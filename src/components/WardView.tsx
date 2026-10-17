import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { buildFeatures, Model, ReplayPatient, score } from '../lib/model';
import { remoteScore } from '../lib/remote';

interface Props { model: Model; remote: string; remoteLabel: string }
interface Bed { id: string; risk: number | null; state: 'scoring' | 'septic' }

export const WardView: React.FC<Props> = ({ model, remote, remoteLabel }) => {
  const [ward, setWard] = useState<ReplayPatient[] | null>(null);
  const [hour, setHour] = useState(6);
  const [playing, setPlaying] = useState(false);
  const [risks, setRisks] = useState<(number | null)[]>([]);
  const [tickMs, setTickMs] = useState<{ ms: number; where: string } | null>(null);
  const firstAlert = useRef<Map<number, number>>(new Map());

  useEffect(() => { fetch(`${import.meta.env.BASE_URL}ward.json`).then((r) => r.json()).then(setWard); }, []);

  // score every bed for the current hour (one batch: locally or on IBM Z)
  useEffect(() => {
    if (!ward) return;
    const idx = ward.map((p, i) => (p.onset !== null && hour >= p.onset ? -1 : i)).filter((i) => i >= 0);
    const xs = idx.map((i) => buildFeatures(ward[i].vitals, hour));
    const apply = (rs: number[], ms: number, where: string) => {
      const out: (number | null)[] = ward.map(() => null);
      idx.forEach((i, k) => {
        out[i] = rs[k];
        if (rs[k] >= model.alert_threshold && !firstAlert.current.has(i)) firstAlert.current.set(i, hour);
      });
      setRisks(out); setTickMs({ ms, where });
    };
    const t = performance.now();
    if (remote) remoteScore(remote, xs).then((r) => apply(r.risk, performance.now() - t, remoteLabel)).catch(() => apply(xs.map((x) => score(model, x)), performance.now() - t, 'browser (remote failed)'));
    else apply(xs.map((x) => score(model, x)), performance.now() - t, 'browser');
  }, [ward, hour, remote, model, remoteLabel]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setHour((h) => (h >= 47 ? (setPlaying(false), h) : h + 1)), 600);
    return () => clearInterval(t);
  }, [playing]);

  const reset = () => { firstAlert.current = new Map(); setHour(6); setPlaying(false); };

  const stats = useMemo(() => {
    if (!ward) return null;
    let tp = 0, fp = 0, missed = 0, septicSoFar = 0;
    ward.forEach((p, i) => {
      const a = firstAlert.current.get(i);
      if (p.onset !== null && p.onset <= hour) { septicSoFar++; if (a === undefined) missed++; }
      if (a !== undefined) (p.onset !== null ? tp++ : fp++);
    });
    return { tp, fp, missed, septicSoFar };
  }, [ward, hour, risks]);

  if (!ward || !stats) return <div className="p-10 text-center font-mono text-slate-500">Loading ward…</div>;

  const beds: Bed[] = ward.map((p, i) => ({ id: p.id, risk: risks[i] ?? null, state: risks[i] == null ? 'septic' : 'scoring' }));
  const ranked = beds.map((b, i) => ({ ...b, i })).filter((b) => b.risk !== null).sort((a, b) => b.risk! - a.risk!);
  const color = (r: number | null) => r === null ? 'bg-slate-700' : r >= model.alert_threshold ? 'bg-amber-400' : r >= model.alert_threshold / 2 ? 'bg-cyan-700' : 'bg-slate-800';

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div>
          <h2 className="text-lg font-bold text-white">Ward view · 200 held-out ICU stays</h2>
          <p className="mt-1 text-sm text-slate-400">All beds are scored together each hour in one batch. Ground truth is revealed as it happens.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-slate-300">Hour {hour}/47</span>
          <button onClick={() => setPlaying((v) => !v)} className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{playing ? 'Pause' : 'Play'}</button>
          <button onClick={reset} aria-label="Reset" className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"><RotateCcw className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[['Alerts on beds that became septic', stats.tp, 'text-emerald-400'], ['Alerts on beds that did not', stats.fp, 'text-amber-400'],
          ['Septic so far', stats.septicSoFar, 'text-slate-200'], ['Septic with no prior alert', stats.missed, 'text-rose-400'],
          ['Scoring time this hour', tickMs ? `${tickMs.ms.toFixed(1)} ms` : '—', 'text-cyan-300']].map(([k, v, c]) => (
          <div key={k as string} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-[11px] text-slate-500">{k}</div><div className={`mt-1 font-mono text-2xl font-bold ${c}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-slate-500">Scored on: <span className="text-slate-300">{tickMs?.where ?? '—'}</span>. Connect an IBM Z endpoint in the IBM Z tab to score the whole ward on LinuxONE.</div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2">
          <div className="grid grid-cols-10 gap-1 sm:grid-cols-20">
            {beds.map((b) => <div key={b.id} title={`${b.id}: ${b.risk === null ? 'septic (in treatment)' : `${(b.risk * 100).toFixed(0)}%`}`} className={`aspect-square rounded-sm ${color(b.risk)}`} />)}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-400">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400" />alert</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-cyan-700" />rising</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-slate-800" />low</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-slate-700" />sepsis onset reached</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-xs text-slate-400">Highest risk now</div>
          <ol className="mt-2 space-y-1.5">
            {ranked.slice(0, 10).map((b) => (
              <li key={b.id} className="flex items-center justify-between font-mono text-sm">
                <span className="text-slate-300">{b.id}</span>
                <span className={b.risk! >= model.alert_threshold ? 'text-amber-400' : 'text-slate-400'}>{(b.risk! * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};
