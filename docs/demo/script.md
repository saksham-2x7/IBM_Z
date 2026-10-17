# AuraZ: 3-Minute Live System Demonstration Script
### IBM Z Datathon 2026 // Technology for Good
**Theme:** Explainable, Calibrated ICU Sepsis Early-Warning on IBM Z / LinuxONE  
**Target Duration:** Exactly 3:00 minutes (180 seconds)  
**Live URL:** `http://localhost:5174` (or deployed instance)  
**Mainframe Endpoint:** `http://localhost:8080` (or `http://<LinuxONE-VM-IP>:8080`)

---

## Technical & Clinical Disclosures (Golden Rules)
1. **Data Source:** Primary evaluation runs on a simulated 48-hour ICU cohort (1,000 stays) incorporating clinical confounders and sparse labs.
2. **Real-Data Pilot:** When evaluated on a 772-stay sample from PhysioNet 2019, AUROC is **0.62 (95% CI 0.48–0.73)** — simulated performance does **not** transfer out-of-the-box. Full 40k-stay retraining and gradient-boosted models are roadmap milestones.
3. **Hardware Status:** IBM LinuxONE inference service (`ml/serve.py`) was verified on a real **IBM z17 (Machine 9175, Telum II, `nnpa` flag present)**. Remote scoring matches browser scoring bit-for-bit with ~12 µs server compute. Execution runs on CPU; NNPA on-chip acceleration via ONNX / zDLC is next on the roadmap.
4. **Clinical Scope:** AuraZ is an academic research prototype, not an FDA-cleared medical device.

---

## Timing Breakdown Overview

| Timecode | Segment | Tab | Key Message |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:35** | Flow 1: Early Sepsis Detection | **Live Replay** | Alert triggered 6 h before onset; conformal set; plain English SHAP driver. |
| **0:35 – 1:10** | Flow 2: Confounder Suppression | **Live Replay** | Post-op tachycardia & hypovolaemia look-alikes do *not* trigger false alarms. |
| **1:10 – 1:50** | Flow 3: Clinical Benchmarking | **Validation** | 75% sensitivity vs 48% SIRS; 75% reduction in false alert fatigue (11.7 vs 47.3). |
| **1:50 – 2:25** | Flow 4: LinuxONE Mainframe Co-Location | **IBM Z** | Machine 9175 / Telum II verification; bit-exact remote=local scoring; ~12 µs compute. |
| **2:25 – 3:00** | Flow 5: Ward-Scale Telemetry | **Ward** | 200 ICU beds batch-scored every hour; click-through drill-down into replay. |

---

## Detailed Cue-by-Cue Walkthrough

### 0:00 – 0:35 · Flow 1: Early Sepsis Detection on Held-Out Patient
- **Target Tab:** `Live Replay`
- **Initial Setup:** Select `TEST-01 · Develops sepsis`.
- **Exact Action:**
  1. Click the timeline slider or press **Play** to advance from **Hour 6** to **Hour 15**.
  2. Notice that at Hour 15, the risk curve crosses the **17% alert threshold** (rising to 34%).
  3. Point to the **Sepsis Alert Raised** badge, the **Conformal set @ 90%: SEPSIS**, and the **Driver summary** box.
- **Narration / Voiceover:**
  > *"Every hour of delayed sepsis intervention increases ICU mortality by up to 8%. Current hospital alerting models suffer from crippling 85% false alarm rates. Here in AuraZ's Live Replay, we are evaluating a held-out patient who develops septic shock at hour 21.*
  > 
  > *At hour 15—six full hours before clinical collapse—AuraZ crosses the calibrated 17% alert threshold. Rather than giving clinicians a black-box percentage, AuraZ outputs a 90% coverage conformal prediction set confirming sepsis risk, alongside an explainable driver summary: 'Rising respiratory rate over 3 h, falling blood pressure over 3 h, and accumulating serum lactate over 6 h.' Clinicians understand immediately why the alert fired."*

---

### 0:35 – 1:10 · Flow 2: Confounder Suppression (Combating Alarm Fatigue)
- **Target Tab:** `Live Replay`
- **Exact Action:**
  1. Click **TEST-07 · Post-op tachycardia (confounder)** button.
  2. Drag the hour slider across the entire 48-hour stay (e.g. Hour 18 to Hour 30).
  3. Point out that Heart Rate is elevated (115+ bpm), yet AuraZ displays **No Alert Raised** (risk remains at 4–8%).
  4. Click **TEST-08 · Hypovolaemia (confounder)** and show similar calm stability.
- **Narration / Voiceover:**
  > *"The primary cause of ICU alert fatigue is confounders: post-operative patients with elevated heart rates or trauma patients with dehydration that fool simplistic rules. Let's switch to TEST-07: a post-op patient with severe tachycardia.*
  > 
  > *Notice that despite a heart rate exceeding 115 beats per minute, the risk score stays low at 4%, safely below the threshold. The driver summary confirms: 'Physiological stability driven by preserved arterial pressure and normal lactate.' By modeling longitudinal delta trends rather than isolated static vitals, AuraZ filters out benign hemodynamic spikes."*

---

### 1:10 – 1:50 · Flow 3: Empirical Validation vs Standard Clinical Rules
- **Target Tab:** Click `Validation` in the header tab bar.
- **Exact Action:**
  1. Scroll slightly to display the side-by-side comparison table between AuraZ and the classic SIRS (Systemic Inflammatory Response Syndrome) rule.
  2. Highlight the AUROC curve (0.818 vs 0.729) and the false alert metrics.
- **Narration / Voiceover:**
  > *"Navigating to the Validation tab, we compare AuraZ on held-out data against the standard bedside SIRS rule. AuraZ achieves an AUROC of 0.818 compared to 0.729 for SIRS.*
  > 
  > *More importantly for clinical staff, under a calibrated budget, AuraZ captures 75% of septic patients early compared to just 48% for SIRS, while slashing false alerts from 47.3 down to 11.7 alerts per 100 patient-days—a 75% reduction in alarm fatigue.*
  > 
  > *We also disclose our real-data pilot on 772 PhysioNet stays, where AUROC dropped to 0.62. We do not hide this: real-world clinical data requires full-scale dataset retraining and gradient boosting, which forms the next phase of our work."*

---

### 1:50 – 2:25 · Flow 4: IBM LinuxONE In-Transaction Scoring & Zero-Egress
- **Target Tab:** Click `IBM Z` in the header tab bar.
- **Exact Action:**
  1. Verify the endpoint is set to `http://localhost:8080` (or the LinuxONE VM IP) and click **Connect**.
  2. Point to the status pill in the header: **z17 Online**.
  3. Click **Benchmark remote (40 requests)** and point to the results:
     - `Server compute P50: 2.4 µs` (or ~12 µs on LinuxONE)
     - `Max |remote - local|: 0.0e+0` (exact match)
  4. Click **Score 100,000 patient-hours now** in the Latency Lab to show local in-process microsecond execution vs 55 ms simulated cloud round-trip.
- **Narration / Voiceover:**
  > *"Why IBM Z? Protected health information cannot be broadcast over public cloud APIs due to HIPAA sovereignty and unpredictable network jitter. The model must live beside the data.*
  > 
  > *In the IBM Z tab, our inference service connects directly to LinuxONE. We verified this on an IBM z17 mainframe—machine type 9175 with the Telum II on-chip AI accelerator and NNPA flag present. Running remote verification, the mainframe executes in 12 microseconds per patient with bit-exact numerical parity to local scoring.*
  > 
  > *In our Latency Lab, 100,000 patient hours score in just a fraction of a millisecond in-process, compared to 55 milliseconds over a cloud round-trip."*

---

### 2:25 – 3:00 · Flow 5: Ward-Scale 200-Bed Surveillance & Clinical Workflow
- **Target Tab:** Click `Ward` in the header tab bar.
- **Exact Action:**
  1. Click **Play** on the ward surveillance banner to advance simulation hours.
  2. Point to the **200 Bed Matrix** displaying colorblind-safe orange (alert) and sky-blue (rising) tiles.
  3. Click an orange bed tile (e.g., `BED-088` or `BED-062`).
  4. Demonstrate the seamless click-through: the app instantly transitions back to `Live Replay` loaded with that specific patient at that exact hour!
- **Narration / Voiceover:**
  > *"Finally, in the Ward view, we see hospital-scale surveillance in action: 200 ICU beds scored together every hour in a single batch on the mainframe.*
  > 
  > *Clinicians have complete situational awareness. At a glance, orange tiles denote active alerts, blue indicates rising risk, and gray indicates stable physiology. When an intensivist spots an alerting bed, clicking the tile instantly opens that patient in Live Replay with full trajectory graphs and SHAP explanations ready for immediate clinical rounds.*
  > 
  > *AuraZ brings zero-egress, explainable AI directly onto IBM Z mainframes to save lives where it matters most."*

---

## Demo Asset Checklist (in `docs/demo/`)

- [x] `01_live_replay_septic.png` — TEST-01 at hour 15; alert fired 6h before onset; conformal set; plain English SHAP driver.
- [x] `02_lookalike_nonseptic.png` — TEST-07 post-op tachycardia confounder; stable risk suppression.
- [x] `03_validation_vs_sirs.png` — Validation tab; AUROC 0.818 vs 0.729; 75% vs 48% sensitivity; false alarm budget.
- [x] `04_ibm_z_remote_verification.png` — Connected to inference service; server compute latency; remote = local exact match.
- [x] `05_ward_surveillance.png` — 200-bed matrix; KPI cards; colorblind-safe status palette.
- [x] `06_conformal_uncertainty.png` — Close-up of conformal set calibration and patient trajectory.
