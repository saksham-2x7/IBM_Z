export interface VitalSigns {
  heartRate: number; // bpm (60-140)
  map: number; // Mean Arterial Pressure mmHg (50-100)
  sbp: number; // Systolic mmHg (80-160)
  dbp: number; // Diastolic mmHg (40-100)
  spo2: number; // % (85-100)
  respiratoryRate: number; // rpm (12-35)
  temperature: number; // °C (35.5-39.8)
  lactate: number; // mmol/L (0.5-6.5)
  shockIndex: number; // HR / SBP (0.5-1.6)
  wbc: number; // 10^9/L (4-25)
  sofaScore: number; // 0-24
}

export interface Patient {
  id: string;
  bed: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  diagnosis: string;
  admissionHours: number;
  status: 'critical' | 'warning' | 'stable' | 'recovering';
  sepsisRisk: number; // 0 to 100%
  conformalBounds: [number, number]; // [lower, upper] e.g. [78, 93]
  timeToShockHours: number | null; // e.g. 2.4 hrs or null
  falseAlarmFiltered: boolean;
  vitals: VitalSigns;
  vitalHistory: Array<{
    time: string;
    risk: number;
    map: number;
    lactate: number;
    hr: number;
  }>;
  shapContributions: Array<{
    feature: string;
    value: string;
    impact: number; // positive = increased risk, negative = protective
    description: string;
  }>;
}

export interface HardwareBenchmark {
  ibmTelumLatencyMs: number; // ~1.2 - 1.8 ms
  cloudGpuLatencyMs: number; // ~280 - 420 ms
  ibmTelumThroughputTps: number; // ~120,000 - 150,000 tx/sec
  cloudGpuThroughputTps: number; // ~3,500 tx/sec
  ibmJitterMs: number; // ~0.05 ms
  cloudJitterMs: number; // ~45.2 ms
  packetLossPercent: number; // 0% vs 4.8%
}

export interface InterventionParams {
  fluidBolusMl: number; // 0 to 2000 mL
  norepinephrineMcg: number; // 0.00 to 0.40 mcg/kg/min
  antibioticDoorToNeedleMins: number; // 0 to 120 mins
}
