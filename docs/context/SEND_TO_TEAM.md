# Copy-paste messages for the team (Saksham sends these)

## 0. One-time setup for everyone (send in the group chat)
```
Team, our repo: https://github.com/saksham-2x7/IBM_Z
Setup (5 min):
  git clone https://github.com/saksham-2x7/IBM_Z.git && cd IBM_Z
  npm install && npm run dev        # opens at http://localhost:5174
Then create your own branch (names below) and open ONE AI session in this folder.
Rules: only edit your own files, never push to main, open a PR. No invented numbers.
Your instructions are in docs/context/ — start by reading docs/context/PROJECT_CONTEXT.md.
```

## 1. Message to KAILASH (Antigravity) — UI
```
Kailash, you own the UI. Branch: kailash/ui.
Paste this into Antigravity:

"Read docs/context/PROJECT_CONTEXT.md and docs/context/KAILASH_AGENT.md completely, then do PHASE 1 only (UI audit and polish) exactly as written there. Create branch kailash/ui. Edit only the files listed for Phase 1. Test at 375/768/1280px, run `npx tsc && npm run build`, and show me before/after screenshots. When I say 'do Phase 2' or 'do Phase 3', continue with that phase from the same file."

Send me the PR link after each phase. Order: Phase 1 now, Phase 2 after Naman's clinical.md, Phase 3 last.
```

## 2. Message to NAMAN (GPT + Antigravity) — evidence, writing, tests
```
Naman, you own research, writing and tests. Branch: naman/docs.
Use GPT for Phases 1-2 and Antigravity for the tests in Phase 3.

Paste into GPT:
"I'm on a hackathon team building AuraZ (ICU sepsis early warning on IBM Z). Here are my instructions file and project context [paste the full text of docs/context/PROJECT_CONTEXT.md and docs/context/NAMAN_AGENT.md]. Do PHASE 1 only: write docs/clinical.md with every fact sourced by a real URL you can open. If you cannot verify a number, mark it 'unverified' and do not use it."

Then after Jyothi fact-checks, say to GPT: "Do PHASE 2" (abstract + whitepaper; must openly include the real-data pilot result from docs/REAL_DATA_PILOT.md).

For Phase 3, paste into Antigravity:
"Read docs/context/PROJECT_CONTEXT.md and docs/context/NAMAN_AGENT.md and do the PHASE 3 Antigravity part (Vitest tests). Show me the passing test output."
Then GPT: "Write docs/qna.md" (25 judge questions, honest answers).

Open one PR per phase and send me the link.
```

## 3. Message to JYOTHI (Antigravity, light work)
```
Jyothi, you're our quality check. Small, specific tasks. Branch: jyothi/qa.

Task 1 (after you run the app): open every tab on your laptop and phone and write what is confusing, broken or ugly with screenshots.
Paste into Antigravity:
"Read docs/context/PROJECT_CONTEXT.md and docs/context/JYOTHI_TASKS.md. I will run the app (npm run dev). Help me write docs/qa-report.md: for each of the 6 tabs, list problems with steps to reproduce, rate clarity 1-5, and suggest one fix each. Do not edit any code files."

Task 2 (when Naman's docs/clinical.md is merged): click every source link and mark each fact OK / wrong / unclear in docs/factcheck.md.

Task 3 (submission day): fill the Hack2Skill form from docs/abstract.md and DO NOT click submit until Saksham says so.
```
