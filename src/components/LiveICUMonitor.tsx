import React, { useEffect, useState } from 'react';
import { Patient } from '../types';
import { Heart, Activity, AlertCircle, ShieldCheck, Clock, User, ChevronRight, Sliders, CheckCircle2 } from 'lucide-react';

interface LiveICUMonitorProps {
  patients: Patient[];
  onSelectPatient: (patient: Patient) => void;
  onOpenIntervention: (patient: Patient) => void;
}

export const LiveICUMonitor: React.FC<LiveICUMonitorProps> = ({
  patients,
  onSelectPatient,
  onOpenIntervention,
}) => {
  // Waveform tick animation offset
  const [waveOffset, setWaveOffset] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWaveOffset((prev) => (prev + 1) % 100);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  const criticalCount = patients.filter((p) => p.status === 'critical').length;
  const warningCount = patients.filter((p) => p.status === 'warning').length;
  const stableCount = patients.filter((p) => p.status === 'stable' || p.status === 'recovering').length;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Unit Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>ACTIVE ICU BEDS</span>
            <Activity className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">4 / 4</div>
          <div className="mt-1 text-xs text-slate-400 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Illustrative fleet view</span>
          </div>
        </div>

        <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-4 backdrop-blur">
          <div className="flex items-center justify-between text-rose-400 text-xs font-mono">
            <span>IMMINENT SHOCK (&lt;2h)</span>
            <AlertCircle className="h-4 w-4 text-rose-500 animate-pulse" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-rose-400">{criticalCount} Bed</div>
          <div className="mt-1 text-xs text-rose-300">Requires vasopressor resuscitation</div>
        </div>

        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 backdrop-blur">
          <div className="flex items-center justify-between text-amber-400 text-xs font-mono">
            <span>PREEMPTIVE WARNING</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-400">{warningCount} Bed</div>
          <div className="mt-1 text-xs text-amber-300">Subclinical trend detected (4.5h window)</div>
        </div>

        <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 backdrop-blur">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-mono">
            <span>FALSE ALARMS FILTERED</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">Demo</div>
          <div className="mt-1 text-xs text-emerald-300">Beds are hand-authored; see Validation for measured results</div>
        </div>
      </div>

      {/* Main Bed Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {patients.map((patient) => {
          const isCritical = patient.status === 'critical';
          const isWarning = patient.status === 'warning';
          const isStable = patient.status === 'stable';

          return (
            <div
              key={patient.id}
              className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 backdrop-blur-xl ${
                isCritical
                  ? 'border-rose-600/70 bg-gradient-to-b from-rose-950/30 via-slate-900/80 to-slate-950/90 shadow-lg shadow-rose-950/40'
                  : isWarning
                  ? 'border-amber-600/60 bg-gradient-to-b from-amber-950/20 via-slate-900/80 to-slate-950/90'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              {/* Bed Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold ${
                      isCritical
                        ? 'bg-rose-500 text-white animate-pulse'
                        : isWarning
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {patient.bed}
                  </span>
                  <div>
                    <h3 className="font-semibold text-white text-sm group-hover:text-cyan-300 transition-colors">
                      {patient.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {patient.age}y {patient.gender} • {patient.diagnosis}
                    </p>
                  </div>
                </div>

                {/* Sepsis Risk Badge */}
                <div className="text-right">
                  <div className="text-[10px] font-mono text-slate-400">SEPSIS RISK (DEMO)</div>
                  <div className="flex items-baseline gap-1 justify-end font-mono">
                    <span
                      className={`text-xl font-bold ${
                        isCritical
                          ? 'text-rose-400'
                          : isWarning
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {patient.sepsisRisk}%
                    </span>
                    <span className="text-[10px] text-slate-500">
                      [{patient.conformalBounds[0]}-{patient.conformalBounds[1]}%]
                    </span>
                  </div>
                </div>
              </div>

              {/* Animated Waveform Canvas Banner */}
              <div className="relative h-14 bg-black/40 border-b border-slate-800/60 px-4 py-1 flex items-center overflow-hidden">
                <div className="absolute top-1 left-3 text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                  Lead II ECG / Arterial Waveform • Real-Time Stream
                </div>
                {/* SVG Synthetic ECG wave */}
                <svg className="w-full h-8 stroke-cyan-400/80 fill-none" viewBox="0 0 600 50" preserveAspectRatio="none">
                  <path
                    d={`M 0 25 
                      L 40 25 L 50 22 L 55 25 L 65 25 
                      L 70 8 L 75 42 L 80 25 L 90 25 
                      L 100 20 L 115 25 L 180 25 
                      L 190 22 L 195 25 L 205 25 
                      L 210 8 L 215 42 L 220 25 L 230 25 
                      L 240 20 L 255 25 L 320 25 
                      L 330 22 L 335 25 L 345 25 
                      L 350 8 L 355 42 L 360 25 L 370 25 
                      L 380 20 L 395 25 L 460 25
                      L 470 22 L 475 25 L 485 25 
                      L 490 8 L 495 42 L 500 25 L 510 25 
                      L 520 20 L 535 25 L 600 25`}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: `translateX(-${(waveOffset * 3) % 140}px)`,
                      transition: 'transform 0.12s linear',
                    }}
                  />
                </svg>
                {/* Sweep Scanner bar */}
                <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black via-black/70 to-transparent pointer-events-none" />
              </div>

              {/* Vitals Hex-Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-4 text-center font-mono">
                <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800/60">
                  <div className="text-[10px] text-slate-500">HEART RATE</div>
                  <div className={`text-base font-bold ${patient.vitals.heartRate > 110 ? 'text-rose-400' : 'text-slate-200'}`}>
                    {patient.vitals.heartRate} <span className="text-[9px] font-normal text-slate-500">bpm</span>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800/60">
                  <div className="text-[10px] text-slate-500">MAP</div>
                  <div className={`text-base font-bold ${patient.vitals.map < 65 ? 'text-rose-400 font-extrabold' : 'text-slate-200'}`}>
                    {patient.vitals.map} <span className="text-[9px] font-normal text-slate-500">mmHg</span>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800/60">
                  <div className="text-[10px] text-slate-500">SPO2</div>
                  <div className={`text-base font-bold ${patient.vitals.spo2 < 92 ? 'text-amber-400' : 'text-slate-200'}`}>
                    {patient.vitals.spo2}%
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800/60">
                  <div className="text-[10px] text-slate-500">LACTATE</div>
                  <div className={`text-base font-bold ${patient.vitals.lactate > 2.0 ? 'text-rose-400' : 'text-slate-200'}`}>
                    {patient.vitals.lactate} <span className="text-[9px] font-normal text-slate-500">mmol</span>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800/60">
                  <div className="text-[10px] text-slate-500">SHOCK INDEX</div>
                  <div className={`text-base font-bold ${patient.vitals.shockIndex > 1.0 ? 'text-rose-400' : 'text-slate-200'}`}>
                    {patient.vitals.shockIndex}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800/60">
                  <div className="text-[10px] text-slate-500">SOFA SCORE</div>
                  <div className="text-base font-bold text-slate-200">
                    {patient.vitals.sofaScore} <span className="text-[9px] font-normal text-slate-500">/24</span>
                  </div>
                </div>
              </div>

              {/* Bottom Prediction Action Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/70 bg-slate-950/40 px-5 py-3">
                <div className="flex items-center gap-2 text-xs font-mono">
                  {patient.timeToShockHours ? (
                    <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                      <Clock className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '6s' }} />
                      Shock Decompensation in ~{patient.timeToShockHours}h
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Hemodynamically Stable
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenIntervention(patient)}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors border border-cyan-800/40"
                  >
                    <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Simulate Titration</span>
                  </button>

                  <button
                    onClick={() => onSelectPatient(patient)}
                    className="flex items-center gap-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                  >
                    <span>Inspect SHAP</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
