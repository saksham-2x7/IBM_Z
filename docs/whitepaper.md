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

**Data.** (a) A clinically parameterised **simulated** ICU cohort (5,000 train / 1,500 calibration / 3,000 test stays) with realistic confounders (post-operative tachycardia, hypovolaemia, fever without sepsis), atypical presentations and labs drawn every 4 hours. (b) **Real ICU data**: PhysioNet/CinC 2019, 4,989 usable stays from a 5,126-file sample of hospitals A and B, split 60/20/20 by patient.

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

**Real ICU data (PhysioNet 2019 sample).** Held-out: 998 stays, 72 septic, same split for every model.

| Metric | Result |
|---|---|
| AUROC, AuraZ-R (gradient-boosted trees, 108 features) | **0.775** (95% CI 0.721–0.822) |
| Ablation: without ICU-time features · also without measurement recency | 0.732 · 0.720 |
| Same 108 features, logistic regression | 0.712 |
| Original 16-feature logistic model | 0.608 (95% CI 0.56–0.65) |
| Conformal coverage (septic · non-septic hours, target 90%) | 89.3% · 89.8% |

| Alerting, same patients | Septic alerted before onset | False alerts / 100 patient-days |
|---|---|---|
| AuraZ-R, low-burden setting | 51% | 16.7 |
| AuraZ-R at a matched alarm rate | **94%** | 117.6 |
| SIRS ≥ 2 | 88% | 111.9 |

**Interpretation.** The simple simulated-cohort model did **not** transfer (AUROC 0.61 on real data). Rebuilding the model for real data (AuraZ-R) lifts discrimination to 0.775, and it stays at 0.73 without the ICU-time features that could act as a shortcut. At a matched alarm rate it catches more septic patients than SIRS (94% vs 88%), or it can run at a seven-times-lower alarm burden. Calibration transfers: the class-conditional coverage holds on real data. This is a moderate result from a two-hospital sample with 72 septic test stays, so the confidence interval is wide. It is research evidence, not clinical validation.

## 4. IBM Z / LinuxONE

`ml/serve.py` is an inference service written only with the Python standard library, so it runs on s390x with nothing to install. `GET /health` reports architecture, IBM machine type and the NNPA CPU flag; `POST /score` scores a batch of patient-hours. We deployed it on the **IBM LinuxONE Community Cloud** and verified it from the application:

- Host: **IBM z17 (machine type 9175, Telum II)**, s390x, `nnpa` flag present.
- Remote scores equal the browser's reference scores exactly (maximum absolute difference 0.0 over 40 requests).
- Server-side compute about **12 µs** per request (median), in pure Python on the CPU.
- The 200-bed ward view scores every bed each hour in one batch request on the mainframe.
- The **real-data AuraZ-R trees** (`POST /score_real`) ran on the z17 too: 300 real held-out rows matched the browser and sklearn exactly (maximum difference 0.0), at about 225 µs per row in pure Python.
- The end-to-end round trip from India was about 445 ms median, all network distance. That gap is the case for scoring where the data already lives.

**Not yet done:** inference does not use the Telum II on-chip accelerator (NNPA). The path is ONNX export, then the IBM Z Deep Learning Compiler (`--maccel=NNPA`), then benchmarking against the CPU. Tree ensembles can also be compiled for the accelerator; we have not tested that yet.

## 5. Limitations

1. The simulated cohort demonstrates the method only. On real data, AuraZ-R reaches AUROC 0.775, a moderate result.
2. The real-data pilot used a sample (4,989 stays) because bulk download was throttled; CIs are wide.
3. Measurement-recency features partly encode clinician behaviour; the model learns from care patterns as well as physiology.
4. There is no prospective or silent-mode validation and no subgroup fairness audit yet. This is not a medical device.
5. Hardware results are for CPU inference only; NNPA acceleration is untested.

## 6. Roadmap

1. Real-data model: the full 40k stays, per-hospital calibration, external validation on MIMIC-IV or eICU.
2. Telum II: compile the AuraZ-R trees with ONNX + zDLC on LinuxONE and benchmark CPU vs NNPA on the z17.
3. Fairness audit by age and sex; calibration plots per subgroup.
4. HL7/FHIR integration and a silent-mode pilot with clinicians before any alerting.

## References

- WHO, Sepsis fact sheet — who.int/news-room/fact-sheets/detail/sepsis
- Singer M. et al., The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3), JAMA 2016 — jamanetwork.com/journals/jama/fullarticle/2492881
- Kumar A. et al., Duration of hypotension before initiation of effective antimicrobial therapy, Crit Care Med 2006 — PMID 16625125
- Surviving Sepsis Campaign, Adult Guidelines 2026 — sccm.org/survivingsepsiscampaign
- AHRQ PSNet, Reducing safety hazards of monitor alert and alarm fatigue — psnet.ahrq.gov
- Reyna M.A. et al., PhysioNet/Computing in Cardiology Challenge 2019 — physionet.org/content/challenge-2019
