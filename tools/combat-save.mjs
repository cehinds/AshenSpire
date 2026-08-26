#!/usr/bin/env node
// Focused acceptance for QA remediation #3: explicit combat saves preserve
// one exact committed turn and restore it without replaying combat setup.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = resolve(ROOT, 'docs', 'preview');
const CAPTURE_SHOTS = process.argv.includes('--screenshots');
const ARTIFACT = process.argv.includes('--artifact');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const browserPath = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((candidate) => candidate && existsSync(candidate));

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const code = await doorSelftest({
    tool: 'combat-save.mjs',
    timeoutMs: 90000,
    plants: [
      {
        name: 'resume discards the stored exact snapshot and restarts the encounter',
        file: 'src/main.js',
        find: '  const savedSnapshot = resuming ? run.combatEntered?.snapshot : null;',
        replace: '  const savedSnapshot = null; // combat-save selftest plant',
        expectRed: /RED COMBAT-SAVE-EXACT-RESUME/,
      },
      {
        name: 'Save and Save and Quit stop committing exact combat snapshots',
        file: 'src/main.js',
        find: '      commitCombatSnapshot({ run, combat, nodeId, encounterId });',
        replace: '      run.combatEntered = { nodeId, encounterId }; // combat-save selftest plant',
        all: true,
        expectRed: /RED COMBAT-SAVE-EXACT-RESUME/,
      },
      {
        name: 'restore drops the saved hand',
        file: 'src/engine/combatSnapshot.js',
        find: '    piles: saved.piles,',
        replace: "    piles: { ...saved.piles, hand: [] }, // combat-save selftest plant",
        expectRed: /RED COMBAT-SAVE-EXACT-RESUME/,
      },
    ],
  });
  process.exit(code);
}

function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id == null || !pending.has(message.id)) return;
    const { yes, no } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? no(new Error(message.error.message)) : yes(message.result);
  };
  return {
    ready: new Promise((yes, no) => { socket.onopen = yes; socket.onerror = no; }),
    send(method, params = {}, sessionId) {
      const id = ++nextId;
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      return new Promise((yes, no) => pending.set(id, { yes, no }));
    },
    close() { socket.close(); },
  };
}

let failures = 0;
let checks = 0;
function check(ok, code, detail) {
  checks += 1;
  if (ok) console.log(`PASS ${code} - ${detail}`);
  else { failures += 1; console.error(`RED ${code} - ${detail}`); }
}

let server;
let cdp;
let closeBrowser = async () => {};
try {
  if (!browserPath) throw new Error('no supported Chrome or Edge binary found');
  const served = await serve({ root: ROOT, port: 8253, open: false });
  server = served.server;
  const launched = await launchBrowser({ prefix: 'combat-save-', browser: browserPath, headless: '--headless=new', timeoutMs: 20000 });
  closeBrowser = launched.close;
  cdp = connectCdp(launched.wsUrl);
  await cdp.ready;

  const runViewport = async ({ width, height, mobile, label }) => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile,
    }, sessionId);

    const ev = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true,
      }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluation failed');
      return result.result.value;
    };
    const until = async (expression, waitingFor, timeout = 20000) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        if (await ev(expression).catch(() => false)) return;
        await wait(70);
      }
      throw new Error(`timeout waiting for ${label} ${waitingFor}`);
    };
    const click = async (selector) => {
      const point = await ev(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      if (!point) throw new Error(`missing ${selector}`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
      await wait(180);
    };
    const neutralizePresentation = async () => {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 8, y: height * 0.65 }, sessionId);
      await ev('document.activeElement?.blur()');
      await wait(180);
    };
    const key = async (keyName) => {
      const vk = keyName === 'Escape' ? 27 : keyName === 'Enter' ? 13 : keyName.toUpperCase().charCodeAt(0);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code: keyName, windowsVirtualKeyCode: vk }, sessionId);
      await wait(80);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code: keyName, windowsVirtualKeyCode: vk }, sessionId);
      await wait(180);
    };
    const screenshot = async (name) => {
      mkdirSync(SHOT_DIR, { recursive: true });
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
      const path = resolve(SHOT_DIR, name);
      writeFileSync(path, Buffer.from(data, 'base64'));
      return path;
    };
    const exactSnapshot = () => ev(`import('./src/engine/combatSnapshot.js').then(({serializeCombatSnapshot}) => JSON.stringify(serializeCombatSnapshot(window.__combat)))`);

    const entry = ARTIFACT ? 'AshenSpire.html' : '';
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${served.port}/${entry}?shot=combat` }, sessionId);
    await until(`!!window.__combat && !!document.querySelector('.end-turn')`, 'combat boot');
    const openingTurn = await ev('window.__combat.turn');
    await click('.end-turn');
    await until(`window.__combat.turn > ${openingTurn} && window.__combat.phase === 'player'`, 'next committed player turn');
    await until(`window.__fx && window.__fx.open > 0 && window.__fx.open === window.__fx.finished`, 'combat timeline settlement');
    await neutralizePresentation();
    await wait(120);
    const before = await exactSnapshot();
    const beforeModel = JSON.parse(before);
    const visibleHp = await ev(`Number(document.querySelector('[data-eid="player"] [data-res="hp"]')?.dataset.cur)`);
    check(beforeModel.turn > openingTurn && beforeModel.phase === 'player' && beforeModel.piles.hand.length > 0
        && visibleHp === beforeModel.player.hp,
      `COMBAT-SAVE-${label}-POSE`, `turn ${beforeModel.turn} is committed and visible at HP ${visibleHp} with ${beforeModel.piles.hand.length} cards in hand`);

    const layout = await ev(`(() => {
      const rect = (s) => { const r=document.querySelector(s)?.getBoundingClientRect(); return r&&{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
      return { overflowX:document.documentElement.scrollWidth-window.innerWidth,
        overflowY:document.documentElement.scrollHeight-window.innerHeight,
        menu:rect('#combat-menu'), endTurn:rect('.end-turn') };
    })()`);
    check(layout.overflowX <= 0 && layout.menu?.left >= 0 && layout.menu?.right <= width
        && layout.endTurn?.left >= 0 && layout.endTurn?.right <= width
        && layout.menu?.width >= 44 && layout.menu?.height >= 44
        && layout.endTurn?.width >= 44 && layout.endTurn?.height >= 44,
      `COMBAT-SAVE-${label}-LAYOUT`, `${width}x${height} combat controls fit and meet the 44 px input floor (${JSON.stringify(layout)})`);
    if (CAPTURE_SHOTS) await screenshot(`qa-combat-save-before-${label.toLowerCase()}-${width}x${height}.png`);

    await click('#combat-menu');
    await until(`!!document.querySelector('.qn-row[data-act="save"]')`, 'quick menu');
    await click('.qn-row[data-act="save"]');
    const savedInPlace = await ev(`document.querySelector('.qn-row[data-act="save"] .qn-label')?.textContent || ''`);
    check(savedInPlace === 'Saved · Slot 1' && !!(await ev('window.__combat')),
      `COMBAT-SAVE-${label}-IN-PLACE`, `Save confirms slot 1 and leaves the exact combat visible (${JSON.stringify(savedInPlace)})`);
    await key('Escape');
    await until(`!document.querySelector('.quick-nav-veil')`, 'quick menu close');

    await click('#combat-menu');
    await until(`!!document.querySelector('.qn-row[data-act="saveQuit"]')`, 'Save and Quit command');
    await click('.qn-row[data-act="saveQuit"]');
    await until(`!!document.querySelector('[data-title-action="load"]')`, 'title after Save and Quit');
    await click('[data-title-action="load"]');
    await until(`!!document.querySelector('[data-slot-pick="1"].is-filled')`, 'occupied Load slot');
    await click('[data-slot-pick="1"]');
    await click('[data-slot-pick="1"]');
    await until(`!!document.querySelector('[data-title-action="review-load"]')`, 'load review');
    await click('[data-title-action="review-load"]');
    await until(`!!window.__combat && !!document.querySelector('.end-turn')`, 'restored combat');
    await wait(300);
    await neutralizePresentation();
    const after = await exactSnapshot();
    check(after === before, `COMBAT-SAVE-EXACT-RESUME`,
      `${label} Load returns the exact saved turn, phase, resources, entities, intents, hand, piles, triggers, and event log`);
    const afterModel = JSON.parse(after);
    check(afterModel.turn === beforeModel.turn && afterModel.player.hp === beforeModel.player.hp
        && afterModel.piles.hand.map((card) => card.instanceId).join(',') === beforeModel.piles.hand.map((card) => card.instanceId).join(','),
      `COMBAT-SAVE-${label}-PLAYER-STATE`, `turn ${afterModel.turn}, HP ${afterModel.player.hp}, and hand order remain visibly coherent`);
    if (CAPTURE_SHOTS) await screenshot(`qa-combat-save-resumed-${label.toLowerCase()}-${width}x${height}.png`);

    await cdp.send('Target.closeTarget', { targetId });
  };

  await runViewport({ width: 1200, height: 730, mobile: false, label: 'WIDE' });
  await runViewport({ width: 390, height: 844, mobile: true, label: 'MOBILE' });
} catch (error) {
  failures += 1;
  console.error(`RED COMBAT-SAVE-DOOR - ${error.stack || error.message}`);
} finally {
  try { cdp?.close(); } catch { /* best effort socket close */ }
  try { await closeBrowser(); } catch (error) { console.error(`BROWSER CLEANUP WARNING ${error.message}`); }
  if (server) await new Promise((done) => server.close(done));
}

console.log(`combat-save: ${checks - failures}/${checks} checks passed${ARTIFACT ? ' against shipped AshenSpire.html' : ' against source'}; ${failures} failed`);
process.exit(failures ? 1 : 0);
