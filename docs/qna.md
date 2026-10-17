# Judge Q&A: the 25 hardest questions, answered honestly

Rule for the stage: answer the question asked, give the number, name the weakness, and say what is next. Every number below is in `public/metrics.json` (simulated), `public/metrics_physionet.json` (real data) or `docs/REAL_DATA_PILOT.md`.

## Clinical validity

**1. Does this work on real patients?**
Moderately, on retrospective data. On 998 held-out real PhysioNet 2019 stays our real-data model AuraZ-R reaches AUROC 0.775 (95% CI 0.72–0.82). At the same alarm rate as SIRS it catches 94% of septic patients early versus 88%. It has not been tested prospectively, so it is research evidence, not clinical validation.

**2. Your first real-data result was AUROC 0.61. What changed?**
The simple 16-feature model built on simulation did not transfer, and we published that. We then used all 34 clinical variables, how recently each was measured, trends and demographics, with gradient-boosted trees: 0.608 to 0.712 (same logistic model, richer features) to 0.775 (trees). Same patients, same split.

**3. Why simulate at all?**
Simulation let us build and test the whole pipeline (features, calibration, alert budget, explanations, mainframe serving) with a known ground truth, including deliberate look-alike patients. The real-data pilot then told us where the model breaks.

**4. What is your sepsis label?**
Sepsis-3 onset. In PhysioNet the challenge label is shifted 6 hours early, so we take onset as the first positive label plus 6 hours, then predict onset within the next 6 hours, scored hourly. Hours after onset are excluded.

**5. How early do you warn?**
Simulated: median 3 hours before onset. Real data at the low-burden setting: median 33 hours among the 51% of septic patients alerted. The test split has only 72 septic stays, so treat that as indicative.

**6. Why compare against SIRS and not qSOFA or NEWS?**
SIRS is the most common rule-based screen and is easy to compute from our variables. The 2026 Surviving Sepsis Campaign recommends NEWS, NEWS2, MEWS or SIRS over qSOFA as a single screening tool. Adding NEWS2 as a second baseline is on our list.

## Machine learning

**7. Any data leakage?**
We split by patient, not by hour, so no patient appears in two splits. The threshold and conformal cut-offs come from a separate calibration cohort and are frozen before testing. Post-onset hours are removed. Features only use the current and past hours.

**8. Why trees and not deep learning?**
Tabular, irregular hourly ICU data with heavy missingness is where gradient-boosted trees are strong, and they handle missing values natively. They also export to plain JSON that runs anywhere, including the z17, with no dependencies, and they score identically in Python and the browser. The simulated demo uses a logistic model because it matches trees there (0.818 vs 0.815) and is exactly explainable.

**9. Are the explanations real SHAP?**
For a linear model, each feature's contribution to the log-odds (coefficient × standardised value) is exactly its SHAP value. Tests check that the contributions plus the intercept rebuild the model's score.

**10. What does "conformal" add?**
A distribution-free coverage guarantee. We use class-conditional conformal prediction: separately for septic and non-septic hours, the true label is inside the predicted set at least 90% of the time on exchangeable data. Each hour gets "sepsis not ruled out", "ruled out" or "uncertain".

**11. Why class-conditional and not standard conformal?**
At 1.8% prevalence, standard conformal reached 90% by covering negative hours and returned empty sets for most risks, which is useless. We caught that in our own UI (an alerting bed labelled "not at risk") and fixed it.

**12. How was the alert threshold chosen?**
On the calibration cohort we chose the most sensitive threshold that stays within 15 false alerts per 100 patient-days. It is a clinical budget, not a tuned accuracy number.

**13. AUPRC is only 0.047 on real data. Isn't that bad?**
The hourly positive rate is 1.3%, so random would be 0.013; 0.047 is 3.7 times random. Precision at this prevalence is inherently low, which is why we set the alert threshold by a false-alarm budget rather than by accuracy. It is a real limitation we do not hide.

**14. Is AuraZ-R just learning "time in ICU"?**
We checked. ICU length of stay is the top split feature, so we retrained without ICULOS and HospAdmTime: AUROC 0.732. Also removing all measurement-recency features gives 0.720. Both are far above the 0.608 baseline. With 72 septic test stays the 95% CI is wide (0.72–0.82 for the full model).

## IBM Z

**15. What actually ran on the mainframe?**
`ml/serve.py`, our inference service, on the IBM LinuxONE Community Cloud. The host reports an IBM z17 (machine type 9175, Telum II) with the `nnpa` flag. The app connected to it, scored real requests, and the remote results matched the browser's reference results exactly.

**16. Did you use the Telum II AI accelerator?**
No. Both models ran on the CPU in pure Python: about 12 µs per request for the demo model and about 225 µs per patient-hour for the 300-tree real-data model, with remote results matching the reference exactly. The NNPA path (ONNX, then the IBM Z Deep Learning Compiler) is our next step.

**17. Why does IBM Z matter for a model this small?**
Not for raw speed: the model is microseconds anywhere. It matters for where the data is. Hospital transaction systems already hold the vitals, so scoring inside them avoids moving protected health data and avoids network delay. Our own test shows the gap: about 12 µs of compute against about 445 ms of network round trip from India to the data centre.

**18. Why is the round trip so slow then?**
That is distance to the Marist data centre plus an SSH tunnel, not the mainframe. It is the argument for co-locating inference with the data.

**19. Can it scale to a hospital?**
The ward view scores 200 beds in one batch request each hour. Batch scoring in the browser handles tens of millions of scores per second. We have not load-tested the LinuxONE service at hospital scale.

## Ethics, regulation, impact

**20. Is this a medical device?**
No. It is a research prototype. Any clinical use would need regulatory review and a prospective study.

**21. What about bias?**
We have not run a subgroup fairness audit yet. PhysioNet has age and sex, so per-subgroup AUROC and calibration is on the roadmap. Until then we make no fairness claims.

**22. What happens when the model is wrong?**
It is designed to support, not replace, clinicians. Every alert shows why it fired, and the "uncertain" label tells staff when not to trust it. The alert budget caps how often it can interrupt.

**23. Is cloud AI actually illegal for hospitals?**
No. In the US, HHS allows cloud processing of protected health information with a business associate agreement and HIPAA safeguards. On-premises scoring is a design choice that reduces exposure and latency; it is not proof of compliance.

## The team

**24. What did you build in the hackathon versus before?**
Everything in the repository was built during the event: the training and calibration pipeline, the PhysioNet pilot, the LinuxONE service and its verification, the app and the documentation.

**25. If you had one more week?**
Train AuraZ-R on all 40k PhysioNet stays and validate it externally on another hospital database. Compile the trees for the Telum II accelerator and benchmark CPU against NNPA on the z17. Run a fairness audit by age and sex.
