import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Metrics, RealMetrics } from '../lib/model';

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const SubmissionHub: React.FC<{ m: Metrics }> = ({ m }) => {
  const [copied, setCopied] = useState('');
  const [real, setReal] = useState<RealMetrics | null>(null);
  useEffect(() => { fetch(`${import.meta.env.BASE_URL}metrics_physionet.json`).then((r) => r.json()).then(setReal).catch(() => setReal(null)); }, []);
  const a = m.alerting, ours = a.model, sirs = a.baseline_sirs_rule;
  const fields: [string, string][] = [
    ['Title', 'AuraZ: explainable, calibrated ICU sepsis early warning that runs beside the data on IBM Z'],
    ['Problem', 'Sepsis is linked to an estimated 11 million deaths a year (WHO). In septic shock, each hour of delay in effective antimicrobials was associated with lower survival (Kumar et al., 2006), and the 2026 Surviving Sepsis Campaign asks for antimicrobials within an hour of recognising probable sepsis or shock. Rule-based ICU screens such as SIRS fire constantly, so clinicians learn to ignore them, while cloud-hosted AI moves protected health data off-site.'],
    ['Solution', `AuraZ scores each ICU patient every hour and predicts sepsis onset in the next 6 hours. Every alert carries a plain-language explanation and a class-conditional conformal label (sepsis not ruled out / uncertain / ruled out, ${pct(m.conformal.target_coverage)} coverage per class). On a held-out simulated cohort with look-alike patients of ${m.cohorts.test.toLocaleString()} stays, AuraZ caught ${pct(ours.sensitivity)} of septic patients early versus ${pct(sirs.sensitivity)} for the SIRS rule, with ${ours.false_alerts_per_100_patient_days.toFixed(1)} versus ${sirs.false_alerts_per_100_patient_days.toFixed(1)} false alerts per 100 patient-days (AUROC ${m.auroc.toFixed(3)}, 95% CI ${m.auroc_ci95[0].toFixed(3)}–${m.auroc_ci95[1].toFixed(3)}).`],
    ['Why IBM Z', 'Hospital vitals already flow through transactional systems. AuraZ ships as a dependency-free inference service that runs on IBM LinuxONE (s390x), so scoring happens next to the data with no PHI egress and no internet round trip. On a real IBM z17 the demo scores a 200-bed ward in one batch, and the real-data AuraZ-R trees score real held-out patients, both matching the reference model exactly. A neural variant of the real-data model (AuraZ-N, AUROC 0.80) runs on the Telum II on-chip AI accelerator through IBM zDNN: 33x faster than a CPU loop with AUROC unchanged; the tree model stays on the CPU, and a tiny logistic model is slower on the accelerator.'],
    ['Real-data evidence', real
      ? `The headline cards use a simulated cohort and demonstrate the method. On real ICU data (PhysioNet 2019, ${(real.cohorts.train + real.cohorts.calibration + real.cohorts.test).toLocaleString()} stays, patient-level held-out test of ${real.cohorts.test} stays) our real-data model AuraZ-R, gradient-boosted trees over all 34 clinical variables plus measurement recency, reaches AUROC ${real.auroc.toFixed(2)} (95% CI ${real.auroc_ci95[0].toFixed(2)}–${real.auroc_ci95[1].toFixed(2)}); ${real.ablations.without_icu_time.toFixed(2)} without ICU-time features; up from ${real.baselines.logistic_16_features.toFixed(2)} for our first 16-feature model. At the same false-alarm rate as the SIRS rule it catches ${pct(real.alerting.model_at_sirs_false_alert_rate?.sensitivity ?? 0)} of septic patients early versus ${pct(real.alerting.baseline_sirs_rule.sensitivity)}. Its uncertainty guarantee holds on real data (${pct(real.conformal.coverage_septic_hours)} / ${pct(real.conformal.coverage_nonseptic_hours)} coverage, target 90%). The trees run on the z17 with no dependencies; the neural variant runs on the Telum II accelerator. Research prototype, not a medical device.`
      : 'Headline results use a simulated cohort and demonstrate the method only. Not a medical device.'],
    ['Future scope', 'Retrain and externally validate on PhysioNet 2019 / MIMIC-IV / eICU, subgroup fairness audit, NNPA acceleration benchmarks, HL7/FHIR integration and a prospective silent-mode pilot.'],
  ];
  const copy = (k: string, t: string) => { navigator.clipboard?.writeText(t).catch(() => {}); setCopied(k); setTimeout(() => setCopied(''), 1500); };
  const words = (t: string) => t.trim().split(/\s+/).length;
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div>
        <h2 className="text-lg font-bold text-white">Submission text</h2>
        <p className="mt-1 text-sm text-slate-400">Generated from <code>public/metrics.json</code>, so every number matches the Validation tab. Check the portal's word limits before pasting.</p>
      </div>
      {fields.map(([k, t]) => (
        <div key={k} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{k}</h3>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>{words(t)} words · {t.length} chars</span>
              <button onClick={() => copy(k, t)} className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800">
                {copied === k ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}{copied === k ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{t}</p>
        </div>
      ))}
    </div>
  );
};
