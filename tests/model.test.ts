import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildFeatures, conformalSet, contributions, score, type Metrics, type Model, type ReplayPatient } from '../src/lib/model';

const load = <T,>(f: string): T => JSON.parse(readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8'));
const model = load<Model>('model.json');
const metrics = load<Metrics>('metrics.json');
const replay = load<ReplayPatient[]>('replay.json');
const ward = load<ReplayPatient[]>('ward.json');

// Expected values come from the reference implementation (ml/serve.py scoring path).
const FIXED: [number[], number][] = [
  [[80, 85, 120, 16, 36.8, 97, 1.1, 8, 0.66, 0, 0, 0, 0, 0, 85, 82], 0.008379621919984415],
  [[122, 58, 86, 28, 39.1, 91, 4.2, 18.4, 1.42, 18, -12, 6, 0.8, 2.0, 58, 122], 0.9988733558228813],
  [[95, 70, 105, 22, 37.9, 94, 2.4, 13, 0.9, 10, -8, 3, 0.4, 1.1, 68, 100], 0.7842527587533283],
];

describe('score()', () => {
  it.each(FIXED)('matches the reference score for %j', (x, expected) => {
    expect(score(model, x)).toBeCloseTo(expected, 12);
  });
  it('is monotonic in the largest positive coefficient feature', () => {
    const i = model.coef.indexOf(Math.max(...model.coef));
    const x = [...FIXED[0][0]];
    const lo = score(model, x); x[i] += 3 * model.std[i];
    expect(score(model, x)).toBeGreaterThan(lo);
  });
});

describe('buildFeatures()', () => {
  it('returns 16 finite numbers for every scored hour of every replay patient', () => {
    for (const p of replay) for (let h = 6; h < p.vitals.hr.length; h++) {
      const x = buildFeatures(p.vitals, h);
      expect(x).toHaveLength(model.features.length);
      expect(x.every(Number.isFinite)).toBe(true);
    }
  });
  it('produces probabilities in (0,1) for all 200 ward beds at hour 12', () => {
    expect(ward).toHaveLength(200);
    for (const p of ward) { const r = score(model, buildFeatures(p.vitals, 12)); expect(r).toBeGreaterThan(0); expect(r).toBeLessThan(1); }
  });
});

describe('contributions() and conformalSet()', () => {
  it('contributions sum (with the intercept) to the model logit', () => {
    const x = FIXED[2][0];
    const logit = contributions(model, x).reduce((s, c) => s + c.impact, model.intercept);
    expect(1 / (1 + Math.exp(-logit))).toBeCloseTo(score(model, x), 12);
  });
  it('conformalSet returns one of three labels and is monotone in risk', () => {
    const order = ['ruled out', 'uncertain', 'sepsis not ruled out'];
    let last = -1;
    for (let p = 0.001; p < 1; p += 0.001) {
      const k = order.indexOf(conformalSet(model, p));
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeGreaterThanOrEqual(last);
      last = k;
    }
  });
});

describe('public/metrics.json consistency', () => {
  it('class-conditional conformal coverage is within 0.03 of target for both classes', () => {
    const c = metrics.conformal;
    expect(Math.abs(c.coverage_septic_hours - c.target_coverage)).toBeLessThan(0.03);
    expect(Math.abs(c.coverage_nonseptic_hours - c.target_coverage)).toBeLessThan(0.03);
  });
  it('a risk at the alert threshold is never labelled "ruled out"', () => {
    expect(conformalSet(model, model.alert_threshold)).not.toBe('ruled out');
  });
  it('AUROC lies inside its own 95% CI', () => {
    expect(metrics.auroc).toBeGreaterThanOrEqual(metrics.auroc_ci95[0]);
    expect(metrics.auroc).toBeLessThanOrEqual(metrics.auroc_ci95[1]);
  });
  it('model.json alert threshold equals the metrics alert threshold', () => {
    expect(model.alert_threshold).toBeCloseTo(metrics.alerting.threshold, 9);
  });
  it('ROC curve is monotone and runs from (0,0) to (1,1)', () => {
    const { fpr, tpr } = metrics.roc;
    expect(fpr[0]).toBe(0); expect(tpr[0]).toBe(0);
    expect(fpr.at(-1)).toBe(1); expect(tpr.at(-1)).toBe(1);
    for (let i = 1; i < fpr.length; i++) { expect(fpr[i]).toBeGreaterThanOrEqual(fpr[i - 1]); expect(tpr[i]).toBeGreaterThanOrEqual(tpr[i - 1]); }
  });
  it('the headline comparison against SIRS matches what the README states', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    const a = metrics.alerting;
    expect(readme).toContain(`${Math.round(a.model.sensitivity * 100)}%`);
    expect(readme).toContain(a.model.false_alerts_per_100_patient_days.toFixed(1));
    expect(readme).toContain(a.baseline_sirs_rule.false_alerts_per_100_patient_days.toFixed(1));
  });
});

describe('data hygiene', () => {
  it('replay patients have equal-length vitals channels', () => {
    for (const p of replay) { const n = p.vitals.hr.length; for (const ch of Object.values(p.vitals)) expect(ch).toHaveLength(n); }
  });
});
