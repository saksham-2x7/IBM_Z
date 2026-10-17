import React from 'react';

const LAYERS: [string, string, string, 'built' | 'next'][] = [
  ['1 · Bedside data', 'Hourly vitals and labs (HR, MAP, SBP, RR, temperature, SpO2, lactate, WBC). Labs arrive sparsely and are forward-filled.', 'ml/train.py (simulated cohort) · PhysioNet 2019 loader next', 'built'],
  ['2 · Features', '16 features per patient-hour: current values, 3–6 h trends, shock index, 6 h extremes. Identical code in Python and TypeScript.', 'ml/train.py · src/lib/model.ts', 'built'],
  ['3 · Model + calibration', 'Logistic model (matches gradient boosting on this task), split-conformal prediction sets, alert threshold set under a false-alert budget on a separate cohort.', 'public/model.json · public/metrics.json', 'built'],
  ['4 · Inference on IBM LinuxONE', 'Standard-library Python service on s390x: /health reports the IBM machine type and NNPA flag, /score scores a batch (e.g. a 200-bed ward) beside the data.', 'ml/serve.py', 'built'],
  ['5 · Telum II acceleration', 'Export to ONNX, compile with the IBM Z Deep Learning Compiler for the on-chip NNPA accelerator, benchmark against CPU.', 'roadmap', 'next'],
  ['6 · Clinician view', 'Live replay with explanation and uncertainty, 200-bed ward ranking, validation against the SIRS rule.', 'src/components', 'built'],
];

export const ArchitectureExplorer: React.FC = () => (
  <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
    <div>
      <h2 className="text-lg font-bold text-white">How AuraZ fits on IBM Z</h2>
      <p className="mt-1 text-sm text-slate-400">Each layer links to the code that implements it. "Next" marks work not yet done.</p>
    </div>
    <ol className="space-y-3">
      {LAYERS.map(([t, d, code, s]) => (
        <li key={t} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-white">{t}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${s === 'built' ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>{s}</span>
          </div>
          <p className="mt-1 text-sm text-slate-300">{d}</p>
          <p className="mt-2 font-mono text-xs text-slate-500">{code}</p>
        </li>
      ))}
    </ol>
  </div>
);
