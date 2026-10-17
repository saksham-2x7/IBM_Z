# AuraZ — Hack2Skill abstract (≈250 words)

**Title:** AuraZ: explainable, calibrated ICU sepsis early warning that runs beside the data on IBM Z

**Problem.** Sepsis causes an estimated 11 million deaths a year (WHO, 2017 estimates), and guidelines ask for antimicrobials within an hour of recognising probable sepsis or shock. Rule-based ICU screens such as SIRS fire constantly, so clinicians tune them out, while cloud-hosted AI moves protected health data off-site.

**Solution.** AuraZ scores every ICU patient hourly and predicts sepsis onset in the next 6 hours. Each alert comes with a plain-language explanation (exact per-feature contributions) and a class-conditional conformal uncertainty label (90% target per class) that says "uncertain" when the model cannot decide. On a held-out simulated cohort (3,000 stays) it caught 75% of septic patients early versus 48% for SIRS, with 11.7 versus 47.3 false alerts per 100 patient-days.

**Honest real-data test.** Retrained on 4,989 real PhysioNet 2019 stays, discrimination is weak (AUROC 0.61, 95% CI 0.56–0.65). The simulated results do not transfer, but calibration does: the uncertainty guarantee holds and the model labels most hours "uncertain" instead of overclaiming.

**Why IBM Z.** A dependency-free inference service runs on IBM LinuxONE. We verified it on a real IBM z17 (machine 9175, Telum II, NNPA flag present): remote scores match the reference model exactly, about 12 µs of compute per request, and a 200-bed ward scores in one batch. Inference currently uses the CPU.

**Next.** Gradient boosting (AUROC 0.68 on real data) compiled for the Telum II accelerator via ONNX and the IBM Z Deep Learning Compiler, the full 40k-stay dataset, and a silent-mode pilot.
