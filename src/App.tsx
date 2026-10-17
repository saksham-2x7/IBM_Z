import React, { useEffect, useState } from 'react';
import { Header, Tab } from './components/Header';
import { BenchmarkLab } from './components/BenchmarkLab';
import { ArchitectureExplorer } from './components/ArchitectureExplorer';
import { SubmissionHub } from './components/SubmissionHub';
import { ReplayLab } from './components/ReplayLab';
import { ValidationPanel } from './components/ValidationPanel';
import { useArtifacts } from './lib/model';
import { Health, health } from './lib/remote';

const Loading = () => <div className="p-10 text-center font-mono text-slate-500">Loading model…</div>;
const KEY = 'auraz.endpoint';

export const App: React.FC = () => {
  const art = useArtifacts();
  const [tab, setTab] = useState<Tab>('replay');
  const [endpoint, setEndpoint] = useState<string>(() => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } });
  const [info, setInfo] = useState<Health | null>(null);

  useEffect(() => {
    try { localStorage.setItem(KEY, endpoint); } catch { /* ignore */ }
    setInfo(null);
    if (!endpoint) return;
    health(endpoint).then(setInfo).catch(() => setInfo(null));
  }, [endpoint]);

  const label = info ? `${info.system} · ${info.arch}` : 'IBM Z: not connected';
  const remote = info ? endpoint : '';

  return (
    <div className="flex min-h-screen flex-col bg-[#06080d] font-sans text-slate-100 selection:bg-cyan-500/30">
      <Header activeTab={tab} setActiveTab={setTab} ibmz={{ connected: !!info, label }} />
      <main className="flex-1 pb-16">
        {tab === 'replay' && (art ? <ReplayLab model={art.model} patients={art.replay} remote={remote} remoteLabel={label} /> : <Loading />)}
        {tab === 'validation' && (art ? <ValidationPanel m={art.metrics} /> : <Loading />)}
        {tab === 'ibmz' && (art ? <BenchmarkLab model={art.model} patients={art.replay} endpoint={endpoint} setEndpoint={setEndpoint} info={info} /> : <Loading />)}
        {tab === 'architecture' && <ArchitectureExplorer />}
        {tab === 'submission' && <SubmissionHub />}
      </main>
      <footer className="border-t border-slate-900 px-6 py-4 text-center text-xs text-slate-500">
        AuraZ · IBM Z Datathon 2026 · Technology for Good · Research prototype on a simulated cohort, not a medical device
      </footer>
    </div>
  );
};

export default App;
