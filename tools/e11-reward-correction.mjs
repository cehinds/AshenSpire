#!/usr/bin/env node
// E11/#256 exact-head browser gate: the real reward renderer, shared hold
// gesture, responsive reach, and paired screenshot evidence.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = resolve(ROOT, 'tools/results/e11-reward-correction');
mkdirSync(OUT, { recursive: true });
const { port } = await serve({ root: ROOT, port: 8211, open: false });
const { wsUrl, close } = await launchBrowser({
  prefix: 'e11-reward-', browser: process.env.CHROME || '/usr/bin/chromium',
  headless: '--headless=new', awaitEndpoint: true, args: ['--hide-scrollbars', '--remote-debugging-port=9411'],
});
let targets;
for (let i = 0; i < 100; i++) { try { targets = await (await fetch('http://127.0.0.1:9411/json/list')).json(); if (targets.length) break; } catch {} await new Promise((r) => setTimeout(r, 80)); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
let seq = 0; const waits = new Map();
ws.onmessage = (m) => { const g = JSON.parse(m.data); if (g.id && waits.has(g.id)) { const w = waits.get(g.id); waits.delete(g.id); g.error ? w.no(new Error(g.error.message)) : w.ok(g.result); } };
const send = (method, params = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method, params })); return new Promise((ok, no) => waits.set(id, { ok, no })); };
await send('Page.enable'); await send('Runtime.enable');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
let fails = 0; const check = (name, yes, detail = '') => { console.log(`${yes ? 'PASS' : 'FAIL'}  ${name}${!yes && detail ? ` — ${detail}` : ''}`); if (!yes) fails++; };
async function shape(w, h, dpr = 1) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: w < 600 }); }
async function open(settings = {}) {
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html?shot=reward&shotSettings=${encodeURIComponent(JSON.stringify(settings))}` });
  for (let i = 0; i < 100 && !(await ev(`!!document.querySelector('.reward-menu')`)); i++) await sleep(80);
  await sleep(150);
}
const click = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.click();return true})()`);
const point = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,ms:Number(e.dataset.holdMs)||600}})()`);
async function mouseHold(msDelta = 120) { const p = await point('#reward-continue'); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await sleep(Math.max(80, p.ms + msDelta)); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await sleep(250); }
async function touchHold(msDelta = 120) { const p = await point('#reward-continue'); await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] }); await sleep(Math.max(80, p.ms + msDelta)); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(250); }
async function abstractHold(source, delta = 120) { const p = await point('#reward-continue'); await ev(`(()=>{const e=document.querySelector('#reward-continue');e.dispatchEvent(new CustomEvent('gppress',{bubbles:true,cancelable:true,detail:{source:${JSON.stringify(source)}}}));return e.dataset.hold})()`); await sleep(Math.max(80, p.ms + delta)); await ev(`(()=>{const e=document.querySelector('#reward-continue');if(!e)return false;e.dispatchEvent(new CustomEvent('gprelease',{bubbles:true,cancelable:true,detail:{source:${JSON.stringify(source)},cancelled:false}}));return true})()`); await sleep(250); }
async function shot(name) { const png = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); writeFileSync(resolve(OUT, `${name}.png`), Buffer.from(png.data, 'base64')); }

await shape(1200, 730); await open({ rewardCollect: 'manual', holdConfirm: 'normal' });
check('ordinary rows have zero Skip controls and labels', await ev(`!document.querySelector('.reward-skip,[data-skip]')&&![...document.querySelectorAll('.reward-kind')].some(e=>/\\bSkip\\b/i.test(e.textContent))`));
await click('.reward-kind[data-kind="cinders"]');
await click('.reward-kind[data-kind="flask"]');
check('Potion opens a distinct non-collecting detail', await ev(`document.querySelector('[data-reward-detail="flask"]')?.textContent.includes('INSPECT THE POTION')`));
await click('#reward-back');
check('Potion Back preserves prior Taken state', await ev(`document.querySelector('[data-kind="cinders"]')?.dataset.state==='taken'`));
await click('.reward-kind[data-kind="armament"]');
check('Armament opens a distinct non-collecting detail', await ev(`document.querySelector('[data-reward-detail="armament"]')?.textContent.includes('INSPECT THE ARMAMENT')`));
await click('#reward-back');
await click('.reward-kind[data-kind="card"]'); await click('#reward-back');
check('Cards Back preserves prior Taken state', await ev(`document.querySelector('[data-kind="cinders"]')?.dataset.state==='taken'`));

await open({ rewardCollect: 'manual', holdConfirm: 'normal' }); await mouseHold(-450);
check('pre-threshold pointer release is inert', await ev(`!!document.querySelector('.reward-menu')`));
await mouseHold(120);
check('completed pointer hold navigates once despite its trailing click', await ev(`!document.querySelector('.reward-menu')`));
await shape(390, 844, 2); await open({ rewardCollect: 'manual', holdConfirm: 'normal' }); await touchHold(-450);
check('pre-threshold touch release is inert', await ev(`!!document.querySelector('.reward-menu')`));
await touchHold(120);
check('completed touch hold finalizes once', await ev(`!document.querySelector('.reward-menu')`));
for (const source of ['key', 'pad']) { await open({ rewardCollect: 'manual', holdConfirm: 'normal' }); await abstractHold(source, -450); check(`pre-threshold ${source} release is inert`, await ev(`!!document.querySelector('.reward-menu')`)); await abstractHold(source, 120); check(`completed ${source} hold finalizes`, await ev(`!document.querySelector('.reward-menu')`)); }

for (const cell of [{ n: 'desktop', w: 1200, h: 730, d: 1, s: {} }, { n: 'phone', w: 390, h: 844, d: 2, s: {} }, { n: 'phone-text-xl', w: 390, h: 844, d: 2, s: { textSize: 'XL' } }]) {
  await shape(cell.w, cell.h, cell.d); await open({ rewardCollect: 'manual', holdConfirm: 'normal', ...cell.s });
  await ev(`document.querySelector('#reward-continue').scrollIntoView({block:'nearest'})`); await sleep(100);
  const g = await ev(`(()=>{const e=document.querySelector('#reward-continue'),h=document.querySelector('#reward-hold-copy'),r=e.getBoundingClientRect(),q=h.getBoundingClientRect();return{ok:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&q.left>=0&&q.right<=innerWidth&&q.top>=0&&q.bottom<=innerHeight,r:[r.left,r.top,r.right,r.bottom],q:[q.left,q.top,q.right,q.bottom]}})()`);
  check(`${cell.n} Continue and hold feedback are wholly scroll-reachable`, g.ok, JSON.stringify(g)); await shot(`${cell.n}-menu`);
  await click('.reward-kind[data-kind="flask"]'); await shot(`${cell.n}-potion-detail`); await click('#reward-back');
  await click('.reward-kind[data-kind="armament"]'); await shot(`${cell.n}-armament-detail`);
}
console.log(`EVIDENCE ${OUT}`);
ws.close(); await close(); process.exit(fails ? 1 : 0);
