# Judge Q&A: the 25 hardest questions, answered honestly

Rule for the stage: answer the question asked, give the number, name the weakness, and say what is next. Every number below is in `public/metrics.json`, `public/metrics_physionet.json` or `docs/REAL_DATA_PILOT.md`.

## Clinical validity

**1. Does this work on real patients?**
Not well yet. On 4,989 real PhysioNet 2019 stays the deployed model reaches AUROC 0.61 (95% CI 0.56–0.65). The strong numbers on the Validation tab are from a simulated cohort and show the method, not clinical performance. We test on real data and disclose it.

**2. Then why should we believe any of it?**
Believe the parts we can prove. The deployment path is real (verified on a z17). The uncertainty layer holds its guarantee on real data (88.5% and 90.5% coverage against a 90% target). And the pipeline is honest about failure: on real data it says "uncertain" for 72% of hours instead of making up confidence.

**3. Why simulate at all?**
Simulation let us build and test the whole pipeline (features, calibration, alert budget, explanations, mainframe serving) with a known ground truth, including deliberate look-alike patients. The real-data pilot then told us where the model breaks.

**4. What is your sepsis label?**
Sepsis-3 onset. In PhysioNet the challenge label is shifted 6 hours early, so we take onset as the first positive label plus 6 hours, then predict onset within the next 6 hours, scored hourly. Hours after onset are excluded.

**5. How early do you warn?**
Simulated: median 3 hours before onset. Real data: median 15.5 hours among the 36% of septic patients alerted. The real-data figure is from a small test split, so treat it as indicative.

**6. Why compare against SIRS and not qSOFA or NEWS?**
SIRS is the most common rule-based screen and is easy to compute from our variables. The 2026 Surviving Sepsis Campaign recommends NEWS, NEWS2, MEWS or SIRS over qSOFA as a single screening tool. Adding NEWS2 as a second baseline is on our list.

## Machine learning

**7. Any data leakage?**
We split by patient, not by hour, so no patient appears in two splits. The threshold and conformal cut-offs come from a separate calibration cohort and are frozen before testing. Post-onset hours are removed. Features only use the current and past hours.

**8. Why a logistic model and not deep learning?**
On the simulated task it matches gradient boosting (0.818 vs 0.815), it is exactly explainable, and it runs anywhere with no dependencies. On real data gradient boosting is better (0.68 vs 0.61), so it is our next deployed model.

**9. Are the explanations real SHAP?**
For a linear model, each feature's contribution to the log-odds (coefficient × standardised value) is exactly its SHAP value. Tests check that the contributions plus the intercept rebuild the model's score.

**10. What does "conformal" add?**
A distribution-free coverage guarantee. We use class-conditional conformal prediction: separately for septic and non-septic hours, the true label is inside the predicted set at least 90% of the time on exchangeable data. Each hour gets "sepsis not ruled out", "ruled out" or "uncertain".

**11. Why class-conditional and not standard conformal?**
At 1.8% prevalence, standard conformal reached 90% by covering negative hours and returned empty sets for most risks, which is useless. We caught that in our own UI (an alerting bed labelled "not at risk") and fixed it.

**12. How was the alert threshold chosen?**
On the calibration cohort we chose the most sensitive threshold that stays within 15 false alerts per 100 patient-days. It is a clinical budget, not a tuned accuracy number.

**13. AUPRC is only 0.30 on simulation and 0.02 on real data. Isn't that bad?**
Prevalence is 1.8% (simulated) and 1.3% (real) per hour, so random would be about that. The simulated 0.30 is 17 times random. The real-data 0.02 is barely above random, which is exactly why we call the real-data model weak.

**14. Are you sure of the real-data AUROC with so few septic patients?**
No. The test split has 72 septic stays and the 95% CI is 0.56–0.65. It is enough to say "weak", not enough for anything finer. The full 40k-stay set is the fix.

## IBM Z

**15. What actually ran on the mainframe?**
`ml/serve.py`, our inference service, on the IBM LinuxONE Community Cloud. The host reports an IBM z17 (machine type 9175, Telum II) with the `nnpa` flag. The app connected to it, scored real requests, and the remote results matched the browser's reference results exactly.

**16. Did you use the Telum II AI accelerator?**
No. Inference ran on the CPU in pure Python, about 12 µs per request. The NNPA path (ONNX, then the IBM Z Deep Learning Compiler with `--maccel=NNPA`) is our next step, and also how we will deploy gradient boosting.

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
Train gradient boosting on the full 40k PhysioNet stays with more variables and missingness features, compile it for the Telum II accelerator, benchmark CPU against NNPA on the z17, and run a fairness audit.
