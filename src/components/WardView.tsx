import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, AlertTriangle, Activity, CheckCircle, Clock } from 'lucide-react';
import { buildFeatures, Model, ReplayPatient, score } from '../lib/model';
import { remoteScore } from '../lib/remote';

interface Props {
  model: Model;
  remote: string;
  remoteLabel: string;
  onSelectPatient?: (patientIndex: number, hour: number) => void;
}

interface Bed {
  id: string;
  risk: number | null;
  state: 'scoring' | 'septic';
}

export const WardView: React.FC<Props> = ({ model, remote, remoteLabel, onSelectPatient }) => {
  const [ward, setWard] = useState<ReplayPatient[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hour, setHour] = useState(6);
  const [playing, setPlaying] = useState(false);
  const [risks, setRisks] = useState<(number | null)[]>([]);
  const [tickMs, setTickMs] = useState<{ ms: number; where: string } | null>(null);
  const [selectedBedIdx, setSelectedBedIdx] = useState<number | null>(null);
  const firstAlert = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    setLoading(true);
    fetch(`${import.meta.env.BASE_URL}ward.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setWard(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load ward data');
        setLoading(false);
      });
  }, []);

  // Score every bed for the current hour (one batch: locally or on IBM Z)
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
      setRisks(out);
      setTickMs({ ms, where });
    };
    const t = performance.now();
    if (remote) {
      remoteScore(remote, xs)
        .then((r) => apply(r.risk, performance.now() - t, remoteLabel))
        .catch(() => apply(xs.map((x) => score(model, x)), performance.now() - t, 'browser (remote fallback)'));
    } else {
      apply(xs.map((x) => score(model, x)), performance.now() - t, 'browser');
    }
  }, [ward, hour, remote, model, remoteLabel]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setHour((h) => (h >= 47 ? (setPlaying(false), h) : h + 1)), 600);
    return () => clearInterval(t);
  }, [playing]);

  const reset = () => {
    firstAlert.current = new Map();
    setHour(6);
    setPlaying(false);
  };

  const handleBedClick = (idx: number) => {
    setSelectedBedIdx(idx);
    if (onSelectPatient) {
      onSelectPatient(idx, hour);
    }
    // Dispatch custom event for cross-component linking and switch tab if standalone
    window.dispatchEvent(
      new CustomEvent('auraz:select-patient', {
        detail: {
          patientIndex: idx,
          patientId: ward?.[idx]?.id,
          hour,
        },
      })
    );
    // Programmatically activate Replay tab if accessible
    const replayTabBtn = document.getElementById('tab-replay');
    if (replayTabBtn) {
      replayTabBtn.click();
    }
  };

  const stats = useMemo(() => {
    if (!ward) return null;
    let tp = 0,
      fp = 0,
      missed = 0,
      septicSoFar = 0;
    ward.forEach((p, i) => {
      const a = firstAlert.current.get(i);
      if (p.onset !== null && p.onset <= hour) {
        septicSoFar++;
        if (a === undefined) missed++;
      }
      if (a !== undefined) (p.onset !== null ? tp++ : fp++);
    });
    return { tp, fp, missed, septicSoFar };
  }, [ward, hour, risks]);

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-center" role="status">
        <div className="inline-flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-4 font-mono text-sm text-slate-300">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" aria-hidden="true" />
          Loading 200-bed ward cohort…
        </div>
      </div>
    );
  }

  // Error state
  if (error || !ward || !stats) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-center" role="alert">
        <div className="inline-flex flex-col items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/20 px-6 py-5 text-sm text-rose-300">
          <AlertTriangle className="h-6 w-6 text-rose-400" aria-hidden="true" />
          <p className="font-semibold">Unable to load ward data</p>
          <p className="text-xs text-rose-400/80">{error ?? 'Ward dataset unavailable'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded-lg border border-rose-400/40 bg-rose-900/40 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-800/60"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const beds: Bed[] = ward.map((p, i) => ({
    id: p.id,
    risk: risks[i] ?? null,
    state: risks[i] == null ? 'septic' : 'scoring',
  }));

  const ranked = beds
    .map((b, i) => ({ ...b, i }))
    .filter((b) => b.risk !== null)
    .sort((a, b) => b.risk! - a.risk!);

  // Colour-blind-safe palette (Orange / Blue / Slate):
  // Orange (High risk/Alert) #f97316 | Blue/Cyan (Rising/Moderate) #0284c7 | Slate (Low risk) #1e293b | Deep Slate (Onset reached) #475569
  const bedColor = (r: number | null) => {
    if (r === null) return 'bg-slate-700 border-slate-600'; // Sepsis onset reached
    if (r >= model.alert_threshold) return 'bg-orange-500 border-orange-400 text-slate-950'; // Alert (High Risk)
    if (r >= model.alert_threshold / 2) return 'bg-sky-600 border-sky-500'; // Rising / Moderate
    return 'bg-slate-800 border-slate-700/60 hover:border-slate-600'; // Low risk
  };

  const bedLabel = (b: Bed) => {
    if (b.risk === null) return `${b.id}: Sepsis onset reached`;
    if (b.risk >= model.alert_threshold) return `${b.id}: ${(b.risk * 100).toFixed(0)}% risk (Alert)`;
    if (b.risk >= model.alert_threshold / 2) return `${b.id}: ${(b.risk * 100).toFixed(0)}% risk (Rising)`;
    return `${b.id}: ${(b.risk * 100).toFixed(0)}% risk (Low)`;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* Control Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-cyan-950 px-2 py-0.5 font-mono text-xs font-semibold text-cyan-400 border border-cyan-800/50">
              WARD SURVEILLANCE
            </span>
            <span className="text-xs text-slate-400">· Click any bed tile to open patient in Live Replay</span>
          </div>
          <h2 className="mt-1.5 text-lg font-bold text-white tracking-tight">Ward View · 200 Held-Out ICU Stays</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            All beds are scored together each hour in one batch. Ground truth is revealed as it occurs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-slate-200 tabular-nums min-w-[90px] text-right">
            Hour {hour}/47
          </span>
          <button
            onClick={() => setPlaying((v) => !v)}
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label={playing ? 'Pause ward simulation' : 'Play ward simulation'}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={reset}
            aria-label="Reset simulation to hour 6"
            className="rounded-xl border border-slate-700 bg-slate-800/60 p-2 text-slate-300 transition-colors hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards with stable heights to prevent layout shift */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Alerts on beds that became septic', value: stats.tp, color: 'text-sky-400', icon: CheckCircle },
          { label: 'Alerts on beds that did not', value: stats.fp, color: 'text-orange-400', icon: AlertTriangle },
          { label: 'Septic so far', value: stats.septicSoFar, color: 'text-slate-200', icon: Activity },
          { label: 'Septic with no prior alert', value: stats.missed, color: 'text-rose-400', icon: Clock },
          {
            label: 'Scoring time this hour',
            value: tickMs ? `${tickMs.ms.toFixed(1)} ms` : '—',
            color: 'text-cyan-300',
            icon: Activity,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4 min-h-[96px]"
          >
            <div className="text-xs text-slate-400 leading-tight">{item.label}</div>
            <div className={`mt-2 font-mono text-2xl font-bold tabular-nums ${item.color}`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Mainframe Scoring Attribution */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="h-2 w-2 rounded-full bg-cyan-400" aria-hidden="true" />
        <span>
          Scored on: <strong className="font-mono text-slate-200">{tickMs?.where ?? 'browser'}</strong>. Connect an IBM
          Z endpoint in the IBM Z tab to score all 200 beds on LinuxONE.
        </span>
      </div>

      {/* Ward Grid & Leaderboard */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 200 Bed Tiles */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2">
          <div className="flex items-center justify-between pb-3">
            <h3 className="text-sm font-semibold text-slate-200">ICU Bed Matrix (200 Beds)</h3>
            <span className="text-xs text-slate-400">Click any bed to inspect replay</span>
          </div>
          <div
            className="grid grid-cols-10 gap-1.5 sm:grid-cols-20"
            role="grid"
            aria-label="200 ICU bed surveillance matrix"
          >
            {beds.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleBedClick(i)}
                title={`${bedLabel(b)} — Click to replay`}
                aria-label={`${bedLabel(b)}. Click to open in Live Replay`}
                className={`aspect-square w-full rounded border transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:z-10 ${bedColor(
                  b.risk
                )} ${selectedBedIdx === i ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-900' : ''}`}
              />
            ))}
          </div>

          {/* Accessible, Color-Blind Safe Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-slate-800/80 pt-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <span className="inline-block h-3 w-3 rounded border border-orange-400 bg-orange-500" aria-hidden="true" />
              Alert (Risk ≥ {Math.round(model.alert_threshold * 100)}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-sky-500 bg-sky-600" aria-hidden="true" />
              Rising Risk
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-slate-700 bg-slate-800" aria-hidden="true" />
              Low Risk
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-slate-600 bg-slate-700" aria-hidden="true" />
              Sepsis Onset Reached
            </span>
          </div>
        </div>

        {/* Highest Risk Patients Ranking */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Highest Risk Now</h3>
              <span className="text-[11px] text-slate-400">Click row to replay</span>
            </div>
            <ol className="mt-3 space-y-2">
              {ranked.slice(0, 10).map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => handleBedClick(b.i)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-left font-mono text-sm transition-colors hover:border-slate-700 hover:bg-slate-800/50 focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    <span className="text-slate-300 font-medium">{b.id}</span>
                    <span
                      className={`font-bold tabular-nums ${
                        b.risk! >= model.alert_threshold ? 'text-orange-400' : 'text-sky-400'
                      }`}
                    >
                      {(b.risk! * 100).toFixed(0)}%
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-4 border-t border-slate-800/80 pt-3 text-xs text-slate-400">
            Clicking any bed opens patient trajectory in Live Replay at hour {hour}.
          </p>
        </div>
      </div>
    </div>
  );
};
