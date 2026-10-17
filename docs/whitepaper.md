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

**Data.** (a) A clinically parameterised **simulated** ICU cohort (5,000 train / 1,500 calibration / 3,000 test stays) with realistic confounders (post-operative tachycardia, hypovolaemia, fever without sepsis), atypical presentations and labs drawn every 4 hours. (b) A **real-data pilot** on PhysioNet/CinC 2019 (4,989 usable stays from a 5,126-file sample of hospitals A and B), split 60/20/20 by patient.

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

**Real ICU data (PhysioNet 2019 sample).** Held-out: 998 stays, 72 septic.

| Metric | AuraZ | SIRS ≥ 2 |
|---|---|---|
| AUROC, deployed logistic model | **0.608** (95% CI 0.560–0.653) | — |
| AUROC, gradient boosting (not deployed) | 0.677 | — |
| Septic patients alerted before onset | 36% | 89% |
| False alerts / 100 patient-days | 15.1 | 115.8 |
| Conformal coverage (septic · non-septic hours) | 88.5% · 90.5% | — |
| Hours labelled "uncertain" | 72% | — |

**Interpretation.** The simulated results **do not transfer** to real data: discrimination drops to 0.61, and at an eight-times-lower alert burden than SIRS, AuraZ also catches far fewer septic patients. What does transfer is calibration. Coverage stays close to target for both classes, and the model labels most real hours "uncertain" rather than overclaiming. We present the simulated numbers only as a demonstration of the method and the deployment path.

## 4. IBM Z / LinuxONE

`ml/serve.py` is an inference service written only with the Python standard library, so it runs on s390x with nothing to install. `GET /health` reports architecture, IBM machine type and the NNPA CPU flag; `POST /score` scores a batch of patient-hours. We deployed it on the **IBM LinuxONE Community Cloud** and verified it from the application:

- Host: **IBM z17 (machine type 9175, Telum II)**, s390x, `nnpa` flag present.
- Remote scores equal the browser's reference scores exactly (maximum absolute difference 0.0 over 40 requests).
- Server-side compute about **12 µs** per request (median), in pure Python on the CPU.
- The 200-bed ward view scores every bed each hour in one batch request on the mainframe.
- The end-to-end round trip from India was about 445 ms median, all network distance. That gap is the case for scoring where the data already lives.

**Not yet done:** inference does not use the Telum II on-chip accelerator (NNPA). The path is ONNX export, then the IBM Z Deep Learning Compiler (`--maccel=NNPA`), then benchmarking against the CPU. This is also the route to deploying the stronger gradient-boosting model.

## 5. Limitations

1. Headline results are from a **simulated** cohort; real-data performance is weak (AUROC 0.61).
2. The real-data pilot used a sample (4,989 stays) because bulk download was throttled; CIs are wide.
3. Only 8 of the 40 PhysioNet variables are used, and there are no missingness indicators.
4. There is no prospective or silent-mode validation and no subgroup fairness audit yet. This is not a medical device.
5. Hardware results are for CPU inference only; NNPA acceleration is untested.

## 6. Roadmap

1. Real-data model: the full 40k stays, more variables, missingness features, gradient boosting, per-hospital calibration.
2. Telum II: ONNX + zDLC on LinuxONE, CPU vs NNPA benchmark, deploy the gradient-boosting model.
3. Fairness audit by age and sex; calibration plots per subgroup.
4. HL7/FHIR integration and a silent-mode pilot with clinicians before any alerting.

## References

- WHO, Sepsis fact sheet — who.int/news-room/fact-sheets/detail/sepsis
- Singer M. et al., The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3), JAMA 2016 — jamanetwork.com/journals/jama/fullarticle/2492881
- Kumar A. et al., Duration of hypotension before initiation of effective antimicrobial therapy, Crit Care Med 2006 — PMID 16625125
- Surviving Sepsis Campaign, Adult Guidelines 2026 — sccm.org/survivingsepsiscampaign
- AHRQ PSNet, Reducing safety hazards of monitor alert and alarm fatigue — psnet.ahrq.gov
- Reyna M.A. et al., PhysioNet/Computing in Cardiology Challenge 2019 — physionet.org/content/challenge-2019
