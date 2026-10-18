# AuraZ Windows Manual QA Report (Chrome & Edge)

**Tested by:** Jyothi Rodrigues (`jyothirodrigues2511-wq`)  
**Project:** AuraZ — IBM Z Datathon 2026  
**Date:** October 18, 2026  
**Operating System:** Windows 11 Pro (`Microsoft Windows NT 10.0.26200.0`, AMD64)  
**Browsers Tested:**
- Google Chrome: Version `155.0.8059.82` (Official Build, 64-bit)
- Microsoft Edge: Version `155.0.4283.62` (Official Build, 64-bit)
**Environment:**
- Local frontend: `http://localhost:5174/` (Node.js `v24.19.0`, Vite `v6.4.4`)
- Local inference server: `http://localhost:8080` (`python ml/serve.py 8080`, Python `3.14.6`)

---

## Executive Summary & Clarity Ratings

| Tab | Chrome Rating | Edge Rating | Key Interactions Verified | Screenshot |
|---|:---:|:---:|---|---|
| **1. Live Replay** | **4.5 / 5** | **4.5 / 5** | Patient selection (`TEST-01` to `TEST-08`), hour slider scrub (h6–h47), Play/Pause playback, remote scoring parity | `docs/qa/01_chrome_live_replay.png`<br>`docs/qa/06_edge_live_replay.png` |
| **2. Ward** | **4.0 / 5** | **4.0 / 5** | 200-bed batch scoring, live clock advancement, clicking bed tile deep-links to patient replay | `docs/qa/02_chrome_ward.png`<br>`docs/qa/07_edge_ward.png` |
| **3. Validation** | **4.5 / 5** | **4.5 / 5** | Full-dataset AUROC card, cross-hospital drop & recalibration, subgroup fairness, SIRS table | `docs/qa/03_chrome_validation.png` |
| **4. IBM Z** | **4.0 / 5** | **4.0 / 5** | Connect to `http://localhost:8080`, 40-request benchmark (max diff 0.0), in-process latency lab (100k inferences) | `docs/qa/04_chrome_ibm_z.png` |
| **5. Architecture** | **4.5 / 5** | **4.5 / 5** | 6-layer architecture cards, built vs next roadmap tags, code path references | `docs/qa/05_chrome_architecture.png` |

---

## Detailed Manual Test Results by Tab

### 1. Live Replay Tab
- **Actions Clicked & Tested:**
  - Selected held-out patient `TEST-01` (develops sepsis at hour 21).
  - Dragged timeline slider to hour 19.
  - Toggled `Play` / `Pause` buttons to verify automated hourly advancement.
  - Selected look-alike non-septic patient `TEST-05` (post-operative tachycardia).
- **Observed Behavior:**
  - For `TEST-01` at hour 19: Alert triggers 2 hours before clinical onset (`Alerted 2 h before sepsis onset`). Conformal prediction badge correctly states: `sepsis not ruled out`.
  - For `TEST-05` at hour 12: No alert raised (`Ground truth: Post-op tachycardia`), conformal set displays `ruled out`.
  - Top feature contributions dynamically recomputed and displayed (`3h Heart Rate trend`, `Lactate 6h change`, etc.).
  - With the local server connected, header correctly shows: `Scored on Windows · AMD64 · ~1.2 ms round trip`.
- **Confusion / Broken / Slow / Rough Edges:**
  - On viewports narrower than 1100px, the SVG line chart labels (`h0`, `h12`, `h24`...) crowd together.
  - Non-statisticians might wonder what "conformal set @ 90%" means without an explanatory tooltip.
- **Clarity Rating:** `4.5 / 5`

---

### 2. Ward Tab (200 Held-Out Beds)
- **Actions Clicked & Tested:**
  - Clicked `Play` to advance ward time from hour 6 to hour 24.
  - Clicked `Pause` to freeze playback.
  - Clicked individual bed tiles (e.g., `BED-002`, `BED-014`).
- **Observed Behavior:**
  - All 200 beds score simultaneously every hour. Local scoring time averages `0.2–0.4 ms`.
  - Bed tiles update color dynamically: amber for active sepsis alerts, cyan for rising risk, dark slate for stable, gray for post-onset.
  - Clicking any alerting bed tile immediately navigates the user to the **Live Replay** tab focused on that exact patient at the current hour.
- **Confusion / Broken / Slow / Rough Edges:**
  - Rapid playback creates frequent DOM rerenders across 200 SVG elements. In Edge and Chrome on Windows, performance was smooth (~60 fps), but background tooltips on hover can lag slightly during playback.
- **Clarity Rating:** `4.0 / 5`

---

### 3. Validation Tab
- **Actions Clicked & Tested:**
  - Reviewed the real-data PhysioNet 2019 panel (`AuraZ-R`: AUROC 0.831 on full 39,317 stays).
  - Inspected the cross-hospital generalization drop (hospital B drops to 0.771–0.787) and the recalibration card (restoring 90% coverage with ~200 local stays).
  - Inspected subgroup fairness metrics (female AUROC 0.835 vs male AUROC 0.828).
  - Verified the classic SIRS rule comparison table (75% sensitivity for AuraZ vs 48% for SIRS; 11.7 vs 47.3 false alerts / 100 patient-days).
- **Observed Behavior:**
  - Metrics render without any layout shift. Numbers strictly match `public/metrics.json` and `public/full/metrics_physionet.json`.
- **Confusion / Broken / Slow / Rough Edges:**
  - High information density; first-time judges may appreciate a toggle or quick filter between "Simulated Cohort (Method Demo)" and "Real PhysioNet Cohort".
- **Clarity Rating:** `4.5 / 5`

---

### 4. IBM Z Tab
- **Actions Clicked & Tested:**
  - Entered `http://localhost:8080` in the endpoint field and clicked `Connect`.
  - Clicked `Benchmark remote (40 requests)`.
  - Clicked `Score 100,000 patient-hours now` in the Latency Lab.
  - Adjusted the Cloud API path assumption sliders (network latency and queue delay).
- **Observed Behavior:**
  - Connection pill immediately turned green: `connected · Windows · AMD64`.
  - Remote benchmark completed 40 requests:
    - P50 round trip: `1.2 ms` (localhost loopback)
    - P50 server compute: `14.8 µs`
    - Max `|remote − local|`: `0.0e+0` (exact numerical identity)
  - In-process Latency Lab executed 100,000 inferences in ~122 ms (`1.22 µs / inference`, throughput ~820,000/s).
- **Confusion / Broken / Slow / Rough Edges:**
  - The "Run AuraZ-R (300 real test stays)" test runs in pure Python on Windows without C-accelerated BLAS, taking ~7 seconds. On automated test harnesses expecting <5s, this can cause a timeout check failure if not given sufficient wait time.
- **Clarity Rating:** `4.0 / 5`

---

### 5. Architecture Tab
- **Actions Clicked & Tested:**
  - Navigated to Architecture tab and inspected the 6 sequential layers.
- **Observed Behavior:**
  - Clear breakdown from Bedside Data, Features, Models, Serving, Accelerator, to Clinician App.
  - Status badges accurately display `built` (green) for layers 1–4 and 6, and `next` (gray) for Layer 5 (Telum II NNPA compiler acceleration).
  - Code paths (`ml/train.py`, `src/lib/model.ts`, `ml/serve.py`) are clearly identified.
- **Confusion / Broken / Slow / Rough Edges:**
  - A visual SVG diagram showing the physical hardware dataflow (bedside monitor -> LinuxONE s390x transaction engine -> nurse station) would make the architectural story even more compelling.
- **Clarity Rating:** `4.5 / 5`

---

## Cross-Browser Comparison: Chrome vs Edge on Windows

1. **Rendering Parity:** Both Google Chrome and Microsoft Edge rendered CSS layouts, Tailwind 4 classes, Lucide icons, and SVG charts identically (Chromium engine parity).
2. **Performance:** In-process inference latency benchmark in the browser was virtually identical:
   - Chrome: `1.22 µs` mean / inference
   - Edge: `1.24 µs` mean / inference
3. **Accessibility & Keyboard Navigation:**
   - Navigating tabs with keyboard (`ArrowRight` / `ArrowLeft`) worked smoothly on both browsers. Focus rings were clearly visible.

---

## Saved Screenshot Artifacts (`docs/qa/`)

All screenshots were captured from the live application and saved as PNG files under 300 KB each:
1. `docs/qa/01_chrome_live_replay.png` (269 KB) — Live Replay with patient `TEST-01` at hour 19 (sepsis alert raised, 2h before onset).
2. `docs/qa/02_chrome_ward.png` (263 KB) — Ward tab displaying 200 beds scored in batch mode.
3. `docs/qa/03_chrome_validation.png` (284 KB) — Validation tab showing PhysioNet 2019 full dataset metrics and SIRS table.
4. `docs/qa/04_chrome_ibm_z.png` (264 KB) — IBM Z tab with active Windows connection and benchmark results.
5. `docs/qa/05_chrome_architecture.png` (260 KB) — Architecture tab showing 6-layer system implementation.
6. `docs/qa/06_edge_live_replay.png` (269 KB) — Microsoft Edge rendering of Live Replay with non-septic lookalike patient `TEST-05`.
7. `docs/qa/07_edge_ward.png` (260 KB) — Microsoft Edge rendering of the 200-bed surveillance ward.
