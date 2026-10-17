export interface Health { ok: boolean; arch: string; machine: string | null; system: string; nnpa: boolean; python: string }
export interface ScoreResp { risk: number[]; compute_us: number; n: number; arch: string; machine: string | null; system: string; nnpa: boolean }

const clean = (u: string) => u.trim().replace(/\/+$/, '');

export async function health(endpoint: string): Promise<Health> {
  const r = await fetch(`${clean(endpoint)}/health`, { signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function remoteScore(endpoint: string, batch: number[][]): Promise<ScoreResp> {
  const r = await fetch(`${clean(endpoint)}/score`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batch }), signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
