# Real-data pilot (PhysioNet/CinC 2019) — honest status

**Run:** `ml/train_physionet.py` on 772 usable stays (47 septic) from training sets A and B (a 793-file sample; the PhysioNet server throttles bulk download to ~3 files/s, so the full 40k-patient set was not fetched). Patient-level 60/20/20 split.

| Metric | Result |
|---|---|
| AUROC (hourly, 6 h horizon) | **0.62** (95% CI 0.48–0.73) |
| Gradient-boosting comparison | 0.60 |
| Conformal coverage @ 90% target | 91.3% |
| Alert operating point | Failed: 0% sensitivity at the 15 alerts/100 patient-days budget |

**Reading:** the simulated-cohort results (AUROC 0.82) do **not** transfer to this small real sample. With ~10 septic stays in the test split the confidence interval is too wide to conclude anything, but it is clear the current 16-feature logistic model, trained on ~460 real stays and 8 vitals/labs, is not enough on real ICU data.

**Do not cite the simulated numbers as clinical performance.** Present them as a demonstration of the method and the IBM Z deployment path only.

**What would fix it (roadmap):** the full 40k-stay dataset; more of the 40 Challenge variables (e.g. ICULOS, age, Unit1/2, more labs); gradient-boosted models with missingness indicators; per-hospital calibration (sets A and B come from different hospitals).
