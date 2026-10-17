# Clinical grounding for AuraZ

AuraZ addresses the need to recognize possible ICU sepsis promptly while limiting distracting alerts and keeping sensitive data under hospital control. The evidence below motivates that research aim; it does not establish AuraZ's clinical benefit. Sources opened and checked on 17 October 2026; team fact-check pending.

1. **Global burden:** WHO reports an estimated **48.9 million sepsis cases and 11 million sepsis-related deaths**, based on the 2017 burden analysis published in 2020; these are historical estimates, not a 2026 count. [WHO, key facts][who]
2. **Unequal burden:** WHO identifies the highest incidence and mortality rates in lower-middle-income countries, so the global totals should not imply uniform risk across settings. [WHO, key facts][who]
3. **Sepsis-3 definition:** Sepsis involves a dysregulated response to infection that produces life-threatening organ dysfunction; infection or inflammation alone is insufficient. [Singer et al., 2016, recommendations][sepsis3]
4. **Organ dysfunction:** Sepsis-3 operationalizes infection-related organ dysfunction as an acute **SOFA increase of at least 2 points**; this is a clinical criterion, not a prediction horizon. [Singer et al., Box 3][sepsis3]
5. **Antibiotic delay:** In Kumar et al.'s retrospective adult septic-shock cohort, each hour of delay in effective antimicrobials over the six hours after the first hour of documented hypotension was associated with an average **7.6% decrease in survival**. This observational, shock-specific association is not a universal causal increase in mortality per hour for all sepsis. [Kumar et al., 2006, abstract results][delay]
6. **Current urgency:** The **2026** Surviving Sepsis Campaign recommends immediate antimicrobials, ideally within **1 hour**, for possible, probable or definite septic shock and for probable or definite sepsis without shock; certainty is very low. Possible sepsis without shock has a separate rapid-investigation pathway. [SSC, antibiotic initiation][ssc]
7. **Alarm fatigue:** Frequent monitor alerts can desensitize clinicians and delay responses or lead to missed alarms, making alarm burden a safety concern for ICU warning systems. This is not a measured false-alert rate for sepsis algorithms. [AHRQ PSNet, perspective][alarms]
8. **SIRS limitations:** Sepsis-3 notes that SIRS can occur without infection and can be absent despite infection-related organ failure, limiting its specificity and sensitivity for sepsis identification. [Singer et al., sepsis discussion][sepsis3]
9. **qSOFA limitations:** The 2026 SSC recommends NEWS, NEWS2, MEWS or SIRS over qSOFA as a single hospital screening tool; no individual biomarker or diagnostic test should alone establish or exclude sepsis. [SSC, screening/biomarkers][ssc]
10. **Privacy constraints:** In the US, HHS permits cloud processing of electronic protected health information with a compliant business associate agreement and other HIPAA safeguards, including risk analysis. These obligations constrain deployment; they do not prohibit cloud AI. Hospital-local processing is a design response, not proof of compliance. [HHS, question 1][privacy]

[who]: https://www.who.int/news-room/fact-sheets/detail/sepsis
[sepsis3]: https://jamanetwork.com/journals/jama/fullarticle/2492881
[delay]: https://pubmed.ncbi.nlm.nih.gov/16625125/
[ssc]: https://sccm.org/survivingsepsiscampaign/guidelines-and-resources/surviving-sepsis-campaign-adult-guidelines
[alarms]: https://psnet.ahrq.gov/perspective/reducing-safety-hazards-monitor-alert-and-alarm-fatigue
[privacy]: https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html
