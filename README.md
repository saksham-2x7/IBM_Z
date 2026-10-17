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
| IBM Z Telum II hardware numbers | **Not yet measured.** Next milestone: LinuxONE Community Cloud + ONNX / zDLC |
| IBM LinuxONE inference service (`ml/serve.py`) | **Real.** Standard-library Python, runs on s390x with nothing to install; the app's Live Replay and 200-bed Ward score on it once connected, and the IBM Z tab verifies remote = local results |
| PhysioNet 2019 retraining (`ml/train_physionet.py`) | **Run on 4,989 real stays (289 septic): AUROC 0.61 (95% CI 0.56–0.65); gradient boosting 0.68. The simulated results do not transfer.** See `docs/REAL_DATA_PILOT.md` |

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
python3 ml/train_physionet.py  # real data (after downloading PhysioNet 2019 into data/physionet2019/)
npm install && npm run dev     # http://localhost:5174
```

**On IBM LinuxONE** (copy `ml/` and `public/` to the VM, nothing to install):

```bash
python3 ml/serve.py 8080
```

If port 8080 is not reachable, tunnel it: `ssh -N -L 8080:localhost:8080 -i key.pem linux1@<VM-IP>`. Then open the **IBM Z** tab, enter `http://localhost:8080` (or the VM address), and press Connect. Live Replay and Ward now score on the mainframe.

Tabs: **Live Replay** · **Ward** (200 beds) · **Validation** · **IBM Z** · Architecture · Submission.

## Verified on IBM LinuxONE

Run through the app against a real IBM z17 (Telum II, machine type 9175, `nnpa` flag present) on the LinuxONE Community Cloud: remote scores match the local reference model exactly (max difference 0.0), server-side compute is ~12 µs per request in pure Python, and the 200-bed ward scores in one batch. The ~445 ms median round trip in that test is the network distance to the data centre, which is the argument for scoring beside the data.

## Roadmap
1. Improve real-data performance: full PhysioNet 2019 (40k stays), more features, gradient boosting with missingness indicators (see `docs/REAL_DATA_PILOT.md`).
2. Export ONNX, compile with the IBM Z Deep Learning Compiler, benchmark on LinuxONE Community Cloud.
3. Subgroup fairness audit (age, sex, race) and calibration plots.
