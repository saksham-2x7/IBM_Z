# AuraZ: 3-Minute Live System Demonstration Script
### IBM Z Datathon 2026 // Technology for Good
**Theme:** Explainable, Calibrated ICU Sepsis Early-Warning on IBM Z / LinuxONE  
**Target Duration:** Exactly 3:00 minutes (180 seconds)  
**Live URL:** `http://localhost:5174` (or deployed instance)  
**Mainframe Endpoint:** `http://localhost:8080` (or `http://<LinuxONE-VM-IP>:8080`)

---

## Technical & Clinical Disclosures (Golden Rules)
1. **Data Source:** Primary evaluation runs on a simulated ICU cohort (clinically parameterized with clinical confounders and sparse labs; 3,000 held-out test stays).
2. **Real-Data Pilot:** When evaluated on real clinical data in `docs/REAL_DATA_PILOT.md` (**4,989 usable stays, 289 septic** from PhysioNet 2019), the deployed logistic model achieves **AUROC 0.608 (95% CI 0.560–0.653)** (with gradient-boosting achieving 0.677). Simulated-cohort performance does **not** transfer out-of-the-box to real clinical data. Full 40k-stay retraining, additional challenge variables, and gradient-boosted architectures are roadmap milestones.
3. **Hardware Status:** IBM LinuxONE inference service (`ml/serve.py`) was verified on a real **IBM z17 (Machine 9175, Telum II, `nnpa` flag present)**. Remote scoring matches browser scoring bit-for-bit with ~12 µs server compute. Inference currently **runs on CPU; NNPA on-chip acceleration via ONNX / zDLC is next on the roadmap**.
4. **Clinical Scope:** AuraZ is an academic research prototype, not an FDA-cleared medical device.

---

## Timing Breakdown Overview

| Timecode | Segment | Tab | Key Message |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:35** | Flow 1: Early Sepsis Detection | **Live Replay** | TEST-01 alerts at hour 19 (2 h before onset at h21); conformal set; plain English SHAP driver. |
| **0:35 – 1:10** | Flow 2: Confounder Suppression | **Live Replay** | Look-alike non-septic patient (TEST-08 hypovolaemia or TEST-05 stable) does *not* trigger false alarms. |
| **1:10 – 1:50** | Flow 3: Clinical Benchmarking | **Validation** | AUROC 0.818; 75% sensitivity vs 48% SIRS; 11.7 vs 47.3 false alerts / 100 patient-days; honest 4,989-stay pilot disclosure. |
| **1:50 – 2:25** | Flow 4: LinuxONE Mainframe Co-Location | **IBM Z** | Machine 9175 / Telum II verification; CPU inference; remote = local exact match; NNPA is next. |
| **2:25 – 3:00** | Flow 5: Ward-Scale Telemetry | **Ward** | 200 ICU beds batch-scored every hour; click-through drill-down into replay for any ward bed. |

---

## Detailed Cue-by-Cue Walkthrough

### 0:00 – 0:35 · Flow 1: Early Sepsis Detection on Held-Out Patient
- **Target Tab:** `Live Replay`
- **Initial Setup:** Select `TEST-01 · Develops sepsis`.
- **Exact Action:**
  1. Click the timeline slider or advance to **Hour 19**.
  2. Notice that at Hour 19, the risk score rises to **56%**, crossing the **17% alert threshold**.
  3. Point to the **Sepsis Alert Raised (56%)** badge, the confirmation that the alert fired **2 h before sepsis onset** (ground truth onset at h21), the **Conformal set @ 90%**, and the **Driver summary** box.
- **Narration / Voiceover:**
  > *"Welcome to AuraZ, an explainable ICU sepsis early-warning system designed for IBM Z and LinuxONE. Here in the Live Replay tab, we evaluate held-out patient TEST-01, whose ground truth sepsis onset occurs at hour 21.*
  > 
  > *At hour 19—two hours before clinical collapse—AuraZ crosses the calibrated 17% alert threshold, scoring 56% predicted risk. Rather than issuing an uncalibrated point estimate, AuraZ computes a 90% coverage conformal prediction set alongside an actionable driver summary: 'Rising temperature trend over 3 h, rising respiratory rate over 3 h, and accelerating heart rate over 3 h.' Clinicians can immediately inspect the underlying physiological trajectory."*

---

### 0:35 – 1:10 · Flow 2: Confounder Suppression (Combating Alarm Fatigue)
- **Target Tab:** `Live Replay`
- **Exact Action:**
  1. Click **TEST-08 · Hypovolaemia (confounder)** button (or select **TEST-05 · Stable**).
  2. Move the hour slider across the stay (e.g. to **Hour 20**).
  3. Point out that AuraZ displays **No Alert Raised** with predicted risk low at **4%**, safely below the 17% alert threshold.
  4. Highlight the conformal set: `NOT-AT-RISK`.
- **Narration / Voiceover:**
  > *"A critical challenge in intensive care is alarm fatigue caused by hemodynamic look-alikes—such as hypovolaemic dehydration or post-surgical changes that trigger simplistic threshold alarms.*
  > 
  > *Let's switch to TEST-08, a patient with hypovolaemia who never develops sepsis. Notice that at hour 20, the risk score remains calm at just 4%, well below the 17% alert threshold, with the conformal set confirming 'not-at-risk'. AuraZ's multi-feature temporal model avoids reflexive false alarms by evaluating cross-vital trajectories rather than isolated vital signs."*

---

### 1:10 – 1:50 · Flow 3: Empirical Validation vs Standard Clinical Rules
- **Target Tab:** Click `Validation` in the header tab bar.
- **Exact Action:**
  1. Scroll down to show the validation cards and the comparative alert burden table against the classic SIRS (Systemic Inflammatory Response Syndrome) rule.
  2. Highlight the model AUROC of **0.818 (95% CI 0.805–0.832)**, AUPRC **0.304**, and conformal empirical coverage of **89.8%** against the 90% target.
  3. Highlight the comparative table: **75% vs 48%** septic patients caught early, and **11.7 vs 47.3** false alerts per 100 patient-days.
  4. Point to the transparency disclosure regarding real clinical data.
- **Narration / Voiceover:**
  > *"In the Validation tab, we benchmark AuraZ on held-out data. AuraZ achieves an AUROC of 0.818 with calibrated 89.8% conformal coverage against our 90% guarantee.*
  > 
  > *Under a fixed false-alert budget, AuraZ captures 75% of septic patients early compared to just 48% for the classic SIRS rule, while cutting false alerts from 47.3 down to 11.7 per 100 patient-days.*
  > 
  > *Crucially, we openly disclose our real-data pilot from docs/REAL_DATA_PILOT.md on 4,989 usable PhysioNet stays, where AUROC was 0.61. We make no exaggerated claims: simulated results do not transfer automatically to noisy hospital EHRs, and deploying gradient-boosted models with more clinical variables is our explicit next milestone."*

---

### 1:50 – 2:25 · Flow 4: IBM LinuxONE In-Transaction Scoring & Zero-Egress
- **Target Tab:** Click `IBM Z` in the header tab bar.
- **Exact Action:**
  1. Point to the status indicator showing active connection to the inference service (`ml/serve.py`).
  2. Click **Benchmark remote (40 requests)** and review the telemetry:
     - `Server compute P50: ~12 µs` (or local benchmark microseconds)
     - `Max |remote - local|: 0.0e+0` (exact numerical match)
  3. Click **Score 100,000 patient-hours now** in the Latency Lab to demonstrate in-process mainframe inference vs high-latency cloud round-trips.
- **Narration / Voiceover:**
  > *"Why IBM Z? Protected health information cannot be broadcast across public cloud APIs due to HIPAA sovereignty and unpredictable network latency. AuraZ scores directly on LinuxONE beside the transaction bus.*
  > 
  > *We verified our inference engine on an IBM z17 mainframe—machine type 9175 with the Telum II processor and NNPA capability. Inference currently runs on CPU at approximately 12 microseconds per patient, achieving bit-exact numerical agreement with local scoring. On-chip hardware acceleration using Telum II's Integrated AI Accelerator via ONNX and the IBM Z Deep Learning Compiler is our next roadmap deliverable."*

---

### 2:25 – 3:00 · Flow 5: Ward-Scale 200-Bed Surveillance & Clinical Workflow
- **Target Tab:** Click `Ward` in the header tab bar.
- **Exact Action:**
  1. Click **Play** on the ward surveillance banner to advance simulation hours.
  2. Point to the **200 Bed Matrix** displaying colorblind-safe orange (alert), sky-blue (rising), and slate (low risk) tiles.
  3. Click any bed tile (e.g. `BED-088` or `BED-062`).
  4. Show that clicking the tile immediately opens that exact patient in `Live Replay` at that specific hour with full SHAP driver explanations and trajectory curves.
- **Narration / Voiceover:**
  > *"Finally, in the Ward view, we see hospital-wide surveillance: 200 ICU beds scored together every hour in a single batch.*
  > 
  > *Our colorblind-safe matrix immediately surfaces patients needing intervention: orange indicates active alerts, blue shows rising risk, and slate indicates stable beds. Clicking any bed tile instantly opens that patient in Live Replay at the current hour, providing doctors with immediate explainability for rapid clinical response.*
  > 
  > *AuraZ demonstrates how explainable, zero-egress AI on IBM Z can transform real-time clinical decisions and save lives."*

---

## Demo Asset Checklist (in `docs/demo/`)

- [x] `01_live_replay_septic.png` — TEST-01 at hour 19; alert fired at h19 (2 h before onset at h21); risk 56%; conformal set; plain English SHAP driver.
- [x] `02_lookalike_nonseptic.png` — TEST-08 hypovolaemia confounder at hour 20; risk 4% (no alert raised); conformal set: not-at-risk.
- [x] `03_validation_vs_sirs.png` — Validation tab; AUROC 0.818; 75% vs 48% sensitivity; 11.7 vs 47.3 false alerts / 100 patient-days; honest clinical disclosures.
- [x] `04_ibm_z_remote_verification.png` — Connected to inference service; server compute latency; remote = local exact match; CPU execution with NNPA on roadmap.
- [x] `05_ward_surveillance.png` — 200-bed matrix; KPI cards; colorblind-safe status palette.
- [x] `06_conformal_uncertainty.png` — Close-up of conformal set calibration and patient trajectory.
