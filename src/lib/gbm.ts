/** AuraZ-R real-data model: gradient-boosted trees exported from ml/train_physionet_gbm.py, scored with no dependencies. */
export interface Tree { f: number[]; t: number[]; l: number[]; r: number[]; v: number[]; m: number[]; leaf: number[] }
export interface GbmModel {
  kind: 'gradient_boosting'; features: string[]; baseline: number; trees: Tree[];
  qhat_pos: number; qhat_neg: number; alpha: number; alert_threshold: number;
}

/** x[i] === null means "not measured yet"; it follows each split's learned missing-value direction. */
export function scoreGbm(m: GbmModel, x: (number | null)[]): number {
  let z = m.baseline;
  for (const t of m.trees) {
    let i = 0;
    while (!t.leaf[i]) {
      const xi = x[t.f[i]];
      const left = xi === null || Number.isNaN(xi) ? t.m[i] === 1 : xi <= t.t[i];
      i = left ? t.l[i] : t.r[i];
    }
    z += t.v[i];
  }
  return 1 / (1 + Math.exp(-z));
}
