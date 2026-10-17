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
| Fleet Mockup / Intervention Sandbox | Illustrative, hand-authored demo data |

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
python3 ml/train.py     # regenerates public/model.json, metrics.json, replay.json
npm install && npm run dev   # http://localhost:5174
```

Tabs: **Live Model Replay** · **Validation** · **Latency Lab** · Fleet Mockup · Intervention Sandbox · IBM Z Architecture · Submission.

## Roadmap
1. Retrain on PhysioNet 2019 (open access) and report real-data metrics.
2. Export ONNX, compile with the IBM Z Deep Learning Compiler, benchmark on LinuxONE Community Cloud.
3. Subgroup fairness audit (age, sex, race) and calibration plots.
