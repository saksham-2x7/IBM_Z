"""AuraZ-R: the real-data model. Gradient boosting on all PhysioNet 2019 variables + measurement-recency features.

    python3 ml/train_physionet_gbm.py
      -> public/model_physionet.json    (trees, exportable; scored by ml/serve.py and src/lib/gbm.ts with no dependencies)
      -> public/metrics_physionet.json  (held-out metrics vs the logistic baseline and the SIRS rule)
      -> public/physionet_samples.json  (held-out feature rows + reference probabilities, for parity tests)

Uses the same patient-level 60/20/20 split as ml/train_physionet.py (same files, same seed) so results compare 1:1.
PhysioNet/CinC Challenge 2019 data: Reyna et al., Crit Care Med 2020; CC BY 4.0.
"""
import glob, json, math, os, sys, time
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, average_precision_score, roc_curve

sys.path.insert(0, os.path.dirname(__file__))
import train as T  # noqa: E402  (alerting, SIRS baseline, conformal quantile)

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get("AURAZ_PHYSIONET_DIR", os.path.join(ROOT, "..", "data", "physionet2019"))
OUT = os.environ.get("AURAZ_OUT", os.path.join(ROOT, "..", "public"))

VARS = ["HR", "O2Sat", "Temp", "SBP", "MAP", "DBP", "Resp", "EtCO2", "BaseExcess", "HCO3", "FiO2", "pH", "PaCO2", "SaO2",
        "AST", "BUN", "Alkalinephos", "Calcium", "Chloride", "Creatinine", "Bilirubin_direct", "Glucose", "Lactate",
        "Magnesium", "Phosphate", "Potassium", "Bilirubin_total", "TroponinI", "Hct", "Hgb", "PTT", "WBC", "Fibrinogen", "Platelets"]
VITALS = VARS[:8]
ROLL = ["HR", "O2Sat", "Temp", "SBP", "MAP", "Resp"]
DEMO = ["Age", "Gender", "HospAdmTime", "ICULOS"]
NORMAL = dict(HR=80, Resp=16, Temp=36.9, WBC=8)
NEVER = 999.0  # "hours since last measurement" when a variable was never measured

FEATURES = ([f"{v}" for v in VARS] + [f"{v}_hours_since" for v in VARS] +
            [f"{v}_d3" for v in VITALS] + [f"{v}_d6" for v in VITALS] +
            [f"{v}_{s}6" for v in ROLL for s in ("min", "max", "mean")] +
            ["shock_index", "labs_measured_so_far"] + DEMO)

def load(path):
    rows = [l.rstrip("\n").split("|") for l in open(path)]
    head, data = rows[0], rows[1:]
    if len(data) < 12:
        return None  # identical filter to ml/train_physionet.py
    col = {h: i for i, h in enumerate(head)}
    num = lambda s: float(s) if s != "NaN" else np.nan
    raw = np.array([[num(r[col[v]]) for v in VARS] for r in data])
    demo = np.array([[num(r[col[d]]) for d in DEMO] for r in data])
    lab = [int(r[col["SepsisLabel"]]) for r in data]
    onset = lab.index(1) + 6 if 1 in lab else None
    return dict(raw=raw, demo=demo, onset=onset, n=len(data), file=os.path.basename(path))

def ffill(a):
    out = a.copy()
    for i in range(1, len(out)):
        m = np.isnan(out[i]); out[i, m] = out[i - 1, m]
    return out

def features(p):
    """All-hours feature matrix (n x len(FEATURES)); NaN = not yet measured."""
    raw, n = p["raw"], p["n"]
    ff = ffill(raw)
    since = np.full(raw.shape, NEVER)
    last = np.full(raw.shape[1], -1)
    for h in range(n):
        last = np.where(~np.isnan(raw[h]), h, last)
        since[h] = np.where(last >= 0, h - last, NEVER)
    iv = [VARS.index(v) for v in VITALS]
    lag = lambda k: np.vstack([np.full((k, raw.shape[1]), np.nan), ff[:-k]]) if n > k else np.full_like(ff, np.nan)
    d3, d6 = (ff - lag(3))[:, iv], (ff - lag(6))[:, iv]
    roll = []
    for v in ROLL:
        x = ff[:, VARS.index(v)]
        win = np.array([x[max(0, h - 5):h + 1] for h in range(n)], dtype=object)
        for fn in (np.nanmin, np.nanmax, np.nanmean):
            roll.append([fn(w) if np.any(~np.isnan(w)) else np.nan for w in win])
    roll = np.array(roll).T
    si = ff[:, VARS.index("HR")] / ff[:, VARS.index("SBP")]
    labs = np.cumsum((~np.isnan(raw[:, 8:])).sum(1))
    return np.column_stack([ff, since, d3, d6, roll, si, labs, p["demo"]])

def sirs_view(p):
    """Forward-filled HR/RR/Temp/WBC with normal defaults, in the format T.sirs_rule expects."""
    ff = ffill(p["raw"])
    v = {}
    for name, key in (("HR", "hr"), ("Resp", "rr"), ("Temp", "temp"), ("WBC", "wbc")):
        x = ff[:, VARS.index(name)].copy(); x[np.isnan(x)] = NORMAL[name]; v[key] = x
    return v

def rows(P, F):
    X, y, pid, hh = [], [], [], []
    for i, p in enumerate(P):
        end = p["n"] if p["onset"] is None else min(p["n"], p["onset"])
        for h in range(6, end):
            X.append(F[i][h]); pid.append(i); hh.append(h)
            y.append(int(p["onset"] is not None and 0 < p["onset"] - h <= 6))
    return np.array(X), np.array(y), np.array(pid), np.array(hh)

def export_trees(gb):
    trees = []
    for it in gb._predictors:
        nd = it[0].nodes
        # JSON has no Infinity: leaves never use a threshold; +/-inf split thresholds become +/-1e308 (same comparisons)
        thr = [0.0 if leaf else (float(x) if np.isfinite(x) else math.copysign(1e308, x))
               for x, leaf in zip(nd["num_threshold"], nd["is_leaf"])]
        trees.append(dict(f=nd["feature_idx"].tolist(), t=thr,
                          l=nd["left"].tolist(), r=nd["right"].tolist(), v=[float(x) for x in nd["value"]],
                          m=nd["missing_go_to_left"].astype(int).tolist(), leaf=nd["is_leaf"].astype(int).tolist()))
    return dict(kind="gradient_boosting", features=FEATURES, baseline=float(np.ravel(gb._baseline_prediction)[0]), trees=trees)

def score_exported(m, x):
    """Reference stdlib scorer (same logic as ml/serve.py and src/lib/gbm.ts)."""
    z = m["baseline"]
    for t in m["trees"]:
        i = 0
        while not t["leaf"][i]:
            xi = x[t["f"][i]]
            go_left = t["m"][i] if (xi is None or (isinstance(xi, float) and math.isnan(xi))) else xi <= t["t"][i]
            i = t["l"][i] if go_left else t["r"][i]
        z += t["v"][i]
    return 1 / (1 + math.exp(-z))

def main():
    t0 = time.time()
    files = sorted(glob.glob(os.path.join(SRC, "**", "*.psv"), recursive=True))
    P = [p for p in (load(f) for f in files) if p is not None]
    rng = np.random.default_rng(2026); rng.shuffle(P)  # same order + seed as ml/train_physionet.py
    n = len(P)
    tr, cal, te = P[: int(.6 * n)], P[int(.6 * n): int(.8 * n)], P[int(.8 * n):]
    print(f"{n} stays ({sum(p['onset'] is not None for p in P)} septic): train {len(tr)} / cal {len(cal)} / test {len(te)}", flush=True)
    F = {k: [features(p) for p in S] for k, S in (("tr", tr), ("cal", cal), ("te", te))}
    Xtr, ytr, _, _ = rows(tr, F["tr"]); Xca, yca, pca_id, hca = rows(cal, F["cal"]); Xte, yte, pte, hte = rows(te, F["te"])
    print(f"rows: train {len(ytr)} ({ytr.mean():.3%} positive), test {len(yte)}; {len(FEATURES)} features; {time.time()-t0:.0f}s", flush=True)

    gb = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_leaf_nodes=15, min_samples_leaf=100,
                                        l2_regularization=1.0, early_stopping=False, random_state=0).fit(Xtr, ytr)
    p_ca, p_te = gb.predict_proba(Xca)[:, 1], gb.predict_proba(Xte)[:, 1]

    # same-feature logistic baseline (median-imputed, standardised) to separate "more features" from "trees"
    med = np.nanmedian(Xtr, 0); med = np.where(np.isnan(med), 0, med)
    imp = lambda X: np.where(np.isnan(X), med, X)
    mu, sd = imp(Xtr).mean(0), imp(Xtr).std(0) + 1e-9
    lr = LogisticRegression(C=0.1, max_iter=3000).fit((imp(Xtr) - mu) / sd, ytr)
    auc_lr_rich = roc_auc_score(yte, lr.predict_proba((imp(Xte) - mu) / sd)[:, 1])

    # ablations: does the gain survive without ICU-time and measurement-recency features (possible shortcuts)?
    def ablate(keep):
        cols = [i for i, f in enumerate(FEATURES) if keep(f)]
        g = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_leaf_nodes=15, min_samples_leaf=100,
                                           l2_regularization=1.0, early_stopping=False, random_state=0).fit(Xtr[:, cols], ytr)
        return float(roc_auc_score(yte, g.predict_proba(Xte[:, cols])[:, 1]))
    no_time = lambda f: f not in ("ICULOS", "HospAdmTime")
    ablations = dict(without_icu_time=ablate(no_time),
                     without_icu_time_and_recency=ablate(lambda f: no_time(f) and not f.endswith("_hours_since") and f != "labs_measured_so_far"))

    ids = np.unique(pte); aucs = []
    for _ in range(300):
        s = rng.choice(ids, len(ids)); msk = np.concatenate([np.where(pte == i)[0] for i in s])
        if yte[msk].min() != yte[msk].max(): aucs.append(roc_auc_score(yte[msk], p_te[msk]))

    alpha = .10
    q_pos = T.conf_qhat(p_ca[yca == 1], alpha); q_neg = T.conf_qhat(1 - p_ca[yca == 0], alpha)
    has_pos, has_neg = (1 - p_te) <= q_pos, p_te <= q_neg

    # hourly predictions per patient for the alerting simulation
    def pred_map(S, Fs):
        out = []
        for p, Fi in zip(S, Fs):
            v = np.full(p["n"], np.nan); end = p["n"] if p["onset"] is None else min(p["n"], p["onset"])
            if end > 6: v[6:end] = gb.predict_proba(Fi[6:end])[:, 1]
            out.append(v)
        return out
    for S in (cal, te):
        for p in S: p["v"] = sirs_view(p)
    pm_cal, pm_te = pred_map(cal, F["cal"]), pred_map(te, F["te"])
    for S, pm in ((cal, pm_cal), (te, pm_te)):
        for p, v in zip(S, pm): p["_pred"] = v
    thr, BUDGET = .95, 15.0
    for t in np.concatenate([np.arange(.95, .05, -.025), np.geomspace(.05, .002, 24)]):
        r = T.summarize(cal, T.alerts(cal, lambda p, h: p["_pred"][h] >= t))
        if r["false_alerts_per_100_patient_days"] > BUDGET: break
        thr = float(t)
    ours = T.summarize(te, T.alerts(te, lambda p, h: p["_pred"][h] >= thr))
    base = T.summarize(te, T.alerts(te, lambda p, h: T.sirs_rule(p["v"], h)))
    # SIRS-matched comparison: AuraZ-R threshold that alerts at the SAME false-alert rate as SIRS
    match = None
    for t in np.geomspace(.5, .001, 80):
        r = T.summarize(te, T.alerts(te, lambda p, h: p["_pred"][h] >= t))
        if r["false_alerts_per_100_patient_days"] >= base["false_alerts_per_100_patient_days"]:
            match = dict(threshold=float(t), **r); break

    # permutation-free importance proxy: total split gain per feature
    gain = np.zeros(len(FEATURES))
    for it in gb._predictors:
        nd = it[0].nodes
        for f, g, leaf in zip(nd["feature_idx"], nd["gain"], nd["is_leaf"]):
            if not leaf: gain[f] += g
    top = sorted(zip(FEATURES, (gain / gain.sum()).round(4).tolist()), key=lambda x: -x[1])[:12]

    model = export_trees(gb); model.update(qhat_pos=q_pos, qhat_neg=q_neg, alpha=alpha, alert_threshold=thr)
    sample_idx = rng.choice(len(yte), 300, replace=False)
    sample = [[None if np.isnan(v) else float(v) for v in Xte[i]] for i in sample_idx]
    ref = gb.predict_proba(Xte[sample_idx])[:, 1]
    parity = max(abs(score_exported(model, x) - r) for x, r in zip(sample, ref))
    assert parity < 1e-9, f"exported scorer disagrees with sklearn by {parity}"

    fpr, tpr, _ = roc_curve(yte, p_te); k = np.linspace(0, len(fpr) - 1, 60).astype(int)
    metrics = dict(
        data="PhysioNet/CinC Challenge 2019 (real ICU data), 5,126-file sample of hospitals A+B, patient-level 60/20/20 split.",
        model="AuraZ-R: gradient boosting, 300 trees, all 34 clinical variables + measurement recency + trends + demographics",
        task="Predict Sepsis-3 onset within the next 6 h, scored hourly",
        cohorts=dict(train=len(tr), calibration=len(cal), test=len(te), test_septic=sum(p["onset"] is not None for p in te)),
        n_features=len(FEATURES), auroc=float(roc_auc_score(yte, p_te)),
        auroc_ci95=[float(np.percentile(aucs, 2.5)), float(np.percentile(aucs, 97.5))],
        auprc=float(average_precision_score(yte, p_te)), prevalence=float(yte.mean()),
        baselines=dict(logistic_16_features=0.608, logistic_same_rich_features=float(auc_lr_rich)), ablations=ablations,
        conformal=dict(method="class-conditional split conformal", alpha=alpha, target_coverage=1 - alpha,
                       coverage_septic_hours=float(has_pos[yte == 1].mean()), coverage_nonseptic_hours=float(has_neg[yte == 0].mean()),
                       empirical_coverage=float(np.where(yte == 1, has_pos, has_neg).mean()),
                       uncertain_fraction=float((has_pos == has_neg).mean()), qhat_pos=q_pos, qhat_neg=q_neg),
        alerting=dict(threshold=thr, false_alert_budget_per_100_patient_days=BUDGET, model=ours, baseline_sirs_rule=base,
                      model_at_sirs_false_alert_rate=match),
        roc=dict(fpr=fpr[k].round(4).tolist(), tpr=tpr[k].round(4).tolist()),
        top_features_by_gain=top, export_parity_max_abs_diff=float(parity), runtime_s=round(time.time() - t0, 1),
        sample_note="Reproduce: download the PhysioNet 2019 training sets into data/physionet2019/ and run ml/train_physionet_gbm.py.")
    json.dump(model, open(f"{OUT}/model_physionet.json", "w"), separators=(",", ":"), allow_nan=False)
    json.dump(metrics, open(f"{OUT}/metrics_physionet.json", "w"), indent=1, allow_nan=False)
    sample = [[v if v is None or math.isfinite(v) else None for v in r] for r in sample]
    json.dump(dict(features=FEATURES, rows=sample, expected=ref.tolist()), open(f"{OUT}/physionet_samples.json", "w"), separators=(",", ":"), allow_nan=False)
    print(json.dumps({k: metrics[k] for k in ("auroc", "auroc_ci95", "auprc", "baselines", "ablations", "conformal", "alerting", "top_features_by_gain")}, indent=1))

if __name__ == "__main__":
    main()
