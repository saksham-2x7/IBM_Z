# Context for Naman's AI agents (GPT + Antigravity) — Evidence, writing, testing

**First, read `docs/context/PROJECT_CONTEXT.md` fully.** Your branch: `naman/docs`. Use **GPT for research/writing** (Phases 1–2) and **Antigravity for tests/code** (Phase 3). You never change `ml/*`, `public/*.json` or UI components.

## Files you own
- Phase 1: `docs/clinical.md`
- Phase 2: `docs/abstract.md`, `docs/whitepaper.md`
- Phase 3: `tests/*`, `docs/qna.md` (+ add `vitest` devDependency and a `test` script in `package.json` — only those lines)

## Phase 1 — Clinical grounding (GPT)
> Read PROJECT_CONTEXT.md. Write `docs/clinical.md` (≤1 page): the problem AuraZ addresses, with 8–10 facts on (a) global sepsis burden, (b) mortality rise per hour of delayed antibiotics, (c) alert fatigue in ICUs, (d) limits of SIRS/qSOFA, (e) the Sepsis-3 definition, (f) why data privacy blocks cloud AI in hospitals. For EACH fact give the exact source URL and the supporting sentence in your own words. Prefer WHO, Lancet, NEJM, JAMA, Surviving Sepsis Campaign, PhysioNet. If you cannot verify a number, write "unverified" and don't use it. Do not mention AuraZ's own results in this file.

## Phase 2 — Abstract + whitepaper (GPT)
> Using ONLY README.md, `public/metrics.json`, PROJECT_CONTEXT.md and `docs/clinical.md`, write (1) `docs/abstract.md` — Hack2Skill abstract: problem, solution, why IBM Z, measured vs projected, impact, future scope (keep it under the portal's limit; ask Saksham for the limit, default 250 words); (2) `docs/whitepaper.md` — 2 pages: problem, method (features, logistic model, conformal, alerting budget), results table vs SIRS, IBM LinuxONE verification (z17, machine 9175, NNPA flag present, CPU inference, remote=local), limitations (simulated data, no prospective validation, not a medical device, NNPA not yet used), roadmap. Every number must match metrics.json exactly. Do not write hardware speedups that are not in the repo.

## Phase 3 — Tests + judge Q&A (Antigravity for tests, GPT for Q&A)
> (Antigravity) Add Vitest. Tests: (1) `score()` in `src/lib/model.ts` matches 3 fixed feature vectors — get expected values by running `python3 ml/serve.py 8080` and POSTing to `/score`; (2) `buildFeatures()` returns 16 finite numbers for every hour 6–47 of every patient in `public/replay.json`; (3) `conformalSet()` returns one of the 3 labels; (4) `public/metrics.json` internal consistency (coverage within 0.05 of target, AUROC CI contains AUROC). Add `"test": "vitest run"`. All must pass.
> (GPT) Write `docs/qna.md`: the 25 hardest judge questions (clinical validity, simulated data, leakage, calibration, fairness, why not a deep model, why IBM Z, what is NNPA, what is not done yet, ethics/regulation) with honest, concise answers grounded in the repo. Honesty beats polish: where we are weak, say so and give the plan.
