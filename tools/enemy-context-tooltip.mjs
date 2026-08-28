#!/usr/bin/env node
// Focused rendered proof for the temporary one-tooltip enemy reading contract.

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const SHOTS = process.argv.includes('--shots') ? resolve(ROOT, process.argv[process.argv.indexOf('--shots') + 1]) : null;
const browserPath = resolveBrowser([
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]);
const shapes = [
  { name: 'desktop', width: 1200, height: 730, mobile: false },
  { name: 'phone', width: 390, height: 844, mobile: true },
];

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const packet = JSON.parse(data); const waiting = pending.get(packet.id);
    if (!waiting) return;
    pending.delete(packet.id);
    packet.error ? waiting.reject(new Error(packet.error.message)) : waiting.resolve(packet.result);
  });
  return {
    ready: new Promise((resolveReady, rejectReady) => { socket.addEventListener('open', resolveReady); socket.addEventListener('error', rejectReady); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((resolveResult, rejectResult) => {
        pending.set(id, { resolve: resolveResult, reject: rejectResult });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => socket.close(),
  };
}

const pause = (ms) => new Promise((resolvePause) => setTimeout(resolvePause, ms));

async function main() {
  if (!browserPath) throw new Error('Chrome/Edge unavailable');
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const served = await serve({ root: ROOT, port: 8592, open: false });
  const browser = await launchBrowser({ prefix: 'enemy-context-', browser: browserPath, headless: '--headless=new', args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const cdp = connect(browser.wsUrl); await cdp.ready;
  let checks = 0; let failures = 0;
  const assert = (held, name, detail = '') => { checks++; if (!held) failures++; console.log(`${held ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
  try {
    const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const sessionId = attached.sessionId;
    await cdp.send('Page.enable', {}, sessionId); await cdp.send('Runtime.enable', {}, sessionId);
    const evaluate = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'page evaluation failed');
      return result.result.value;
    };
    const waitFor = async (expression, label) => {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) { if (await evaluate(expression)) return; await pause(80); }
      throw new Error(`timed out waiting for ${label}`);
    };
    for (const shape of shapes) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: shape.width, height: shape.height, deviceScaleFactor: 1, mobile: shape.mobile }, sessionId);
      await cdp.send('Page.navigate', { url: `${served.url}/?shot=combat` }, sessionId);
      await waitFor("document.querySelector('.combatant.enemy') && document.querySelector('.topbar.combat-hud')", `${shape.name} combat`);
      const trigger = "(() => { const e=document.querySelector('.combatant.enemy'); e.dispatchEvent(new PointerEvent('pointerenter', {bubbles:true,pointerType:'mouse'})); return !!e; })()";
      await evaluate(trigger); await pause(480);
      assert(await evaluate("(() => { const t=document.querySelector('#tooltip'); return !t || getComputedStyle(t).display === 'none'; })()"), `${shape.name} remains hidden before the 500ms hover delay`);
      await pause(80);
      const receipt = await evaluate(`(() => {
        const t=document.querySelector('#tooltip'); const enemy=document.querySelector('.combatant.enemy'); const intent=enemy.querySelector('.intent'); const hud=document.querySelector('.topbar.combat-hud');
        const visible=!!t && getComputedStyle(t).display !== 'none'; const rect=(el) => { const r=el.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
        const intersects=(a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const tr=visible ? rect(t) : null; return {visible, count:document.querySelectorAll('#tooltip').length, variant:t?.dataset.tooltipVariant, text:t?.innerText || '', tr, intent:rect(intent), hud:rect(hud), width:innerWidth, height:innerHeight, intersectsIntent:tr ? intersects(tr, rect(intent)) : null, intersectsHud:tr ? intersects(tr, rect(hud)) : null};
      })()`);
      assert(receipt.visible && receipt.count === 1 && receipt.variant === 'enemy-context', `${shape.name} shows exactly one compact enemy tooltip`);
      assert(/HP\s+\d+\/\d+/.test(receipt.text) && /Poise\s+\d+\/\d+/.test(receipt.text) && /Status/.test(receipt.text), `${shape.name} tooltip contains only the required combat context`, receipt.text.replace(/\s+/g, ' ').slice(0, 120));
      assert(receipt.tr.left >= 0 && receipt.tr.top >= 0 && receipt.tr.right <= receipt.width && receipt.tr.bottom <= receipt.height && !receipt.intersectsIntent && !receipt.intersectsHud, `${shape.name} tooltip clears intent and HUD`);
      if (SHOTS) {
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
        writeFileSync(resolve(SHOTS, `enemy-context-${shape.name}-${shape.width}x${shape.height}.png`), Buffer.from(shot.data, 'base64'));
      }
      await evaluate("document.querySelector('.combatant.enemy').click()");
      assert(await evaluate("document.querySelector('#tooltip')?.dataset.tooltipVariant === 'enemy-context'"), `${shape.name} selection retains the one compact enemy tooltip`);
      await pause(5200);
      assert(await evaluate("(() => { const t=document.querySelector('#tooltip'); return !t || getComputedStyle(t).display === 'none'; })()"), `${shape.name} auto-hides after the configured 5000ms`);
      await evaluate("(() => { document.body.classList.add('reduced-motion'); const e=document.querySelector('.combatant.enemy'); e.dispatchEvent(new Event('gpfocus')); return true; })()");
      await pause(560);
      assert(await evaluate("getComputedStyle(document.querySelector('#tooltip')).display !== 'none'"), `${shape.name} keyboard/gamepad focus reaches the same tooltip`);
      const reducedTransition = await evaluate("getComputedStyle(document.querySelector('#tooltip')).transitionDuration");
      assert(reducedTransition.split(',').every((value) => Number.parseFloat(value) <= 0.001), `${shape.name} reduced motion removes the fade animation`, reducedTransition);
      await evaluate("document.body.classList.remove('reduced-motion')");
    }
  } finally {
    cdp.close(); await browser.close(); served.server.close();
  }
  console.log(`enemy-context-tooltip: ${failures ? `RED — ${failures} finding(s)` : `OK — ${checks}/${checks} checks passed`}`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => { console.error(`enemy-context-tooltip: UNKNOWN — ${error.stack || error.message}`); process.exit(2); });
