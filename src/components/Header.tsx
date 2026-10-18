import React, { useRef } from 'react';
import { Activity, CheckCircle2, Server } from 'lucide-react';

export type Tab = 'replay' | 'ward' | 'validation' | 'ibmz' | 'architecture';

const TABS: [Tab, string][] = [
  ['replay', 'Live Replay'],
  ['ward', 'Ward'],
  ['validation', 'Validation'],
  ['ibmz', 'IBM Z'],
  ['architecture', 'Architecture'],
];

interface Props {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  ibmz: { connected: boolean; label: string };
}

export const Header: React.FC<Props> = ({ activeTab, setActiveTab, ibmz }) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % TABS.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = TABS.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    const nextTab = TABS[nextIndex][0];
    setActiveTab(nextTab);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4 sm:px-6">
        {/* Top row on mobile/tablet: Brand & IBM Z status */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-900"
              style={{ background: "linear-gradient(135deg,#0f62fe,#8a3ffc)", color: "#fff" }}
              aria-hidden="true"
            >
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-mono text-lg font-bold leading-none tracking-tight text-white">
                Aura<span className="text-cyan-400">Z</span>
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                ICU sepsis early warning for IBM Z
              </p>
            </div>
          </div>

          {/* Quick status pill - visible on mobile/tablet right header */}
          <button
            type="button"
            onClick={() => setActiveTab('ibmz')}
            className="flex lg:hidden items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            aria-label={`IBM Z Status: ${ibmz.label}. Open IBM Z tab`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${ibmz.connected ? 'bg-cyan-400' : 'bg-slate-500'}`}
              aria-hidden="true"
            />
            <span className="max-w-[140px] truncate text-xs font-mono font-medium">
              {ibmz.connected ? 'z17 Online' : 'No Mainframe'}
            </span>
          </button>
        </div>

        {/* Navigation Tabs with ARIA & Keyboard support */}
        <nav
          role="tablist"
          aria-label="Main Navigation"
          className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-sm scrollbar-none"
        >
          {TABS.map(([k, label], idx) => {
            const isActive = activeTab === k;
            return (
              <button
                key={k}
                ref={(el) => { tabRefs.current[idx] = el; }}
                role="tab"
                id={`tab-${k}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${k}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(k)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 min-h-[40px] flex items-center ${
                  isActive
                    ? 'bg-cyan-500 font-semibold text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* IBM Z Mainframe Status badge on desktop (>= 1024px) */}
        <div className="hidden lg:flex lg:items-center">
          <button
            type="button"
            onClick={() => setActiveTab('ibmz')}
            className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            aria-label={`IBM Z Status: ${ibmz.label}. Click to manage connection`}
          >
            {ibmz.connected ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
            ) : (
              <Server className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            )}
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                ibmz.connected ? 'bg-cyan-400' : 'bg-slate-500'
              }`}
              aria-hidden="true"
            />
            <span className="font-mono text-[11px] text-slate-300">
              {ibmz.label}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
