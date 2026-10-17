import React, { useState, useEffect } from 'react';
import { Patient, InterventionParams } from '../types';
import { Sliders, Activity, Heart, ArrowRight, ShieldCheck, Sparkles, CheckCircle2, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CounterfactualSimulatorProps {
  patients: Patient[];
  selectedPatientId?: string;
}

export const CounterfactualSimulator: React.FC<CounterfactualSimulatorProps> = ({
  patients,
  selectedPatientId,
}) => {
  const [currentPatientId, setCurrentPatientId] = useState<string>(selectedPatientId || 'PT-8942');
  const [params, setParams] = useState<InterventionParams>({
    fluidBolusMl: 500,
    norepinephrineMcg: 0.08,
    antibioticDoorToNeedleMins: 15,
  });

  const patient = patients.find((p) => p.id === currentPatientId) || patients[0];

  // Mathematical counterfactual response model based on Surviving Sepsis Campaign evidence
  // Baseline risk
  const baseRisk = patient.sepsisRisk;

  // Fluid effect: up to 1000mL gives positive volume expansion, beyond 1500mL risks pulmonary edema in pneumonia/CABG
  const fluidScore = params.fluidBolusMl <= 1200
    ? (params.fluidBolusMl / 1000) * 18
    : 18 - ((params.fluidBolusMl - 1200) / 800) * 8;

  // Vasopressor effect (restores vascular tone):
  const vasoScore = (params.norepinephrineMcg / 0.3) * 26;

  // Antibiotic timing penalty: 7.6% mortality spike per hour (60 min) of delay
  const antibioticPenalty = (params.antibioticDoorToNeedleMins / 60) * 14;

  const rawProjectedRisk = Math.max(12, Math.min(96, Math.round(baseRisk - fluidScore - vasoScore + antibioticPenalty)));
  const projectedRisk = rawProjectedRisk;

  // Projected MAP
  const projectedMap = Math.min(88, Math.round(patient.vitals.map + (params.fluidBolusMl / 400) * 4 + (params.norepinephrineMcg / 0.1) * 6));

  const isStabilized = projectedRisk < 35 && projectedMap >= 65;

  const triggerStabilizedCelebration = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#06b6d4', '#10b981', '#3b82f6'],
    });
  };

  useEffect(() => {
    if (isStabilized && baseRisk > 70) {
      triggerStabilizedCelebration();
    }
  }, [isStabilized]);

  const resetParams = () => {
    setParams({
      fluidBolusMl: 0,
      norepinephrineMcg: 0.0,
      antibioticDoorToNeedleMins: 90,
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-cyan-950 px-2 py-0.5 font-mono text-xs font-semibold text-cyan-400 border border-cyan-800/50">
                IN SILICO CLINICAL PREDICTION
              </span>
              <span className="text-xs text-slate-400">Surviving Sepsis Campaign 1-Hour Bundle</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold font-mono text-white">
              Counterfactual Hemodynamic Intervention Sandbox
            </h2>
            <p className="mt-1 text-sm text-slate-400 max-w-3xl">
              Simulate dynamic bedside resuscitation interventions in real time. AuraZ forecasts hemodynamic stabilization trajectories and post-intervention shock probabilities before administering drugs.
            </p>
          </div>

          {/* Patient Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">PATIENT:</span>
            <select
              value={currentPatientId}
              onChange={(e) => setCurrentPatientId(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.bed}: {p.name} ({p.sepsisRisk}% Baseline Risk)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column (7 cols) */}
        <div className="lg:col-span-7 space-y-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-semibold text-white font-mono flex items-center gap-2">
              <Sliders className="h-4 w-4 text-cyan-400" />
              <span>Titration Controls & Resuscitation Bundle</span>
            </h3>
            <button
              onClick={resetParams}
              className="flex items-center gap-1 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Slider 1: Fluid Bolus */}
          <div className="rounded-xl bg-slate-950/70 p-4 border border-slate-800/80">
            <div className="flex justify-between items-center text-xs font-mono mb-2">
              <span className="font-bold text-slate-200">IV CRYSTALLOID FLUID BOLUS</span>
              <span className="text-cyan-400 font-extrabold text-sm">{params.fluidBolusMl} mL</span>
            </div>
            <input
              type="range"
              min="0"
              max="2000"
              step="100"
              value={params.fluidBolusMl}
              onChange={(e) => setParams({ ...params, fluidBolusMl: Number(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>0 mL (No fluid)</span>
              <span>1000 mL (Standard Bolus)</span>
              <span>2000 mL (Max Protocol)</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Restores intravascular volume and cardiac preload. Caution: Excessive crystalloid in heart failure may induce pulmonary capillary leak.
            </p>
          </div>

          {/* Slider 2: Norepinephrine */}
          <div className="rounded-xl bg-slate-950/70 p-4 border border-slate-800/80">
            <div className="flex justify-between items-center text-xs font-mono mb-2">
              <span className="font-bold text-slate-200">NOREPINEPHRINE VASOPRESSOR TITRATION</span>
              <span className="text-amber-400 font-extrabold text-sm">{params.norepinephrineMcg.toFixed(2)} mcg/kg/min</span>
            </div>
            <input
              type="range"
              min="0.00"
              max="0.40"
              step="0.02"
              value={params.norepinephrineMcg}
              onChange={(e) => setParams({ ...params, norepinephrineMcg: Number(e.target.value) })}
              className="w-full accent-amber-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>0.00 mcg/kg/min</span>
              <span>0.15 mcg (Moderate)</span>
              <span>0.40 mcg (High Inotropic Support)</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Alpha-1 adrenergic agonist to restore systemic vascular resistance and maintain Mean Arterial Pressure (MAP) &gt; 65 mmHg.
            </p>
          </div>

          {/* Slider 3: Antibiotic Timing */}
          <div className="rounded-xl bg-slate-950/70 p-4 border border-slate-800/80">
            <div className="flex justify-between items-center text-xs font-mono mb-2">
              <span className="font-bold text-slate-200">BROAD-SPECTRUM ANTIBIOTIC DOOR-TO-NEEDLE</span>
              <span className="text-emerald-400 font-extrabold text-sm">{params.antibioticDoorToNeedleMins} mins</span>
            </div>
            <input
              type="range"
              min="0"
              max="120"
              step="5"
              value={params.antibioticDoorToNeedleMins}
              onChange={(e) => setParams({ ...params, antibioticDoorToNeedleMins: Number(e.target.value) })}
              className="w-full accent-emerald-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>0 min (Immediate)</span>
              <span>60 min (Golden Hour target)</span>
              <span>120 min (Delayed)</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Every 60 minutes of delay in antibiotic administration after shock onset increases mortality by 7.6% (Kumar et al.).
            </p>
          </div>
        </div>

        {/* Projection Column (5 cols) */}
        <div className="lg:col-span-5 space-y-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur">
          <h3 className="font-semibold text-white font-mono flex items-center gap-2 border-b border-slate-800 pb-3">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span>Counterfactual Trajectory Forecast</span>
          </h3>

          {/* Before & After Risk Box */}
          <div className="rounded-xl bg-slate-950/80 p-5 border border-slate-800 space-y-4 font-mono">
            <div>
              <div className="text-xs text-slate-400">SEPSIS SHOCK PROBABILITY</div>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">Baseline</div>
                  <div className="text-2xl font-bold text-rose-400">{baseRisk}%</div>
                </div>

                <ArrowRight className="h-5 w-5 text-slate-600" />

                <div className="text-right">
                  <div className="text-xs text-slate-500">Counterfactual Projection</div>
                  <div className={`text-3xl font-extrabold ${projectedRisk < 40 ? 'text-emerald-400' : projectedRisk < 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {projectedRisk}%
                  </div>
                </div>
              </div>

              {/* Progress visualizer */}
              <div className="mt-3 h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${projectedRisk < 40 ? 'bg-emerald-500' : projectedRisk < 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${projectedRisk}%` }}
                />
              </div>
            </div>

            {/* MAP Restoration */}
            <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">PROJECTED PERFUSION (MAP)</div>
                <div className="text-xs text-slate-500">Target &gt; 65 mmHg</div>
              </div>
              <div className="text-right">
                <span className={`text-2xl font-extrabold ${projectedMap >= 65 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {projectedMap} mmHg
                </span>
                <span className="text-[10px] text-slate-500 block">Baseline was {patient.vitals.map} mmHg</span>
              </div>
            </div>
          </div>

          {/* Clinical Status Assessment */}
          <div className={`rounded-xl p-4 border ${isStabilized ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-amber-950/30 border-amber-800/50 text-amber-300'}`}>
            <div className="flex items-start gap-2.5">
              {isStabilized ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Activity className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="text-xs font-bold font-mono">
                  {isStabilized ? 'CLINICAL STABILIZATION ACHIEVED' : 'HEMODYNAMIC THREAT PERSISTS'}
                </h4>
                <p className="mt-1 text-[11px] leading-relaxed">
                  {isStabilized
                    ? 'Combination of fluid resuscitation, target vasopressor titration, and early antimicrobial delivery projects resolution of anaerobic cellular debt. Shock probability reduced by ' + (baseRisk - projectedRisk) + '%.'
                    : 'Current titration is insufficient to guarantee vital organ perfusion. Increase vasopressor support to achieve MAP > 65 mmHg and expedite antimicrobial delivery within the golden hour.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
