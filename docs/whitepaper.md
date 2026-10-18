# AuraZ: Explainable, Calibrated ICU Sepsis Early Warning on IBM Z

**IBM Z Datathon 2026 · Theme: Technology for Good** · Repository: github.com/saksham-2x7/IBM_Z
*Research prototype. Not a medical device. All numbers below are reproduced by scripts in the repository.*

## 1. Problem

Sepsis is life-threatening organ dysfunction caused by a dysregulated host response to infection (Sepsis-3). WHO reports an estimated 48.9 million cases and 11 million sepsis-related deaths (2017 estimates, published 2020), with the highest rates in lower-middle-income countries. In septic shock, each hour of delay in effective antimicrobials over the first six hours of hypotension was associated with an average 7.6% decrease in survival (Kumar et al., 2006, observational). The 2026 Surviving Sepsis Campaign asks for antimicrobials ideally within one hour of recognising probable sepsis or shock.

Early warning helps only if clinicians trust it. Frequent alarms cause desensitisation and missed alarms (AHRQ PSNet), and SIRS criteria fire in many patients who never develop infection (Sepsis-3). Hospitals also face strict obligations when protected health information leaves their systems. AuraZ is designed around three requirements: **alert less but earlier**, **explain every alert and say when it is unsure**, and **score beside the data**.

## 2. Method

**Task.** Every hour from hour 6 of an ICU stay, predict whether Sepsis-3 onset occurs within the next 6 hours. Hours after onset are excluded.

**Features (16).** Current heart rate, mean arterial pressure, systolic pressure, respiratory rate, temperature, SpO₂, lactate and WBC; shock index (HR/SBP); 3-hour changes in HR, MAP, RR and temperature; 6-hour change in lactate; lowest MAP and highest HR over 6 hours. Labs are forward-filled. The same feature code exists in Python (training, server) and TypeScript (browser), and tests check they agree.

**Model.** L2-regularised logistic regression on standardised features. On the simulated task it matches gradient boosting (AUROC 0.818 vs 0.815), and it allows exact explanations: each feature's contribution to the log-odds is `coef × z-score`, which equals its SHAP value for a linear model. The app turns the top contributions into one plain sentence.

**Uncertainty: class-conditional conformal prediction.** On a separate calibration cohort we compute one threshold for septic hours and one for non-septic hours (α = 0.10). Each patient-hour gets a label: *sepsis not ruled out*, *ruled out*, or *uncertain* (both or neither plausible). Each class then has a 90% coverage target separately. We moved away from plain (marginal) conformal prediction because, at 1.8% prevalence, it reached 90% almost entirely by covering negative hours and gave empty sets for most risks.

**Alerting.** The alert threshold is chosen on the calibration cohort as the most sensitive setting that stays within **15 false alerts per 100 patient-days**. It is then frozen and evaluated on the test cohort against the classic SIRS ≥ 2 rule. Each patient has one alert per 12-hour refractory window.

**Data.** (a) A clinically parameterised **simulated** ICU cohort (5,000 train / 1,500 calibration / 3,000 test stays) with realistic confounders (post-operative tachycardia, hypovolaemia, fever without sepsis), atypical presentations and labs drawn every 4 hours. (b) **Real ICU data**: PhysioNet/CinC 2019, 14,635 usable stays (919 septic) from a 15,009-file sample (about 37%) of hospitals A and B, split 60/20/20 by patient.

**Real-data model (AuraZ-R).** The 16-feature logistic model did not transfer to real data, so for real ICU data we use gradient-boosted trees (300 trees) over 108 features: all 34 clinical variables, hours since each was last measured, 3 h and 6 h trends, 6 h min/max/mean of key vitals, shock index, lab count and demographics. Missing values are handled natively by the trees. The trees are exported to plain JSON and scored with no dependencies, identically in Python and the browser.

## 3. Results

**Simulated cohort (method demonstration).** Held-out: 3,000 stays, 357 septic.

| Metric | AuraZ | SIRS ≥ 2 |
|---|---|---|
| AUROC (hourly, 6 h horizon) | 0.818 (95% CI 0.805–0.832) | — |
| AUPRC (prevalence 1.8%) | 0.304 | — |
| Septic patients alerted before onset | **75%** | 48% |
| False alerts / 100 patient-days | **11.7** | 47.3 |
| Non-septic patients ever alerted | **19%** | 47% |
| Median warning before onset | 3 h | 3 h |
| Conformal coverage (septic · non-septic hours) | 92.4% · 89.6% | — |

**Real ICU data (PhysioNet 2019 sample).** Held-out: 2,927 stays, 175 septic, same split for every model.

| Metric | Result |
|---|---|
| AUROC, AuraZ-R (gradient-boosted trees, 108 features) | **0.819** (95% CI 0.791–0.845) |
| Ablation: without ICU-time features · also without measurement recency | 0.794 · 0.766 |
| Same 108 features, logistic regression | 0.765 |
| Original 16-feature logistic model | 0.608 |
| Conformal coverage (septic · non-septic hours, target 90%) | 86.3% · 91.3% |

| Alerting, same patients | Septic alerted before onset | False alerts / 100 patient-days |
|---|---|---|
| AuraZ-R, low-burden setting | 57% | 15.0 |
| AuraZ-R at a matched alarm rate | **95%** | 115.6 |
| SIRS ≥ 2 | 89% | 113.8 |

**External validation (train on one hospital, test on the other).**

| Train → test | Test septic stays | AUROC (95% CI) | Coverage septic · non-septic |
|---|---|---|---|
| Hospital A → B | 329 | 0.737 (0.711–0.769) | 69.8% · 92.7% |
| Hospital B → A | 590 | 0.745 (0.726–0.762) | 92.6% · 79.6% |

**Subgroups** (same alert threshold for all): AUROC is similar by sex and age band (0.81–0.84), but the share of septic hours alerted differs (women 46% vs men 32%; ages 50–64 23% vs 65–74 54%), on groups of 35–119 septic stays. Full table in `docs/MODEL_CARD.md`.

**Interpretation.** The simple simulated-cohort model did **not** transfer (AUROC 0.61 on real data). Rebuilding it for real data (AuraZ-R) gives AUROC 0.82 in a pooled split and 0.79 without the ICU-time features that could act as a shortcut. **Across hospitals it falls to about 0.74, and the uncertainty guarantee does not transfer** (septic coverage 70% in A→B, non-septic 80% in B→A), so a new hospital must recalibrate. At a matched alarm rate AuraZ-R catches more septic patients than SIRS (95% vs 89%), or it can run at about one-eighth of SIRS's alarm burden while catching 57%. Septic-hour coverage inside the pooled split is 86.3%, below the 90% target, because hours within one patient are correlated. This is research evidence, not clinical validation.

## 4. IBM Z / LinuxONE

`ml/serve.py` is an inference service written only with the Python standard library, so it runs on s390x with nothing to install. `GET /health` reports architecture, IBM machine type and the NNPA CPU flag; `POST /score` scores a batch of patient-hours. We deployed it on the **IBM LinuxONE Community Cloud** and verified it from the application:

- Host: **IBM z17 (machine type 9175, Telum II)**, s390x, `nnpa` flag present.
- Remote scores equal the browser's reference scores exactly (maximum absolute difference 0.0 over 40 requests).
- Server-side compute about **12 µs** per request (median), in pure Python on the CPU.
- The 200-bed ward view scores every bed each hour in one batch request on the mainframe.
- The **real-data AuraZ-R trees** (`POST /score_real`) ran on the z17 too: 300 real held-out rows from the final model matched sklearn exactly (maximum difference 0.0), at about 150–200 µs per row in pure Python. The FHIR endpoint (`POST /fhir/score`) also ran on the z17.
- The end-to-end round trip from India was about 445 ms median, all network distance. That gap is the case for scoring where the data already lives.

**Telum II accelerator (NNPA).** We also ran a neural-network variant of the real-data model, **AuraZ-N** (108→64→32→1, AUROC 0.800 vs 0.819 for the trees), on the on-chip accelerator through IBM's zDNN library (`ml/nnpa_mlp.c`). On 32,768 held-out patient-hours the accelerator took **10.9 ms versus 354.9 ms for a plain CPU loop (32.6×)** and versus 15.9 ms for OpenBLAS, a tuned CPU library, on one thread (1.5×; 1.2× against both of the VM's threads), with AUROC unchanged (0.80858 vs 0.80859 in FP32) and 99.994% identical alert decisions (the chip computes in 16-bit). The accelerator is not a universal win: our 16-feature logistic model ran 2–4× *slower* on it because it is too small, and the gradient-boosted trees (AuraZ-R) are not an accelerator workload. Details: `docs/NNPA.md`.

**Load test.** With two worker processes on the 2-vCPU VM the AuraZ-R service peaked at 11,870 scores per second (6,492 with one worker), with 0.27 ms median latency for single patient-hours. The test found and fixed a real bug: a TCP delayed-ACK stall had pinned single requests at 50 ms.

## 5. Limitations

1. The simulated cohort demonstrates the method only. On real data AuraZ-R reaches AUROC 0.82 pooled but about 0.74 across hospitals.
2. We used 37% of the PhysioNet 2019 stays (downloads were throttled); only two US hospitals, no race/ethnicity audit, and subgroup differences rest on small groups.
3. Measurement-recency features partly encode clinician behaviour; the model learns from care patterns as well as physiology.
4. There is no prospective or silent-mode validation, and no race/ethnicity audit (the data has none). This is not a medical device.
5. The accelerator result is for AuraZ-N, which is slightly less accurate than AuraZ-R; the 33× is against a plain loop (1.2–1.5× against tuned OpenBLAS); load numbers share a 2-vCPU VM with the load generator.

## 6. Roadmap

1. Real-data model: the full 40k stays, per-hospital recalibration, validation on MIMIC-IV or eICU.
2. Telum II: close the 0.02 AUROC gap between AuraZ-N and AuraZ-R (wider networks, more data), compare against an optimised CPU library, and test the IBM Z Deep Learning Compiler.
3. Extend the fairness audit to race/ethnicity (needs a dataset that records it) and per-subgroup calibration plots.
4. Deeper integration (HL7 v2, FHIR subscriptions) and a silent-mode pilot with clinicians before any alerting.

## References

- WHO, Sepsis fact sheet — who.int/news-room/fact-sheets/detail/sepsis
- Singer M. et al., The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3), JAMA 2016 — jamanetwork.com/journals/jama/fullarticle/2492881
- Kumar A. et al., Duration of hypotension before initiation of effective antimicrobial therapy, Crit Care Med 2006 — PMID 16625125
- Surviving Sepsis Campaign, Adult Guidelines 2026 — sccm.org/survivingsepsiscampaign
- AHRQ PSNet, Reducing safety hazards of monitor alert and alarm fatigue — psnet.ahrq.gov
- Reyna M.A. et al., PhysioNet/Computing in Cardiology Challenge 2019 — physionet.org/content/challenge-2019
