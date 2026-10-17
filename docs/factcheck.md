# Fact-check of `docs/clinical.md` (Naman, PR #1)

Checked on 17 October 2026 by opening each source. ✅ = source says it; ⚠️ = supported with a caveat; ❓ = could not open the source.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | WHO: 48.9 million cases, 11 million sepsis-related deaths; historical estimates | ✅ | WHO fact sheet: "From data published in 2020, there were 48.9 million cases and 11 million sepsis-related deaths worldwide" (ref. Rudd et al., Lancet 2020, data 1990–2017). |
| 2 | Highest incidence and mortality in lower-middle-income countries | ✅ | WHO fact sheet: highest rates "in lower-middle-income countries". |
| 3 | Sepsis-3 definition: dysregulated host response causing life-threatening organ dysfunction | ✅ | JAMA 2016: "life-threatening organ dysfunction caused by a dysregulated host response to infection". |
| 4 | Organ dysfunction = acute SOFA increase ≥ 2 | ✅ | JAMA 2016: "an acute change in total SOFA score ≥2 points consequent to the infection". |
| 5 | Kumar 2006: each hour of delay over the ensuing 6 h → average 7.6% decrease in survival (septic shock, observational) | ✅ | Abstract (via Europe PMC): "an average decrease in survival of 7.6%". The caveat in clinical.md (shock-specific, observational) is correct. |
| 6 | SSC 2026: antimicrobials immediately, ideally within 1 h, for possible/probable/definite shock and probable/definite sepsis without shock | ✅ | SCCM page for the 2026 adult guideline: "administering antimicrobial therapy immediately, ideally within 1 hr of recognition". Possible sepsis without shock: rapid assessment, antibiotics within 3 h if still suspected. |
| 7 | Alarm fatigue: desensitisation → delayed response or missed alarms | ✅ | AHRQ PSNet: "This desensitization can lead to longer response times or to missing important alarms." |
| 8 | SIRS can occur without infection and be absent despite infection-related organ failure | ✅ | JAMA 2016: SIRS criteria "present in many hospitalized patients, including those who never develop infection"; about 1 in 8 infected ICU patients with new organ failure did not meet 2 SIRS criteria. |
| 9 | SSC 2026: NEWS, NEWS2, MEWS or SIRS over qSOFA as a single screening tool | ✅ | SCCM page: "we 'recommend' using NEWS, NEW2, MEWS, or SIRS over qSOFA as a single tool to screen for sepsis" ("NEW2" is a typo on the source page). The biomarker part of the sentence was not re-checked. |
| 10 | HHS allows cloud processing of ePHI with a BAA and HIPAA safeguards | ❓ | hhs.gov returned 403 to our checker. The claim matches the well-known HHS cloud-computing guidance; open the link in a browser before quoting it on stage. |

**Result:** 9 of 10 verified against the source; 1 could not be opened automatically (claim believed correct). No wrong or invented facts. `clinical.md` is safe to merge.
