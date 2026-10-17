# QA report (Claude, 17 Oct 2026) — what was actually tested

Scope: `claude/team-work` branch (main + class-conditional conformal + real-data panel). Jyothi's own report was never pushed, so this replaces it. Kailash's UI work (PR #2) was reviewed and click-through tested separately.

| Check | Method | Result |
|---|---|---|
| TypeScript, production build | `npx tsc && npm run build` | Pass |
| Unit tests | `npm test` (18 tests, incl. real-data tree parity on 300 rows; scorer vs reference values, features, conformal monotonicity, metrics consistency, README numbers) | 18/18 pass |
| Uncertainty label vs alert | Replay TEST-01 at h12 / h19 / h21 | "ruled out" → "sepsis not ruled out" ×2, consistent with alert at h19 (previously an alerting bed showed "not at risk") |
| Real-data panel | Validation tab | AuraZ-R AUROC 0.775 (0.72–0.82), ablations 0.732 / 0.720, baselines 0.608 / 0.712, coverage 89.3% · 89.8%, alerting vs SIRS table |
| Real-data trees on IBM z17 | IBM Z tab → "Run AuraZ-R real-data trees" | 300 real held-out rows: remote = browser = sklearn (0.0), ~225 µs/row |
| Remote scoring on IBM z17 | App → SSH tunnel → `ml/serve.py` on LinuxONE | Connected as "IBM z17 (Telum II) · s390x · machine 9175 · NNPA present"; remote = local exactly; Ward scored remotely |
| Sources in `docs/clinical.md` | Opened each (see `docs/factcheck.md`) | 9/10 verified, 1 blocked (HHS 403) |

**Known gaps (not tested):** phone/real-device testing, screen-reader pass, load test of the LinuxONE service, subgroup fairness. The console shows connection errors when a saved IBM Z endpoint is offline (harmless; the app falls back to browser scoring).
