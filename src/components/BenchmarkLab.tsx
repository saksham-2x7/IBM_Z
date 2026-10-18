import React, { useState } from 'react';
import { Cpu, Cloud, RefreshCw, Info } from 'lucide-react';
import { buildFeatures, Model, ReplayPatient, score } from '../lib/model';
import { Health, remoteScore } from '../lib/remote';
import { GbmModel, scoreGbm } from '../lib/gbm';
import { Z17Measurements } from './Z17Measurements';

interface Result { meanUs: number; p99Us: number; perSec: number; n: number }

interface RemoteRes { rttP50: number; rttP99: number; computeP50: number; maxDiff: number; n: number }
interface BProps { model: Model; patients: ReplayPatient[]; endpoint: string; setEndpoint: (u: string) => void; info: Health | null }

export const BenchmarkLab: React.FC<BProps> = ({ model, patients, endpoint, setEndpoint, info }) => {
  const [draft, setDraft] = useState(endpoint);
  const [rres, setRres] = useState<RemoteRes | null>(null);
  const [rbusy, setRbusy] = useState(false);
  const [rerr, setRerr] = useState('');
  const [gres, setGres] = useState<{ rows: number; computeUsPerRow: number; maxRemoteVsLocal: number; maxLocalVsSklearn: number } | null>(null);
  const [gbusy, setGbusy] = useState(false);
  const runReal = async () => {
    setGbusy(true); setRerr(''); setGres(null);
    try {
      const base = import.meta.env.BASE_URL;
      const [gm, smp] = await Promise.all([fetch(`${base}model_physionet.json`).then((r) => r.json()) as Promise<GbmModel>,
        fetch(`${base}physionet_samples.json`).then((r) => r.json()) as Promise<{ rows: (number | null)[][]; expected: number[] }>]);
      let us = 0, dR = 0, dS = 0;
      for (let k = 0; k < smp.rows.length; k += 25) {
        const batch = smp.rows.slice(k, k + 25);
        const r = await remoteScore(endpoint, batch, '/score_real');
        us += r.compute_us;
        batch.forEach((x, i) => { const loc = scoreGbm(gm, x); dR = Math.max(dR, Math.abs(r.risk[i] - loc)); dS = Math.max(dS, Math.abs(loc - smp.expected[k + i])); });
      }
      setGres({ rows: smp.rows.length, computeUsPerRow: us / smp.rows.length, maxRemoteVsLocal: dR, maxLocalVsSklearn: dS });
    } catch { setRerr('Could not score the real-data model remotely. Is the latest ml/serve.py running with public/model_physionet.json next to it?'); }
    setGbusy(false);
  };
  const runRemote = async () => {
    setRbusy(true); setRerr(''); setRres(null);
    try {
      const xs: number[][] = [];
      for (const p of patients) for (let h = 6; h < 48; h++) xs.push(buildFeatures(p.vitals, h));
      const rtt: number[] = [], comp: number[] = []; let maxDiff = 0;
      for (let i = 0; i < 40; i++) {
        const x = xs[i % xs.length]; const t = performance.now();
        const r = await remoteScore(endpoint, [x]);
        rtt.push(performance.now() - t); comp.push(r.compute_us);
        maxDiff = Math.max(maxDiff, Math.abs(r.risk[0] - score(model, x)));
      }
      const q = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
      setRres({ rttP50: q(rtt, 0.5), rttP99: q(rtt, 0.99), computeP50: q(comp, 0.5), maxDiff, n: rtt.length });
    } catch (e) { setRerr('Could not reach the endpoint. Is ml/serve.py running and reachable?'); }
    setRbusy(false);
  };

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white">Run the model on IBM LinuxONE</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-mono ${info ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'}`}>
            {info ? `connected · ${info.system} · ${info.arch}${info.machine ? ` · machine ${info.machine}` : ''}${info.nnpa ? ' · NNPA present' : ''}` : 'not connected'}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="http://<LinuxONE-VM-IP>:8080" className="min-w-[260px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100" />
          <button onClick={() => setEndpoint(draft)} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:brightness-110">Connect</button>
          <button onClick={runRemote} disabled={!info || rbusy} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40">{rbusy ? 'Measuring…' : 'Benchmark remote (40 requests)'}</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={runReal} disabled={!info?.real_model || gbusy} className="rounded-lg border border-emerald-700 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-950/40 disabled:opacity-40">
            {gbusy ? 'Scoring real-data trees…' : `Run AuraZ-R real-data trees on this host${info?.real_model ? ` (${info.real_model} trees)` : ''}`}
          </button>
        </div>
        {rerr && <div className="mt-3 text-sm text-amber-400">{rerr}</div>}
        {gres && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-center font-mono md:grid-cols-4">
            {[['Real held-out rows', gres.rows.toString()], ['Server compute / row', `${gres.computeUsPerRow.toFixed(0)} µs`],
              ['Max |remote − browser|', gres.maxRemoteVsLocal.toExponential(1)], ['Max |browser − sklearn|', gres.maxLocalVsSklearn.toExponential(1)]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-950 p-3"><div className="text-[11px] text-slate-500">{k}</div><div className="text-xl font-bold text-emerald-400">{v}</div></div>
            ))}
          </div>
        )}
        {rres && (
          <div className="mt-4 text-xs text-slate-400">The round trip is dominated by the distance to the data centre. The model itself runs in microseconds on the mainframe; that gap is the case for scoring beside the data.</div>
        )}
        {rres && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-center font-mono md:grid-cols-4">
            {[['Round trip P50 (incl. network)', `${rres.rttP50.toFixed(1)} ms`], ['Round trip P99 (incl. network)', `${rres.rttP99.toFixed(1)} ms`], ['Server compute P50', `${rres.computeP50.toFixed(1)} µs`], ['Max |remote − local|', rres.maxDiff.toExponential(1)]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-950 p-3"><div className="text-[11px] text-slate-500">{k}</div><div className="text-xl font-bold text-emerald-400">{v}</div></div>
            ))}
          </div>
        )}
        <details className="mt-4 text-sm text-slate-400">
          <summary className="cursor-pointer text-slate-300">How to start the server on the VM (no installs needed)</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">{`# on your Mac: copy the project's model + server to the VM
scp -i ercinent.pem -r ml public linux1@<VM-IP>:~/auraz/
# on the VM:
cd ~/auraz && nohup python3 ml/serve.py 8080 > serve.log 2>&1 &`}</pre>
          <p className="mt-2">Open TCP 8080 in the LinuxONE security group, then paste <code>http://&lt;VM-IP&gt;:8080</code> above. The Live Replay tab will then score every hour on the mainframe.</p>
        </details>
      </div>
      <Z17Measurements />

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <span className="rounded bg-cyan-950 px-2 py-0.5 font-mono text-xs font-semibold text-cyan-400 border border-cyan-800/50">Measured, not claimed</span>
        <h2 className="mt-2 text-2xl font-bold font-mono text-white">Latency lab: in-process inference vs a cloud round trip</h2>
        <p className="mt-1 text-sm text-slate-400 max-w-3xl">Run the real exported model on this device. In-process scoring has no network hop; IBM Z lets that scoring sit beside the transactional data itself. The cloud path is a model you can tune: it is an assumption, not a measurement.</p>
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
          <b>Why this matters for IBM Z:</b> at hospital scale, scoring happens inside the transaction path where the monitor data already lives, so there is no network hop to tune, throttle or leak. Measured on a real IBM z17 through the LinuxONE Community Cloud. The inference service runs on the CPU; the accelerator results above (vs a plain loop and vs OpenBLAS) come from a neural variant (AuraZ-N) run through IBM's zDNN library.
        </div>
      </div>
    </div>
  );
};
