import React, { useEffect, useMemo, useState } from 'react';
import { Play, Pause, RotateCcw, ShieldAlert, ShieldCheck, HelpCircle } from 'lucide-react';
import { remoteScore } from '../lib/remote';
import { buildFeatures, conformalSet, contributions, FEATURE_LABELS, Model, ReplayPatient, score } from '../lib/model';

interface Props { model: Model; patients: ReplayPatient[]; remote: string; remoteLabel: string }

const KIND: Record<string, string> = {
  sepsis: 'Develops sepsis', none: 'Stable', postop: 'Post-op tachycardia (confounder)', hypovol: 'Hypovolaemia (confounder)', fever: 'Fever without sepsis (confounder)',
};

export const ReplayLab: React.FC<Props> = ({ model, patients, remote, remoteLabel }) => {
  const [idx, setIdx] = useState(0);
  const [hour, setHour] = useState(6);
  const [playing, setPlaying] = useState(false);
  const p = patients[idx];

  const local = useMemo(() => {
    const out: (number | null)[] = [];
    for (let h = 0; h < p.vitals.hr.length; h++) out.push(h < 6 || (p.onset !== null && h >= p.onset) ? null : score(model, buildFeatures(p.vitals, h)));
    return out;
  }, [p, model]);
  const [remoteSeries, setRemoteSeries] = useState<(number | null)[] | null>(null);
  const [remoteMs, setRemoteMs] = useState<number | null>(null);
  useEffect(() => {
    setRemoteSeries(null);
    if (!remote) return;
    const hs = local.map((v, h) => (v === null ? -1 : h)).filter((h) => h >= 0);
    const t = performance.now();
    remoteScore(remote, hs.map((h) => buildFeatures(p.vitals, h)))
      .then((r) => { const out: (number | null)[] = local.map(() => null); hs.forEach((h, i) => { out[h] = r.risk[i]; }); setRemoteSeries(out); setRemoteMs(performance.now() - t); })
      .catch(() => setRemoteSeries(null));
  }, [p, remote, local]);
  const series = remoteSeries ?? local;

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setHour((h) => (h >= 47 ? (setPlaying(false), h) : h + 1)), 350);
    return () => clearInterval(t);
  }, [playing]);

  const pick = (i: number) => { setIdx(i); setHour(6); setPlaying(false); };
  const risk = series[hour] ?? series.filter((v) => v !== null).slice(-1)[0] ?? 0;
  const firstAlert = series.findIndex((r, h) => r !== null && r >= model.alert_threshold && h <= hour);
  const alerted = firstAlert >= 0;
  const lead = alerted && p.onset !== null ? p.onset - firstAlert : null;
  const x = buildFeatures(p.vitals, hour);
  const contrib = contributions(model, x).slice(0, 6);
  const maxImp = Math.max(...contrib.map((c) => Math.abs(c.impact)), 0.01);
  const cset = conformalSet(model, risk);
  const W = 720, Hh = 220, sx = (h: number) => 30 + (h / 47) * (W - 40), sy = (r: number) => Hh - 24 - r * (Hh - 40);

  const tiles: [string, number, string][] = [
    ['HR', p.vitals.hr[hour], 'bpm'], ['MAP', p.vitals.map[hour], 'mmHg'], ['RR', p.vitals.rr[hour], '/min'],
    ['Temp', p.vitals.temp[hour], '°C'], ['SpO2', p.vitals.spo2[hour], '%'], ['Lactate', p.vitals.lactate[hour], 'mmol/L'],
  ];

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="rounded bg-cyan-950 px-2 py-0.5 font-mono text-xs font-semibold text-cyan-400 border border-cyan-800/50">LIVE MODEL REPLAY</span>
            <h2 className="mt-2 text-xl font-bold font-mono text-white">Watch the trained model score a held-out patient, hour by hour</h2>
            <p className="mt-1 text-sm text-slate-400 max-w-3xl">Every number below is computed live by the exported model in your browser. These patients were never seen in training or calibration. Includes look-alike patients (post-op, hypovolaemia, fever) that should not trigger an alert.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPlaying((v) => !v)} className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 hover:brightness-110">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{playing ? 'Pause' : 'Play'}
            </button>
            <button onClick={() => { setHour(6); setPlaying(false); }} className="rounded-xl border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"><RotateCcw className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {patients.map((pt, i) => (
            <button key={pt.id} onClick={() => pick(i)} className={`rounded-lg border px-3 py-1.5 text-xs font-mono ${i === idx ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
              {pt.id} · {KIND[pt.kind] ?? pt.kind}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between font-mono text-xs text-slate-400">
            <span>Predicted risk of sepsis onset within 6 h</span>
            <span>{remoteSeries ? <span className="text-emerald-400">Scored on {remoteLabel}{remoteMs ? ` · ${remoteMs.toFixed(0)} ms round trip` : ""}</span> : "Scored in browser"} · Hour {hour} of 47</span>
          </div>
          <svg viewBox={`0 0 ${W} ${Hh}`} className="mt-2 w-full">
            {[0, .25, .5, .75, 1].map((g) => <g key={g}><line x1={30} x2={W - 10} y1={sy(g)} y2={sy(g)} stroke="#1e293b" /><text x={4} y={sy(g) + 3} fontSize="9" fill="#64748b">{Math.round(g * 100)}%</text></g>)}
            <line x1={30} x2={W - 10} y1={sy(model.alert_threshold)} y2={sy(model.alert_threshold)} stroke="#f59e0b" strokeDasharray="5 4" />
            <text x={W - 150} y={sy(model.alert_threshold) - 4} fontSize="9" fill="#f59e0b">alert threshold {Math.round(model.alert_threshold * 100)}%</text>
            {p.onset !== null && <g><line x1={sx(p.onset)} x2={sx(p.onset)} y1={10} y2={Hh - 24} stroke="#ef4444" strokeDasharray="3 3" /><text x={sx(p.onset) + 4} y={20} fontSize="10" fill="#ef4444">sepsis onset (h{p.onset})</text></g>}
            <polyline fill="none" stroke="#22d3ee" strokeWidth="2" points={series.map((r, h) => (r !== null && h <= hour ? `${sx(h)},${sy(r)}` : '')).filter(Boolean).join(' ')} />
            {alerted && <g><circle cx={sx(firstAlert)} cy={sy(series[firstAlert]!)} r="5" fill="#f59e0b" /><text x={sx(firstAlert) - 20} y={sy(series[firstAlert]!) - 10} fontSize="10" fill="#f59e0b">ALERT h{firstAlert}</text></g>}
            {[0, 12, 24, 36, 47].map((h) => <text key={h} x={sx(h)} y={Hh - 8} fontSize="9" fill="#64748b" textAnchor="middle">h{h}</text>)}
          </svg>
          <input type="range" min={6} max={47} value={hour} onChange={(e) => { setHour(+e.target.value); setPlaying(false); }} className="w-full accent-cyan-400" />
          <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-6">
            {tiles.map(([n, v, u]) => (
              <div key={n} className="rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-center font-mono">
                <div className="text-[10px] text-slate-500">{n}</div><div className="text-lg font-bold text-slate-100">{v.toFixed(n === 'Temp' || n === 'Lactate' ? 1 : 0)}</div><div className="text-[10px] text-slate-500">{u}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className={`rounded-2xl border p-5 ${alerted ? 'border-amber-500/50 bg-amber-950/20' : 'border-slate-800 bg-slate-900/60'}`}>
            <div className="flex items-center gap-2 font-mono text-sm font-bold text-white">
              {alerted ? <ShieldAlert className="h-5 w-5 text-amber-400" /> : <ShieldCheck className="h-5 w-5 text-emerald-400" />}
              {alerted ? 'Sepsis alert raised' : 'No alert'}
            </div>
            <div className="mt-2 text-4xl font-extrabold font-mono text-cyan-300">{(risk * 100).toFixed(0)}%</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-mono text-slate-400">
              <HelpCircle className="h-3.5 w-3.5" />Conformal set @ {Math.round((1 - model.alpha) * 100)}%: <b className="text-slate-200">{cset}</b>
            </div>
            <div className="mt-3 text-xs text-slate-300">
              {p.onset === null && (alerted ? 'False alarm — this patient never developed sepsis.' : `Ground truth: ${KIND[p.kind]}. No sepsis in the 48 h stay.`)}
              {p.onset !== null && (lead !== null ? `Alerted ${lead} h before sepsis onset.` : `Ground truth: sepsis onset at h${p.onset}. ${hour >= p.onset ? 'Missed.' : 'Not alerted yet.'}`)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="font-mono text-xs text-slate-400">Why this score (log-odds contribution)</div>
            <div className="mt-3 space-y-2">
              {contrib.map((c) => (
                <div key={c.feature} className="text-xs">
                  <div className="flex justify-between text-slate-300"><span>{FEATURE_LABELS[c.feature]}</span><span className="font-mono text-slate-500">{c.value.toFixed(1)}</span></div>
                  <div className="mt-0.5 h-1.5 rounded bg-slate-800"><div className={`h-1.5 rounded ${c.impact > 0 ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{ width: `${(Math.abs(c.impact) / maxImp) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
