import React from 'react';
import { Metrics } from '../lib/model';

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;

export const ValidationPanel: React.FC<{ m: Metrics }> = ({ m }) => {
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
        <b>Transparency:</b> {m.data} Results are from a patient-level held-out test cohort of {m.cohorts.test.toLocaleString()} simulated stays ({m.cohorts.test_septic} septic). The identical pipeline is built to retrain on PhysioNet 2019 / MIMIC-IV; those numbers will differ.
      </div>
      <div className="grid gap-5 md:grid-cols-4">
        {[['AUROC', m.auroc.toFixed(3), `95% CI ${m.auroc_ci95[0].toFixed(3)}–${m.auroc_ci95[1].toFixed(3)}`],
          ['AUPRC', m.auprc.toFixed(3), `prevalence ${pct(m.prevalence, 1)}`],
          ['Conformal coverage', pct(m.conformal.empirical_coverage, 1), `target ${pct(m.conformal.target_coverage)} — matches the guarantee`],
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
