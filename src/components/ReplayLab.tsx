import React, { useEffect, useMemo, useState } from 'react';
import { Play, Pause, RotateCcw, ShieldAlert, ShieldCheck, HelpCircle, AlertCircle, ArrowUpRight, ArrowDownRight, Bed } from 'lucide-react';
import { remoteScore } from '../lib/remote';
import { buildFeatures, conformalSet, contributions, FEATURE_LABELS, Model, ReplayPatient, score } from '../lib/model';

interface Props {
  model: Model;
  patients: ReplayPatient[];
  remote: string;
  remoteLabel: string;
  target?: { patient: ReplayPatient; hour: number } | null;
}

const KIND: Record<string, string> = {
  sepsis: 'Develops sepsis',
  none: 'Stable',
  postop: 'Post-op tachycardia (confounder)',
  hypovol: 'Hypovolaemia (confounder)',
  fever: 'Fever without sepsis (confounder)',
};

/**
 * Translates a feature attribution into a clinician-friendly phrase.
 */
function formatFeaturePhrase(f: string, value: number, impact: number): string {
  if (impact > 0) {
    switch (f) {
      case 'rr_d3': return 'rising respiratory rate over 3 h';
      case 'map_d3': return 'falling blood pressure over 3 h';
      case 'hr_d3': return 'accelerating heart rate over 3 h';
      case 'temp_d3': return 'rising temperature trend over 3 h';
      case 'lactate_d6': return 'accumulating serum lactate over 6 h';
      case 'map_min6': return 'episodes of sustained arterial hypotension';
      case 'hr_max6': return 'tachycardic heart rate spikes';
      case 'shock_index': return 'elevated shock index';
      case 'rr': return `tachypnea (${value.toFixed(0)} breaths/min)`;
      case 'hr': return `tachycardia (${value.toFixed(0)} bpm)`;
      case 'map': return `low mean arterial pressure (${value.toFixed(0)} mmHg)`;
      case 'sbp': return `depressed systolic pressure (${value.toFixed(0)} mmHg)`;
      case 'temp': return value > 38 ? `hyperthermia (${value.toFixed(1)}°C)` : `hypothermia (${value.toFixed(1)}°C)`;
      case 'lactate': return `elevated serum lactate (${value.toFixed(1)} mmol/L)`;
      case 'spo2': return `hypoxemia (${value.toFixed(0)}% SpO2)`;
      case 'wbc': return `leukocytosis (${value.toFixed(1)} k/µL)`;
      default: return `elevated ${FEATURE_LABELS[f] ?? f}`;
    }
  } else {
    switch (f) {
      case 'map': return `preserved mean arterial pressure (${value.toFixed(0)} mmHg)`;
      case 'rr': return `stable respiratory rate (${value.toFixed(0)}/min)`;
      case 'hr': return `normal heart rate (${value.toFixed(0)} bpm)`;
      case 'lactate': return `normal serum lactate (${value.toFixed(1)} mmol/L)`;
      case 'spo2': return `adequate oxygenation (${value.toFixed(0)}% SpO2)`;
      case 'map_d3': return 'stable hemodynamics over 3 h';
      case 'rr_d3': return 'stable respiratory effort';
      default: return `normal ${FEATURE_LABELS[f] ?? f}`;
    }
  }
}

/**
 * Generates one plain English sentence summarizing the top 3 feature contributions.
 * Example: "Rising respiratory rate and falling blood pressure over 3 h."
 */
function explainTopContributions(m: Model, x: number[]): string {
  const top = contributions(m, x).slice(0, 3);
  const positive = top.filter((c) => c.impact > 0);
  if (positive.length > 0) {
    const phrases = positive.map((c) => formatFeaturePhrase(c.feature, c.value, c.impact));
    const sentence =
      phrases.length === 1
        ? phrases[0]
        : phrases.length === 2
        ? `${phrases[0]} and ${phrases[1]}`
        : `${phrases[0]}, ${phrases[1]}, and ${phrases[2]}`;
    return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
  } else {
    const stablePhrases = top.map((c) => formatFeaturePhrase(c.feature, c.value, c.impact));
    const sentence = stablePhrases.slice(0, 2).join(' and ');
    return `Physiological stability driven by ${sentence}.`;
  }
}

export const ReplayLab: React.FC<Props> = ({ model, patients, remote, remoteLabel, target }) => {
  const [wardPatients, setWardPatients] = useState<ReplayPatient[]>([]);
  const [activePatient, setActivePatient] = useState<ReplayPatient>(patients[0]);
  const [hour, setHour] = useState(6);
  const [playing, setPlaying] = useState(false);

  // Load 200 ward patients so ReplayLab can open any ward bed
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}ward.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ReplayPatient[]) => setWardPatients(data))
      .catch(() => {});
  }, []);

  // When target prop is received from App.tsx (e.g. from WardView click)
  useEffect(() => {
    if (!target) return;
    setActivePatient(target.patient);
    if (typeof target.hour === 'number' && target.hour >= 6 && target.hour <= 47) {
      setHour(target.hour);
    }
    setPlaying(false);
  }, [target]);

  // Ensure activePatient defaults sensibly
  useEffect(() => {
    if (!target && !activePatient && patients.length > 0) {
      setActivePatient(patients[0]);
    }
  }, [patients, target, activePatient]);

  // Empty state guard
  if (!activePatient) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-center" role="status">
        <div className="inline-flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-4 font-mono text-sm text-slate-400">
          <AlertCircle className="h-5 w-5 text-slate-500" aria-hidden="true" />
          No patient trajectory selected.
        </div>
      </div>
    );
  }

  const p = activePatient;

  const local = useMemo(() => {
    const out: (number | null)[] = [];
    for (let h = 0; h < p.vitals.hr.length; h++) {
      out.push(h < 6 || (p.onset !== null && h >= p.onset) ? null : score(model, buildFeatures(p.vitals, h)));
    }
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
      .then((r) => {
        const out: (number | null)[] = local.map(() => null);
        hs.forEach((h, i) => {
          out[h] = r.risk[i];
        });
        setRemoteSeries(out);
        setRemoteMs(performance.now() - t);
      })
      .catch(() => setRemoteSeries(null));
  }, [p, remote, local]);

  const series = remoteSeries ?? local;

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setHour((h) => (h >= 47 ? (setPlaying(false), h) : h + 1)), 350);
    return () => clearInterval(t);
  }, [playing]);

  const pickPatient = (pt: ReplayPatient) => {
    setActivePatient(pt);
    setHour(6);
    setPlaying(false);
  };

  const risk = series[hour] ?? series.filter((v) => v !== null).slice(-1)[0] ?? 0;
  const firstAlert = series.findIndex((r, h) => r !== null && r >= model.alert_threshold && h <= hour);
  const alerted = firstAlert >= 0;
  const lead = alerted && p.onset !== null ? p.onset - firstAlert : null;
  const x = buildFeatures(p.vitals, hour);
  const contrib = contributions(model, x).slice(0, 6);
  const maxImp = Math.max(...contrib.map((c) => Math.abs(c.impact)), 0.01);
  const cset = conformalSet(model, risk);
  const clinicalReasonSentence = explainTopContributions(model, x);

  const W = 720,
    Hh = 220,
    sx = (h: number) => 30 + (h / 47) * (W - 40),
    sy = (r: number) => Hh - 24 - r * (Hh - 40);

  const tiles: [string, number, string][] = [
    ['HR', p.vitals.hr[hour], 'bpm'],
    ['MAP', p.vitals.map[hour], 'mmHg'],
    ['RR', p.vitals.rr[hour], '/min'],
    ['Temp', p.vitals.temp[hour], '°C'],
    ['SpO2', p.vitals.spo2[hour], '%'],
    ['Lactate', p.vitals.lactate[hour], 'mmol/L'],
  ];

  const isWardPatient = p.id.startsWith('BED-');

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* Header card with patient selector */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-cyan-400">Live replay</span>
              {isWardPatient && (
                <span className="flex items-center gap-1 rounded bg-orange-950/60 border border-orange-500/40 px-2 py-0.5 text-xs font-mono text-orange-300">
                  <Bed className="h-3 w-3" /> ICU Ward Bed: {p.id}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-xl font-bold font-mono text-white tracking-tight">
              Watch the trained model score a held-out patient, hour by hour
            </h2>
            <p className="mt-1 text-sm text-slate-400 max-w-3xl leading-relaxed">
              Every number below is computed live by the exported model, in your browser or on the connected IBM Z host. These patients were never seen in
              training or calibration. Includes look-alike patients (post-op, hypovolaemia, fever) that should not trigger an alert.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlaying((v) => !v)}
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400"
              aria-label={playing ? 'Pause replay' : 'Play replay'}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={() => {
                setHour(6);
                setPlaying(false);
              }}
              aria-label="Reset trajectory to hour 6"
              className="rounded-xl border border-slate-700 bg-slate-800/60 p-2 text-slate-300 transition-colors hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Patient Selection Controls */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* 8 Primary Replay Patient Buttons */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Select Curated Patient">
            {patients.map((pt) => {
              const isSelected = pt.id === p.id;
              return (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => pickPatient(pt)}
                  aria-pressed={isSelected}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-mono transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/60 font-semibold text-cyan-300 shadow-sm'
                      : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {pt.id} · {KIND[pt.kind] ?? pt.kind}
                </button>
              );
            })}
          </div>

          {/* Ward Bed Selector Dropdown (200 Beds) */}
          {wardPatients.length > 0 && (
            <div className="flex items-center gap-2 pl-1">
              <label htmlFor="ward-bed-select" className="sr-only">
                Select from 200 Ward Beds
              </label>
              <select
                id="ward-bed-select"
                value={isWardPatient ? p.id : ''}
                onChange={(e) => {
                  const selected = wardPatients.find((w) => w.id === e.target.value);
                  if (selected) pickPatient(selected);
                }}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-300 focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <option value="">Inspect ward bed (200 available)…</option>
                {wardPatients.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.id} {w.onset !== null ? `(septic @ h${w.onset})` : '(stable)'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Trajectory Chart & Vitals */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-slate-400">
              <span className="font-medium text-slate-300">Predicted risk of sepsis onset within 6 h</span>
              <span className="tabular-nums">
                {remoteSeries ? (
                  <span className="text-cyan-400 font-semibold">
                    Scored on {remoteLabel}
                    {remoteMs ? ` · ${remoteMs.toFixed(0)} ms round trip` : ''}
                  </span>
                ) : (
                  <span>Scored in browser</span>
                )}{' '}
                · Hour {hour} of 47
              </span>
            </div>

            {/* SVG Waveform Chart */}
            <div className="mt-3 aspect-[720/220] w-full">
              <svg viewBox={`0 0 ${W} ${Hh}`} className="w-full h-full" aria-label="Sepsis risk trajectory graph">
                {[0, 0.25, 0.5, 0.75, 1].map((g) => (
                  <g key={g}>
                    <line x1={30} x2={W - 10} y1={sy(g)} y2={sy(g)} stroke="#e5e8ee" strokeWidth="1" />
                    <text x={4} y={sy(g) + 3} fontSize="9" fill="#64748b" fontFamily="Inter, system-ui, sans-serif">
                      {Math.round(g * 100)}%
                    </text>
                  </g>
                ))}
                {/* Alert Threshold (Orange, Colorblind-Safe) */}
                <line
                  x1={30}
                  x2={W - 10}
                  y1={sy(model.alert_threshold)}
                  y2={sy(model.alert_threshold)}
                  stroke="#f97316"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />
                <text x={W - 160} y={sy(model.alert_threshold) - 5} fontSize="9" fill="#f97316" fontFamily="Inter, system-ui, sans-serif">
                  alert threshold {Math.round(model.alert_threshold * 100)}%
                </text>

                {/* Sepsis Onset Ground Truth (Rose dashed) */}
                {p.onset !== null && (
                  <g>
                    <line
                      x1={sx(p.onset)}
                      x2={sx(p.onset)}
                      y1={10}
                      y2={Hh - 24}
                      stroke="#e11d48"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    <text x={sx(p.onset) + 4} y={20} fontSize="10" fill="#e11d48" fontFamily="Inter, system-ui, sans-serif">
                      sepsis onset (h{p.onset})
                    </text>
                  </g>
                )}

                {/* Risk Trajectory Line (Cyan) */}
                <polyline
                  fill="none"
                  stroke="#1d5fb4"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={series
                    .map((r, h) => (r !== null && h <= hour ? `${sx(h)},${sy(r)}` : ''))
                    .filter(Boolean)
                    .join(' ')}
                />

                {/* Alert Point Marker */}
                {alerted && (
                  <g>
                    <circle cx={sx(firstAlert)} cy={sy(series[firstAlert]!)} r="5" fill="#f97316" />
                    <text
                      x={sx(firstAlert) - 20}
                      y={sy(series[firstAlert]!) - 10}
                      fontSize="10"
                      fill="#f97316"
                      fontWeight="bold"
                      fontFamily="Inter, system-ui, sans-serif"
                    >
                      ALERT h{firstAlert}
                    </text>
                  </g>
                )}

                {/* X Axis Timeline Labels */}
                {[0, 12, 24, 36, 47].map((h) => (
                  <text key={h} x={sx(h)} y={Hh - 8} fontSize="9" fill="#64748b" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">
                    h{h}
                  </text>
                ))}
              </svg>
            </div>

            <div className="mt-3">
              <label htmlFor="hour-range" className="sr-only">
                Patient timeline hour slider
              </label>
              <input
                id="hour-range"
                type="range"
                min={6}
                max={47}
                value={hour}
                onChange={(e) => {
                  setHour(+e.target.value);
                  setPlaying(false);
                }}
                className="w-full accent-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              />
            </div>
          </div>

          {/* Vitals Tiles with Tabular Numbers */}
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {tiles.map(([n, v, u]) => (
              <div
                key={n}
                className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-center font-mono min-h-[72px]"
              >
                <div className="text-[10px] text-slate-400">{n}</div>
                <div className="text-lg font-bold text-slate-100 tabular-nums">
                  {v.toFixed(n === 'Temp' || n === 'Lactate' ? 1 : 0)}
                </div>
                <div className="text-[10px] text-slate-400">{u}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Clinician Diagnosis & Explainability Panel */}
        <div className="space-y-6">
          {/* Sepsis Alert Status Card */}
          <div
            className={`rounded-2xl border p-5 transition-colors min-h-[190px] flex flex-col justify-between ${
              alerted
                ? 'border-orange-500/50 bg-orange-950/20'
                : 'border-slate-800 bg-slate-900/60'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 font-mono text-sm font-bold text-white">
                {alerted ? (
                  <ShieldAlert className="h-5 w-5 text-orange-400 shrink-0" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-sky-400 shrink-0" aria-hidden="true" />
                )}
                <span className={alerted ? 'text-orange-300' : 'text-slate-100'}>
                  {alerted ? 'Sepsis Alert Raised' : 'No Alert Raised'}
                </span>
              </div>
              <div className="mt-2 text-4xl font-extrabold font-mono text-cyan-300 tabular-nums">
                {(risk * 100).toFixed(0)}%
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <HelpCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <span>
                  Conformal set @ {Math.round((1 - model.alpha) * 100)}%:{' '}
                  <strong className="text-slate-200">{cset}</strong>
                </span>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-300 leading-relaxed border-t border-slate-800/80 pt-2.5">
              {p.onset === null &&
                (alerted
                  ? 'False alarm — this patient never developed sepsis during stay.'
                  : `Ground truth: ${KIND[p.kind] ?? p.kind}. No sepsis in the 48 h stay.`)}
              {p.onset !== null &&
                (lead !== null
                  ? `Alerted ${lead} h before sepsis onset.`
                  : `Ground truth: sepsis onset at h${p.onset}. ${hour >= p.onset ? 'Missed.' : 'Not alerted yet.'}`)}
            </div>
          </div>

          {/* Clinician Explainability & SHAP Contributions */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 min-h-[300px]">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-semibold text-slate-400">
                Clinical Attribution
              </h3>
              <span className="text-[11px] font-mono text-cyan-400">SHAP log-odds</span>
            </div>

            {/* Plain English Sentence Explanation (Top 3 Contributions) */}
            <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-950/30 p-3 text-xs text-slate-200 leading-relaxed">
              <span className="font-semibold text-cyan-400">Driver summary: </span>
              {clinicalReasonSentence}
            </div>

            {/* Feature Bars with Colorblind-Safe Palette */}
            <div className="mt-4 space-y-2.5">
              {contrib.map((c) => {
                const isHarm = c.impact > 0;
                return (
                  <div key={c.feature} className="text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-medium flex items-center gap-1">
                        {isHarm ? (
                          <ArrowUpRight className="h-3 w-3 text-orange-400 shrink-0" aria-hidden="true" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3 text-sky-400 shrink-0" aria-hidden="true" />
                        )}
                        {FEATURE_LABELS[c.feature] ?? c.feature}
                      </span>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="text-slate-400 tabular-nums">{c.value.toFixed(1)}</span>
                        <span
                          className={`font-semibold tabular-nums ${isHarm ? 'text-orange-400' : 'text-sky-400'}`}
                        >
                          {isHarm ? '+ Raises' : '- Lowers'}
                        </span>
                      </div>
                    </div>
                    {/* Visual Bar Indicator */}
                    <div className="mt-1 h-2 rounded-full bg-slate-800/80 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isHarm ? 'bg-orange-500' : 'bg-sky-500'
                        }`}
                        style={{ width: `${Math.min(100, (Math.abs(c.impact) / maxImp) * 100)}%` }}
                        role="progressbar"
                        aria-valuenow={Math.round((Math.abs(c.impact) / maxImp) * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${FEATURE_LABELS[c.feature]} contribution`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
