import React from 'react';
import { Patient } from '../types';
import { X, Activity, ShieldAlert, Cpu, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';

interface PatientDetailModalProps {
  patient: Patient | null;
  onClose: () => void;
  onOpenIntervention: (patient: Patient) => void;
}

export const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
  patient,
  onClose,
  onOpenIntervention,
}) => {
  if (!patient) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl p-6 text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-cyan-950 px-2.5 py-0.5 font-mono text-xs font-bold text-cyan-400 border border-cyan-800/60">
                {patient.bed}
              </span>
              <h2 className="text-xl font-bold text-white font-mono">{patient.name}</h2>
              <span className="text-xs text-slate-400">({patient.id})</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {patient.age}y {patient.gender} • {patient.diagnosis} • Admitted {patient.admissionHours}h ago
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Risk & Conformal Interval Strip */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-xs font-mono text-slate-400">CURRENT SEPSIS RISK</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold font-mono ${patient.sepsisRisk > 70 ? 'text-rose-400' : patient.sepsisRisk > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {patient.sepsisRisk}%
              </span>
              <span className="text-xs font-mono text-slate-400">
                Telum II Multi-Vital Model
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Conformal Prediction Set: <strong className="text-slate-200">[{patient.conformalBounds[0]}% – {patient.conformalBounds[1]}%]</strong> (95% marginal coverage)
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-xs font-mono text-slate-400">RESUSCITATION WINDOW</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold font-mono ${patient.timeToShockHours ? 'text-rose-400' : 'text-emerald-400'}`}>
                {patient.timeToShockHours ? `~${patient.timeToShockHours} hrs` : 'N/A'}
              </span>
              <span className="text-xs font-mono text-slate-400">pre-shock margin</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {patient.timeToShockHours ? 'Intervention prior to arterial collapse prevents refractory shock.' : 'No hemodynamic crisis projected.'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-xs font-mono text-slate-400">TELEMETRY INFERENCE SPEED</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-cyan-400">illustrative</span>
              <span className="text-xs font-mono text-slate-400">in-transaction bus</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Illustrative mock patient. Measured latency: see Latency Lab.
            </div>
          </div>
        </div>

        {/* 6-Hour Longitudinal Trajectory Chart */}
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <h4 className="text-sm font-semibold font-mono text-white">6-Hour Longitudinal Physiological Trend</h4>
            </div>
            <span className="text-[11px] font-mono text-slate-500">MIMIC-IV Continuous Feature Trace</span>
          </div>

          <div className="grid grid-cols-6 gap-2 text-center font-mono">
            {patient.vitalHistory.map((point, idx) => (
              <div key={idx} className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                <div className="text-xs font-bold text-slate-400">{point.time}</div>
                <div className="mt-2 text-sm font-bold text-rose-400">{point.risk}% <span className="text-[10px] font-normal text-slate-500">risk</span></div>
                <div className="mt-1 text-xs text-cyan-300">MAP {point.map}</div>
                <div className="text-[11px] text-amber-300">Lac {point.lactate}</div>
                <div className="text-[11px] text-slate-400">HR {point.hr}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Explainable AI: SHAP Feature Attribution Waterfall */}
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <h4 className="text-sm font-semibold font-mono text-white">Explainable AI: Physiological SHAP Attribution Waterfall</h4>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Additive Feature Contributions</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Shows exactly which organ-system parameters triggered the deep sequence model to elevate septic decompensation risk:
          </p>

          <div className="space-y-3 font-mono">
            {patient.shapContributions.map((shap, idx) => {
              const isPositive = shap.impact > 0;
              const widthPct = Math.min(100, Math.abs(shap.impact) * 200);

              return (
                <div key={idx} className="rounded-lg bg-slate-900/60 p-3 border border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{shap.feature} ({shap.value})</span>
                    <span className={`font-bold ${isPositive ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {isPositive ? `+${(shap.impact * 100).toFixed(0)}% Risk Impact` : `${(shap.impact * 100).toFixed(0)}% Protective`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${isPositive ? 'bg-gradient-to-r from-rose-500 to-red-600' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400 font-sans">
                    {shap.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
          <div className="text-xs text-slate-400">
            Telemetry validated via IBM z/OS Enterprise Transaction Streaming Pipeline.
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenIntervention(patient);
              }}
              className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white transition-colors"
            >
              Open Intervention Sandbox
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
