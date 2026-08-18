// tools/card-drag-targeting.mjs — browser acceptance for #150 + #198.
//
// The same real page and pointer door checks the approved hand paging controls,
// drag start, legal and illegal target feedback, one legal commit, zero illegal
// commits, and cleanup on both endings.  `--selftest` plants the cleanup defect
// back into combat.js and requires this door to go red.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'card-drag-targeting.mjs',
    args: ['--only', '390x844'],
    timeoutMs: 600000,
    plants: [{
      name: 'illegal-drop cleanup is removed, leaving the targeting state armed',
      file: 'src/ui/screens/combat.js',
      find: '          clearDragTargeting();\n          if (dragGhost)',
      replace: '          /* planted: #198 cleanup omitted */\n          if (dragGhost)',
      expectRed: /FAIL illegal drop clears every drag marker/,
    }],
  }));
}

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BROWSERS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const SHAPES = [[320, 640], [390, 844], [768, 1024], [1200, 730]];
const args = process.argv.slice(2);
const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const only = argOf('--only');
const screenshots = args.includes('--screenshots');
const useDist = args.includes('--dist');
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
    if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => {
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

async function main() {
  if (!browserPath) throw new Error('no Chrome/Edge found; pass --browser or set CHROME');
  const served = useDist ? null : await serve({ root: ROOT, port: 8298, open: false });
  const base = useDist ? pathToFileURL(resolve(ROOT, 'dist', 'AshenSpire.html')).href : `http://localhost:${served.port}/`;
  const browser = await launchBrowser({ prefix: 'carddrag-', browser: browserPath, timeoutMs: 15000 });
  const cdp = connectCdp(browser.wsUrl); await cdp.ready;
  let fails = 0; let ran = 0;
  const ok = (value, label, detail = '') => {
    console.log(`    ${value ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
    if (!value) fails++;
  };

  try {
    for (const [W, H] of SHAPES) {
      const shape = `${W}x${H}`;
      if (only && only !== shape) continue;
      ran++;
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 }, S);
      const ev = async (expression) => {
        const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page evaluation threw');
        return r.result.value;
      };
      const until = async (expression, label, ms = 20000) => {
        const started = Date.now();
        while (Date.now() - started < ms) {
          if (await ev(expression).catch(() => false)) return;
          await wait(120);
        }
        throw new Error(`timeout waiting for ${label}`);
      };
      const mouse = (type, x, y, down = false) => cdp.send('Input.dispatchMouseEvent', {
        type, x, y, button: 'left', buttons: down ? 1 : 0, clickCount: type === 'mousePressed' || type === 'mouseReleased' ? 1 : 0,
      }, S);
      const point = (selector) => ev(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      const state = () => ev(`(() => ({
        discard:+document.querySelector('.pile.discard .n').textContent,
        energy:document.querySelector('.energy-orb').textContent.trim(),
        mode:document.querySelector('.combat').classList.contains('drag-targeting'),
        legal:document.querySelectorAll('[data-drop-state="legal"]').length,
        illegal:document.querySelectorAll('[data-drop-state="illegal"]').length,
        ghosts:document.querySelectorAll('.card-drag-ghost').length
      }))()`);

      await cdp.send('Page.navigate', { url: `${base}?shot=combat` }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'combat'); await wait(350);
      console.log(`\n  ${shape}`);
      const controls = await ev(`(() => { const hs=[...document.querySelectorAll('.hand-page')]; return {n:hs.length, labels:hs.map(x=>x.getAttribute('aria-label')), on:hs.every(x=>{const r=x.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})}; })()`);
      ok(controls.n === 2 && controls.labels.every(Boolean), 'approved previous/next controls exist and are named', JSON.stringify(controls));
      ok(controls.on, 'hand paging controls stay inside the viewport');
      const overlap = await ev(`(() => {
        const hit=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
        const box=x=>{const r=x.getBoundingClientRect();return {name:x.className,left:r.left,top:r.top,right:r.right,bottom:r.bottom}};
        const pages=[...document.querySelectorAll('.hand-page')].map(box);
        const fixed=[...document.querySelectorAll('.end-turn,.energy-orb,.pile')].filter(x=>getComputedStyle(x).display!=='none').map(box);
        const hand=document.querySelector('.hand').getBoundingClientRect();
        const cards=[...document.querySelectorAll('.hand .card')].map(box).map(r=>({...r,
          left:Math.max(r.left,hand.left),right:Math.min(r.right,hand.right),
          top:Math.max(r.top,hand.top),bottom:Math.min(r.bottom,hand.bottom)}))
          .filter(r=>r.right>Math.max(0,r.left)&&r.bottom>r.top&&r.left<innerWidth);
        const pairs=(bs)=>pages.flatMap(a=>bs.filter(b=>hit(a,b)).map(b=>[a,b]));
        const chromePairs=pairs(fixed), cardPairs=pairs(cards);
        return { chrome:chromePairs.length>0, cards:cardPairs.length>0, chromePairs, cardPairs };
      })()`);
      ok(!overlap.chrome && !overlap.cards, 'paging controls overlap neither cards nor combat controls', JSON.stringify(overlap));
      if (controls.n === 2) {
        await ev(`document.querySelector('.hand-next').click()`); await wait(100);
        ok(await ev(`!!document.querySelector('.hand .card.gp-focus')`), 'paging moves focus through the real hand');
      }

      const card = await ev(`(() => { const c=[...document.querySelectorAll('.hand .card')].find(x=>/Strike/.test(x.textContent)); if(!c)return null; c.scrollIntoView({inline:'center',block:'nearest'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      const enemy = await point('.enemy:not(.dead)');
      if (!card || !enemy) throw new Error(`${shape}: missing targetable card/enemy`);
      const before = await state();
      await mouse('mousePressed', card.x, card.y, true);
      await mouse('mouseMoved', card.x, card.y - 30, true);
      await mouse('mouseMoved', enemy.x, enemy.y, true); await wait(120);
      const armed = await state();
      ok(armed.mode && armed.legal > 0 && armed.ghosts === 1, 'drag start exposes one ghost and explicit legal targets', JSON.stringify(armed));
      if (screenshots) {
        const dir = join(ROOT, 'docs', 'preview'); mkdirSync(dir, { recursive: true });
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, S);
        writeFileSync(join(dir, `combat-ui-drag-${shape}.png`), Buffer.from(shot.data, 'base64'));
      }
      await mouse('mouseReleased', enemy.x, enemy.y, false); await wait(700);
      const legalEnd = await state();
      ok(legalEnd.discard === before.discard + 1, 'legal drop plays exactly once', `${before.discard} -> ${legalEnd.discard}`);
      ok(!legalEnd.mode && legalEnd.legal === 0 && legalEnd.illegal === 0 && legalEnd.ghosts === 0, 'legal drop clears every drag marker', JSON.stringify(legalEnd));

      await cdp.send('Page.navigate', { url: `${base}?shot=combat` }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'combat reset'); await wait(350);
      const card2 = await ev(`(() => { const c=[...document.querySelectorAll('.hand .card')].find(x=>/Strike/.test(x.textContent)); c.scrollIntoView({inline:'center',block:'nearest'}); const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      const bad = await point('.topbar'); const beforeBad = await state();
      await mouse('mousePressed', card2.x, card2.y, true);
      await mouse('mouseMoved', card2.x, card2.y - 30, true);
      await mouse('mouseMoved', bad.x, bad.y, true); await wait(120);
      const rejected = await state();
      ok(rejected.mode && rejected.illegal > 0 && rejected.legal > 0, 'illegal hover is distinct while legal targets remain visible', JSON.stringify(rejected));
      await mouse('mouseReleased', bad.x, bad.y, false); await wait(350);
      const illegalEnd = await state();
      ok(illegalEnd.discard === beforeBad.discard && illegalEnd.energy === beforeBad.energy, 'illegal drop spends and plays nothing');
      ok(!illegalEnd.mode && illegalEnd.legal === 0 && illegalEnd.illegal === 0 && illegalEnd.ghosts === 0, 'illegal drop clears every drag marker', JSON.stringify(illegalEnd));
      await cdp.send('Target.closeTarget', { targetId });
    }
    if (!ran) throw new Error(`--only ${only} matched no shape`);
    console.log(`\n${fails ? `FAIL — ${fails} finding(s)` : 'PASS — card drag targeting and approved hand paging hold at every measured shape'}`);
    process.exitCode = fails ? 1 : 0;
  } finally {
    cdp.close(); await browser.close(); if (served) served.server.close();
  }
}

main().catch((e) => { console.error(`card-drag-targeting: ${e.message}`); process.exitCode = 2; });
