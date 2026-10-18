# AuraZ demo video: 3-minute script, tech stack and explanations

**Hard limit: 3:00.** The narration below is 318 spoken words, about 2:10 of speech at 150 words per minute. Add about 30 to 40 seconds for clicks and pauses and it lands at roughly 2:45. Record at 1920×1080, browser at 100% zoom. Every number comes from the app on screen or `public/*.json`.

## 0. Before you record (5 minutes)
```bash
cd IBM_Z && npm install && npm run dev                      # http://localhost:5174
ssh -N -L 8080:localhost:8080 -i <key>.pem linux1@<VM-IP>   # keep this open: the app auto-connects to the z17 on localhost:8080
```
The header pill and the hero chip must say **IBM z17 (Telum II)** before you start. If the VM is gone, run `python3 ml/serve.py 8080` locally and say "recorded earlier on the z17" over `docs/demo/04_ibm_z_remote_verification.png`. Tools: QuickTime or OBS to record, any editor to trim. Rehearse once with a stopwatch; if you run long, cut the sentences marked ✂.

## 1. The 3:00 script

| Time | On screen (click path) | Say |
|---|---|---|
| **0:00–0:15** | Live Replay page, nothing clicked | "Sepsis is a body-wide reaction to infection, and every hour of delay hurts. Hospital alarms ring so often that staff ignore them. AuraZ rings less, earlier, and tells you why." *(35 words)* |
| **0:15–0:55** | Click **TEST-01**, drag slider to **hour 19**. Then click **TEST-05**, drag to **hour 12**. | "This patient has never been seen by the model. At hour 19 the risk crosses the alert line, two hours before sepsis starts. It explains in plain English: rising temperature, breathing and heart rate. And it says 'sepsis not ruled out'. ✂ Here is a stable patient. Quiet, and it says 'ruled out'. The model also admits when it is unsure." *(62 words)* |
| **0:55–1:35** | **Validation** tab, top of the page. Scroll slowly to the cross-hospital table. | "Now the honest part. On real ICU data, about fourteen thousand patients from PhysioNet, our first model failed, so we rebuilt it. The new one scores point eight two on unseen patients. At the same alarm volume as the standard rule it catches ninety-five percent of septic patients versus eighty-nine. ✂ We also tested on a different hospital. It drops to point seven four, so each hospital must recalibrate. We show our weak spots." *(78 words)* |
| **1:35–2:30** | **IBM Z** tab (already connected). Scroll to the accelerator card, then the load-test card. Click **Run AuraZ-R real-data trees**. | "Why IBM Z? Hospital data already lives on systems like this, so AuraZ is built to score where the data is. This is a real IBM z17 mainframe, running our service with nothing to install, and it matches our reference exactly. IBM's chip has an AI accelerator, so we built a neural version of the model for it: thirty-two thousand patient-hours in eleven milliseconds: thirty-three times faster than a plain processor loop and about one and a half times faster than a tuned math library, with accuracy unchanged. ✂ We also show where it does not help: a tiny model is slower on it, and our best model, the trees, stays on the regular processor. Load testing found a real bug and reached eleven thousand scores a second." *(112 words)* |
| **2:30–2:50** | **Ward** tab → **Play** → click an orange bed | "A ward of two hundred beds is scored together every hour. Click any bed to open that patient." *(20 words)* |
| **2:50–3:00** | Back to the hero banner | "AuraZ: explainable, honest about uncertainty, and built to run beside the data on IBM Z. Built with React, Python, scikit-learn and IBM's zDNN. Thank you." *(26 words)* |

**318 spoken words in total (about 290 without the ✂ sentences).** If a rehearsal runs past 2:55, drop the ✂ lines first.

**If a judge asks later (do not put in the video):** the 355 ms is a plain single-thread CPU loop; against OpenBLAS it is 15.9 ms (1 thread) or 12.7 ms (2 threads) versus 10.9 ms on the chip, so 1.5× and 1.2×. The accelerator runs AuraZ-N (AUROC 0.80); the tree model AuraZ-R (0.82) runs on the CPU. The alert label and the alert line are different things: the line means "act now" (budgeted to limit alarms), the label means "can sepsis be excluded at 90% confidence".

## 2. Tech stack and tools

| Layer | What we used | Why |
|---|---|---|
| App (front end) | React 19, TypeScript 5, Vite, Tailwind CSS 4, lucide-react icons, Inter font | Fast, typed, and runs the model in the browser |
| Models | Python (NumPy, scikit-learn): logistic regression (demo) and gradient-boosted trees (real data, 300 trees, 108 features) | Trees suit messy ICU tables with missing values |
| Trust layer | Class-conditional split conformal prediction; exact linear SHAP explanations; false-alarm budget threshold | Says when it is unsure; explains every alert |
| Data | PhysioNet/CinC Challenge 2019 (public real ICU data, two hospitals); a simulated cohort with look-alike patients | Real for claims, simulated for the demo |
| Serving | Python standard library only (`http.server`), JSON, HTTP keep-alive, FHIR RiskAssessment output, alert audit log | Runs on s390x with nothing to install |
| IBM | IBM LinuxONE Community Cloud, IBM z17 (machine 9175, Telum II), RHEL 9 / Ubuntu 24.04 on s390x | The real IBM Z hardware we ran on |
| Accelerator | IBM zDNN 1.0.1 (C), gcc 13, `ml/nnpa_mlp.c`: AuraZ-N on the Telum II NNPA | Uses the chip's AI accelerator; 33× over a CPU loop |
| Quality | Vitest (18 tests), Python unittest (6 tests), GitHub Actions CI | Parity between Python, browser and mainframe scoring |
| Dev tools | Git/GitHub, `gh` CLI, headless Chrome (DevTools protocol) for screenshots and the whitepaper PDF, Claude Code (AI coding assistant) | Reproducible docs; AI-assisted development |

## 3. Explain it in simple terms

- **The problem:** sepsis is the body overreacting to an infection. Treating it within the first hour saves lives, but it is hard to spot early, and existing alarms go off so often that staff stop trusting them.
- **What AuraZ does:** every hour it looks at a patient's vital signs and lab results, estimates the chance of sepsis in the next 6 hours, and rings only when that chance is high. It tells you which signals drove the score, and it says "I am not sure" instead of guessing.
- **Why two models:** a simple one that is easy to explain (the demo), and a stronger one for real hospital data (AuraZ-R).
- **How we know it works:** we hide some patients from the model while it learns, then test on them. We also test on a hospital it never saw.
- **Why IBM Z:** big hospitals already run their records on systems like this. If the model runs there, patient data does not need to leave the building.
- **What is honest to say:** it is a research prototype, tested on past data only, not a medical device. On a new hospital it needs recalibration.

## 4. Explain it technically

- **Task:** hourly binary prediction of Sepsis-3 onset within 6 hours; post-onset hours excluded; patient-level 60/20/20 split.
- **Demo model:** L2 logistic regression on 16 standardised features (current vitals/labs, 3 to 6 hour trends, shock index, lag extremes). Linear, so log-odds contributions are exact SHAP values.
- **AuraZ-R:** `HistGradientBoostingClassifier`, 300 trees, 15 leaves, over 108 features: all 34 PhysioNet variables, hours since last measurement per variable, 3 h and 6 h deltas, rolling min/max/mean, shock index, lab count, demographics. Native missing-value handling. Exported as plain JSON trees and scored by identical code in Python (`ml/serve.py`) and TypeScript (`src/lib/gbm.ts`); parity with scikit-learn is exact on 300 held-out rows including missing values.
- **Uncertainty:** class-conditional (Mondrian) split conformal, alpha 0.10: one quantile for septic hours and one for non-septic, giving labels `ruled out`, `uncertain`, `sepsis not ruled out`. Marginal conformal was rejected because at about 1% prevalence it produced empty sets. Hours within a patient are correlated, so the guarantee is approximate (septic-hour coverage 86.3% on the pooled split; it degrades across hospitals).
- **Alerting:** most sensitive threshold on the calibration split within 15 false alerts per 100 patient-days; refractory window 12 hours; compared with SIRS ≥ 2 on the same patients.
- **Real-data results (2,927 held-out stays, 175 septic):** AUROC 0.819 (0.791–0.845); logistic on the same features 0.765; first 16-feature model 0.608; ablations 0.794 (no ICU-time) and 0.766 (also no recency). At a matched alarm rate 95% vs 89%; at a 15 per 100 patient-day budget 57%.
- **External validation:** train on hospital A, test on B: 0.737; B → A: 0.745. Coverage does not transfer (septic 70% in A→B; non-septic 80% in B→A).
- **IBM Z:** stdlib Python service on s390x (prefork workers, `TCP_NODELAY`); `/health` reports architecture, machine type and the NNPA flag; `/score`, `/score_real`, `/fhir/score`. z17 results: remote = scikit-learn (difference 0.0); load test peak 11,870 scores/s (2 workers), median 0.27 ms for one patient-hour. **Accelerator:** AuraZ-N (MLP 108-64-32-1, AUROC 0.800) on the NNPA through zDNN: 10.9 ms vs 354.9 ms for 32,768 rows (32.6×), AUROC 0.80858 vs 0.80859 FP32, 99.994% identical alert decisions, max probability change 0.00065 (16-bit DLFLOAT16). The 16-feature logistic model is 2–4× slower on the accelerator; tree ensembles are not an accelerator workload. IBM Z is big-endian, so binary files for the C program are written big-endian.
- **Honest limits:** 37% of PhysioNet 2019 used, two US hospitals, retrospective, no prospective test, no race/ethnicity audit, simulated cohort is a demonstration only.

## 5. Numbers cheat sheet

| Fact | Value | Source |
|---|---|---|
| Real stays used | 14,635 (919 septic) | `docs/REAL_DATA_PILOT.md` |
| AuraZ-R AUROC | 0.819 (0.791–0.845) | `public/metrics_physionet.json` |
| Without ICU-time features | 0.794 | same |
| First 16-feature model | 0.608 | same |
| Septic caught at SIRS alarm rate | 95% vs 89% | same |
| Cross-hospital AUROC | 0.737 and 0.745 | `public/audit_physionet.json` |
| Simulated demo AUROC | 0.818; 75% vs 48%; 11.7 vs 47.3 false alerts | `public/metrics.json` |
| z17 | machine 9175, Telum II | live `/health` |
| Accelerator speed-up | 32.6× vs a plain loop; 1.5× vs OpenBLAS 1 thread, 1.2× vs 2 threads (10.9 ms vs 354.9 / 15.9 / 12.7 ms, 32,768 rows); AUROC 0.80858 vs 0.80859 | `public/nnpa_z17.json` |
| Load test | 11,870 scores/s peak (2 workers), 0.27 ms median single request | `public/loadtest_z17.json` |

## 6. Do not say

"FDA", "clinically proven", "the trees run on the accelerator" (only the neural model does), "33× faster than a tuned CPU" (it is 1.2–1.5× against OpenBLAS), "world's first", "works at every hospital", or any number not in the table above.
