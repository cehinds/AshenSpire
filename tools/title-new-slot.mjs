#!/usr/bin/env node
// Focused acceptance for QA remediation #2: New Game keeps the selected empty
// slot visibly selected, carries that exact slot through creation, and saves the
// new run there without replacing either of the other slots.

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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
    tool: 'title-new-slot.mjs',
    timeoutMs: 60000,
    plants: [
      {
        name: 'slot presses read a missing data attribute',
        file: 'src/ui/screens/title.js',
        find: '        selectedSlot = +button.dataset.slotPick;',
        replace: '        selectedSlot = +button.dataset.slot; // title-new-slot selftest plant',
        expectRed: /RED NEW-SLOT-CHANGE/,
      },
      {
        name: 'New Game focuses the first row instead of its selected empty slot',
        file: 'src/ui/screens/title.js',
        find: '    focusModal(selectedSlot == null ? undefined : `[data-slot-pick="${selectedSlot}"]`);',
        replace: '    focusModal(); // title-new-slot selftest plant',
        expectRed: /RED NEW-SLOT-INITIAL/,
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
let serverPort;
let cdp;
let closeBrowser = async () => {};
try {
  if (!browserPath) throw new Error('no supported Chrome or Edge binary found');
  ({ server, port: serverPort } = await serve({ root: ROOT, port: 8252, open: false }));
  const launched = await launchBrowser({ prefix: 'title-new-slot-', browser: browserPath, headless: '--headless=new', timeoutMs: 20000 });
  closeBrowser = launched.close;
  cdp = connectCdp(launched.wsUrl);
  await cdp.ready;

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  }, sessionId);

  const ev = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluation failed');
    return result.result.value;
  };
  const until = async (expression, label, timeout = 15000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await ev(expression).catch(() => false)) return;
      await wait(60);
    }
    throw new Error(`timeout waiting for ${label}`);
  };
  const click = async (selector) => {
    const point = await ev(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    if (!point) throw new Error(`missing ${selector}`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
    await wait(120);
  };

  const url = `http://127.0.0.1:${serverPort}/?shot=title`;
  await cdp.send('Page.navigate', { url }, sessionId);
  await until(`!!document.querySelector('[data-title-action="new"]')`, 'title with slot 1 occupied');
  await click('[data-title-action="new"]');
  await until(`!!document.querySelector('.title-menu-modal')`, 'New Game slot picker');

  const initial = await ev(`(() => {
    const selected=document.querySelector('[data-slot-pick][aria-pressed="true"]');
    const focused=document.querySelector('[data-slot-pick].gp-focus');
    return { selected:selected?.dataset.slotPick||null, focused:focused?.dataset.slotPick||null,
      continueEnabled:document.querySelector('[data-title-action="modal-continue"]')?.disabled===false };
  })()`);
  check(initial.selected === '2' && initial.focused === '2' && initial.continueEnabled,
    'NEW-SLOT-INITIAL', `next empty slot is selected, focused, and actionable (${JSON.stringify(initial)})`);

  await click('[data-slot-pick="3"]');
  const changed = await ev(`(() => {
    const row=document.querySelector('[data-slot-pick="3"]')?.closest('.title-slot-row');
    const button=document.querySelector('[data-slot-pick="3"]');
    return { selected:row?.classList.contains('is-selected')===true,
      pressed:button?.getAttribute('aria-pressed')||null,
      focused:button?.classList.contains('gp-focus')===true,
      continueEnabled:document.querySelector('[data-title-action="modal-continue"]')?.disabled===false };
  })()`);
  check(changed.selected && changed.pressed === 'true' && changed.focused && changed.continueEnabled,
    'NEW-SLOT-CHANGE', `slot 3 styling, aria state, focus, and Continue survive rerender (${JSON.stringify(changed)})`);

  await click('[data-title-action="modal-continue"]');
  await until(`!!document.querySelector('#cz-start')`, 'character creation for slot 3');
  await click('#cz-start');
  await until(`!!document.querySelector('#open-menu')`, 'new run map');
  await click('#open-menu');
  await until(`!!document.querySelector('.qn-row[data-act="saveQuit"], #ov-quit')`, 'Save and Quit control');
  const saveQuitSelector = await ev(`document.querySelector('.qn-row[data-act="saveQuit"]') ? '.qn-row[data-act="saveQuit"]' : '#ov-quit'`);
  await click(saveQuitSelector);
  await until(`!!document.querySelector('[data-title-action="load"]')`, 'title after saving slot 3');
  await click('[data-title-action="load"]');
  await until(`!!document.querySelector('.title-menu-modal')`, 'Load Game verification');
  const stored = await ev(`(() => Object.fromEntries([...document.querySelectorAll('[data-slot-pick]')]
    .map((button) => [button.dataset.slotPick, button.classList.contains('is-filled')])))()`);
  check(stored['1'] === true && stored['2'] === false && stored['3'] === true,
    'NEW-SLOT-STORED', `slot 3 alone changed from empty to occupied (${JSON.stringify(stored)})`);

  await cdp.send('Target.closeTarget', { targetId });
  if (!checks) throw new Error('no checks ran');
  if (failures) console.error(`title-new-slot: RED - ${checks - failures}/${checks} checks passed; ${failures} failed`);
  else console.log(`title-new-slot: OK - ${checks} checks passed`);
  console.log('BOUNDARY: source tree, one private headless browser, memory-backed shot storage, 390x844, real pointer presses through title, creation, map, Save and Quit, and Load.');
  process.exitCode = failures ? 1 : 0;
} catch (error) {
  console.error(`title-new-slot: UNKNOWN - ${error.stack || error.message}`);
  process.exitCode = 2;
} finally {
  try { cdp?.close(); } catch { /* already closed */ }
  try { await closeBrowser(); } catch { /* cleanup is reported by browser.mjs */ }
  try { server?.close(); } catch { /* already closed */ }
}
