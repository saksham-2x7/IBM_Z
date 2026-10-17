"""AuraZ model pipeline: simulate ICU cohort -> train -> calibrate (conformal) -> validate -> export.

Data is a SIMULATED cohort (clinically parameterised, with confounders and sparse labs).
The same pipeline runs unchanged on PhysioNet 2019 / MIMIC-IV once loaded into `Cohort`.
Run:  python3 ml/train.py     (writes public/model.json, public/metrics.json, public/replay.json)
"""
import json, os, time
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score, average_precision_score, roc_curve

rng = np.random.default_rng(2026)
OUT = os.environ.get("AURAZ_OUT", os.path.join(os.path.dirname(__file__), "..", "public"))
cohort_override = None  # (train, calibration, test) lists of patients; set by ml/train_physionet.py
DATA_LABEL = "Simulated ICU cohort (clinically parameterised; confounders + sparse labs). Not real patients."
H = 48
CH = ["hr", "map", "sbp", "rr", "temp", "spo2", "lactate", "wbc"]

def ar1(n, sd, phi=0.8):
    x = np.zeros(n); e = rng.normal(0, sd, n)
    for i in range(1, n): x[i] = phi * x[i-1] + e[i]
    return x

def simulate_patient(septic, kind):
    t = np.arange(H)
    b = dict(hr=rng.normal(78, 10), map=rng.normal(86, 8), rr=rng.normal(16, 2),
             temp=rng.normal(36.8, .3), spo2=rng.normal(97, 1.2), lactate=abs(rng.normal(1.1, .3)), wbc=rng.normal(8, 2))
    v = {c: np.full(H, b[c]) for c in ["hr", "map", "rr", "temp", "spo2", "lactate", "wbc"]}
    onset = None
    if septic:
        onset = int(rng.integers(14, 44)); sev = rng.uniform(.4, 1.2)
        ramp = np.clip((t - (onset - 7)) / 9, 0, 1) ** 1.5 * sev
        w = {c: rng.uniform(.5, 1.5) for c in v}
        w[rng.choice(list(v))] = 0.0 if rng.random() < .3 else w[list(v)[0]]  # atypical presentation
        for c, d in dict(hr=30, map=-18, rr=8, temp=1.3, spo2=-4, lactate=2.2, wbc=7).items():
            v[c] = v[c] + w[c] * d * ramp
    else:
        s = rng.uniform(.5, 1.4); decay = np.exp(-t / rng.uniform(15, 45))
        if kind == "postop":   v["hr"] += 15*s*decay; v["rr"] += 3*s*decay; v["wbc"] += 3*s*decay
        if kind == "hypovol":  v["map"] -= 11*s*decay; v["hr"] += 20*s*decay; v["lactate"] += .9*s*decay
        if kind == "fever":    v["temp"] += 1.5*s*decay; v["wbc"] += 4*s*decay; v["hr"] += 10*s*decay
    for c, sd in dict(hr=3.8, map=4.2, rr=1.5, temp=.2, spo2=.85, lactate=.16, wbc=.65).items():
        v[c] = v[c] + ar1(H, sd)
    v["sbp"] = v["map"] * 1.38 + 4 + rng.normal(0, 3, H)
    v["spo2"] = np.clip(v["spo2"], 80, 100)
    return v, onset

def cohort(n):
    P = []
    for i in range(n):
        septic = rng.random() < .13
        kind = "sepsis" if septic else rng.choice(["none", "postop", "hypovol", "fever"], p=[.45, .18, .18, .19])
        v, onset = simulate_patient(septic, kind)
        obs = {c: v[c].copy() for c in CH}
        for c in ("lactate", "wbc"):  # labs drawn every 4h, forward-filled
            for h in range(H):
                if h % 4: obs[c][h] = obs[c][h-1]
        P.append(dict(v=obs, onset=onset, kind=str(kind)))
    return P

FEATS = ["hr", "map", "sbp", "rr", "temp", "spo2", "lactate", "wbc", "shock_index",
         "hr_d3", "map_d3", "rr_d3", "temp_d3", "lactate_d6", "map_min6", "hr_max6"]

def feat(v, h):
    g = lambda c, k=0: v[c][h-k]
    return [g("hr"), g("map"), g("sbp"), g("rr"), g("temp"), g("spo2"), g("lactate"), g("wbc"), g("hr")/g("sbp"),
            g("hr")-g("hr", 3), g("map")-g("map", 3), g("rr")-g("rr", 3), g("temp")-g("temp", 3), g("lactate")-g("lactate", 6),
            v["map"][h-5:h+1].min(), v["hr"][h-5:h+1].max()]

def table(P):
    X, y, pid, hh = [], [], [], []
    for i, p in enumerate(P):
        n = len(p["v"]["hr"])
        end = n if p["onset"] is None else min(n, p["onset"])  # drop post-onset hours
        for h in range(6, end):
            X.append(feat(p["v"], h)); pid.append(i); hh.append(h)
            y.append(int(p["onset"] is not None and 0 < p["onset"] - h <= 6))
    return np.array(X), np.array(y), np.array(pid), np.array(hh)

def sirs_rule(v, h):  # baseline: classic SIRS>=2 rule
    s = int(v["hr"][h] > 90) + int(v["rr"][h] > 20) + int(v["temp"][h] > 38 or v["temp"][h] < 36) + int(v["wbc"][h] > 12)
    return s >= 2

def alerts(P, score_fn, refractory=12):
    """Patient-level: first alert per patient, then re-arm after `refractory` h (non-septic only counts false alerts)."""
    out = []
    for p in P:
        n = len(p["v"]["hr"])
        end = n if p["onset"] is None else min(n, p["onset"])
        fired = [h for h in range(6, end) if score_fn(p, h)]
        first = fired[0] if fired else None
        n_false = 0; last = -99
        for h in fired:
            if h - last >= refractory: n_false += 1; last = h
        out.append((first, n_false, end - 6))
    return out

def summarize(P, res):
    sep = [(p, r) for p, r in zip(P, res) if p["onset"] is not None]
    non = [(p, r) for p, r in zip(P, res) if p["onset"] is None]
    caught = [(p["onset"] - r[0]) for p, r in sep if r[0] is not None]
    pdays = sum(r[2] for _, r in non) / 24
    return dict(sensitivity=len(caught) / len(sep), median_lead_h=float(np.median(caught)) if caught else 0,
                false_alerts_per_100_patient_days=100 * sum(r[1] for _, r in non) / pdays,
                pct_nonseptic_patients_alerted=100 * np.mean([r[1] > 0 for _, r in non]))

def conf_qhat(p_true_cal, alpha):
    n = len(p_true_cal); s = 1 - p_true_cal
    return float(np.quantile(s, min(1, np.ceil((n + 1) * (1 - alpha)) / n), method="higher"))

def main():
    t0 = time.time()
    tr, cal, te = cohort_override or (cohort(5000), cohort(1500), cohort(3000))
    Xtr, ytr, _, _ = table(tr); Xca, yca, _, _ = table(cal); Xte, yte, pte, hte = table(te)
    mu, sd = Xtr.mean(0), Xtr.std(0) + 1e-9
    Z = lambda X: (X - mu) / sd
    lr = LogisticRegression(C=1.0, max_iter=2000, class_weight=None).fit(Z(Xtr), ytr)
    gb = HistGradientBoostingClassifier(max_depth=4, learning_rate=.08, max_iter=250, random_state=0).fit(Xtr, ytr)
    pte_lr, pte_gb = lr.predict_proba(Z(Xte))[:, 1], gb.predict_proba(Xte)[:, 1]

    # patient-bootstrap CI for AUROC (LR)
    ids = np.unique(pte); aucs = []
    for _ in range(200):
        s = rng.choice(ids, len(ids)); m = np.concatenate([np.where(pte == i)[0] for i in s])
        if yte[m].min() != yte[m].max(): aucs.append(roc_auc_score(yte[m], pte_lr[m]))
    fpr, tpr, _ = roc_curve(yte, pte_lr); k = np.linspace(0, len(fpr) - 1, 60).astype(int)

    # conformal (split) on calibration table, alpha = 0.10
    pca = lr.predict_proba(Z(Xca))[:, 1]; alpha = .10
    qhat = conf_qhat(np.where(yca == 1, pca, 1 - pca), alpha)
    in_set = lambda p, y: (1 - (p if y == 1 else 1 - p)) <= qhat
    cover = np.mean([in_set(p, y) for p, y in zip(pte_lr, yte)])
    amb = np.mean([((1 - p) <= qhat) and (p <= qhat) for p in pte_lr])

    # alert threshold chosen on calibration cohort under a false-alert budget
    score = lambda p, h: float(lr.predict_proba(Z(np.array([feat(p["v"], h)])))[0, 1])
    cache = {}
    def sc(p, h):
        k_ = (id(p), h)
        if k_ not in cache: cache[k_] = score(p, h)
        return cache[k_]
    thr, BUDGET = .95, 15.0  # most sensitive threshold within a false-alert budget (alerts / 100 patient-days)
    for t in np.concatenate([np.arange(.95, .05, -.025), np.geomspace(.05, .002, 24)]):
        r = summarize(cal, alerts(cal, lambda p, h: sc(p, h) >= t))
        if r["false_alerts_per_100_patient_days"] > BUDGET: break
        thr = float(t)
    ours = summarize(te, alerts(te, lambda p, h: sc(p, h) >= thr))
    base = summarize(te, alerts(te, lambda p, h: sirs_rule(p["v"], h)))
    # lead-time distribution
    leads = [p["onset"] - r[0] for p, r in zip(te, alerts(te, lambda p, h: sc(p, h) >= thr)) if p["onset"] is not None and r[0] is not None]

    # SHAP-exact attribution for LR = coef * z ; mean |contribution| global importance
    imp = np.abs(Z(Xte) * lr.coef_[0]).mean(0)
    json.dump(dict(features=FEATS, mean=mu.tolist(), std=sd.tolist(), coef=lr.coef_[0].tolist(),
                   intercept=float(lr.intercept_[0]), qhat=qhat, alpha=alpha, alert_threshold=thr),
              open(f"{OUT}/model.json", "w"))
    metrics = dict(
        data=DATA_LABEL,
        cohorts=dict(train=len(tr), calibration=len(cal), test=len(te), test_septic=sum(p["onset"] is not None for p in te)),
        task="Predict Sepsis-3 onset within the next 6 h, scored hourly",
        auroc=float(roc_auc_score(yte, pte_lr)), auroc_ci95=[float(np.percentile(aucs, 2.5)), float(np.percentile(aucs, 97.5))],
        auprc=float(average_precision_score(yte, pte_lr)), prevalence=float(yte.mean()),
        auroc_gbm_comparison=float(roc_auc_score(yte, pte_gb)),
        conformal=dict(alpha=alpha, target_coverage=1 - alpha, empirical_coverage=float(cover), uncertain_fraction=float(amb)),
        alerting=dict(threshold=thr, false_alert_budget_per_100_patient_days=BUDGET, model=ours, baseline_sirs_rule=base),
        lead_time_hist=np.histogram(leads, bins=range(0, 12))[0].tolist(),
        roc=dict(fpr=fpr[k].round(4).tolist(), tpr=tpr[k].round(4).tolist()),
        feature_importance=sorted(zip(FEATS, imp.round(4).tolist()), key=lambda x: -x[1]),
        runtime_s=round(time.time() - t0, 1))
    json.dump(metrics, open(f"{OUT}/metrics.json", "w"), indent=1)

    # replay patients (held-out) for the live demo
    pick = []
    for want, n in (("sepsis", 4), ("none", 2), ("postop", 1), ("hypovol", 1)):
        pick += [p for p in te if p["kind"] == want][:n]
    pick = pick or te[:8]
    ward = None
    json.dump([dict(id=f"TEST-{i+1:02d}", kind=p["kind"], onset=p["onset"],
                    vitals={c: np.round(p["v"][c], 2).tolist() for c in CH}) for i, p in enumerate(pick)],
              open(f"{OUT}/replay.json", "w"))
    # ward: 200 held-out stays for the multi-bed view (patients 100..299 of the test cohort)
    ward = te[100:300]
    if cohort_override: ward = []  # real-data run: variable-length stays; UI ward/replay assume 48 h
    json.dump([dict(id=f"BED-{i+1:03d}", onset=p["onset"], kind=p["kind"],
                    vitals={c: np.round(p["v"][c], 1).tolist() for c in CH}) for i, p in enumerate(ward)],
              open(f"{OUT}/ward.json", "w"), separators=(",", ":"))
    print(json.dumps({k: metrics[k] for k in ("auroc", "auroc_ci95", "auroc_gbm_comparison", "conformal", "alerting")}, indent=1))

if __name__ == "__main__":
    main()
