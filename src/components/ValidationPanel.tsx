import React, { useEffect, useState } from 'react';
import { Metrics, RealMetrics } from '../lib/model';

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;

export const ValidationPanel: React.FC<{ m: Metrics }> = ({ m }) => {
  const [real, setReal] = useState<RealMetrics | null>(null);
  useEffect(() => { fetch(`${import.meta.env.BASE_URL}metrics_physionet.json`).then((r) => r.json()).then(setReal).catch(() => setReal(null)); }, []);
  const a = m.alerting, W = 300, H = 220;
  const roc = m.roc.fpr.map((f, i) => `${30 + f * (W - 40)},${H - 24 - m.roc.tpr[i] * (H - 40)}`).join(' ');
  const hist = m.lead_time_hist, hmax = Math.max(...hist, 1);
  const rows: [string, string, string][] = [
    ['Septic patients caught early', pct(a.model.sensitivity), pct(a.baseline_sirs_rule.sensitivity)],
    ['False alerts / 100 patient-days', a.model.false_alerts_per_100_patient_days.toFixed(1), a.baseline_sirs_rule.false_alerts_per_100_patient_days.toFixed(1)],
    ['Non-septic patients ever alerted', pct(a.model.pct_nonseptic_patients_alerted / 100), pct(a.baseline_sirs_rule.pct_nonseptic_patients_alerted / 100)],
    ['Median warning before onset', `${a.model.median_lead_h} h`, `${a.baseline_sirs_rule.median_lead_h} h`],
  ];
  return (
    <div className="space-y-5 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="rounded-2xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200">
        <b>Transparency:</b> {m.data} The cards below are a <b>method demonstration</b> on a patient-level held-out test cohort of {m.cohorts.test.toLocaleString()} simulated stays ({m.cohorts.test_septic} septic). Real-data results from the same pipeline are in the PhysioNet panel just below.</div>
      {real && (
        <div className="rounded-2xl border border-emerald-800/50 bg-slate-900/60 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-white">Real ICU data · AuraZ-R on PhysioNet 2019</h3>
            <span className="text-xs text-slate-400">{real.cohorts.test.toLocaleString()} held-out stays · {real.cohorts.test_septic} septic · {real.n_features} features · gradient-boosted trees</span>
          </div>
          <div className="mt-3 grid gap-3 font-mono sm:grid-cols-4">
            {[['AUROC, AuraZ-R', real.auroc.toFixed(3), `95% CI ${real.auroc_ci95[0].toFixed(2)}–${real.auroc_ci95[1].toFixed(2)}`],
              ['Without ICU-time features', real.ablations.without_icu_time.toFixed(3), `and without recency: ${real.ablations.without_icu_time_and_recency.toFixed(3)}`],
              ['Earlier 16-feature model', real.baselines.logistic_16_features.toFixed(3), `same rich features, logistic: ${real.baselines.logistic_same_rich_features.toFixed(3)}`],
              ['Conformal coverage', `${pct(real.conformal.coverage_septic_hours, 1)} · ${pct(real.conformal.coverage_nonseptic_hours, 1)}`, 'septic · non-septic, target 90%']].map(([t, val, s]) => (
              <div key={t} className="rounded-xl bg-slate-950 p-3"><div className="text-[11px] text-slate-500">{t}</div><div className="text-xl font-bold text-slate-100">{val}</div><div className="text-[11px] text-slate-500">{s}</div></div>
            ))}
          </div>
          <table className="mt-4 w-full text-sm font-mono">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Operating point (same held-out patients)</th><th>Septic caught early</th><th>False alerts / 100 patient-days</th></tr></thead>
            <tbody>
              <tr className="border-t border-slate-800"><td className="py-2 text-slate-300">AuraZ-R, low-burden setting (budget {real.alerting.false_alert_budget_per_100_patient_days})</td><td className="text-emerald-400">{pct(real.alerting.model.sensitivity)}</td><td className="text-emerald-400">{real.alerting.model.false_alerts_per_100_patient_days.toFixed(1)}</td></tr>
              {real.alerting.model_at_sirs_false_alert_rate && <tr className="border-t border-slate-800"><td className="py-2 text-slate-300">AuraZ-R at the SIRS alarm rate</td><td className="font-bold text-emerald-400">{pct(real.alerting.model_at_sirs_false_alert_rate.sensitivity)}</td><td className="text-slate-300">{real.alerting.model_at_sirs_false_alert_rate.false_alerts_per_100_patient_days.toFixed(1)}</td></tr>}
              <tr className="border-t border-slate-800"><td className="py-2 text-slate-300">SIRS ≥ 2 rule</td><td className="text-slate-400">{pct(real.alerting.baseline_sirs_rule.sensitivity)}</td><td className="text-slate-400">{real.alerting.baseline_sirs_rule.false_alerts_per_100_patient_days.toFixed(1)}</td></tr>
            </tbody>
          </table>
          <p className="mt-3 text-sm text-slate-300">
            The simulated numbers above do not carry over one-to-one, so for real data we built AuraZ-R: all 34 clinical variables, how recently each was measured, trends and demographics.
            It reaches AUROC {real.auroc.toFixed(2)} on real held-out patients (still {real.ablations.without_icu_time.toFixed(2)} without ICU-time features) and keeps its uncertainty guarantee.
            It is a 4,989-stay sample with {real.cohorts.test_septic} septic test stays, so the confidence interval is wide; this is research evidence, not clinical validation.
          </p>
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-4">
        {[['AUROC', m.auroc.toFixed(3), `95% CI ${m.auroc_ci95[0].toFixed(3)}–${m.auroc_ci95[1].toFixed(3)}`],
          ['AUPRC', m.auprc.toFixed(3), `prevalence ${pct(m.prevalence, 1)}`],
          ['Conformal coverage', `${pct(m.conformal.coverage_septic_hours, 1)} · ${pct(m.conformal.coverage_nonseptic_hours, 1)}`, `septic · non-septic hours, each targeting ${pct(m.conformal.target_coverage)} (class-conditional)`],
          ['Interpretable vs GBM', m.auroc.toFixed(3), `gradient-boosting: ${m.auroc_gbm_comparison.toFixed(3)} (no accuracy cost)`]].map(([t, v, s]) => (
          <div key={t} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 font-mono"><div className="text-xs text-slate-400">{t}</div><div className="mt-1 text-3xl font-extrabold text-cyan-300">{v}</div><div className="mt-1 text-[11px] text-slate-500">{s}</div></div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="font-mono text-xs text-slate-400">ROC curve (hourly, 6 h horizon)</div>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full">
            <rect x="30" y="16" width={W - 40} height={H - 40} fill="none" stroke="#1e293b" />
            <line x1="30" y1={H - 24} x2={W - 10} y2="16" stroke="#334155" strokeDasharray="4 4" />
            <polyline points={roc} fill="none" stroke="#22d3ee" strokeWidth="2" />
            <text x={W / 2} y={H - 6} fontSize="9" fill="#64748b" textAnchor="middle">false-positive rate</text>
          </svg>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="font-mono text-xs text-slate-400">Warning time before onset (septic patients)</div>
          <div className="mt-4 flex h-40 items-end gap-1">
            {hist.map((c, i) => <div key={i} className="flex flex-1 flex-col items-center"><div className="w-full rounded-t bg-cyan-500/70" style={{ height: `${(c / hmax) * 100}%` }} /><span className="mt-1 text-[9px] text-slate-500">{i}h</span></div>)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="font-mono text-xs text-slate-400">Top drivers (mean |log-odds|)</div>
          <div className="mt-3 space-y-1.5">{m.feature_importance.slice(0, 7).map(([f, v]) => (
            <div key={f} className="flex items-center gap-2 text-xs text-slate-300"><span className="w-40 truncate">{f}</span><div className="h-1.5 flex-1 rounded bg-slate-800"><div className="h-1.5 rounded bg-cyan-400" style={{ width: `${(v / m.feature_importance[0][1]) * 100}%` }} /></div></div>
          ))}</div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="font-mono text-xs text-slate-400">Alert burden: AuraZ vs classic SIRS≥2 rule (same held-out patients, threshold fixed on a separate calibration cohort under a {a.false_alert_budget_per_100_patient_days}/100-patient-day false-alert budget)</div>
        <table className="mt-3 w-full text-sm font-mono">
          <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Metric</th><th>AuraZ</th><th>SIRS rule</th></tr></thead>
          <tbody>{rows.map(([n, x, y]) => <tr key={n} className="border-t border-slate-800"><td className="py-2 text-slate-300">{n}</td><td className="font-bold text-emerald-400">{x}</td><td className="text-slate-400">{y}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
};
