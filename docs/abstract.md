# AuraZ — Hack2Skill abstract (about 250 words)

**Title:** AuraZ: explainable, calibrated ICU sepsis early warning that runs beside the data on IBM Z

**Problem.** Sepsis causes an estimated 11 million deaths a year (WHO), and guidelines ask for antimicrobials within an hour of recognising probable sepsis or shock. Rule-based ICU screens such as SIRS fire constantly, so clinicians tune them out, and cloud AI moves protected health data off-site.

**Solution.** AuraZ scores every ICU patient hourly and predicts sepsis onset in the next 6 hours. Each alert carries a plain-language explanation and a conformal uncertainty label (90% coverage per class) that says "uncertain" when the model cannot decide.

**Real ICU data.** Our first model did not transfer to real data (AUROC 0.61), so we built AuraZ-R: gradient-boosted trees over all 34 clinical variables plus measurement recency. On 998 held-out PhysioNet 2019 stays it reaches AUROC 0.775 (95% CI 0.72–0.82; 0.73 without ICU-time features). At SIRS's alarm rate it catches 94% of septic patients early versus 88%, and the uncertainty guarantee still holds. A simulated cohort with look-alike patients demonstrates the full workflow.

**Why IBM Z.** A dependency-free inference service runs on IBM LinuxONE. On a real IBM z17 (machine 9175, Telum II, NNPA flag present) both models ran and matched our reference scores exactly. A 200-bed ward scores in one batch, and the real-data trees take about 225 µs per patient-hour, on the CPU.

**Next.** Compile the trees for the Telum II accelerator (ONNX + IBM Z Deep Learning Compiler), train on all 40k stays with external validation, and run a silent-mode clinical pilot.
