"""Retrain AuraZ on PhysioNet/CinC Challenge 2019 (real ICU data, open access).

1. Download training_setA + training_setB from https://physionet.org/content/challenge-2019/1.0.0/
   into data/physionet2019/ (one .psv file per patient, ~40k patients).
2. python3 ml/train_physionet.py
   -> overwrites public/model.json, metrics.json, replay.json, ward.json (same schema as ml/train.py)

Reuses the exact feature, alerting and conformal code from ml/train.py so the UI needs no changes.
"""
import glob, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import train as T  # noqa: E402  (feature code, alerting, conformal, export)

SRC = os.environ.get("AURAZ_PHYSIONET_DIR", os.path.join(os.path.dirname(__file__), "..", "data", "physionet2019"))
COLS = {"HR": "hr", "MAP": "map", "SBP": "sbp", "Resp": "rr", "Temp": "temp", "O2Sat": "spo2", "Lactate": "lactate", "WBC": "wbc"}
NORMAL = dict(hr=80, map=85, sbp=120, rr=16, temp=36.9, spo2=97, lactate=1.2, wbc=8)

def load(path):
    rows = [l.rstrip("\n").split("|") for l in open(path)]
    head, data = rows[0], rows[1:]
    if len(data) < 12:
        return None
    col = {h: i for i, h in enumerate(head)}
    v = {}
    for src, dst in COLS.items():
        x = np.array([float(r[col[src]]) if r[col[src]] != "NaN" else np.nan for r in data])
        # forward-fill, then back-fill, then population normal
        for i in range(1, len(x)):
            if np.isnan(x[i]): x[i] = x[i - 1]
        first = next((y for y in x if not np.isnan(y)), NORMAL[dst])
        x[np.isnan(x)] = first
        v[dst] = x
    lab = [int(r[col["SepsisLabel"]]) for r in data]
    # Challenge labels are shifted 6 h early; Sepsis-3 onset = first positive label + 6
    onset = lab.index(1) + 6 if 1 in lab else None
    meta = dict(age=float(data[0][col["Age"]]), sex=int(float(data[0][col["Gender"]])))
    return dict(v=v, onset=onset if onset is None or onset < len(data) else None, kind="sepsis" if onset is not None else "none", **meta)

if __name__ == "__main__":
    files = sorted(glob.glob(os.path.join(SRC, "**", "*.psv"), recursive=True))
    if not files:
        sys.exit(f"No .psv files under {SRC}. Download the PhysioNet 2019 training sets first (see docstring).")
    P = [p for p in (load(f) for f in files) if p is not None]
    # Truncate to the 48 h window ml/train.py works with (H)
    P = [dict(p, v={k: a[:T.H] for k, a in p["v"].items()}) for p in P if len(p["v"]["hr"]) >= T.H or p["onset"] is not None]
    P = [p for p in P if len(p["v"]["hr"]) == T.H and (p["onset"] is None or 6 < p["onset"] < T.H)]
    rng = np.random.default_rng(2026); rng.shuffle(P)
    n = len(P); print(f"{n} usable stays, {sum(p['onset'] is not None for p in P)} septic")
    T.cohort_override = (P[: int(.6 * n)], P[int(.6 * n): int(.8 * n)], P[int(.8 * n):])
    T.DATA_LABEL = "PhysioNet/CinC Challenge 2019 (real ICU data, hospitals A+B), patient-level 60/20/20 split."
    T.main()
