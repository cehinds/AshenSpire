#!/usr/bin/env node
// Rendered contract for the combat battlefield's vertical safe corridor.
// The combatant frame (intent + card) belongs in the center of the space left
// between the shared HUD and the visible hand. The authored viewport share is
// protected at each edge; intent stays attached without touching either card
// or HUD. DOM presence alone cannot prove any of those statements.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const valueOf = (flag) => { const at = args.indexOf(flag); return at < 0 ? null : args[at + 1]; };
const standalone = args.includes('--standalone');
const only = valueOf('--only');
const shots = valueOf('--shots');
const label = valueOf('--label') || 'preview';
const browserPath = resolveBrowser([
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]);

const SHAPES = [
  { name: 'desktop', width: 1200, height: 730, mobile: false },
  { name: 'phone', width: 390, height: 844, mobile: true },
  { name: 'phone-short', width: 375, height: 667, mobile: true },
  { name: 'short-wide', width: 844, height: 390, mobile: false },
].filter((shape) => !only || only === shape.name || only === `${shape.width}x${shape.height}`);

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const packet = JSON.parse(event.data);
    const waiting = pending.get(packet.id);
    if (!waiting) return;
    pending.delete(packet.id);
    packet.error ? waiting.reject(new Error(packet.error.message)) : waiting.resolve(packet.result);
  });
  return {
    ready: new Promise((pass, fail) => {
      socket.addEventListener('open', pass);
      socket.addEventListener('error', fail);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((pass, fail) => {
        pending.set(id, { resolve: pass, reject: fail });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { socket.close(); },
  };
}

async function main() {
  if (!browserPath) {
    console.error('combatant-stage: UNKNOWN — Chrome/Edge not found');
    process.exit(2);
  }
  if (!SHAPES.length) {
    console.error(`combatant-stage: UNKNOWN — --only ${only} selected no shape`);
    process.exit(2);
  }

  const served = standalone ? null : await serve({ root: ROOT, port: 8581, open: false });
  const base = standalone
    ? pathToFileURL(resolve(ROOT, 'dist/AshenSpire.html')).href
    : `${served.url}/`;
  if (standalone && !existsSync(resolve(ROOT, 'dist/AshenSpire.html'))) {
    console.error('combatant-stage: UNKNOWN — dist/AshenSpire.html is missing');
    process.exit(2);
  }
  if (shots) mkdirSync(resolve(ROOT, shots), { recursive: true });

  const browser = await launchBrowser({
    prefix: 'combatant-stage-', browser: browserPath, headless: '--headless=new',
    args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
  });
  const cdp = connect(browser.wsUrl);
  await cdp.ready;
  let failures = 0;
  let checks = 0;
  try {
    const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const sessionId = attached.sessionId;
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    const evaluate = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', {
        expression, returnByValue: true, awaitPromise: true,
      }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'page evaluation failed');
      return result.result.value;
    };
    const waitFor = async (expression, name) => {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return;
        await new Promise((pass) => setTimeout(pass, 100));
      }
      throw new Error(`timed out waiting for ${name}`);
    };
    const assert = (held, name, detail) => {
      checks++;
      if (!held) failures++;
      console.log(`    ${held ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    };

    for (const shape of SHAPES) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: shape.width, height: shape.height, deviceScaleFactor: 1, mobile: shape.mobile,
      }, sessionId);
      await cdp.send('Page.navigate', { url: `${base}?shot=combat` }, sessionId);
      await waitFor("document.querySelectorAll('.combatant-card').length >= 2 && document.querySelectorAll('.hand .card').length > 0", `${shape.name} combat`);
      await new Promise((pass) => setTimeout(pass, 900));

      const receipt = await evaluate(`(() => {
        const visible = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
        const rect = (el) => { const r=el.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
        const intersects = (a,b) => a.left < b.right-.25 && a.right > b.left+.25 && a.top < b.bottom-.25 && a.bottom > b.top+.25;
        const hud=rect(document.querySelector('.shared-hud'));
        const fieldEl=document.querySelector('.field');
        const field=rect(fieldEl);
        const actionCards=[...document.querySelectorAll('.hand .card')].filter(visible).map(rect);
        const actionTop=Math.min(...actionCards.map((card)=>card.top));
        const hudPct=Number(fieldEl.dataset.hudClearanceViewportPct);
        const actionPct=Number(fieldEl.dataset.actionClearanceViewportPct);
        const requiredTop=innerHeight*(hudPct/100);
        const requiredBottom=innerHeight*(actionPct/100);
        const safeTop=hud.bottom+requiredTop;
        const safeBottom=actionTop-requiredBottom;
        const safeCenter=(safeTop+safeBottom)/2;
        const frames=[...document.querySelectorAll('.combatant')].filter(visible).map((frame) => {
          const card=rect(frame.querySelector('.combatant-card'));
          const intentEl=frame.querySelector('.intent');
          const intent=visible(intentEl)?rect(intentEl):null;
          const top=intent?intent.top:card.top;
          const bottom=card.bottom;
          return {
            role:frame.classList.contains('player')?'player':'enemy',
            card,intent,top,bottom,
            topClearance:top-hud.bottom,
            bottomClearance:actionTop-bottom,
            intentGap:intent?card.top-intent.bottom:null,
            centerDelta:((top+bottom)/2)-safeCenter,
            intentCardOverlap:intent?intersects(intent,card):false,
            hudOverlap:intent?intersects(hud,intent):intersects(hud,card),
            actionOverlap:actionCards.some((action)=>intersects(action,card)),
            onGlass:top>=-.25 && bottom<=innerHeight+.25,
          };
        });
        return {viewport:{width:innerWidth,height:innerHeight},hud,field,actionTop,hudPct,actionPct,requiredTop,requiredBottom,safeTop,safeBottom,safeCenter,frames};
      })()`);

      console.log(`\n  ${shape.name} ${shape.width}x${shape.height} · required ${receipt.hudPct}%/${receipt.actionPct}% = ${receipt.requiredTop.toFixed(2)}px/${receipt.requiredBottom.toFixed(2)}px · safe corridor ${receipt.safeTop.toFixed(2)}..${receipt.safeBottom.toFixed(2)}`);
      assert(receipt.safeBottom > receipt.safeTop, 'the HUD and hand leave a positive protected battlefield corridor', `${(receipt.safeBottom-receipt.safeTop).toFixed(2)}px`);
      for (const [index, frame] of receipt.frames.entries()) {
        const who = `${frame.role} ${index + 1}`;
        assert(frame.topClearance >= receipt.requiredTop - 1, `${who} keeps the authored HUD clearance above its visible frame`, `${frame.topClearance.toFixed(2)}px`);
        assert(frame.bottomClearance >= receipt.requiredBottom - 1, `${who} keeps the authored hand clearance below its card`, `${frame.bottomClearance.toFixed(2)}px`);
        assert(Math.abs(frame.centerDelta) <= Math.max(4, (receipt.safeBottom-receipt.safeTop)*.08), `${who} is centered in the protected corridor`, `delta ${frame.centerDelta.toFixed(2)}px`);
        assert(!frame.intentCardOverlap && !frame.hudOverlap && !frame.actionOverlap && frame.onGlass, `${who} has no HUD, intent, card, hand, or viewport collision`);
        if (frame.intent) {
          assert(frame.intentGap >= 2 && frame.intentGap <= 12, `${who} intent is closely attached without overlap`, `${frame.intentGap.toFixed(2)}px`);
        }
      }

      if (shots) {
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
        const file = resolve(ROOT, shots, `combatant-stage-${label}-${shape.name}-${shape.width}x${shape.height}.png`);
        writeFileSync(file, Buffer.from(shot.data, 'base64'));
        console.log(`    screenshot: ${file}`);
      }
    }
  } finally {
    cdp.close();
    await browser.close();
    served?.server.close();
  }

  console.log(`\ncombatant-stage: ${failures ? `RED — ${failures} finding(s)` : `OK — ${checks}/${checks} checks passed`} over ${SHAPES.length} rendered shape(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(`combatant-stage: UNKNOWN — ${error.stack || error.message}`);
  process.exit(2);
});
