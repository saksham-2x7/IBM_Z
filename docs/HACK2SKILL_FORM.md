# Hack2Skill form: paste-ready answers (matches the portal's fields)

Each text answer is under the portal's 1,024-character limit (counts shown). Numbers come from `public/*.json`.

## Challenges (dropdown)
Pick **"Real-Time AI for Critical Decisions"** (our track) if it is listed; otherwise the closest healthcare / critical-decisions option.

## What is the Problem you are trying to solve? (638/1024)
Sepsis, the body's life-threatening reaction to infection, is linked to about 11 million deaths a year (WHO). Every hour of delay in effective antibiotics lowers survival, and guidelines ask for treatment within an hour of recognising probable sepsis. ICU early-warning rules such as SIRS fire so often that clinicians learn to ignore them (alarm fatigue), and cloud-hosted AI means sending protected patient data outside the hospital and waiting on network delay for a time-critical decision. Hospitals need warnings that come earlier, ring less often, explain why, admit when they are unsure, and run next to the data they already hold.

## How are you planning to solve the problem? (Brief Overview) (810/1024)
AuraZ scores every ICU patient each hour and predicts sepsis onset within 6 hours. Models: a logistic demo model and AuraZ-R, 300 gradient-boosted trees on 108 features (all 34 PhysioNet variables, trends, how recently each was measured). Every alert shows a plain-language explanation and a conformal-prediction label (sepsis not ruled out / uncertain / ruled out, 90% coverage per class); the alert threshold is set under a false-alarm budget. We tested honestly on 14,635 real PhysioNet 2019 stays: AUROC 0.82 on held-out patients, 95% vs 89% of septic patients caught at SIRS's alarm rate, and 0.74 on a different hospital (we report the drop). Stack: React/TypeScript app, Python and scikit-learn, a dependency-free inference service with a FHIR endpoint, a 200-bed ward view, and 23 app + 6 server tests.

## How does your solution leverage IBM Z / LinuxONE technologies? (789/1024)
We ran AuraZ on a real IBM z17 (LinuxONE Community Cloud, machine 9175, Telum II). 1) A standard-library Python inference service runs on s390x with nothing to install; remote scores match our reference exactly; load test: 11,870 scores/s peak on 2 vCPUs, 0.27 ms median per patient-hour (it found and fixed a TCP delay bug). 2) A neural variant, AuraZ-N (AUROC 0.80), runs on the on-chip AI accelerator (NNPA) through IBM zDNN: 32,768 patient-hours in 10.9 ms vs 355 ms for a plain CPU loop (33x) and 15.9 ms for tuned OpenBLAS (1.5x), AUROC unchanged (0.80858 vs 0.80859). We also report where it does not help: our tiny logistic model is slower on it and the tree model stays on the CPU. Why it matters: hospital data already lives on IBM Z, so scoring there avoids moving patient data.

## What value does your solution deliver, and who will benefit from it? (817/1024)
Who benefits: ICU clinicians and nurses (fewer, earlier, explained alerts), patients (faster treatment), and hospital IT and privacy teams (scoring stays beside the data on IBM Z, so protected health information is not shipped to a third-party cloud). Outcome: at the same alarm volume as the standard SIRS rule, AuraZ-R catches 95% vs 89% of septic patients early; at a low-alarm setting it raises about 15 false alerts per 100 patient-days instead of about 114. Uncertainty labels tell staff when not to trust the model. Business value: it fits existing mainframe estates, a FHIR endpoint integrates with EHRs, and one 2-vCPU z17 VM scored 11,870 patient-hours per second. Honest scope: a research prototype on retrospective data, not a medical device; each hospital must recalibrate (AUROC 0.74 at a new hospital).

## Upload your pitch deck in PDF format (max 5 MB)
Upload `docs/AuraZ_PitchDeck.pdf` (about 0.2 MB). If the upload fails, paste the link below instead.

## Share the link to your pitch deck (if not able to upload)
https://github.com/saksham-2x7/IBM_Z/blob/main/docs/AuraZ_PitchDeck.pdf

## GitHub link of your project
https://github.com/saksham-2x7/IBM_Z

## Video submission link (YouTube/Vimeo, max 3 minutes)
Your unlisted YouTube link. Script: `docs/VIDEO_SCRIPT.md`.

## Link to all open-source resources used (566/1024)
https://github.com/facebook/react, https://github.com/vitejs/vite, https://github.com/tailwindlabs/tailwindcss, https://github.com/microsoft/TypeScript, https://github.com/scikit-learn/scikit-learn, https://github.com/numpy/numpy, https://github.com/IBM/zDNN, https://github.com/OpenMathLib/OpenBLAS, https://github.com/vitest-dev/vitest, https://github.com/lucide-icons/lucide, https://github.com/rsms/inter, Dataset: PhysioNet/CinC Challenge 2019 https://physionet.org/content/challenge-2019/1.0.0/ (open access). Python standard library for the inference service.

## Any other document (flowchart / architecture diagram)
https://github.com/saksham-2x7/IBM_Z/blob/main/docs/ARCHITECTURE.md
(also useful: whitepaper https://github.com/saksham-2x7/IBM_Z/blob/main/docs/AuraZ_Whitepaper.pdf and accelerator details https://github.com/saksham-2x7/IBM_Z/blob/main/docs/NNPA.md)

## Before you press Submit
1. Merge the pull request on GitHub so these links show the final version.
2. Open every link above in a private/incognito window to confirm it loads without login.
3. Make sure the video is "Unlisted" or "Public" and under 3:00.
