import React, { useState } from 'react';
import { Cpu, Cloud, RefreshCw, Info } from 'lucide-react';
import { buildFeatures, Model, ReplayPatient, score } from '../lib/model';

interface Result { meanUs: number; p99Us: number; perSec: number; n: number }

export const BenchmarkLab: React.FC<{ model: Model; patients: ReplayPatient[] }> = ({ model, patients }) => {
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [rtt, setRtt] = useState(40);
  const [queue, setQueue] = useState(15);

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      const xs: number[][] = [];
      for (const p of patients) for (let h = 6; h < 48; h++) xs.push(buildFeatures(p.vitals, h));
      const batch = 200, rounds = 500; let sink = 0;
      for (let i = 0; i < 50; i++) sink += score(model, xs[i % xs.length]); // warm-up
      const per: number[] = [];
      const t0 = performance.now();
      for (let r = 0; r < rounds; r++) {
        const s = performance.now();
        for (let i = 0; i < batch; i++) sink += score(model, xs[(r * batch + i) % xs.length]);
        per.push(((performance.now() - s) / batch) * 1000);
      }
      const total = performance.now() - t0;
      per.sort((a, b) => a - b);
      void sink;
      setRes({ meanUs: per.reduce((a, b) => a + b, 0) / per.length, p99Us: per[Math.floor(per.length * 0.99)], perSec: (rounds * batch) / (total / 1000), n: rounds * batch });
      setBusy(false);
    }, 30);
  };

  const compute = res ? res.meanUs / 1000 : 0;
  const cloud = rtt + queue + compute;
  return (
    <div className="space-y-5 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <span className="rounded bg-cyan-950 px-2 py-0.5 font-mono text-xs font-semibold text-cyan-400 border border-cyan-800/50">MEASURED, NOT CLAIMED</span>
        <h2 className="mt-2 text-2xl font-bold font-mono text-white">Latency lab: in-process inference vs a cloud round trip</h2>
        <p className="mt-1 text-sm text-slate-400 max-w-3xl">Run the real exported model on this device. In-process scoring (no network hop) is the architectural idea IBM Z's on-chip accelerator takes to its limit. The cloud path is a model you can tune: it is an assumption, not a measurement.</p>
        <button onClick={run} disabled={busy} className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{busy ? 'Scoring…' : 'Score 100,000 patient-hours now'}
        </button>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-cyan-500/40 bg-slate-900/80 p-6 font-mono">
          <div className="flex items-center gap-2 text-white font-bold"><Cpu className="h-5 w-5 text-cyan-400" />In-process (this device's CPU)</div>
          {res ? (<div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-slate-950 p-3"><div className="text-[11px] text-slate-500">MEAN / INFERENCE</div><div className="text-2xl font-extrabold text-emerald-400">{res.meanUs.toFixed(2)} µs</div></div>
            <div className="rounded-xl bg-slate-950 p-3"><div className="text-[11px] text-slate-500">P99 (batch-mean)</div><div className="text-2xl font-extrabold text-emerald-400">{res.p99Us.toFixed(2)} µs</div></div>
            <div className="rounded-xl bg-slate-950 p-3"><div className="text-[11px] text-slate-500">THROUGHPUT</div><div className="text-2xl font-extrabold text-cyan-300">{Math.round(res.perSec).toLocaleString()}/s</div></div>
            <div className="rounded-xl bg-slate-950 p-3"><div className="text-[11px] text-slate-500">SAMPLES</div><div className="text-2xl font-bold text-slate-200">{res.n.toLocaleString()}</div></div>
          </div>) : <div className="mt-4 text-sm text-slate-500">Press the button to measure.</div>}
          <div className="mt-4 text-[11px] text-slate-500">Includes the logistic-model dot product only; excludes feature extraction I/O. Software proxy on this machine's CPU, <b>not Telum II</b>.</div>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 font-mono">
          <div className="flex items-center gap-2 text-white font-bold"><Cloud className="h-5 w-5 text-slate-300" />Cloud API path (assumption you control)</div>
          <label className="mt-4 block text-xs text-slate-400">Network round trip: {rtt} ms<input type="range" min={5} max={300} value={rtt} onChange={(e) => setRtt(+e.target.value)} className="w-full accent-slate-400" /></label>
          <label className="mt-2 block text-xs text-slate-400">Queue + cold-start: {queue} ms<input type="range" min={0} max={200} value={queue} onChange={(e) => setQueue(+e.target.value)} className="w-full accent-slate-400" /></label>
          <div className="mt-4 rounded-xl bg-slate-950 p-3 text-center"><div className="text-[11px] text-slate-500">END-TO-END</div><div className="text-2xl font-extrabold text-amber-400">{cloud.toFixed(1)} ms</div></div>
          {res && <div className="mt-3 text-xs text-slate-300">Under these assumptions the network hop, not the model, is the latency budget: ~{cloud.toFixed(0)} ms end-to-end vs {(res.meanUs).toFixed(2)} µs of compute. Keeping inference beside the data removes the hop (and the PHI egress).</div>}
        </div>
      </div>
      <div className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-300">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
        <div>
          <b>Why this matters for IBM Z:</b> at hospital scale, scoring happens inside the transaction path where the monitor data already lives, so there is no network hop to tune, throttle or leak. The target runtime is Telum II via ONNX / IBM Z Deep Learning Compiler on LinuxONE. Hardware numbers are the next milestone: we will measure them on the IBM LinuxONE Community Cloud and publish them here, whatever they are.
        </div>
      </div>
    </div>
  );
};
