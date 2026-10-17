# Real ICU data (PhysioNet/CinC 2019): what we found

**Data:** 14,635 usable ICU stays (919 septic) from a 15,009-file sample of PhysioNet 2019 training sets A and B (the PhysioNet server throttles downloads to ~3–4 files/s, so we fetched about 37% of the ~40k stays). Patient-level 60/20/20 split: 8,781 train, 2,927 calibration, 2,927 test (175 septic in test). Hourly prevalence of the 6-hour target: 1.06%. The split is identical for every model below. All numbers: `public/metrics_physionet.json`, `public/audit_physionet.json`.

## Step 1: the simulated-cohort model does not transfer
`ml/train_physionet.py` retrains our original 16-feature logistic model on real data: **AUROC 0.608**. Too simple for real ICU data.

## Step 2: AuraZ-R, the real-data model
`ml/train_physionet_gbm.py`: all 34 clinical variables, hours since each was last measured, 3 h and 6 h trends, 6 h min/max/mean of key vitals, shock index, lab count, demographics (108 features); 300 gradient-boosted trees.

| Held-out test (2,927 stays, 175 septic) | Result |
|---|---|
| **AUROC, AuraZ-R** | **0.819 (95% CI 0.791–0.845)** |
| AUPRC (hourly prevalence 1.06%) | 0.077 (7.2× random) |
| Same 108 features, logistic regression | 0.765 |
| Original 16-feature logistic model | 0.608 |
| Ablation: without ICU-time features (ICULOS, HospAdmTime) | 0.794 |
| Ablation: also without measurement-recency features | 0.766 |
| Conformal coverage, septic · non-septic hours (target 90%) | 86.3% · 91.3% |
| Hours labelled "uncertain" | 34% |

Septic-hour coverage is **3.7 points under target**: hours within a patient are correlated, which breaks the exchangeability assumption behind the guarantee.

| Alerting on the same patients | Septic patients alerted before onset | False alerts / 100 patient-days | Non-septic patients ever alerted | Median warning |
|---|---|---|---|---|
| AuraZ-R, low-burden setting (budget 15, set on calibration split) | 57% | 15.0 | 13% | 35.5 h |
| AuraZ-R at a matched alarm rate | **95%** | 115.6 | 68% | 33 h |
| SIRS ≥ 2 rule | 89% | 113.8 | 69% | 32.5 h |

## Step 3: external validation (`ml/audit_physionet.py`)
Hospitals A and B are different sites. Training on one and testing on the other:

| Train → test | Test septic stays | AUROC (95% CI) | Coverage septic · non-septic |
|---|---|---|---|
| A → B | 329 | **0.737** (0.711–0.769) | 69.8% · 92.7% |
| B → A | 590 | **0.745** (0.726–0.762) | 92.6% · 79.6% |
| Pooled random split (reference) | 175 | 0.819 (0.791–0.845) | 86.3% · 91.3% |

**Discrimination drops by about 0.08 across hospitals and the uncertainty guarantee does not transfer** (septic coverage 70% in A→B, non-septic coverage 80% in B→A). The honest conclusion: AuraZ-R needs per-hospital recalibration, and a pooled-split AUROC of 0.82 overstates how it would do at a new hospital (about 0.74).

## Step 4: subgroup audit (same alert threshold for every group; top 5% of held-out hours)
AUROC is similar across groups (0.81–0.84). The share of septic hours alerted is not: women 46% vs men 32%; ages 50–64 23% vs ages 65–74 54%. Groups have 35–119 septic stays, so these differences are a signal to investigate, not proof of bias. Race/ethnicity is not in the dataset and was not audited. Full table: `docs/MODEL_CARD.md`.

## Reading it honestly
- **Real and moderate.** 0.82 in a pooled split, about 0.74 across hospitals. Not state-of-the-art.
- **Where the gain comes from.** Richer features (0.608 to 0.765 with the same logistic model), then trees (0.765 to 0.819). Without ICU-time features it is 0.794, still far above the baseline. Measurement recency partly encodes clinician behaviour.
- **Versus SIRS.** At a matched alarm rate AuraZ-R catches more septic patients (95% vs 89%), or runs at about one-eighth of SIRS's alarm burden while catching 57%.
- **Limits.** Two US hospitals, retrospective, 37% of the dataset, no prospective test, no race audit.

## Runs on IBM Z
The trees are plain JSON (`public/model_physionet.json`) scored with no dependencies by `ml/serve.py` (`POST /score_real`) and `src/lib/gbm.ts`. An earlier training run of AuraZ-R (same code path, 300 trees) was verified on the IBM z17 (machine 9175): 300 real held-out rows matched the browser and sklearn exactly (max difference 0.0) at about 250 µs per row in pure Python on the CPU. The current model has not been redeployed to the z17 (the VM was not used in this round). The Telum II NNPA accelerator is not used.

## Reproduce
Download the PhysioNet 2019 training sets into `data/physionet2019/`; run `python3 ml/train_physionet_gbm.py` (about 2 min) and `python3 ml/audit_physionet.py` (about 1.5 min).
