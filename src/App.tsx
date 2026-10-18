import React, { useEffect, useState } from 'react';
import { Header, Tab } from './components/Header';
import { Hero } from './components/Hero';
import { BenchmarkLab } from './components/BenchmarkLab';
import { ArchitectureExplorer } from './components/ArchitectureExplorer';
import { SubmissionHub } from './components/SubmissionHub';
import { ReplayLab } from './components/ReplayLab';
import { ValidationPanel } from './components/ValidationPanel';
import { WardView } from './components/WardView';
import { ReplayPatient, useArtifacts } from './lib/model';
import { Health, health } from './lib/remote';

const Loading = () => (
  <div className="flex items-center justify-center py-24 text-center font-mono text-sm text-slate-400">
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" aria-hidden="true" />
      Loading model artifacts…
    </div>
  </div>
);

const KEY = 'auraz.endpoint';

export const App: React.FC = () => {
  const art = useArtifacts();
  const [tab, setTab] = useState<Tab>('replay');
  const [replayTarget, setReplayTarget] = useState<{ patient: ReplayPatient; hour: number } | null>(null);
  const [endpoint, setEndpoint] = useState<string>(() => {
    try {
      return localStorage.getItem(KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [info, setInfo] = useState<Health | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, endpoint);
    } catch {
      /* ignore */
    }
    setInfo(null);
    if (!endpoint) return;
    health(endpoint)
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [endpoint]);

  const label = info ? `${info.system} · ${info.arch}` : 'IBM Z: not connected';
  const remote = info ? endpoint : '';

  const handleSelectBed = (patient: ReplayPatient, hour: number) => {
    setReplayTarget({ patient, hour });
    setTab('replay');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fa] font-sans text-slate-100 selection:bg-cyan-500/30">
      <Header activeTab={tab} setActiveTab={setTab} ibmz={{ connected: !!info, label }} />

      <Hero setTab={setTab} connected={!!info} hostLabel={label} />

      <main className="flex-1 pb-16">
        <section
          role="tabpanel"
          id={`tabpanel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          tabIndex={0}
          className="outline-none"
        >
          {tab === 'replay' && (
            art ? (
              <ReplayLab
                model={art.model}
                patients={art.replay}
                remote={remote}
                remoteLabel={label}
                target={replayTarget}
              />
            ) : <Loading />
          )}
          {tab === 'validation' && (
            art ? <ValidationPanel m={art.metrics} /> : <Loading />
          )}
          {tab === 'ibmz' && (
            art ? <BenchmarkLab model={art.model} patients={art.replay} endpoint={endpoint} setEndpoint={setEndpoint} info={info} /> : <Loading />
          )}
          {tab === 'architecture' && <ArchitectureExplorer />}
          {tab === 'ward' && (
            art ? (
              <WardView
                model={art.model}
                remote={remote}
                remoteLabel={label}
                onSelectPatient={handleSelectBed}
              />
            ) : <Loading />
          )}
          {tab === 'submission' && (
            art ? <SubmissionHub m={art.metrics} /> : <Loading />
          )}
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-900 px-4 py-6 text-xs text-slate-400 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>AuraZ · IBM Z Datathon 2026 · Research prototype on retrospective data, not a medical device.</p>
          <nav className="flex flex-wrap gap-4 font-medium text-cyan-300" aria-label="Project links">
            <a className="hover:underline" href="https://github.com/saksham-2x7/IBM_Z" target="_blank" rel="noreferrer">Source code</a>
            <a className="hover:underline" href="https://github.com/saksham-2x7/IBM_Z/blob/main/docs/MODEL_CARD.md" target="_blank" rel="noreferrer">Model card</a>
            <a className="hover:underline" href="https://github.com/saksham-2x7/IBM_Z/blob/main/docs/REAL_DATA_PILOT.md" target="_blank" rel="noreferrer">Real-data results</a>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default App;
