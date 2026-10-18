# AuraZ — Explainable, calibrated ICU sepsis early warning for IBM Z

**IBM Z Datathon 2026 · Theme: Technology for Good · Not a medical device**

AuraZ scores ICU vitals every hour and warns clinicians hours before sepsis onset. Each alert comes with a plain-language reason (per-feature contributions) and a statistical uncertainty guarantee (conformal prediction). Inference is designed to run *beside the data* on IBM Z / LinuxONE, so patient data never leaves the hospital.

## What is real in this repo (and what is not)

| Piece | Status |
|---|---|
| Training / calibration / validation pipeline (`ml/train.py`) | **Real, runnable.** Patient-level splits, bootstrap CIs, conformal calibration, alert threshold fixed on a separate cohort |
| Model + live scoring in the browser (`public/model.json`) | **Real.** The dashboard scores held-out patients with the exported model |
| Data | **Simulated** ICU cohort (confounders, sparse labs, atypical presentations). Pipeline retrains unchanged on PhysioNet 2019 / MIMIC-IV once downloaded — numbers will differ |
| Latency Lab | **Measured** on the viewer's CPU. Cloud path is a labelled, adjustable assumption |
| IBM z17 / Telum II | **Measured.** Inference service verified on a real z17 (exact parity, 11,870 scores/s peak, 0.27 ms median). A neural variant (AuraZ-N, AUROC 0.80) runs on the **on-chip NNPA accelerator via zDNN: 33× faster than a CPU loop, AUROC unchanged** (see `docs/NNPA.md`); the accelerator is slower for our tiny logistic model, and the tree model (AuraZ-R) stays on the CPU |
| IBM LinuxONE inference service (`ml/serve.py`) | **Real.** Standard-library Python, runs on s390x with nothing to install; the app's Live Replay and 200-bed Ward score on it once connected, and the IBM Z tab verifies remote = local results |
| Real-data model AuraZ-R (`ml/train_physionet_gbm.py`) | **Real ICU data, 14,635 PhysioNet 2019 stays: AUROC 0.82 pooled (95% CI 0.79–0.84), 0.79 without ICU-time features; about 0.74 when tested on the other hospital.** Uncertainty coverage does not transfer across hospitals. See `docs/REAL_DATA_PILOT.md` and `docs/MODEL_CARD.md` |

## Held-out results (simulated cohort, 3,000 test stays)

| | AuraZ | Classic SIRS ≥ 2 rule |
|---|---|---|
| Septic patients caught early | **75%** | 48% |
| False alerts / 100 patient-days | **11.7** | 47.3 |
| Non-septic patients ever alerted | **19%** | 47% |

AUROC 0.818 (95% CI 0.805–0.832); conformal coverage 89.8% at a 90% target. Interpretable logistic model matches gradient boosting (0.815), so explanations cost no accuracy. Full numbers: `public/metrics.json`.

## Why IBM Z

Sepsis scoring is a streaming, latency-sensitive, privacy-bound workload: exactly where in-transaction inference on the same system that holds the data (Telum II on-chip accelerator, LinuxONE Secure Execution) beats shipping PHI to a cloud API.

## Run

```bash
python3 ml/train.py            # simulated cohort -> public/*.json
python3 ml/train_physionet_gbm.py  # real-data model AuraZ-R (after downloading PhysioNet 2019 into data/physionet2019/)
npm test                       # 18 app tests; python3 -m unittest ml/test_serve.py for the server (incl. FHIR)
npm install && npm run dev     # http://localhost:5174
```

**On IBM LinuxONE** (copy `ml/` and `public/` to the VM, nothing to install):

```bash
python3 ml/serve.py 8080
```

If port 8080 is not reachable, tunnel it: `ssh -N -L 8080:localhost:8080 -i key.pem linux1@<VM-IP>`. Then open the **IBM Z** tab, enter `http://localhost:8080` (or the VM address), and press Connect. Live Replay and Ward now score on the mainframe.

Tabs: **Live Replay** · **Ward** (200 beds) · **Validation** · **IBM Z** · Architecture.

## Verified on IBM LinuxONE

Both models run on the mainframe: the real-data AuraZ-R trees (`POST /score_real`) scored 300 real held-out rows of the final model on the z17 with results identical to sklearn and the browser (maximum difference 0.0), about 150–200 µs per row in pure Python.


Run through the app against a real IBM z17 (Telum II, machine type 9175, `nnpa` flag present) on the LinuxONE Community Cloud: remote scores match the local reference model exactly (max difference 0.0), server-side compute is ~12 µs per request in pure Python, and the 200-bed ward scores in one batch. The ~445 ms median round trip in that test is the network distance to the data centre, which is the argument for scoring beside the data.

## Roadmap
1. AuraZ-R on all 40k PhysioNet stays plus external validation (MIMIC-IV / eICU).
2. Close the AuraZ-N vs AuraZ-R accuracy gap, compare the accelerator with an optimised CPU library, try the IBM Z Deep Learning Compiler.
3. Subgroup fairness audit (age, sex, race) and calibration plots.
