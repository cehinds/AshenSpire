#!/usr/bin/env node
// Real-browser smoke for the painted Reaver sequence: play an actual Strike,
// observe P32, measure the sprite, capture it, and prove click-skip cleanup.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = resolve(oi >= 0 && args[oi + 1] ? args[oi + 1] : resolve(ROOT, 'audit-evidence', 'reaver-attack'));
const pi = args.indexOf('--page');
const PAGE = pi >= 0 && args[pi + 1] ? args[pi + 1].replace(/^\/+/, '') : '';
const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean).find(existsSync);
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: ok, reject: no } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) no(new Error(message.error.message));
    else ok(message.result);
  });
  return {
    ready: new Promise((ok, no) => {
      socket.addEventListener('open', ok, { once: true });
      socket.addEventListener('error', no, { once: true });
    }),
    send(method, params = {}, sessionId) {
      const id = ++nextId;
      return new Promise((ok, no) => {
        pending.set(id, { resolve: ok, reject: no });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { socket.close(); },
  };
}

async function main() {
  assert(CHROME, 'Chrome or Edge is required (or set CHROME)');
  mkdirSync(OUT, { recursive: true });
  const served = await serve({ root: ROOT, port: 8139, open: false });
  const launched = await launchBrowser({
    prefix: 'reaver-attack-',
    browser: CHROME,
    headless: '--headless=new',
    args: ['--mute-audio'],
    timeoutMs: 15000,
  });
  const cdp = connect(launched.wsUrl);
  await cdp.ready;

  const openPage = async ({ width, height, reduced = false }) => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: width < 600,
    }, sessionId);
    if (reduced) await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    }, sessionId);
    const evaluate = async (expression) => {
      const response = await cdp.send('Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true,
      }, sessionId);
      if (response.exceptionDetails) {
        throw new Error(response.exceptionDetails.exception?.description || 'browser evaluation failed');
      }
      return response.result.value;
    };
    const until = async (expression, label, timeout = 12000) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        const value = await evaluate(expression).catch(() => false);
        if (value) return value;
        await wait(20);
      }
      throw new Error(`timed out waiting for ${label}`);
    };
    await cdp.send('Page.navigate', { url: `${served.url}${PAGE}?shot=combat` }, sessionId);
    await until("!!window.__combat && !!document.querySelector('.combatant.player')", 'combat mount');
    return { targetId, sessionId, evaluate, until };
  };

  const armGreatsword = `(() => {
    const loadout = window.__combat?.loadout;
    if (!loadout) return false;
    const active = loadout.active || {};
    const set = (slot, id) => {
      const index = active[slot] || 0;
      loadout.sets[slot][index] = id;
    };
    set('rightHand', 'greatsword');
    set('leftHand', null);
    set('armor', 'default');
    return true;
  })()`;
  const playStrike = `new Promise((done) => {
    const card = [...document.querySelectorAll('.hand .card')]
      .find((node) => /strike/i.test(node.textContent) && !node.matches('[aria-disabled="true"],:disabled'));
    if (!card) return done({ ok: false, reason: 'no playable Strike' });
    card.click();
    setTimeout(() => {
      if (!document.querySelector('.reaver-attack-sequence')) {
        document.querySelector('.combatant.enemy')?.click();
      }
      done({ ok: true, card: card.textContent.replace(/\\s+/g, ' ').trim() });
    }, 40);
  })`;
  const reading = `(() => {
    const image = document.querySelector('.reaver-attack-sequence');
    const sprite = document.querySelector('.combatant.player .sprite');
    const idle = sprite?.querySelector(':scope > .class-sprite');
    const box = image?.getBoundingClientRect();
    const viewport = { width: innerWidth, height: innerHeight };
    return {
      present: !!image,
      frameId: image?.dataset.frameId || null,
      naturalWidth: image?.naturalWidth || 0,
      naturalHeight: image?.naturalHeight || 0,
      box: box ? { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height } : null,
      viewport,
      spriteOverflow: sprite ? getComputedStyle(sprite).overflow : null,
      idleVisible: !!idle && getComputedStyle(idle).display !== 'none',
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    };
  })()`;

  const runVisual = async (shape) => {
    const page = await openPage(shape);
    assert(await page.evaluate(armGreatsword), `${shape.width}x${shape.height}: could not arm Greatsword`);
    const played = await page.evaluate(playStrike);
    assert(played?.ok, `${shape.width}x${shape.height}: ${played?.reason || 'Strike did not play'}`);
    await page.until("!!document.querySelector('.reaver-attack-sequence')", 'painted sequence start');
    await page.until("document.querySelector('.reaver-attack-sequence')?.dataset.frameId === 'P32'", 'P32 impact', 6000);
    const observed = await page.evaluate(reading);
    assert(observed.naturalWidth === 512 && observed.naturalHeight === 512, 'painted frame did not decode at 512 x 512');
    assert(!observed.idleVisible, `${shape.width}x${shape.height}: idle figure remained behind the attack`);
    assert(observed.horizontalOverflow <= 1, `${shape.width}x${shape.height}: painted frame caused horizontal overflow`);
    assert(observed.box.bottom <= observed.viewport.height + 1, `${shape.width}x${shape.height}: painted frame fell below the viewport`);
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: false,
    }, page.sessionId);
    const name = `${shape.width}x${shape.height}-P32.png`;
    writeFileSync(resolve(OUT, name), Buffer.from(data, 'base64'));
    await page.evaluate("(() => { window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); })()");
    await page.until("!document.querySelector('.reaver-attack-sequence')", 'skip cleanup', 1000);
    await cdp.send('Target.closeTarget', { targetId: page.targetId });
    return { ...observed, screenshot: resolve(OUT, name) };
  };

  const desktop = await runVisual({ width: 1440, height: 860 });
  const phone = await runVisual({ width: 390, height: 844 });

  const reducedPage = await openPage({ width: 1440, height: 860, reduced: true });
  assert(await reducedPage.evaluate(armGreatsword), 'reduced motion: could not arm Greatsword');
  assert((await reducedPage.evaluate(playStrike))?.ok, 'reduced motion: Strike did not play');
  await wait(120);
  const reducedPainted = await reducedPage.evaluate("!!document.querySelector('.reaver-attack-sequence')");
  assert(!reducedPainted, 'reduced motion unexpectedly played the painted sequence');
  await cdp.send('Target.closeTarget', { targetId: reducedPage.targetId });

  console.log(JSON.stringify({ page: PAGE || 'source index.html', desktop, phone, reducedMotionUsesFallback: !reducedPainted }, null, 2));
  console.log('reaver-attack-playtest: PASS');
  cdp.close();
  await launched.close();
  served.server.close();
}

main().catch((error) => {
  console.error(`reaver-attack-playtest: FAIL — ${error.message}`);
  process.exit(1);
});
