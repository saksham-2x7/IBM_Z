# Real ICU data (PhysioNet/CinC 2019): what we found

**Data:** 4,989 usable ICU stays (289 septic) from a 5,126-file sample of PhysioNet 2019 training sets A and B. The PhysioNet server throttles bulk downloads, so we used a sample rather than all ~40k stays. Patient-level 60/20/20 split: 2,993 train, 998 calibration, 998 test (72 septic in test). Hourly prevalence of the 6-hour target is 1.3%. The split is identical for every model below.

## Step 1: the simulated-cohort model does not transfer
`ml/train_physionet.py` retrains our original 16-feature logistic model (8 vitals/labs + trends) on real data: **AUROC 0.608 (95% CI 0.56–0.65)**. An earlier 772-stay run gave 0.62. That model is too simple for real ICU data.

## Step 2: AuraZ-R, the real-data model
`ml/train_physionet_gbm.py` adds all 34 clinical variables, hours since each variable was last measured, 3 h and 6 h trends, 6 h min/max/mean of key vitals, shock index, lab count and demographics (108 features). It uses gradient-boosted trees (300 trees, depth limited by 15 leaves).

| Held-out test (998 stays, 72 septic) | Result |
|---|---|
| **AUROC, AuraZ-R** | **0.775 (95% CI 0.721–0.822)** |
| AUPRC (prevalence 1.3%) | 0.047 (3.7× random) |
| Same 108 features, logistic regression | 0.712 |
| Original 16-feature logistic model | 0.608 |
| Ablation: without ICU-time features (ICULOS, HospAdmTime) | 0.732 |
| Ablation: also without measurement-recency features | 0.720 |
| Conformal coverage, septic · non-septic hours (target 90%) | 89.3% · 89.8% |
| Hours labelled "uncertain" | 51% |

**Alerting on the same held-out patients**

| Operating point | Septic patients alerted before onset | False alerts / 100 patient-days | Non-septic patients ever alerted |
|---|---|---|---|
| AuraZ-R, low-burden setting (budget 15, chosen on calibration set) | 51% | 16.7 | 12% |
| AuraZ-R at a matched alarm rate | **94%** | 117.6 | 65% |
| SIRS ≥ 2 rule | 88% | 111.9 | 68% |

## Reading it honestly
- **Real but moderate.** AUROC 0.775 is a meaningful jump from 0.608, and it holds at 0.73 without the ICU-time features that could be a shortcut. It is a moderate result from a sample, not a state-of-the-art one.
- **Where the gain comes from.** Most of it is richer features (0.608 to 0.712 with the same logistic model); trees add the rest (0.712 to 0.775). Measurement recency partly reflects clinician behaviour (ordering a lactate signals suspicion), which is legitimate at prediction time but means the model learns from care patterns as well as physiology.
- **Versus SIRS.** At a matched alarm rate AuraZ-R catches more septic patients (94% vs 88%), or it can run at a seven-times-lower alarm burden while catching about half.
- **Calibration transfers.** The class-conditional uncertainty guarantee holds on real data for both classes.
- **Limits.** 72 septic test stays means a wide confidence interval. It is a sample of two hospitals, with no external validation, no fairness audit and no prospective test. It is research evidence, not clinical validation.

## Runs on IBM Z
The 300 trees are exported to plain JSON (`public/model_physionet.json`) and scored with no dependencies by `ml/serve.py` (`POST /score_real`) and in the browser (`src/lib/gbm.ts`). On the IBM z17 (machine 9175, LinuxONE Community Cloud) we scored 300 real held-out rows. The remote scores matched the browser and sklearn exactly (maximum difference 0.0), at about 225 µs per row in pure Python on the CPU. The Telum II NNPA accelerator is not used yet.

## Reproduce
Download the PhysioNet 2019 training sets into `data/physionet2019/`, then run `python3 ml/train_physionet_gbm.py`. It takes about 2 minutes on a laptop.
