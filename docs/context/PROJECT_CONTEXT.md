# AuraZ — shared project context (every AI agent reads this first)

## What this is
AuraZ is an explainable, calibrated ICU **sepsis early-warning** system built for the **IBM Z Datathon 2026** (theme: Technology for Good). It scores each ICU patient every hour and predicts sepsis onset within the next 6 hours. Each alert has (1) a per-feature explanation and (2) a conformal-prediction uncertainty set. Inference is designed to run **beside the data on IBM Z / LinuxONE** so patient data never leaves the hospital.

Repo: https://github.com/saksham-2x7/IBM_Z  ·  Stack: Python (stdlib + numpy/sklearn for training), React 19 + TypeScript + Vite + Tailwind 4.

## What is REAL vs NOT (never blur this)
| Item | Status |
|---|---|
| Training/validation pipeline `ml/train.py` | Real, runs. Data is a **simulated** ICU cohort (confounders, sparse labs) |
| Real-data retrain `ml/train_physionet.py` | Run on a 772-stay PhysioNet 2019 sample: **AUROC 0.62 (95% CI 0.48–0.73) — simulated results do NOT transfer.** See `docs/REAL_DATA_PILOT.md`. Always disclose this |
| Model + browser scoring `public/model.json`, `src/lib/model.ts` | Real |
| IBM LinuxONE inference service `ml/serve.py` | Real. Verified on a real **IBM z17 (machine 9175, Telum II, `nnpa` flag present)**: remote scores equal local scores exactly, ~12 µs server compute. Runs on CPU, **NOT yet on the NNPA accelerator** |
| Telum II / NNPA acceleration (ONNX + zDLC) | **Not done** (roadmap). Never claim it |
| Clinical validity | **Not** validated on patients. Research prototype, not a medical device |

Held-out results on the **simulated** cohort (a method demo, NOT clinical performance) (source of truth: `public/metrics.json`): AUROC 0.818 (95% CI 0.805–0.832); AuraZ catches 75% of septic patients early vs 48% for the classic SIRS≥2 rule, with 11.7 vs 47.3 false alerts per 100 patient-days; conformal coverage 89.8% at a 90% target.

## Golden rules
1. **No invented numbers.** Every metric/claim comes from `public/metrics.json`, a script in the repo, or a source URL you verified. If you can't source it, delete it.
2. Say "simulated" wherever simulated data is the basis. Never say "world's first", "FDA", "HIPAA-certified", or give hardware numbers not in the repo.
3. Only edit files you own (see your agent file). Work on your own branch, open a PR to `main`. Never push to `main`.
4. Before every PR: `npm install && npx tsc && npm run build` must pass.
5. Show real command output when you claim something works.

## File map
- `ml/train.py` — simulates cohort, trains logistic model, split-conformal calibration, alert threshold under a false-alert budget, exports `public/{model,metrics,replay,ward}.json`
- `ml/train_physionet.py` — same pipeline on real PhysioNet 2019 `.psv` files
- `ml/serve.py` — stdlib HTTP service: `GET /health` (arch, IBM machine type, NNPA flag), `POST /score {"batch":[[16 features],…]}`; CORS on; runs on LinuxONE with nothing to install
- `public/model.json` (weights, mean/std, conformal qhat, alert threshold), `metrics.json`, `replay.json` (8 held-out patients), `ward.json` (200 held-out stays)
- `src/lib/model.ts` — feature builder, scorer, SHAP-exact contributions (linear model), conformal set; `src/lib/remote.ts` — client for `serve.py`
- `src/components/` — `ReplayLab` (hour-by-hour patient replay), `WardView` (200 beds), `ValidationPanel` (metrics vs SIRS), `BenchmarkLab` ("IBM Z" tab: connect to LinuxONE, remote benchmark, in-browser latency), `ArchitectureExplorer`, `SubmissionHub`, `Header`
- `src/App.tsx` — 6 tabs: Live Replay · Ward · Validation · IBM Z · Architecture · Submission
- `docs/TEAM_PLAN.md` — who does what; `docs/OPUS_PROMPTS.md` — Claude-side prompts

## Run locally
```bash
npm install && npm run dev          # http://localhost:5174
python3 ml/train.py                 # regenerate public/*.json (simulated cohort, ~25 s)
python3 ml/serve.py 8080            # local inference service (same code that runs on LinuxONE)
```
In the app: **IBM Z** tab → endpoint `http://localhost:8080` → Connect → "Benchmark remote". The Live Replay and Ward tabs then say "Scored on …".
