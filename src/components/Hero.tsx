import React, { useEffect, useState } from 'react';
import { ArrowRight, Server, ShieldCheck, TrendingUp, Globe2 } from 'lucide-react';
import type { Audit, RealMetrics } from '../lib/model';
import type { Tab } from './Header';

interface Props { setTab: (t: Tab) => void; connected: boolean; hostLabel: string }

const base = import.meta.env.BASE_URL;

export const Hero: React.FC<Props> = ({ setTab, connected, hostLabel }) => {
  const [real, setReal] = useState<RealMetrics | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  useEffect(() => {
    fetch(`${base}metrics_physionet.json`).then((r) => r.json()).then(setReal).catch(() => setReal(null));
    fetch(`${base}audit_physionet.json`).then((r) => r.json()).then(setAudit).catch(() => setAudit(null));
  }, []);

  const m = real?.alerting.model_at_sirs_false_alert_rate;
  const [nnpa, setNnpa] = useState<{ timing: { speedup_total_vs_cpu: number }; auroc_change: number } | null>(null);
  useEffect(() => { fetch(`${base}nnpa_z17.json`).then((r) => r.json()).then(setNnpa).catch(() => setNnpa(null)); }, []);
  const xfer = audit ? Object.values(audit.cross_hospital).map((x) => x.auroc) : [];
  const chips = [
    { Icon: TrendingUp, big: real ? real.auroc.toFixed(2) : '—', label: 'AUROC on real ICU data', sub: real ? `${real.cohorts.test.toLocaleString()} held-out stays, first run (0.83 on all stays, see Validation)` : '' },
    { Icon: ShieldCheck, big: m && real ? `${Math.round(m.sensitivity * 100)}% vs ${Math.round(real.alerting.baseline_sirs_rule.sensitivity * 100)}%` : '—', label: 'septic patients caught early', sub: 'AuraZ-R vs SIRS at the same alarm rate' },
    { Icon: Globe2, big: xfer.length ? (xfer.reduce((a, b) => a + b, 0) / xfer.length).toFixed(2) : '—', label: 'AUROC at a new hospital', sub: 'honest cross-hospital test' },
    { Icon: Server, big: connected ? 'Live' : nnpa ? `${Math.round(nnpa.timing.speedup_total_vs_cpu)}×` : 'z17', label: connected ? hostLabel : 'Telum II accelerator speed-up', sub: connected ? 'scoring on the mainframe now' : 'vs a plain CPU loop (1.5× vs tuned OpenBLAS); AUROC unchanged' },
  ];

  return (
    <section className="hero text-white" aria-label="AuraZ overview">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-7">
        <div className="grid items-center gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,.78)' }}>IBM Z Datathon 2026 · Technology for Good</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl" style={{ color: '#fff' }}>Sepsis early warning you can explain, trust and run beside the data.</h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,.86)' }}>
              AuraZ scores every ICU patient each hour, says why, and says when it is unsure. It runs on IBM LinuxONE with nothing to install.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => setTab('replay')} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5" style={{ background: '#fff', color: '#0043ce' }}>
                Watch a live replay <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => setTab('validation')} className="rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10" style={{ border: '1px solid rgba(255,255,255,.5)', color: '#fff' }}>
                See the evidence
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:col-span-3 lg:grid-cols-4">
            {chips.map(({ Icon, big, label, sub }) => (
              <div key={label} className="hero-chip rounded-xl p-4">
                <Icon className="h-4 w-4" style={{ color: 'rgba(255,255,255,.8)' }} aria-hidden="true" />
                <div className="mt-2 text-2xl font-bold leading-none" style={{ color: '#fff' }}>{big}</div>
                <div className="mt-1.5 text-xs font-semibold" style={{ color: '#fff' }}>{label}</div>
                <div className="mt-0.5 text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,.75)' }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
