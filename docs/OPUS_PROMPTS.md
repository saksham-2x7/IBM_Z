# Prompts for Claude Opus 5.5 — AuraZ (IBM Z Datathon 2026)

Repo: github.com/saksham-2x7/IBM_Z. Always start a session with: "Read README.md, ml/train.py, ml/serve.py, src/lib/model.ts first. Never invent numbers: every metric shown must come from a script in this repo. Test everything yourself and show output."

## 1. Real data (biggest score lever)
Add `ml/train_physionet.py`. Download PhysioNet/CinC Challenge 2019 training sets A+B (open access, ask me before downloading), parse the .psv files, build the same 16 features as `ml/train.py` (`feat`), forward-fill labs, use SepsisLabel with a 6 h horizon, split by patient (60/20/20), fit the logistic model, split-conformal calibrate (alpha 0.1), choose the alert threshold under a 15 alerts/100 patient-days budget on the calibration split, and write public/model.json, metrics.json, replay.json in the same schema. Add a subgroup table (age bands, sex) and a calibration plot to metrics.json. Update README numbers from the output only.

## 2. NNPA / Telum II path
On the LinuxONE VM (s390x, `nnpa` flag present) export the model to ONNX, compile with the IBM Z Deep Learning Compiler (zDLC) targeting `--maccel=NNPA`, and add `ml/bench_nnpa.py` that reports P50/P99 latency for batch sizes 1, 64, 4096 for: numpy CPU, ONNX Runtime CPU, zDLC NNPA. Save to public/hw_bench.json and show it in src/components/BenchmarkLab.tsx. If NNPA is unavailable, say so in the output; do not fabricate.

## 3. Streaming at scale
Extend ml/serve.py with `POST /stream` (SSE) fed by a simulated 200-bed generator at 1 Hz per bed. Add a "Ward" view in the UI showing 200 beds ranked by risk, alert counts, and measured end-to-end alert latency. Report sustained msgs/sec honestly from the server.

## 4. UI polish (clean + minimal)
Keep 5 tabs. One accent colour, 8px grid, no glow/gradients, readable at 1280px and on a phone, WCAG AA contrast, keyboard-accessible tabs, empty/error states for the IBM Z connection. Remove mock data and any claim not backed by a script.

## 5. Submission
Rewrite the Hack2Skill abstract (<= the portal limit) from README + metrics.json: problem, why IBM Z, what is measured vs projected, impact, future scope. Generate a 3-minute demo script: replay a septic patient on the mainframe, show alert + SHAP + conformal set, show the Validation tab vs SIRS, close on IBM Z latency numbers.
