#!/usr/bin/env node
// tools/external-play.mjs — load the DE-INLINED build in a real browser and
// prove the art arrives over the wire.
//
// WHY A SECOND GATE. tools/verify-external.mjs reads the output directory off
// disk and proves every shippable asset is present and byte-identical. That is
// necessary and it is not sufficient: a file can be on disk and still never
// reach the page — a url rebased against the wrong base, a path that resolves
// only when the output happens to sit two directories under the repo root, a
// sibling tree the build forgot to carry. Every one of those passes a disk
// check and 404s in a browser.
//
// Both of those defects were real in this build, found here and not by reading:
// the CSS urls first came out as `../../assets/…` (climbing out of the output
// directory), and the map-detail tiles were not copied at all. Static checks
// were green for both.
//
//   node tools/external-play.mjs [--dir build/web]
//
// VERDICT: "external-play: OK — N checks passed".
//
// WHAT IT DOES NOT CHECK: gameplay. It mounts three screens and watches the
// network; it does not play a run, and a screen that mounts with the wrong art
// passes. Two known non-findings are filtered and named where they are filtered.
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { resolve, dirname, relative } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2);
const dirFlag = ARGV.indexOf('--dir');
const DIR = resolve(ROOT, dirFlag >= 0 ? ARGV[dirFlag + 1] : 'build/web');

if (!existsSync(resolve(DIR, 'AshenSpire.html'))) {
  console.error(`external-play: no build at ${relative(ROOT, DIR)} — node tools/bundle.mjs --external-art --out ${relative(ROOT, DIR)}`);
  process.exit(2);
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 1; const pending = new Map(); const subs = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method) subs.forEach((f) => f(m));
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    on: (f) => subs.push(f),
    send: (method, params = {}, sessionId) => new Promise((res, rej) => { const i = id++; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); }),
  };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SCREENS = [
  ['title', '?shot=title', `!!document.querySelector('#app button')`],
  ['combat', '?shot=combat', `!!document.querySelector('.combat .hand .card')`],
  ['map', '?shot=map', `!!document.querySelector('.map-node')`],
];

const server = await serve({ root: DIR, port: 8317, open: false });
const { wsUrl, close } = await launchBrowser({ prefix: 'extplay-', browser: process.env.CHROME || process.env.CHROME_PATH, timeoutMs: 30000 });
const cdp = connect(wsUrl); await cdp.ready;
const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S); await cdp.send('Network.enable', {}, S);

const failures = []; const thrown = [];
cdp.on((m) => {
  // /api/lan/* is the LAUNCHER's endpoint (src/net/lan.js), not an asset: a
  // plain static server does not implement it and the source tree 404s on it
  // identically. Filtering it here, named, beats a green that quietly ignores
  // every 404.
  // favicon.ico is requested by the BROWSER, not by the game — no markup asks
  // for it, so its absence says nothing about whether the art shipped. Filtered
  // on both event paths, because it arrives on either depending on timing; the
  // first cut filtered only loadingFailed and went red on the responseReceived.
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400
      && !/\/api\/lan\//.test(m.params.response.url) && !/favicon\.ico/i.test(m.params.response.url)) {
    failures.push(`${m.params.response.status} ${m.params.response.url.replace(/^https?:\/\/[^/]+\//, '')}`);
  }
  if (m.method === 'Network.loadingFailed' && !/favicon/i.test(m.params.errorText || '')) failures.push(m.params.errorText);
  if (m.method === 'Runtime.exceptionThrown') thrown.push(m.params.exceptionDetails.text || 'exception');
});
const ev = async (e) => {
  const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
  return r.result.value;
};

await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, S);
let checks = 0; const findings = [];
for (const [name, query, ready] of SCREENS) {
  await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/AshenSpire.html${query}` }, S);
  const t0 = Date.now(); let up = false;
  while (Date.now() - t0 < 20000) { if (await ev(ready).catch(() => false)) { up = true; break; } await wait(200); }
  await wait(1200);
  checks++;
  if (!up) { findings.push(`${name} did not mount`); continue; }
  // An <img> with NO src reports complete=true/naturalWidth=0 and is not a
  // missing asset — PoseAnimator builds its frames before assigning one, and
  // the source tree shows the same element. Only images that asked for
  // something and got nothing count.
  const art = await ev(`(() => { const imgs=[...document.images];
    const broken=imgs.filter(i=>i.complete&&i.naturalWidth===0&&(i.currentSrc||i.getAttribute('src')));
    return { imgs: imgs.length, broken: broken.map(i=>(i.currentSrc||i.src).slice(-70)) }; })()`);
  checks++;
  if (art.broken.length) findings.push(`${name}: ${art.broken.length} broken image(s) — ${art.broken.slice(0, 3).join(', ')}`);
  console.log(`  ${name.padEnd(7)} mounted, ${art.imgs} image(s), ${art.broken.length} broken`);
}
checks++;
if (failures.length) findings.push(`${failures.length} failed request(s): ${[...new Set(failures)].slice(0, 5).join(' | ')}`);
checks++;
if (thrown.length) findings.push(`${thrown.length} uncaught exception(s): ${thrown.slice(0, 2).join(' | ')}`);

await close(); server.server.close();
for (const f of findings) console.log('  RED ' + f);
if (findings.length) { console.log(`external-play: RED — ${findings.length} finding(s) over ${checks} checks`); process.exit(1); }
// Same grammar rule as verify-external: the verdict line ends at the count, or
// tools/verdict.mjs reads the whole thing as prose and calls the run silent.
console.log(`  3 screens mounted from ${relative(ROOT, DIR)}; 0 broken images; 0 failed requests.`);
console.log(`external-play: OK — ${checks} checks passed`);
console.log('BOUNDARY: three screens and the network. No run was played, and a screen that');
console.log('          mounts with the WRONG art passes this.');
