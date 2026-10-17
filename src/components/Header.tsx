import React from 'react';
import { Activity } from 'lucide-react';

export type Tab = 'replay' | 'ward' | 'validation' | 'ibmz' | 'architecture' | 'submission';
const TABS: [Tab, string][] = [['replay', 'Live Replay'], ['ward', 'Ward'], ['validation', 'Validation'], ['ibmz', 'IBM Z'], ['architecture', 'Architecture'], ['submission', 'Submission']];

interface Props { activeTab: Tab; setActiveTab: (t: Tab) => void; ibmz: { connected: boolean; label: string } }

export const Header: React.FC<Props> = ({ activeTab, setActiveTab, ibmz }) => (
  <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#070a12]/95 backdrop-blur">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400"><Activity className="h-5 w-5" /></div>
        <div>
          <h1 className="font-mono text-lg font-bold leading-none text-white">Aura<span className="text-cyan-400">Z</span></h1>
          <p className="mt-0.5 text-[11px] text-slate-400">ICU sepsis early warning for IBM Z</p>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto text-sm">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`rounded-lg px-3 py-1.5 transition-colors ${activeTab === k ? 'bg-cyan-500 font-semibold text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
            {label}
          </button>
        ))}
      </nav>
      <button onClick={() => setActiveTab('ibmz')} className="flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800">
        <span className={`h-2 w-2 rounded-full ${ibmz.connected ? 'bg-emerald-400' : 'bg-slate-500'}`} />{ibmz.label}
      </button>
    </div>
  </header>
);
