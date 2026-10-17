# Context for Kailash's AI agent (Antigravity) — Product & UI

**First, read `docs/context/PROJECT_CONTEXT.md` fully.** You are the UI/UX owner. Your branch: `kailash/ui`. You never change numbers, model logic, `ml/*`, or `public/*.json`.

## Files you own
- Phase 1: `src/components/Header.tsx`, `src/index.css`, (`src/App.tsx` layout only — ask Saksham before changing props/state)
- Phase 2: `src/components/ReplayLab.tsx`, `src/components/WardView.tsx`
- Phase 3: `docs/demo/*` (new)

## Design direction (what "good" looks like)
Clean, minimal, clinician-friendly: dark UI is fine but calm. One accent colour (cyan), 8px spacing grid, no glows or gradients, generous whitespace, 3 levels of text hierarchy, readable at 375px / 768px / 1280px, WCAG AA contrast, visible keyboard focus, colour never the only signal (add text/icons), friendly empty/error states (e.g. "IBM Z not connected — scoring in your browser").

## Phase 1 — UI audit and polish
> Read `docs/context/PROJECT_CONTEXT.md`, then the files I own. Run `npm run dev`. Audit every tab at 375, 768 and 1280px and list problems (spacing, contrast, overflow, focus, tap targets). Fix them in my files only: single accent colour, 8px grid, no glows/gradients, ARIA roles + keyboard support for the nav tabs, visible focus rings. Do not change any numbers, labels that state results, or data logic. Attach before/after screenshots in the PR. Run `npx tsc && npm run build`.

## Phase 2 — Clinician views
> Add click-through: clicking a bed tile in WardView opens that patient in ReplayLab at the current hour (propose the minimal state/props change to App.tsx in the PR description and ask Saksham to approve it; do not edit App.tsx unasked). Show the alert reason as one plain sentence from the top 3 `contributions()` in `src/lib/model.ts` (example: "Rising respiratory rate and falling blood pressure over 3 h"). Use a colour-blind-safe palette (e.g. blue/orange) plus text labels. Add empty/loading/error states. Keep it fast: no layout shift during playback. Run tsc + build; attach screenshots.

## Phase 3 — Demo assets
> Using the running app, create `docs/demo/script.md`: a 3:00 timed demo with exact clicks. Flow: (1) Live Replay on a septic patient — alert fires before onset, explanation, conformal set; (2) a look-alike non-septic patient that does NOT alert; (3) Validation tab vs the SIRS rule; (4) IBM Z tab connected to the z17 — show machine 9175 / NNPA flag and "remote = local"; (5) Ward scored on the mainframe. Capture 6 annotated screenshots to `docs/demo/` and a 60–90 s screen recording. Only quote numbers that are visible in the app. Mention honestly that data is simulated and that NNPA acceleration is next.
