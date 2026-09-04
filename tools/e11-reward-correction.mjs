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
const { close } = await launchBrowser({
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
// A pad shim at navigator.getGamepads, the same boundary the shipped poller
// reads. Unlike the former custom-event injection, presses travel through the
// real input poller and its blur cancellation path.
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const pad = { index:0, id:'E11 standard gamepad shim', mapping:'standard', connected:true,
    timestamp:0, axes:[0,0,0,0], buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0})) };
  navigator.getGamepads = () => [pad,null,null,null];
  window.__e11pad = {
    connect(){ window.dispatchEvent(new Event('gamepadconnected')); },
    down(i){ pad.buttons[i]={pressed:true,touched:true,value:1}; pad.timestamp=performance.now(); },
    up(i){ pad.buttons[i]={pressed:false,touched:false,value:0}; pad.timestamp=performance.now(); }
  };
})()` });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
let fails = 0; const check = (name, yes, detail = '') => { console.log(`${yes ? 'PASS' : 'FAIL'}  ${name}${!yes && detail ? ` — ${detail}` : ''}`); if (!yes) fails++; };
async function shape(w, h, dpr = 1) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: w < 600 }); }
async function open(settings = {}, extra = '') {
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html?shot=reward&shotSettings=${encodeURIComponent(JSON.stringify(settings))}${extra}` });
  for (let i = 0; i < 100 && !(await ev(`!!document.querySelector('.reward-menu')`)); i++) await sleep(80);
  await sleep(150);
}
const click = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.click();return true})()`);
const point = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,ms:Number(e.dataset.holdMs)||600}})()`);
async function mouseHold(msDelta = 120) { const p = await point('#reward-continue'); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await sleep(Math.max(80, p.ms + msDelta)); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await sleep(250); }
async function touchHold(msDelta = 120) { const p = await point('#reward-continue'); await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] }); await sleep(Math.max(80, p.ms + msDelta)); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(250); }
async function focusContinue() { return ev(`(()=>{const e=document.querySelector('#reward-continue');if(!e)return false;document.querySelectorAll('.gp-focus').forEach(x=>x.classList.remove('gp-focus'));e.classList.add('gp-focus');e.focus();return true})()`); }
async function nativeEnter(ms) {
  await focusContinue();
  await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
  const until = Date.now() + ms;
  while (Date.now() < until) { await sleep(33); await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13, autoRepeat:true }); }
  await send('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
  await sleep(250);
}
async function nativePad(ms, { blur = false } = {}) {
  await focusContinue(); await ev(`window.__e11pad.connect()`); await sleep(120);
  await ev(`window.__e11pad.down(0)`); await sleep(ms);
  if (blur) await ev(`window.dispatchEvent(new Event('blur'))`);
  await ev(`window.__e11pad.up(0)`); await sleep(300);
}
async function shot(name) { const png = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); writeFileSync(resolve(OUT, `${name}.png`), Buffer.from(png.data, 'base64')); }

await shape(1200, 730); await open({ rewardCollect: 'manual', holdConfirm: 'normal' });
check('ordinary rows have zero Skip controls and labels', await ev(`!document.querySelector('.reward-skip,[data-skip]')&&![...document.querySelectorAll('.reward-kind')].some(e=>/\\bSkip\\b/i.test(e.textContent))`));
check('rewardContinue is rendered through the shared second-beat registry', await ev(`(()=>{const e=document.querySelector('#reward-continue');return e?.dataset.beatAction==='rewardContinue'&&e?.dataset.beat==='hold'&&Number(e?.dataset.holdMs)===600})()`));
await click('.reward-kind[data-kind="cinders"]');
await click('.reward-kind[data-kind="flask"]');
check('Potion opens a distinct non-collecting detail', await ev(`/inspect the potion/i.test(document.querySelector('[data-reward-detail="flask"]')?.textContent||'')`));
await click('#reward-back');
check('Potion Back preserves prior Taken state', await ev(`document.querySelector('[data-kind="cinders"]')?.dataset.state==='taken'`));
await click('.reward-kind[data-kind="armament"]');
check('Armament opens a distinct non-collecting detail', await ev(`/inspect the armament/i.test(document.querySelector('[data-reward-detail="armament"]')?.textContent||'')`));
await click('#reward-back');
const beforeCard = await ev(`window.__spoils()`);
await click('.reward-kind[data-kind="card"]'); await click('#reward-back');
check('Cards Back preserves prior Taken state', await ev(`document.querySelector('[data-kind="cinders"]')?.dataset.state==='taken'`));
await click('.reward-kind[data-kind="card"]'); await click('.reward-row .card');
const afterCard = await ev(`window.__spoils()`);
check('Card is persisted before Continue and before the done callback',
  afterCard.liveDeck.length === beforeCard.liveDeck.length + 1
    && afterCard.savedDeck.length === afterCard.liveDeck.length && afterCard.done === 0,
  JSON.stringify({ beforeCard, afterCard }));

await open({ rewardCollect: 'manual', holdConfirm: 'normal' }); await mouseHold(-450);
check('pre-threshold pointer release is inert', await ev(`!!document.querySelector('.reward-menu')`));
await mouseHold(120);
await click('#reward-continue');
check('completed pointer hold calls onDone exactly once despite its trailing click', await ev(`window.__spoils().done===1`));
await shape(390, 844, 2); await open({ rewardCollect: 'manual', holdConfirm: 'normal' }); await touchHold(-450);
check('pre-threshold touch release is inert', await ev(`!!document.querySelector('.reward-menu')`));
await touchHold(120);
check('completed touch hold finalizes once', await ev(`window.__spoils().done===1`));
await open({ rewardCollect: 'manual', holdConfirm: 'normal' }); await nativeEnter(150);
check('native focused Enter shorter than 600ms is inert', await ev(`!!document.querySelector('.reward-menu')&&window.__spoils().done===0`));
await nativeEnter(720);
check('native focused Enter held past 600ms finalizes exactly once', await ev(`window.__spoils().done===1`));
await open({ rewardCollect: 'manual', holdConfirm: 'normal' }); await nativePad(150, { blur:true });
check('real gamepad-poller hold cancelled by blur is inert', await ev(`!!document.querySelector('.reward-menu')&&window.__spoils().done===0`));
await nativePad(720);
check('real gamepad-poller hold past 600ms finalizes exactly once', await ev(`window.__spoils().done===1`));

for (const cell of [{ n: 'desktop', w: 1200, h: 730, d: 1, s: {} }, { n: 'phone', w: 390, h: 844, d: 2, s: {} }, { n: 'phone-text-xl', w: 390, h: 844, d: 2, s: { textSize: 'XL' } }]) {
  await shape(cell.w, cell.h, cell.d); await open({ rewardCollect: 'manual', holdConfirm: 'normal', ...cell.s });
  await ev(`document.querySelector('#reward-continue').scrollIntoView({block:'nearest'})`); await sleep(100);
  const g = await ev(`(()=>{const e=document.querySelector('#reward-continue'),h=document.querySelector('#reward-hold-copy'),r=e.getBoundingClientRect(),q=h.getBoundingClientRect();return{ok:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&q.left>=0&&q.right<=innerWidth&&q.top>=0&&q.bottom<=innerHeight,r:[r.left,r.top,r.right,r.bottom],q:[q.left,q.top,q.right,q.bottom]}})()`);
  check(`${cell.n} Continue and hold feedback are wholly scroll-reachable`, g.ok, JSON.stringify(g)); await shot(`${cell.n}-menu`);
  await click('.reward-kind[data-kind="flask"]'); await sleep(240); await shot(`${cell.n}-potion-detail`); await click('#reward-back');
  await click('.reward-kind[data-kind="armament"]'); await sleep(240); await shot(`${cell.n}-armament-detail`);
  {
    await open({ rewardCollect: 'manual', holdConfirm: 'normal', ...cell.s }, '&shotStorage=full');
    const fallback = await ev(`(()=>{
      const all=[...document.querySelectorAll('.reward-skip,[data-skip]')], row=document.querySelector('[data-kind="armament"]'), b=row?.querySelector('[data-skip="armament"]');
      if(!row||!b)return{ok:false,why:'missing armament fallback',count:all.length};
      const rr=row.getBoundingClientRect(), br=b.getBoundingClientRect(), body=row.querySelector('.cp-body').getBoundingClientRect();
      return{ok:all.length===1&&br.width>=44&&br.height>=44&&br.right<=rr.right+1&&rr.right-br.right<=20&&br.left>=body.right-1&&br.left>=0&&br.right<=innerWidth,
        count:all.length,row:[rr.left,rr.right],button:[br.left,br.top,br.right,br.bottom],bodyRight:body.right};
    })()`);
    check(`${cell.n} exceptional blocked fallback is the only Skip and is far-right, whole, and non-overlapping`, fallback.ok, JSON.stringify(fallback));
    await click('[data-skip="armament"]');
    check(`${cell.n} exceptional Skip leaves the blocked row explicitly skipped`, await ev(`document.querySelector('[data-kind="armament"]')?.dataset.state==='skipped'`));
  }
}
console.log(`EVIDENCE ${OUT}`);
ws.close(); await close(); process.exit(fails ? 1 : 0);
