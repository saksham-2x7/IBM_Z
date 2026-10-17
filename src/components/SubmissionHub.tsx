import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Metrics } from '../lib/model';

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const SubmissionHub: React.FC<{ m: Metrics }> = ({ m }) => {
  const [copied, setCopied] = useState('');
  const [real, setReal] = useState<Metrics | null>(null);
  useEffect(() => { fetch(`${import.meta.env.BASE_URL}metrics_physionet.json`).then((r) => r.json()).then(setReal).catch(() => setReal(null)); }, []);
  const a = m.alerting, ours = a.model, sirs = a.baseline_sirs_rule;
  const fields: [string, string][] = [
    ['Title', 'AuraZ: explainable, calibrated ICU sepsis early warning that runs beside the data on IBM Z'],
    ['Problem', 'Sepsis kills about 11 million people a year, and every hour of delayed treatment raises mortality. ICU early-warning rules such as SIRS fire constantly, so clinicians learn to ignore them, while cloud-hosted AI moves protected health data off-site and adds network latency to a time-critical decision.'],
    ['Solution', `AuraZ scores each ICU patient every hour and predicts sepsis onset in the next 6 hours. Every alert carries a per-feature explanation and a conformal-prediction uncertainty set with a ${pct(m.conformal.target_coverage)} coverage guarantee. On a held-out simulated cohort of ${m.cohorts.test.toLocaleString()} stays, AuraZ caught ${pct(ours.sensitivity)} of septic patients early versus ${pct(sirs.sensitivity)} for the SIRS rule, with ${ours.false_alerts_per_100_patient_days.toFixed(1)} versus ${sirs.false_alerts_per_100_patient_days.toFixed(1)} false alerts per 100 patient-days (AUROC ${m.auroc.toFixed(3)}, 95% CI ${m.auroc_ci95[0].toFixed(3)}–${m.auroc_ci95[1].toFixed(3)}).`],
    ['Why IBM Z', 'Hospital vitals already flow through transactional systems. AuraZ ships as a dependency-free inference service that runs on IBM LinuxONE (s390x), so scoring happens next to the data with no PHI egress and no internet round trip. The demo scores a 200-bed ward in one batch on the mainframe and verifies the result matches the reference model exactly. Inference currently runs on the CPU; compiling the model for the Telum II on-chip accelerator (NNPA) with the IBM Z Deep Learning Compiler is the next step.'],
    ['Honesty statement', real
      ? `The headline results use a clinically parameterised simulated cohort and demonstrate the method only. Retrained on ${(real.cohorts.train + real.cohorts.calibration + real.cohorts.test).toLocaleString()} real PhysioNet 2019 stays, the deployed model is weak (AUROC ${real.auroc.toFixed(2)}, 95% CI ${real.auroc_ci95[0].toFixed(2)}–${real.auroc_ci95[1].toFixed(2)}; gradient boosting ${real.auroc_gbm_comparison.toFixed(2)}), so the simulated results do not transfer. The uncertainty calibration does hold on real data (coverage ${pct(real.conformal.coverage_septic_hours)} septic / ${pct(real.conformal.coverage_nonseptic_hours)} non-septic against a 90% target). Inference on the z17 ran on the CPU; the NNPA accelerator is not yet used. Not a medical device.`
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
