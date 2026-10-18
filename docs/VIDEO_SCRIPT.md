# AuraZ demo video: script, tech stack and explanations

Length: about 3:45. Record at 1920×1080 with the browser zoomed to 100%. Every number below comes from `public/metrics*.json`, `public/audit_physionet.json` or the live app.

## 0. Before you record (10 minutes)

```bash
cd IBM_Z && npm install && npm run dev          # app at http://localhost:5174
python3 ml/serve.py 8080                         # local inference service (optional, for the IBM Z tab)
```
- **To show the real mainframe:** start `python3 ml/serve.py 8080` on the LinuxONE VM, then `ssh -N -L 8080:localhost:8080 -i <key>.pem linux1@<VM-IP>` on your laptop. Check `curl localhost:8080/health` shows `"system": "IBM z17 (Telum II)"`. If the VM is gone, skip Part 4's live connect and show `docs/demo/04_ibm_z_remote_verification.png` instead, and say it was recorded on the z17.
- **Recording tools:** QuickTime (File → New Screen Recording) or OBS, plus any editor (iMovie, CapCut). Mic on, notifications off, browser in full screen, light theme as shipped.
- Rehearse once. Speak slowly; judges read the screen while you talk.

## 1. The 3:45 script

| Time | On screen | Say (plain language) | Technical add-on (say only if you have time) |
|---|---|---|---|
| **0:00–0:20** | Live Replay tab, nothing clicked | "Sepsis is a life-threatening reaction to infection, and every hour of delayed treatment matters. Hospitals have alarms for it, but they ring so often that nurses learn to ignore them. AuraZ is an early-warning system that rings less often, earlier, and tells you why." | "It predicts Sepsis-3 onset within 6 hours, scored every hour per patient." |
| **0:20–1:05** | Click **TEST-01**, drag the slider to **hour 19** | "This is a patient the model has never seen. The line is the predicted risk. At hour 19 it crosses the alert line, two hours before the patient actually becomes septic at hour 21. On the right, in plain English, it says why: rising temperature, rising breathing rate, faster heartbeat. It also says 'sepsis not ruled out', which is its honesty label." | "The explanation is exact: each feature's contribution to the log-odds equals its SHAP value because the demo model is linear. The label comes from class-conditional conformal prediction at 90% per class." |
| **1:05–1:35** | Click **TEST-05 · Stable**, slide to **hour 12**, then **hour 30** | "Here is a stable patient. The system says 'ruled out' and stays quiet. Our test set also has look-alikes, like post-surgery patients whose heart rate is high for harmless reasons, to see if it overreacts." | "Alerts use a threshold chosen on a separate calibration set under a budget of 15 false alerts per 100 patient-days." |
| **1:35–2:25** | **Validation** tab. Start at the top (real-data panel) | "Now the honest part. First we tested on made-up patients and it looked great, but that is only a demonstration. So we trained on real ICU data from PhysioNet: about 14,600 patients. Our first model only reached 0.61, so we rebuilt it using every measurement and how recently each was taken. The new model, AuraZ-R, scores 0.82 on patients it has never seen. At the same alarm volume as the standard SIRS rule, it catches 95% of septic patients early versus 89%." | "AUROC 0.819, 95% CI 0.79 to 0.84, 175 septic test stays; 0.794 without ICU-time features, 0.766 without recency features, so it is not just learning how long someone has been in the ICU." |
| **2:25–2:50** | Scroll to **External validation and fairness audit** | "We also tested it on a different hospital than it was trained on. It drops to about 0.74, and its confidence guarantee weakens, so each hospital must recalibrate before using it. We checked by sex and age too: ranking accuracy is similar, but at one fixed alert level some groups get flagged less often, which we flag for follow-up. We would rather show you our weak spots than hide them." | "Train A → test B: 0.737; B → A: 0.745. Septic-class coverage 70% in A→B. Subgroup alert sensitivity ranges 23% to 54% on groups of 35 to 119 septic stays." |
| **2:50–3:25** | **IBM Z** tab → **Connect** → **Run AuraZ-R real-data trees** → **Benchmark remote** | "Why IBM Z? Hospital data already lives on systems like this. Moving it out to an outside service adds risk and delay, so AuraZ is built to score where the data is. This is a real IBM z17 mainframe on the LinuxONE Community Cloud. Our service runs on it with nothing to install. We send it real patient data and its answers match our reference exactly. The calculation takes microseconds; the 400 milliseconds you see is just the distance to the data centre. Today it runs on the regular processor; using the Telum II AI accelerator is our next step." | "Machine type 9175, NNPA flag present. `/score_real` scores the 300 trees in pure Python; remote vs browser vs scikit-learn difference is 0.0. A FHIR endpoint turns Observation bundles into RiskAssessments." |
| **3:25–3:45** | **Ward** tab → **Play** → click a bed | "In a ward, all 200 beds are scored together every hour, and clicking any bed opens that patient. AuraZ: explainable, honest about uncertainty, and built to live next to the data on IBM Z. Thank you." | "One batch request per hour to the mainframe; the ward view shows the scoring time." |

**If asked about the "uncertain" label vs the alert:** the alert means "act now" (budgeted to limit alarms); the label means "can the model exclude sepsis at 90% confidence" and is deliberately more cautious.

## 2. Tech stack and tools

| Layer | What we used | Why |
|---|---|---|
| App (front end) | React 19, TypeScript 5, Vite, Tailwind CSS 4, lucide-react icons, Inter font | Fast, typed, and runs the model in the browser |
| Models | Python (NumPy, scikit-learn): logistic regression (demo) and gradient-boosted trees (real data, 300 trees, 108 features) | Trees suit messy ICU tables with missing values |
| Trust layer | Class-conditional split conformal prediction; exact linear SHAP explanations; false-alarm budget threshold | Says when it is unsure; explains every alert |
| Data | PhysioNet/CinC Challenge 2019 (public real ICU data, two hospitals); a simulated cohort with look-alike patients | Real for claims, simulated for the demo |
| Serving | Python standard library only (`http.server`), JSON, HTTP keep-alive, FHIR RiskAssessment output, alert audit log | Runs on s390x with nothing to install |
| IBM | IBM LinuxONE Community Cloud, IBM z17 (machine 9175, Telum II), RHEL 9 / Ubuntu 24.04 on s390x | The real IBM Z hardware we ran on |
| Next on IBM | ONNX + IBM Z Deep Learning Compiler for the NNPA accelerator | Not done yet |
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
- **IBM Z:** stdlib Python service on s390x; `/health` reports architecture, machine type and the NNPA CPU flag; `/score`, `/score_real`, `/fhir/score`. z17 runs (final model): demo model about 12 µs compute per request, 300 real rows through the trees at about 150–200 µs per row, remote = scikit-learn (difference 0.0); the FHIR endpoint also runs there. CPU only; NNPA not used.
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
| z17 | machine 9175, Telum II, NNPA flag present, CPU inference | live `/health` |

## 6. Do not say

"FDA", "clinically proven", "uses the Telum II accelerator", "world's first", "works at every hospital", or any number not in the table above.
