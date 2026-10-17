# Real-data pilot (PhysioNet/CinC 2019) — honest status

**Run:** `ml/train_physionet.py` on **4,989 usable stays (289 septic)**, a 5,126-file sample of training sets A and B (the PhysioNet server throttles downloads to ~3–8 files/s, so we fetched a sample, not all ~40k). Patient-level 60/20/20 split: 2,993 train / 998 calibration / 998 test (72 septic in test). Hourly prevalence of the 6 h target: 1.3%.

| Metric (test split) | Result |
|---|---|
| AUROC, deployed logistic model | **0.608** (95% CI 0.560–0.653) |
| AUROC, gradient boosting (not deployed) | 0.677 |
| Conformal coverage @ 90% target | 90.1% |
| Alerting @ ≈15 false alerts/100 patient-days | 36% of septic patients alerted, median 15.5 h before onset |
| SIRS ≥ 2 rule (same patients) | 89% alerted, but 116 false alerts/100 patient-days; 69% of non-septic patients alerted |

(An earlier 772-stay run gave AUROC 0.62, CI 0.48–0.73 — consistent, just noisier.)

**Reading:** on real ICU data the current 16-feature logistic model is a **weak** predictor (AUROC ≈ 0.61). It alerts ~8× less than SIRS but also catches far fewer septic patients, so it is not a clear win. The simulated-cohort results (AUROC 0.82, 75% vs 48% sensitivity) **do not transfer** and must be presented as a demonstration of the method and the IBM Z deployment, not as clinical performance. Calibration (conformal coverage) does hold on real data (90.1%).

**Why it's weak / what to try next:**
1. Gradient boosting already does better (0.68) — needs a deployable runtime for LinuxONE (e.g. Snap ML / ONNX via zDLC, which is also the NNPA route).
2. We only use 8 of the 40 Challenge variables. Add ICULOS, age, Unit, more labs, and missingness indicators (how long since each lab).
3. Use the full 40k stays and per-hospital calibration (sets A and B come from different hospitals).
