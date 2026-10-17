"""External validation + fairness audit for AuraZ-R on PhysioNet 2019.

    python3 ml/audit_physionet.py   ->   public/audit_physionet.json

1. Cross-hospital: train on hospital A, test on hospital B (and the reverse). PhysioNet sets A and B come from
   different hospitals, so this is a genuine external test with no credentialed data needed.
2. Subgroups: AUROC, alert rate and conformal coverage by sex and age band on the held-out split.
"""
import glob, json, os, sys, time
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score

sys.path.insert(0, os.path.dirname(__file__))
import train as T  # noqa: E402
import train_physionet_gbm as G  # noqa: E402

OUT = os.environ.get("AURAZ_OUT", G.OUT)
hosp = lambda p: "B" if p["file"].startswith("p1") else "A"
class Fit:
    """HistGradientBoosting that ignores columns with <2 distinct observed values in the training data
    (e.g. a variable one hospital never measures)."""
    def __init__(self, X, y):
        self.cols = [j for j in range(X.shape[1]) if len(np.unique(X[:, j][~np.isnan(X[:, j])])) >= 2]
        self.m = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_leaf_nodes=15, min_samples_leaf=100,
                                                l2_regularization=1.0, early_stopping=False, random_state=0).fit(X[:, self.cols], y)
    def predict_proba(self, X): return self.m.predict_proba(X[:, self.cols])
fit = Fit

def split(P, seed=2026):
    rng = np.random.default_rng(seed); P = list(P); rng.shuffle(P); n = len(P)
    return P[: int(.6 * n)], P[int(.6 * n): int(.8 * n)], P[int(.8 * n):]

def boot_ci(y, p, pid, rng, B=300):
    ids = np.unique(pid); a = []
    idx = {i: np.where(pid == i)[0] for i in ids}
    for _ in range(B):
        m = np.concatenate([idx[i] for i in rng.choice(ids, len(ids))])
        if y[m].min() != y[m].max(): a.append(roc_auc_score(y[m], p[m]))
    return [float(np.percentile(a, 2.5)), float(np.percentile(a, 97.5))] if a else [None, None]

def conformal(p_cal, y_cal, p_te, y_te, alpha=.10):
    qp, qn = T.conf_qhat(p_cal[y_cal == 1], alpha), T.conf_qhat(1 - p_cal[y_cal == 0], alpha)
    hp, hn = (1 - p_te) <= qp, p_te <= qn
    return dict(coverage_septic_hours=float(hp[y_te == 1].mean()) if (y_te == 1).any() else None,
                coverage_nonseptic_hours=float(hn[y_te == 0].mean()), uncertain_fraction=float((hp == hn).mean()))

def main():
    t0 = time.time(); rng = np.random.default_rng(7)
    P = [p for p in (G.load(f) for f in sorted(glob.glob(os.path.join(G.SRC, "**", "*.psv"), recursive=True))) if p is not None]
    for p in P: p["F"] = G.features(p); p["hosp"] = hosp(p)
    print(f"{len(P)} stays, A={sum(p['hosp']=='A' for p in P)} B={sum(p['hosp']=='B' for p in P)}, features {time.time()-t0:.0f}s", flush=True)
    res = dict(n_stays=len(P), septic=sum(p["onset"] is not None for p in P))

    def table(S): return G.rows(S, [p["F"] for p in S])
    # 1. cross-hospital
    res["cross_hospital"] = {}
    for src, dst in (("A", "B"), ("B", "A")):
        tr, cal, _ = split([p for p in P if p["hosp"] == src]); te = [p for p in P if p["hosp"] == dst]
        Xtr, ytr, _, _ = table(tr); Xca, yca, _, _ = table(cal); Xte, yte, pte, _ = table(te)
        gb = fit(Xtr, ytr); pc, pt = gb.predict_proba(Xca)[:, 1], gb.predict_proba(Xte)[:, 1]
        res["cross_hospital"][f"train_{src}_test_{dst}"] = dict(
            train_stays=len(tr), test_stays=len(te), test_septic=sum(p["onset"] is not None for p in te),
            auroc=float(roc_auc_score(yte, pt)), auroc_ci95=boot_ci(yte, pt, pte, rng), conformal=conformal(pc, yca, pt, yte))
        print("cross", src, "->", dst, round(res["cross_hospital"][f"train_{src}_test_{dst}"]["auroc"], 3), flush=True)
    # within-hospital reference (same split, same model family)
    tr, cal, te = split(P)
    Xtr, ytr, _, _ = table(tr); Xca, yca, _, _ = table(cal); Xte, yte, pte, hte = table(te)
    gb = fit(Xtr, ytr); pc, pt = gb.predict_proba(Xca)[:, 1], gb.predict_proba(Xte)[:, 1]
    res["pooled_split"] = dict(test_stays=len(te), test_septic=sum(p["onset"] is not None for p in te), auroc=float(roc_auc_score(yte, pt)),
                               auroc_ci95=boot_ci(yte, pt, pte, rng), conformal=conformal(pc, yca, pt, yte))
    # 2. subgroup audit on the pooled held-out split
    age = np.array([te[i]["demo"][0, 0] for i in pte]); sex = np.array([te[i]["demo"][0, 1] for i in pte])
    groups = {"sex=female": sex == 0, "sex=male": sex == 1, "age<50": age < 50, "age 50-64": (age >= 50) & (age < 65),
              "age 65-74": (age >= 65) & (age < 75), "age>=75": age >= 75}
    thr = float(np.quantile(pt, 1 - 0.05))  # common operating point: alert the top 5% of patient-hours, same cut-off for every group
    qp, qn = T.conf_qhat(pc[yca == 1], .1), T.conf_qhat(1 - pc[yca == 0], .1)
    res["subgroups"] = {"operating_point": f"alert if risk >= {thr:.4f} (top 5% of all held-out patient-hours)"}
    for name, m in groups.items():
        if m.sum() < 200 or len(np.unique(yte[m])) < 2:
            res["subgroups"][name] = dict(rows=int(m.sum()), note="too few positives for a stable estimate"); continue
        ids = np.unique(pte[m]); sep = int(sum(te[i]["onset"] is not None for i in ids))
        hp, hn = (1 - pt[m]) <= qp, pt[m] <= qn
        res["subgroups"][name] = dict(stays=int(len(ids)), septic_stays=sep, auroc=float(roc_auc_score(yte[m], pt[m])),
                                      auroc_ci95=boot_ci(yte[m], pt[m], pte[m], rng, 200),
                                      alert_rate_pct=float(100 * (pt[m] >= thr).mean()),
                                      sensitivity_hour_pct=float(100 * (pt[m][yte[m] == 1] >= thr).mean()),
                                      coverage_septic_hours=float(hp[yte[m] == 1].mean()), coverage_nonseptic_hours=float(hn[yte[m] == 0].mean()))
    res["runtime_s"] = round(time.time() - t0, 1)
    json.dump(res, open(f"{OUT}/audit_physionet.json", "w"), indent=1, allow_nan=False)
    print(json.dumps({k: res[k] for k in ("cross_hospital", "pooled_split", "subgroups")}, indent=1)[:4000])

if __name__ == "__main__":
    main()
