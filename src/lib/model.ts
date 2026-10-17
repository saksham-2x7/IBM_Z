import { useEffect, useState } from 'react';

export interface Model {
  features: string[];
  mean: number[];
  std: number[];
  coef: number[];
  intercept: number;
  qhat: number;
  alpha: number;
  alert_threshold: number;
}

export interface Vitals {
  hr: number[]; map: number[]; sbp: number[]; rr: number[];
  temp: number[]; spo2: number[]; lactate: number[]; wbc: number[];
}

export interface ReplayPatient {
  id: string;
  kind: string;
  onset: number | null;
  vitals: Vitals;
}

export interface Metrics {
  data: string;
  task: string;
  cohorts: { train: number; calibration: number; test: number; test_septic: number };
  auroc: number;
  auroc_ci95: [number, number];
  auprc: number;
  prevalence: number;
  auroc_gbm_comparison: number;
  conformal: { alpha: number; target_coverage: number; empirical_coverage: number; uncertain_fraction: number };
  alerting: {
    threshold: number;
    false_alert_budget_per_100_patient_days: number;
    model: AlertStats;
    baseline_sirs_rule: AlertStats;
  };
  lead_time_hist: number[];
  roc: { fpr: number[]; tpr: number[] };
  feature_importance: [string, number][];
}

export interface AlertStats {
  sensitivity: number;
  median_lead_h: number;
  false_alerts_per_100_patient_days: number;
  pct_nonseptic_patients_alerted: number;
}

export const FEATURE_LABELS: Record<string, string> = {
  hr: 'Heart rate', map: 'Mean arterial pressure', sbp: 'Systolic BP', rr: 'Respiratory rate',
  temp: 'Temperature', spo2: 'SpO2', lactate: 'Serum lactate', wbc: 'WBC count', shock_index: 'Shock index (HR/SBP)',
  hr_d3: 'Heart-rate change (3h)', map_d3: 'MAP change (3h)', rr_d3: 'Resp-rate change (3h)',
  temp_d3: 'Temperature change (3h)', lactate_d6: 'Lactate change (6h)', map_min6: 'Lowest MAP (6h)', hr_max6: 'Peak heart rate (6h)',
};

export function buildFeatures(v: Vitals, h: number): number[] {
  const g = (a: number[], k = 0) => a[h - k];
  const win = (a: number[]) => a.slice(h - 5, h + 1);
  return [
    g(v.hr), g(v.map), g(v.sbp), g(v.rr), g(v.temp), g(v.spo2), g(v.lactate), g(v.wbc), g(v.hr) / g(v.sbp),
    g(v.hr) - g(v.hr, 3), g(v.map) - g(v.map, 3), g(v.rr) - g(v.rr, 3), g(v.temp) - g(v.temp, 3),
    g(v.lactate) - g(v.lactate, 6), Math.min(...win(v.map)), Math.max(...win(v.hr)),
  ];
}

export function score(m: Model, x: number[]): number {
  let z = m.intercept;
  for (let i = 0; i < x.length; i++) z += m.coef[i] * ((x[i] - m.mean[i]) / m.std[i]);
  return 1 / (1 + Math.exp(-z));
}

/** Exact additive attribution for a linear model in log-odds space (equals SHAP for linear models). */
export function contributions(m: Model, x: number[]) {
  return m.features
    .map((f, i) => ({ feature: f, value: x[i], impact: m.coef[i] * ((x[i] - m.mean[i]) / m.std[i]) }))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

/** Split-conformal prediction set: which labels remain plausible at the calibrated coverage. */
export function conformalSet(m: Model, p: number): 'sepsis' | 'not-at-risk' | 'uncertain' {
  const pos = 1 - p <= m.qhat, neg = p <= m.qhat;
  return pos && neg ? 'uncertain' : pos ? 'sepsis' : 'not-at-risk';
}

const base = import.meta.env.BASE_URL;
export function useArtifacts() {
  const [data, setData] = useState<{ model: Model; metrics: Metrics; replay: ReplayPatient[] } | null>(null);
  useEffect(() => {
    Promise.all(['model', 'metrics', 'replay'].map((n) => fetch(`${base}${n}.json`).then((r) => r.json())))
      .then(([model, metrics, replay]) => setData({ model, metrics, replay }));
  }, []);
  return data;
}
