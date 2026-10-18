"""AuraZ-N: a neural-network variant of the real-data model, built to run on the Telum II NNPA accelerator.

    python3 ml/train_physionet_mlp.py   ->   public/metrics_mlp.json  and  build/nnpa/{weights.bin,x.bin,expected.bin,meta.json}

Same patient-level split and 108 features as AuraZ-R (ml/train_physionet_gbm.py); missing values are median-imputed.
Then, on the IBM z17:  ml/nnpa_mlp.c  runs the network on the accelerator, and  scripts/nnpa_eval.py  scores its output.
"""
import glob, json, os, struct, sys, time
import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import roc_auc_score

sys.path.insert(0, os.path.dirname(__file__))
import train_physionet_gbm as G  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.environ.get("AURAZ_OUT", os.path.join(ROOT, "public"))
BUILD = os.path.join(ROOT, "build", "nnpa"); os.makedirs(BUILD, exist_ok=True)
# Hyperparameters chosen on the CALIBRATION split (never the test split): grid over hidden (128,64)/(64,32), alpha 1-30, 6/12 epochs;
# strong L2 (alpha=1) matters because rows from one patient are highly correlated and the network otherwise memorises patients.
HIDDEN, ALPHA, EPOCHS = (64, 32), 1.0, 12

def main():
    t0 = time.time()
    P = [p for p in (G.load(f) for f in sorted(glob.glob(os.path.join(G.SRC, "**", "*.psv"), recursive=True))) if p is not None]
    rng = np.random.default_rng(2026); rng.shuffle(P); n = len(P)  # identical order + split to AuraZ-R
    tr, cal, te = P[: int(.6 * n)], P[int(.6 * n): int(.8 * n)], P[int(.8 * n):]
    F = {k: [G.features(p) for p in S] for k, S in (("tr", tr), ("te", te))}
    Xtr, ytr, _, _ = G.rows(tr, F["tr"]); Xte, yte, pte, _ = G.rows(te, F["te"])
    print(f"{n} stays; train rows {len(ytr)}, test rows {len(yte)}; features {time.time()-t0:.0f}s", flush=True)

    names = G.FEATURES; since = [i for i, f in enumerate(names) if f.endswith("_hours_since")]
    def tf(X):  # tame heavy-tailed columns: "hours since last measured" (999 = never) and ICU-time counters
        X = X.copy()
        for j in since: X[:, j] = np.log1p(np.minimum(X[:, j], 72))
        for j, f in enumerate(names):
            if f in ("ICULOS", "HospAdmTime", "labs_measured_so_far"): X[:, j] = np.sign(X[:, j]) * np.log1p(np.abs(X[:, j]))
        return X
    Ttr = tf(Xtr); med = np.nanmedian(Ttr, 0); med = np.where(np.isnan(med), 0.0, med)
    imp = lambda X: np.where(np.isnan(X), med, X)
    mu = imp(Ttr).mean(0); sd = imp(Ttr).std(0); sd = np.where(sd < 1e-9, 1.0, sd)
    Z = lambda X: np.clip((imp(tf(X)) - mu) / sd, -5, 5).astype(np.float32)
    Ztr, Zte = Z(Xtr), Z(Xte)

    mlp = MLPClassifier(hidden_layer_sizes=HIDDEN, activation="relu", alpha=ALPHA, batch_size=512, learning_rate_init=1e-3,
                        early_stopping=False, max_iter=EPOCHS, random_state=0).fit(Ztr, ytr)
    p_te = mlp.predict_proba(Zte)[:, 1]
    auc = float(roc_auc_score(yte, p_te))
    ids = np.unique(pte); aucs = []
    for _ in range(300):
        s = rng.choice(ids, len(ids)); m = np.concatenate([np.where(pte == i)[0] for i in s])
        if yte[m].min() != yte[m].max(): aucs.append(roc_auc_score(yte[m], p_te[m]))
    print(f"AuraZ-N AUROC {auc:.3f}  ({time.time()-t0:.0f}s, {mlp.n_iter_} epochs)", flush=True)

    # --- export for the accelerator program ---
    with open(os.path.join(BUILD, "weights.bin"), "wb") as f:
        f.write(struct.pack(">i", len(mlp.coefs_)))   # IBM Z (s390x) is BIG-endian: binaries for the accelerator program are written big-endian
        for W, b in zip(mlp.coefs_, mlp.intercepts_):
            f.write(struct.pack(">ii", W.shape[0], W.shape[1])); f.write(W.astype(">f4").tobytes()); f.write(b.astype(">f4").tobytes())
    sub = np.random.default_rng(11).choice(len(yte), 32768, replace=False)  # zDNN limit: 32,768 rows per tensor dimension
    Zs, ys = Zte[sub], yte[sub]; exp = mlp.predict_proba(Zs)[:, 1].astype(np.float32)
    Zs.astype(">f4").tofile(os.path.join(BUILD, "x.bin")); exp.astype("<f4").tofile(os.path.join(BUILD, "expected.bin")); ys.astype(np.int8).tofile(os.path.join(BUILD, "y.bin"))
    json.dump(dict(rows=int(len(sub)), features=int(Zs.shape[1]), layers=[int(W.shape[0]) for W in mlp.coefs_] + [int(mlp.coefs_[-1].shape[1])]),
              open(os.path.join(BUILD, "meta.json"), "w"))
    json.dump(dict(model="AuraZ-N: MLP 108-64-32-1 (ReLU, sigmoid), median-imputed, log-scaled and clipped standardised inputs; hyperparameters chosen on the calibration split", cohorts=dict(train=len(tr), test=len(te), test_septic=sum(p["onset"] is not None for p in te)),
                   auroc=auc, auroc_ci95=[float(np.percentile(aucs, 2.5)), float(np.percentile(aucs, 97.5))], auroc_sklearn_subsample=float(roc_auc_score(ys, exp)),
                   subsample_rows=int(len(sub)), parameters=int(sum(W.size + b.size for W, b in zip(mlp.coefs_, mlp.intercepts_))), epochs=int(mlp.n_iter_),
                   reference="AuraZ-R (gradient-boosted trees) AUROC is in metrics_physionet.json"), open(os.path.join(OUT, "metrics_mlp.json"), "w"), indent=1)
    print("wrote public/metrics_mlp.json and build/nnpa/*")

if __name__ == "__main__":
    main()
