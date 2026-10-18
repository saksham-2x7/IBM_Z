// Regenerate docs/demo/*.png from the running app with headless Chrome (DevTools protocol, no npm deps).
//   npm run dev            # app on :5174
//   (optional) ssh -N -L 8080:localhost:8080 ... # IBM Z inference service reachable on :8080
//   node scripts/capture_demo.mjs [appUrl] [endpoint]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP = process.argv[2] ?? 'http://localhost:5174/';
const ENDPOINT = process.argv[3] ?? 'http://localhost:8080';
const OUT = new URL('../docs/demo/', import.meta.url).pathname;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'auraz-cdp-'))}`, 'about:blank'], { stdio: 'ignore' });

let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const msg = { id: ++id, method, params };
  pending.set(msg.id, { resolve, reject });
  ws.send(JSON.stringify(msg));
});
const run = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed');
  return r.result.value;
};

// helpers injected into the page
const HELPERS = `
  window.__w = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__tab = async (name) => { [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent.includes(name)).click(); await __w(1500); window.scrollTo(0, 0); };
  window.__patient = async (label, hour) => {
    [...document.querySelectorAll('main button')].find((b) => b.textContent.includes(label)).click(); await __w(2500);
    const s = document.querySelector('main input[type=range]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(s, String(hour));
    s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }));
    await __w(1000); window.scrollTo(0, 0);
  };
  window.__click = async (prefix, ms) => { [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(prefix)).click(); await __w(ms); };
`;

const shots = [
  { file: '01_live_replay_septic.png', h: 1000, steps: `await __tab('Live Replay'); await __patient('TEST-01', 19);` },
  { file: '02_lookalike_nonseptic.png', h: 1000, steps: `await __tab('Live Replay'); await __patient('TEST-05', 12);` },
  { file: '03_validation_vs_sirs.png', h: 1500, steps: `await __tab('Validation'); window.scrollTo(0, 0);` },
  { file: '04_ibm_z_remote_verification.png', h: 1950, steps: `await __tab('IBM Z'); await __click('Benchmark remote', 30000); await __click('Run AuraZ-R', 25000); window.scrollTo(0, 0);` },
  { file: '05_ward_surveillance.png', h: 1100, steps: `await __tab('Ward'); await __click('Play', 9000); const p = [...document.querySelectorAll('main button')].find((b) => /Pause/.test(b.textContent)); p && p.click(); await __w(800); window.scrollTo(0, 0);` },
  { file: '06_conformal_uncertainty.png', h: 1000, steps: `await __tab('Live Replay'); await __patient('TEST-01', 15);` },
];

try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    try { target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json(); }
    catch { await sleep(250); }
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await send('Page.navigate', { url: APP }); await sleep(2500);
  await run(`localStorage.setItem('auraz.endpoint', ${JSON.stringify(ENDPOINT)});`);
  await send('Page.navigate', { url: APP }); await sleep(4000);
  for (const s of shots) {
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: s.h, deviceScaleFactor: 1, mobile: false });
    await run(HELPERS + s.steps);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, s.file), Buffer.from(data, 'base64'));
    const where = await run(`return document.querySelector('header').innerText.split('\\n').slice(-1)[0];`);
    console.log(`wrote ${s.file} (header: ${where})`);
  }
} finally {
  ws?.close(); chrome.kill();
}
