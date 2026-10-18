import React, { useEffect, useState } from 'react';
import { Cpu, Gauge } from 'lucide-react';

interface Kernel { case: string; rows: number; cpu_fp32_ms: number; nnpa_total_ms: number; total_speedup_vs_cpu: number; max_abs_diff: number }
interface Nnpa {
  host: string; model: string; rows: number; auroc_fp32_sklearn: number; auroc_on_nnpa: number; auroc_change: number;
  full_test_auroc_fp32: number; full_test_auroc_ci95: [number, number]; max_abs_prob_diff: number; alert_agreement_at_threshold: number;
  timing: { cpu_fp32_ms: number; nnpa_total_ms: number; nnpa_compute_ms: number; nnpa_transform_ms: number; speedup_total_vs_cpu: number; speedup_compute_vs_cpu: number; rows: number };
  kernel_benchmark: { results: Kernel[] } | null; notes: string[]; cpu_openblas?: { threads: number; ms: number; nnpa_speedup_total: number; nnpa_speedup_compute: number }[];
}
interface LoadRes { clients: number; batch: number; scores_per_s: number; p50_ms: number; p99_ms: number; requests_per_s: number }
interface Conc { host: { cpus: number }; seconds_per_level: number; results: { connections: number; requests: number; success_pct: number; p50_ms: number; p99_ms: number; errors: number }[] }
interface Load { host: { system: string; cpus: number }; workers_1: { results: LoadRes[]; peak: LoadRes }; workers_2: { results: LoadRes[]; peak: LoadRes }; note: string }

const base = import.meta.env.BASE_URL;
const get = <T,>(f: string, set: (v: T | null) => void) => fetch(`${base}${f}`).then((r) => (r.ok ? r.json() : null)).then(set).catch(() => set(null));

export const Z17Measurements: React.FC = () => {
  const [n, setN] = useState<Nnpa | null>(null);
  const [l, setL] = useState<Load | null>(null);
  const [cc, setCc] = useState<Conc | null>(null);
  useEffect(() => { get<Nnpa>('nnpa_z17.json', setN); get<Load>('loadtest_z17.json', setL); get<Conc>('concurrency_z17.json', setCc); }, []);
  if (!n && !l && !cc) return null;
  const row1 = l?.workers_1.results.find((r) => r.batch === 1 && r.clients === 1);
  return (
    <div className="space-y-5">
      {n && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center gap-2"><Cpu className="h-5 w-5 text-cyan-400" aria-hidden="true" /><h2 className="text-lg font-bold text-white">Telum II accelerator (NNPA), measured on the z17</h2></div>
          <p className="mt-1 text-sm text-slate-400">AuraZ-N is a neural-network variant of the real-data model (AUROC {n.full_test_auroc_fp32.toFixed(3)}, 95% CI {n.full_test_auroc_ci95[0].toFixed(2)}–{n.full_test_auroc_ci95[1].toFixed(2)}). It runs on IBM's on-chip AI accelerator through the zDNN library. {n.host}.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[[`${n.timing.speedup_total_vs_cpu.toFixed(0)}×`, 'faster than a plain CPU loop', `${n.rows.toLocaleString()} patient-hours: ${n.timing.nnpa_total_ms.toFixed(1)} ms vs ${n.timing.cpu_fp32_ms.toFixed(0)} ms`],
              ...(n.cpu_openblas?.length ? [[`${n.cpu_openblas[0].nnpa_speedup_total.toFixed(1)}×`, 'faster than tuned OpenBLAS', `vs ${n.cpu_openblas[0].ms.toFixed(1)} ms on 1 CPU thread; ${n.cpu_openblas[n.cpu_openblas.length - 1].nnpa_speedup_total.toFixed(1)}× vs both threads`]] : []),
              [n.auroc_on_nnpa.toFixed(4), 'AUROC on the accelerator', `FP32 reference ${n.auroc_fp32_sklearn.toFixed(4)} (change ${n.auroc_change.toExponential(0)})`],
              [`${(n.alert_agreement_at_threshold * 100).toFixed(2)}%`, 'same alert decisions', 'accelerator vs FP32 at a 5% alert rate'],
              [n.max_abs_prob_diff.toFixed(4), 'largest probability change', '16-bit arithmetic on the chip']].map(([big, label, sub]) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="text-2xl font-bold text-cyan-300">{big}</div><div className="mt-1 text-xs font-semibold text-slate-200">{label}</div><div className="mt-0.5 text-[11px] text-slate-500">{sub}</div></div>
            ))}
          </div>
          {n.kernel_benchmark && (
            <table className="mt-4 w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Where the accelerator helps (and where it does not)</th><th>Rows</th><th>CPU loop</th><th>NNPA incl. transfer</th><th>Speed-up</th></tr></thead>
              <tbody>
                {n.kernel_benchmark.results.filter((k) => [64, 1024, 16384].includes(k.rows) || k.case.startsWith('synthetic')).map((k) => (
                  <tr key={`${k.case}${k.rows}`} className="border-t border-slate-800"><td className="py-1.5 text-slate-300">{k.case}</td><td className="text-slate-400">{k.rows.toLocaleString()}</td>
                    <td className="text-slate-400">{k.cpu_fp32_ms.toFixed(3)} ms</td><td className="text-slate-400">{k.nnpa_total_ms.toFixed(3)} ms</td>
                    <td className={k.total_speedup_vs_cpu >= 1 ? 'font-semibold text-emerald-400' : 'font-semibold text-amber-300'}>{k.total_speedup_vs_cpu >= 1 ? `${k.total_speedup_vs_cpu.toFixed(0)}× faster` : `${(1 / k.total_speedup_vs_cpu).toFixed(1)}× slower`}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-400">
            <li>A single logistic regression is too small for the accelerator: data conversion costs more than the arithmetic. A real neural network is where it pays off.</li>
            <li>AuraZ-R (gradient-boosted trees, our most accurate model) is a tree ensemble and runs on the CPU, not the accelerator.</li>
            <li>The 33× figure is against a plain single-thread C loop. Against OpenBLAS, a vector-tuned CPU library, the accelerator is about 1.5× faster than one CPU thread and 1.2× faster than both (this VM has 2 vCPUs). The accelerator also leaves the CPU cores free for other work.</li>
          </ul>
        </div>
      )}
      {l && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-cyan-400" aria-hidden="true" /><h2 className="text-lg font-bold text-white">Load test on the z17</h2></div>
          <p className="mt-1 text-sm text-slate-400">The real-data model ({'AuraZ-R, 300 trees'}) behind the inference service, driven by concurrent clients on the same {l.host.cpus}-vCPU VM (so numbers are conservative).</p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[[l.workers_2.peak.scores_per_s.toLocaleString(), 'scores per second, peak', `2 workers, batch ${l.workers_2.peak.batch}, p50 ${l.workers_2.peak.p50_ms} ms`],
              [l.workers_1.peak.scores_per_s.toLocaleString(), 'scores per second, 1 worker', 'pure Python on the CPU'],
              [row1 ? `${row1.p50_ms} ms` : '—', 'median latency, one patient-hour', row1 ? `p99 ${row1.p99_ms} ms` : ''],
              [`${(l.workers_2.peak.scores_per_s / l.workers_1.peak.scores_per_s).toFixed(1)}×`, 'scaling with a second worker', 'prefork on 2 vCPUs']].map(([big, label, sub]) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="text-2xl font-bold text-cyan-300">{big}</div><div className="mt-1 text-xs font-semibold text-slate-200">{label}</div><div className="mt-0.5 text-[11px] text-slate-500">{sub}</div></div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">The test also caught a real bug: single requests were stuck at a flat 50 ms by a TCP delayed-ACK stall. One line (<code>TCP_NODELAY</code>) brought the median to {row1 ? `${row1.p50_ms} ms` : 'under a millisecond'}. At that rate the compute alone could score about {Math.floor((l.workers_2.peak.scores_per_s * 3600) / 200).toLocaleString()} 200-bed wards every hour (before feature extraction and I/O).</p>
        </div>
      )}

      {cc && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-cyan-400" aria-hidden="true" /><h2 className="text-lg font-bold text-white">Many monitors at once, on the z17</h2></div>
          <p className="mt-1 text-sm text-slate-400">Each connection behaves like one bedside monitor sending a patient-hour every second to the 300-tree model, for {cc.seconds_per_level} seconds, on the same {cc.host.cpus}-vCPU VM.</p>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Simultaneous connections</th><th>Requests</th><th>Success</th><th>Median</th><th>p99</th></tr></thead>
            <tbody>{cc.results.map((r) => (
              <tr key={r.connections} className="border-t border-slate-800"><td className="py-1.5 font-semibold text-slate-200">{r.connections.toLocaleString()}</td><td className="text-slate-400">{r.requests.toLocaleString()}</td>
                <td className={r.errors === 0 ? 'font-semibold text-emerald-400' : 'text-amber-300'}>{r.success_pct}%</td><td className="text-slate-400">{r.p50_ms} ms</td><td className="text-slate-400">{r.p99_ms} ms</td></tr>))}</tbody>
          </table>
          <p className="mt-3 text-xs text-slate-400">The first run showed 2 to 3 failed requests at 500 and 2,000 connections. The cause was the server's default listen backlog of 5, so a burst of new connections was refused. Raising it to 1,024 removed every error. The load generator shares the VM, so this is conservative; it is not a test of a real hospital network.</p>
        </div>
      )}
    </div>
  );
};
