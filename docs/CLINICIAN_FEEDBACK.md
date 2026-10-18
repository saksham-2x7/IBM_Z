# Clinician feedback kit

Goal: get 3–5 short responses from people who work in or near an ICU (doctor, nurse, pharmacist, medical student) and add them, honestly and unedited, to the submission. **Do not write responses yourself or edit them to be more positive.** Even two or three real, mixed responses are worth more than none.

## What to send (copy-paste message)
> Hi, I'm in a hackathon team building a sepsis early-warning prototype and I'd value 5 minutes of your honest opinion as someone who works with ICU patients. Open <https://github.com/saksham-2x7/IBM_Z> (or run it locally with `npm install && npm run dev`), click "Live Replay", pick the patient "TEST-01" and slide to hour 19, then open the "Ward" tab. Then please answer the questions in this form: *(link to your form)*. Everything is a research prototype on retrospective data, not for clinical use. Thank you!

## Questions (paste into Google Forms / any form tool)
1. Your role and years of experience (optional, can be anonymous).
2. Rate 1–5: *The explanation sentence ("rising temperature, rising respiratory rate…") is clear and useful.*
3. Rate 1–5: *The labels "sepsis not ruled out / uncertain / ruled out" are understandable.*
4. Rate 1–5: *I would trust an alert like this more than a SIRS-based alarm.*
5. What would make you ignore an alert from this system?
6. Which single thing would you change first?
7. Anything that confused you or looked wrong? (free text)

## How to report it
After collecting responses, record them in `docs/CLINICIAN_RESPONSES.md` as a table (role, ratings, quotes) with the count of respondents, and state the sample size plainly ("n = 3, informal, not a study"). Quote negative comments too. Then one line in the form's Value answer, for example: "Informal feedback from N clinicians: …". If you get no responses by submission time, do not mention this at all.
