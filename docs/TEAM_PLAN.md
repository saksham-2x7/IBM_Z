# AuraZ team plan (IBM Z Datathon 2026)

**Collaborators on the repo:** `saikailashnathk-max`, `NAMAN121208`, `jyothirodrigues2511-wq` (Saksham = `saksham-2x7`). Assign two of them as Teammate A and Teammate B below.

## Ground rules (everyone)
1. One branch per person: `a/ui`, `b/docs`. Open a PR to `main`; Saksham merges. Never push to `main` directly.
2. **Only edit the files you own** (listed per phase). Anything else: ask in the group chat.
3. **No invented numbers.** Every metric comes from `public/metrics.json` or a script in this repo. If a claim has no source, delete it.
4. Start every AI session with: *"Read README.md, docs/TEAM_PLAN.md and the files I own. Follow the ground rules. Show me the output of anything you run."*
5. Run before every PR: `npm install && npx tsc && npm run build` (must pass).

---

## Claude (Saksham's session) — data, hardware, integration (most work)
| Phase | Work | Files |
|---|---|---|
| 1 | Real data: download PhysioNet 2019, run `ml/train_physionet.py`, regenerate `public/*.json`, update README/metrics | `ml/*`, `public/*.json`, `data/` |
| 2 | IBM Z: keep LinuxONE inference service working, measure on z17, then ONNX + zDLC/NNPA benchmark, subgroup fairness table in `metrics.json` | `ml/serve.py`, `ml/bench*`, `ml/*` |
| 3 | Integration: merge teammates' PRs, final QA on mainframe + browser, freeze `main`, final README | everything (merge only) |

---

## Teammate A (has Antigravity) — product & UI
### Phase 1 — UI audit and polish (files: `src/components/Header.tsx`, `src/index.css`, `src/App.tsx`)
Deliver: one accent colour, consistent spacing, readable at 1280px and phone width, keyboard-accessible tabs, WCAG AA contrast, no horizontal scroll.
Done when: Lighthouse accessibility ≥ 95 and screenshots before/after in the PR.
> **Prompt:** Read the files you own and `src/components/ReplayLab.tsx` for style reference. Make the app look clean, minimal and consistent (single accent, 8px spacing grid, no glows or gradients). Add visible focus states and ARIA roles to the nav tabs. Test at 375px, 768px and 1280px and attach screenshots. Do not change any numbers or data logic.

### Phase 2 — Clinician views (files: `src/components/ReplayLab.tsx`, `src/components/WardView.tsx`)
Deliver: clicking a bed in the Ward opens that patient in Live Replay at the current hour; alert banner explaining *why* in plain language; colour-blind-safe risk colours; empty and error states.
Done when: a clinician can go from ward → patient → explanation in two clicks.
> **Prompt:** Add click-through from a WardView tile to ReplayLab for that patient (lift state to App via props; ask Saksham before touching App.tsx). Show alert reason in one plain sentence using the top 3 contributions from `contributions()` in `src/lib/model.ts`. Use a colour-blind-safe palette and add text labels, not colour alone.

### Phase 3 — Demo assets (files: `docs/demo/*`)
Deliver: 3-minute demo script, 6 annotated screenshots, a 60–90 s screen recording.
Flow: replay a septic patient → alert + explanation + uncertainty → Validation tab vs SIRS → IBM Z tab connected to the z17 → Ward on mainframe.
> **Prompt:** Using the running app (`npm run dev`), write `docs/demo/script.md` (timed to 3:00, with exact clicks) and capture the screenshots/recording. Use only numbers visible in the app.

---

## Teammate B (GPT Plus + Antigravity) — evidence, writing, testing
### Phase 1 — Clinical grounding (files: `docs/clinical.md`)
Deliver: 1-page problem statement with **verifiable citations** (sepsis burden, cost of delayed treatment, alarm fatigue, why SIRS is weak, Sepsis-3 definition). Every statistic needs a link; remove any you cannot verify.
> **Prompt:** Research and write `docs/clinical.md`: 8–10 cited facts on sepsis burden, delayed-treatment mortality, alert fatigue and SIRS limits. For each, give the exact source URL and the sentence it supports. Flag anything you could not verify instead of guessing.

### Phase 2 — Submission text and whitepaper (files: `docs/whitepaper.md`, `docs/abstract.md`)
Deliver: Hack2Skill abstract (respect the portal's word limits) and a 2-page whitepaper replacing the old PDF, built from `public/metrics.json`, the README "real vs simulated" table, and `docs/clinical.md`. Must state limitations (simulated/PhysioNet data, not a medical device, no prospective validation).
> **Prompt:** Draft `docs/abstract.md` and `docs/whitepaper.md` from README.md and public/metrics.json only. Keep the honesty statement. Do not claim hardware results that are not in the repo. Include a limitations section.

### Phase 3 — Testing and Q&A (files: `tests/*`, `docs/qna.md`)
Deliver: smoke tests (Playwright or Vitest) for the 5 tabs and the model scorer (`src/lib/model.ts` vs `public/model.json` known outputs), plus a 25-question judge Q&A (clinical, ML, IBM Z, ethics) with short answers.
> **Prompt:** Add Vitest tests: `score()` returns known probabilities for 3 fixed feature vectors (get expected values by running `ml/serve.py` locally and POSTing to `/score`), and each tab renders without console errors. Then write `docs/qna.md` with the 25 toughest judge questions and answers grounded in the repo.

---

## Timeline (suggested)
- Now → +2 h: everyone finishes Phase 1 (open PRs).
- +2 h → +4 h: Phase 2. Saksham/Claude merges and re-verifies on the mainframe.
- Last 2 h: Phase 3 and freeze.
