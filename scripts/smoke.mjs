// End-to-end smoke test: drives the real app in headless Chrome, checks every tab and interaction, fails on any console error.
//   npm run dev  (in another terminal)  then:  node scripts/smoke.mjs [appUrl]
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP = process.argv[2] ?? 'http://localhost:5174/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9555, SERVER_PORT = 8091;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [], errors = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const server = spawn('python3', ['ml/serve.py', String(SERVER_PORT)], { stdio: 'ignore', cwd: new URL('..', import.meta.url).pathname });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'smoke-'))}`, 'about:blank'], { stdio: 'ignore' });

let ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: `(async()=>{ ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed');
  return r.result.value;
};
const H = `const w=(ms)=>new Promise(r=>setTimeout(r,ms));
const tab=async(n)=>{const b=[...document.querySelectorAll('[role=tab]')].find(x=>x.textContent.includes(n)); if(!b) throw new Error('no tab '+n); b.click(); await w(1200);};
const btn=(t)=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(t));
const txt=()=>document.querySelector('main').innerText;
const setRange=async(v)=>{const s=document.querySelector('main input[type=range]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(s,String(v)); s.dispatchEvent(new Event('input',{bubbles:true})); s.dispatchEvent(new Event('change',{bubbles:true})); await w(500);};`;

try {
  let t; for (let i = 0; i < 40 && !t; i++) { try { t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json(); } catch { await sleep(250); } }
  ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 160));
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400 && !/favicon/.test(m.params.response.url)) errors.push(`HTTP ${m.params.response.status} ${m.params.response.url}`);
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: APP }); await sleep(3500);
  await ev(`localStorage.removeItem('auraz.endpoint');`);
  await send('Page.navigate', { url: APP }); await sleep(3500);

  // ---- tabs render
  const tabs = ['Live Replay', 'Ward', 'Validation', 'IBM Z', 'Architecture'];
  check('5 tabs present, no Submission tab', (await ev(`return document.querySelectorAll('[role=tab]').length`)) === 5 && !(await ev(`return document.body.innerText.includes('Submission')`)));
  for (const n of tabs) {
    const len = await ev(`${H} await tab(${JSON.stringify(n)}); return txt().length;`);
    check(`tab "${n}" renders content`, len > 200, `${len} chars`);
  }
  // ---- Live Replay
  await ev(`${H} await tab('Live Replay');`);
  const kinds = await ev(`${H} const out=[]; for (const b of [...document.querySelectorAll('main button')].filter(x=>/TEST-0\\d/.test(x.textContent))) { b.click(); await w(700); out.push(/Alert|alert/.test(txt())); } return out.length;`);
  check('Live Replay: all 8 held-out patients open', kinds === 8, `${kinds}`);
  const alert = await ev(`${H} [...document.querySelectorAll('main button')].find(x=>x.textContent.includes('TEST-01')).click(); await w(900); await setRange(19); return txt();`);
  check('TEST-01 hour 19 raises an alert 2 h before onset', /Sepsis Alert Raised/i.test(alert) && /2 h before/.test(alert) && /sepsis not ruled out/i.test(alert));
  const calm = await ev(`${H} [...document.querySelectorAll('main button')].find(x=>x.textContent.includes('TEST-05')).click(); await w(900); await setRange(12); return txt();`);
  check('TEST-05 hour 12: no alert, "ruled out"', /No Alert/i.test(calm) && /ruled out/i.test(calm));
  const play = await ev(`${H} const p=btn('Play'); p.click(); await w(1500); const a=txt().match(/Hour \\d+/)?.[0]; await w(1500); const b=txt().match(/Hour \\d+/)?.[0]; const q=btn('Pause'); q&&q.click(); return [a,b];`);
  check('Play advances the hour', play[0] !== play[1], play.join(' → '));
  // ---- Ward
  await ev(`${H} await tab('Ward'); btn('Play').click(); await w(5000); const q=btn('Pause'); q&&q.click();`);
  const ward = await ev(`${H} return txt();`);
  check('Ward: 200 beds scored, stats shown', /Scoring time this hour/.test(ward) && (await ev(`return document.querySelectorAll('main button[aria-label^="BED-"]').length`)) === 200);
  const click = await ev(`${H} const b=[...document.querySelectorAll('main button[aria-label^="BED-"]')].find(x=>/Alert|Rising/.test(x.getAttribute('aria-label')))||document.querySelector('main button[aria-label^="BED-"]'); const id=b.getAttribute('aria-label').slice(0,7); b.click(); await w(1500); return [id, [...document.querySelectorAll('[role=tab]')].find(x=>x.getAttribute('aria-selected')==='true').textContent.trim(), txt().includes(id)];`);
  check('Ward bed click opens that patient in Live Replay', click[1] === 'Live Replay' && click[2], click.join(' / '));
  // ---- Validation
  const val = await ev(`${H} await tab('Validation'); return txt();`);
  check('Validation: real-data panel (AuraZ-R)', /AuraZ-R on PhysioNet 2019/.test(val) && /0\.8\d\d/.test(val));
  if (existsSync(new URL('../public/full/metrics_physionet.json', import.meta.url))) check('Validation: full-dataset card + recalibration card', /Full dataset · AuraZ-R on every PhysioNet 2019 stay/.test(val) && /Fixing the uncertainty guarantee at a new hospital/.test(val));
  check('Validation: external validation + subgroup audit', /External validation and fairness audit/.test(val) && /sex=female/.test(val));
  check('Validation: simulated panel + SIRS table', /SIRS rule/.test(val) && /0\.818/.test(val));
  // ---- IBM Z
  await ev(`${H} await tab('IBM Z');`);
  const rec = await ev(`${H} return txt();`);
  check('IBM Z: recorded accelerator (NNPA) results shown', /Telum II accelerator \(NNPA\), measured on the z17/.test(rec) && /faster than a plain CPU loop/.test(rec));
  check('IBM Z: recorded load-test results shown', /Load test on the z17/.test(rec) && /scores per second, peak/.test(rec));
  const bad = await ev(`${H} const i=document.querySelector('input[placeholder^="http"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'http://localhost:9'); i.dispatchEvent(new Event('input',{bubbles:true})); btn('Connect').click(); await w(2500); return [/not connected/.test(txt()), btn('Benchmark remote').disabled];`);
  check('IBM Z: unreachable endpoint fails gracefully', bad[0] && bad[1]);
  await ev(`${H} const i=document.querySelector('input[placeholder^="http"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'http://localhost:${SERVER_PORT}'); i.dispatchEvent(new Event('input',{bubbles:true})); btn('Connect').click(); await w(2500);`);
  const conn = await ev(`${H} return txt().match(/connected · [^\\n]*/)?.[0] ?? 'none'`);
  check('IBM Z: connects to inference service', /connected/.test(conn), conn);
  const bench = await ev(`${H} btn('Benchmark remote').click(); await w(8000); return txt();`);
  check('IBM Z: remote benchmark matches local exactly', /Max \|remote − local\|\n0\.0e\+0/.test(bench));
  const real = await ev(`${H} btn('Run AuraZ-R').click(); await w(7000); return txt();`);
  check('IBM Z: real-data trees match sklearn exactly', /Max \|browser − sklearn\|\n0\.0e\+0/.test(real) && /Max \|remote − browser\|\n0\.0e\+0/.test(real));
  const lat = await ev(`${H} btn('Score 100,000').click(); await w(3000); return txt();`);
  check('IBM Z: in-browser latency lab runs', /MEAN \/ INFERENCE/.test(lat) || /µs/.test(lat));
  await ev(`${H} await tab('Live Replay'); [...document.querySelectorAll('main button')].find(x=>x.textContent.includes('TEST-01')).click(); await w(2500);`);
  check('Live Replay scores on the connected host', /Scored on/.test(await ev(`${H} return txt()`)) && !/Scored in browser/.test(await ev(`${H} return txt()`)));
  // ---- Architecture
  check('Architecture: 6 layers', (await ev(`${H} await tab('Architecture'); return (txt().match(/^\\d · /gm)||[]).length`)) === 6);
  // ---- Keyboard nav
  const kb = await ev(`${H} const t=[...document.querySelectorAll('[role=tab]')]; t[0].focus(); t[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})); await w(500); return document.activeElement.textContent.trim();`);
  check('Keyboard: ArrowRight moves between tabs', /Ward/.test(kb), kb);
  // ---- mobile
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });
  await sleep(800);
  const overflow = await ev(`${H} const out=[]; for (const n of ['Live Replay','Ward','Validation','IBM Z','Architecture']) { await tab(n); if (document.documentElement.scrollWidth > innerWidth + 2) out.push(n+':'+document.documentElement.scrollWidth); } return out;`);
  check('Mobile 390px: no horizontal overflow on any tab', overflow.length === 0, overflow.join(', '));

  const real_errors = errors.filter((e) => !/WebSocket|ERR_CONNECTION_REFUSED|localhost:9|Failed to load resource.*(8080|:9)/.test(e));
  check('No unexpected console errors or failed requests', real_errors.length === 0, real_errors.slice(0, 3).join(' | '));
} catch (e) {
  check('smoke test ran to completion', false, e.message);
} finally {
  ws?.close(); chrome.kill(); server.kill();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}
