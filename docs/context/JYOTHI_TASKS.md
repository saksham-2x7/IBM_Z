# Tasks for Jyothi (Antigravity, light workload) — verification, QA and submission

You are the team's quality gate. Work on your own branch `jyothi/qa` or just send results in the group chat.

## Task sequence
**Phase 1 — Use it like a judge (30–45 min).** Run the app (`npm install && npm run dev`, open http://localhost:5174). Go through all 6 tabs on a laptop and on your phone (same Wi-Fi, use the Network URL Vite prints). Write `docs/qa-report.md`: anything confusing, broken, slow, ugly or unclear, with a screenshot and the exact steps. Rate each tab 1–5 for clarity.

**Phase 2 — Fact-check (45–60 min).** Open `docs/clinical.md` (once Naman pushes it) and the Submission tab text. For every statistic, click the source link and confirm it says what we claim. Put ✅ / ❌ / ❓ next to each in `docs/factcheck.md`. Tell Saksham about every ❌ and ❓ so it gets fixed before submission.

**Phase 3 — Submission day (60 min).** Create the Hack2Skill submission: paste the abstract from the Submission tab / `docs/abstract.md`, add the repo link, demo video link, and screenshots. Check word/character limits, spelling, and that every number matches the Validation tab. Do a final run-through as a judge: open the live app, follow `docs/demo/script.md`, and confirm each step works. Do NOT click the final submit until Saksham says so.

## Rules
Don't edit code files. Don't change numbers. If something seems wrong, report it — don't "fix" it.
