import React, { useEffect, useState } from 'react';
import { Cpu, ShieldCheck, Activity, Zap, Layers, FileText, Sliders, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  activeTab: 'monitor' | 'replay' | 'validation' | 'benchmark' | 'counterfactual' | 'architecture' | 'submission';
  setActiveTab: (tab: 'monitor' | 'replay' | 'validation' | 'benchmark' | 'counterfactual' | 'architecture' | 'submission') => void;
  criticalAlertCount: number;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, criticalAlertCount }) => {
  const [time, setTime] = useState<string>('');
  const [throughput, setThroughput] = useState<number>(124800);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    const throughputTimer = setInterval(() => {
      setThroughput(124800 + Math.floor(Math.random() * 4200 - 2100));
    }, 1500);

    return () => {
      clearInterval(timer);
      clearInterval(throughputTimer);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070a12]/90 backdrop-blur-xl">
      {/* Top Telemetry Strip */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800/50 px-4 py-1.5 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-cyan-400 font-mono">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500"></span>
            </span>
            <span>AURAZ · IN-PROCESS INFERENCE · IBM Z TARGET</span>
          </div>
          <span className="hidden sm:inline text-slate-600">|</span>
          <div className="hidden sm:flex items-center gap-1 font-mono text-slate-300">
            <span className="text-slate-500">MODEL:</span>
            <span className="text-emerald-400 font-semibold">exported · live-scored</span>
          </div>
          <span className="hidden md:inline text-slate-600">|</span>
          <div className="hidden md:flex items-center gap-1 font-mono text-slate-300">
            <span className="text-slate-500">SIMULATED STREAM:</span>
            <span className="text-cyan-300 font-semibold tabular-nums">{throughput.toLocaleString()} msg/s</span>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono">
          <div className="flex items-center gap-1 rounded bg-emerald-950/40 px-2 py-0.5 text-[11px] text-emerald-400 border border-emerald-800/40">
            <ShieldCheck className="h-3 w-3" />
            <span>DESIGN: ON-PREM / ZERO-EGRESS</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 tabular-nums">{time} UTC</span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/40">
            <Activity className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white font-mono">Aura<span className="text-cyan-400">Z</span></h1>
              <span className="rounded-full bg-cyan-950/80 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 border border-cyan-800/60">
                IBM Z DATATHON 2026
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Explainable, calibrated ICU sepsis early warning for IBM Z
            </p>
          </div>
        </div>

        {/* Tab Switchers */}
        <nav className="flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-900/80 p-1 border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              activeTab === 'monitor'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Fleet Mockup</span>
            {criticalAlertCount > 0 && (
              <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white animate-bounce">
                {criticalAlertCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('replay')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              activeTab === 'replay'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Live Model Replay</span>
          </button>

          <button
            onClick={() => setActiveTab('validation')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              activeTab === 'validation'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Validation</span>
          </button>

          <button
            onClick={() => setActiveTab('benchmark')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              activeTab === 'benchmark'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Latency Lab</span>
          </button>

          <button
            onClick={() => setActiveTab('counterfactual')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              activeTab === 'counterfactual'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Intervention Sandbox</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              activeTab === 'architecture'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>IBM Z Architecture</span>
          </button>

          <button
            onClick={() => setActiveTab('submission')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              activeTab === 'submission'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-amber-300 hover:text-amber-200 hover:bg-amber-950/40 border border-amber-500/20'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Hack2Skill Submission</span>
          </button>
        </nav>
      </div>

      {/* Critical Banner Alert if Bed 04 is in Septic Shock Warning */}
      {criticalAlertCount > 0 && activeTab === 'monitor' && (
        <div className="flex items-center justify-between bg-rose-950/60 border-t border-rose-900/60 px-4 py-1.5 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 animate-pulse" />
            <span className="font-semibold text-rose-200">EARLY DECOMPENSATION WARNING:</span>
            <span>Patient Eleanor Vance (ICU Bed 04) sepsis probability peaked at 88% [82-94% CI]. Projected hemodynamic shock in 1.8 hrs.</span>
          </div>
          <button
            onClick={() => setActiveTab('counterfactual')}
            className="flex items-center gap-1 rounded bg-rose-600 hover:bg-rose-500 px-2.5 py-0.5 text-[11px] font-bold text-white transition-colors"
          >
            <span>Simulate Vasopressor Resuscitation</span>
          </button>
        </div>
      )}
    </header>
  );
};
