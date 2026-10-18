"""Can a small slice from a NEW hospital repair the uncertainty guarantee?

    python3 ml/recalibrate_physionet.py   ->   public/recalibration.json  (AURAZ_OUT overrides the folder)

Train AuraZ-R on one hospital, calibrate on that hospital (the normal procedure), test on the other: the conformal coverage
breaks (see ml/audit_physionet.py). Here we re-calibrate ONLY the conformal quantiles (the model is NOT retrained) using k stays
from the new hospital, then measure coverage on the remaining stays of that hospital. 20 random draws per k.
"""
import glob, json, os, sys, time
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import train as T  # noqa: E402
import train_physionet_gbm as G  # noqa: E402
import audit_physionet as A  # noqa: E402

OUT = os.environ.get("AURAZ_OUT", G.OUT)
KS = (25, 50, 100, 200, 400)
REPS = 20

def cover(p, y, qp, qn):
    hp, hn = (1 - p) <= qp, p <= qn
    return (float(hp[y == 1].mean()) if (y == 1).any() else None, float(hn[y == 0].mean()), float((hp == hn).mean()))

def main():
    t0 = time.time(); rng = np.random.default_rng(5)
    P = [p for p in (G.load(f) for f in sorted(glob.glob(os.path.join(G.SRC, "**", "*.psv"), recursive=True))) if p is not None]
    for p in P: p["F"] = G.features(p); p["hosp"] = A.hosp(p)
    res = dict(n_stays=len(P), ks=list(KS), reps=REPS, directions={})
    table = lambda S: G.rows(S, [p["F"] for p in S])
    for src, dst in (("A", "B"), ("B", "A")):
        tr, cal, _ = A.split([p for p in P if p["hosp"] == src]); tgt = [p for p in P if p["hosp"] == dst]
        Xtr, ytr, _, _ = table(tr); Xca, yca, _, _ = table(cal)
        gb = A.fit(Xtr, ytr); pca = gb.predict_proba(Xca)[:, 1]
        qp0, qn0 = T.conf_qhat(pca[yca == 1], .1), T.conf_qhat(1 - pca[yca == 0], .1)
        # score every target stay once
        for p in tgt:
            X, y, _, _ = G.rows([p], [p["F"]]); p["_X"], p["_y"] = X, y
            p["_p"] = gb.predict_proba(X)[:, 1] if len(y) else np.array([])
        tgt = [p for p in tgt if len(p["_y"])]
        stack = lambda S, k: np.concatenate([p[k] for p in S])
        sep_idx = np.array([p["onset"] is not None for p in tgt])
        d = dict(target_stays=len(tgt), source_calibration_stays=len(cal), before=dict(zip(("coverage_septic", "coverage_nonseptic", "uncertain_fraction"), cover(stack(tgt, "_p"), stack(tgt, "_y"), qp0, qn0))), after={})
        for k in KS:
            if k >= len(tgt) // 2: continue
            runs = []
            for _ in range(REPS):
                idx = rng.permutation(len(tgt)); rc, ev = [tgt[i] for i in idx[:k]], [tgt[i] for i in idx[k:]]
                pc, yc = stack(rc, "_p"), stack(rc, "_y")
                if (yc == 1).sum() < 5: continue  # too few septic hours to calibrate the septic class
                qp, qn = T.conf_qhat(pc[yc == 1], .1), T.conf_qhat(1 - pc[yc == 0], .1)
                runs.append(cover(stack(ev, "_p"), stack(ev, "_y"), qp, qn))
            if runs:
                a = np.array([[x if x is not None else np.nan for x in r] for r in runs])
                d["after"][str(k)] = dict(draws=len(runs), coverage_septic_mean=float(np.nanmean(a[:, 0])), coverage_septic_sd=float(np.nanstd(a[:, 0])),
                                          coverage_nonseptic_mean=float(a[:, 1].mean()), coverage_nonseptic_sd=float(a[:, 1].std()), uncertain_fraction_mean=float(a[:, 2].mean()))
        res["directions"][f"train_{src}_test_{dst}"] = d
        print(src, "->", dst, "before", {k: round(v, 3) for k, v in d["before"].items() if v is not None}, "k=100:", d["after"].get("100"), flush=True)
    res["runtime_s"] = round(time.time() - t0, 1)
    json.dump(res, open(os.path.join(OUT, "recalibration.json"), "w"), indent=1, allow_nan=False)
    print("wrote recalibration.json")

if __name__ == "__main__":
    main()
