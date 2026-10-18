# AuraZ — Hack2Skill abstract (about 250 words)

**Title:** AuraZ: explainable, calibrated ICU sepsis early warning that runs beside the data on IBM Z

**Problem.** Sepsis causes an estimated 11 million deaths a year (WHO), and guidelines ask for antimicrobials within an hour of recognising probable sepsis or shock. Rule-based ICU screens such as SIRS fire constantly, so clinicians tune them out, and cloud AI moves protected health data off-site.

**Solution.** AuraZ scores every ICU patient hourly and predicts sepsis onset in the next 6 hours. Each alert carries a plain-language explanation and a conformal uncertainty label (90% coverage per class) that says "uncertain" when the model cannot decide.

**Real ICU data.** Our first model did not transfer to real data (AUROC 0.61), so we built AuraZ-R, gradient-boosted trees over all 34 clinical variables. On 2,927 held-out PhysioNet 2019 stays it reaches AUROC 0.82 (95% CI 0.79–0.84; 0.79 without ICU-time features). Tested on a different hospital it drops to 0.74 and its uncertainty guarantee weakens, so each hospital must recalibrate. At SIRS's alarm rate it catches 95% of septic patients early versus 89%.

**Why IBM Z.** Everything runs on a real IBM z17 (LinuxONE, Telum II) with nothing to install: a standard-library inference service (11,870 scores/s peak, 0.27 ms median latency), a FHIR endpoint, and a 200-bed ward scored in one batch. A neural variant, AuraZ-N (AUROC 0.80), runs on the on-chip AI accelerator: 33× faster than a plain CPU loop on 32,768 patient-hours (1.5× against a tuned CPU library) with AUROC unchanged. We also report where the accelerator does not help.

**Next.** Train on all 40k stays with external validation, close the small accuracy gap between the neural and tree models, and run a silent-mode clinical pilot.
