# AuraZ architecture

```mermaid
flowchart LR
  subgraph Data["Data"]
    P["PhysioNet/CinC 2019<br/>real ICU stays (14,635)"]
    S["Simulated cohort<br/>look-alike patients"]
  end
  subgraph Train["Training and calibration (Python, scikit-learn)"]
    F["Features: 108 (34 variables, trends,<br/>how recently measured)"]
    R["AuraZ-R: 300 gradient-boosted trees<br/>AUROC 0.82"]
    N["AuraZ-N: MLP 108-64-32-1<br/>AUROC 0.80"]
    C["Class-conditional conformal labels<br/>+ alert threshold (false-alarm budget)"]
  end
  subgraph Z["IBM z17 / LinuxONE (s390x, Telum II)"]
    SV["Inference service<br/>stdlib Python, /score_real, /fhir/score"]
    ACC["NNPA accelerator via IBM zDNN<br/>AuraZ-N: 33x vs plain loop, 1.5x vs OpenBLAS"]
  end
  subgraph App["Clinician app (React + TypeScript)"]
    L["Live replay + explanations"]
    W["200-bed ward view"]
    V["Validation: real data, other hospital, fairness"]
  end
  P --> F
  S --> F
  F --> R
  F --> N
  R --> C
  N --> C
  R --> SV
  N --> ACC
  C --> SV
  SV --> L
  SV --> W
  ACC -. "recorded benchmark" .-> V
  FH["FHIR Observation bundle"] --> SV
  SV --> RA["FHIR RiskAssessment + alert log"]
```

**Reading it:** data is turned into 108 features; two models are trained (trees for accuracy, a small neural network for the accelerator); each alert carries a conformal uncertainty label. The standard-library inference service runs on the z17 and feeds the app and a FHIR endpoint; the neural model runs on the on-chip AI accelerator through zDNN. Files: `ml/train_physionet_gbm.py`, `ml/train_physionet_mlp.py`, `ml/serve.py`, `ml/nnpa_mlp.c`, `src/`.
