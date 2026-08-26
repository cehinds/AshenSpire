#!/usr/bin/env node
// Focused acceptance for QA remediation #6: rebinding to an occupied key or
// pad button pauses before mutation and offers Choose another / Replace /
// Cancel through one shared, accessible conflict dialog.

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
    tool: 'binding-conflict.mjs',
    timeoutMs: 60000,
    plants: [
      {
        name: 'the conflict model refuses the occupied binding',
        file: 'src/ui/models/BindingConflictModel.js',
        find: '  if (!conflict) return null;',
        replace: '  if (conflict) return null; // binding-conflict selftest plant',
        expectRed: /RED CONFLICT-PAUSES/,
      },
      {
        name: 'Replace leaves the prior owner bound to the same input',
        file: 'src/ui/screens/controls.js',
        find: '    if (conflictId) next[conflictId] = null;',
        replace: '    if (conflictId) next[conflictId] = next[conflictId]; // binding-conflict selftest plant',
        expectRed: /RED CONFLICT-REPLACE/,
      },
      {
        name: 'Choose another does not rearm capture',
        file: 'src/ui/screens/controls.js',
        find: '        listenAgain(btn);',
        replace: '        // binding-conflict selftest plant: capture was not rearmed',
        expectRed: /RED CONFLICT-CHOOSE/,
      },
    ],
  });
  process.exit(code);
}

let failures = 0;
let checks = 0;
function check(ok, code, detail) {
  checks += 1;
  if (ok) console.log(`PASS ${code} - ${detail}`);
  else { failures += 1; console.error(`RED ${code} - ${detail}`); }
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

let server;
let serverPort;
let cdp;
let closeBrowser = async () => {};
try {
  let conflictModel = null;
  try {
    ({ bindingConflictModel: conflictModel } = await import('../src/ui/models/BindingConflictModel.js'));
  } catch { /* RED is reported below; the browser checks still run. */ }
  check(typeof conflictModel === 'function', 'CONFLICT-MODEL',
    'a shared DOM-free BindingConflictModel is exported');
  if (conflictModel) {
    const actions = [
      { id: 'endTurn', label: 'End Turn', defKey: 'e', defBtn: 2 },
      { id: 'flask1', label: 'Use Flask 1', defKey: 'f', defBtn: 6 },
    ];
    const keyModel = conflictModel({
      family: 'keyboard', actionId: 'endTurn', value: 'f',
      bindings: { endTurn: 'e', flask1: 'f' }, actions,
    });
    const padModel = conflictModel({
      family: 'controller', actionId: 'endTurn', value: 6,
      bindings: { endTurn: 2, flask1: 6 }, actions,
    });
    check(keyModel?.properties?.conflictActionId === 'flask1'
      && keyModel?.properties?.candidateLabel === 'F', 'KEY-MODEL',
    `keyboard conflict names the occupied action and candidate (${JSON.stringify(keyModel?.properties)})`);
    check(padModel?.properties?.conflictActionId === 'flask1'
      && padModel?.properties?.candidateLabel, 'PAD-MODEL',
    `controller conflict uses the same decision model (${JSON.stringify(padModel?.properties)})`);
  } else {
    check(false, 'KEY-MODEL', 'keyboard conflict model is unavailable');
    check(false, 'PAD-MODEL', 'controller conflict model is unavailable');
  }

  if (!browserPath) throw new Error('no supported Chrome or Edge binary found');
  ({ server, port: serverPort } = await serve({ root: ROOT, port: 8256, open: false }));
  const launched = await launchBrowser({
    prefix: 'binding-conflict-', browser: browserPath,
    headless: '--headless=new', timeoutMs: 20000,
  });
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
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description
      || result.exceptionDetails.text || 'evaluation failed');
    return result.result.value;
  };
  const until = async (expression, label, timeout = 15000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await ev(expression).catch(() => false)) return true;
      await wait(60);
    }
    return false;
  };
  const click = async (selector) => {
    const point = await ev(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    if (!point) throw new Error(`missing ${selector}`);
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1,
    }, sessionId);
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1,
    }, sessionId);
    await wait(100);
  };
  const key = async (value, code) => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code }, sessionId);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code }, sessionId);
    await wait(120);
  };
  const openControls = async () => {
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/?shot=map&qa=06` }, sessionId);
    if (!await until(`!!document.querySelector('#open-menu')`, 'map menu')) return false;
    await click('#open-menu');
    if (!await until(`!!document.querySelector('.qn-row[data-tab="controls"]')`, 'quick Controls row')) return false;
    await click('.qn-row[data-tab="controls"]');
    return until(`!!document.querySelector('.rebind-key[data-action="endTurn"]')`, 'Controls bindings');
  };
  const armConflict = async () => {
    await click('.rebind-key[data-action="endTurn"]');
    await key('f', 'KeyF');
    await wait(120);
    return ev(`!!document.querySelector('.binding-conflict-dialog')`);
  };

  // Cancel: no binding mutates, and the armed control gets focus back.
  check(await openControls(), 'CONTROLS-OPEN', 'the real Map -> Controls route opens');
  const cancelDialog = await armConflict();
  check(cancelDialog, 'CONFLICT-PAUSES', 'an occupied key opens a decision dialog before mutation');
  if (cancelDialog) {
    const dialog = await ev(`(() => { const d=document.querySelector('.binding-conflict-dialog'); const r=d.getBoundingClientRect();
      const bs=[...d.querySelectorAll('button')]; return {role:d.getAttribute('role'), modal:d.getAttribute('aria-modal'),
      text:d.innerText.replace(/\\s+/g,' ').trim(), labels:bs.map(b=>b.textContent.trim()),
      minButton:Math.min(...bs.map(b=>b.getBoundingClientRect().height)), onScreen:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,
      overflow:document.documentElement.scrollWidth>innerWidth}; })()`);
    check(dialog.role === 'dialog' && dialog.modal === 'true'
      && /End Turn/.test(dialog.text) && /Use Flask 1/.test(dialog.text)
      && ['Choose another', 'Replace', 'Cancel'].every((label) => dialog.labels.includes(label)),
    'CONFLICT-COPY', `dialog names both actions and all decisions (${JSON.stringify(dialog)})`);
    check(dialog.minButton >= 44 && dialog.onScreen && !dialog.overflow,
      'CONFLICT-MOBILE', `390x844 dialog is reachable without bleed (${JSON.stringify(dialog)})`);
    await click('.binding-conflict-cancel');
    const cancelled = await ev(`(() => ({
      end:document.querySelector('.key-btn[data-keyfor="endTurn"]')?.textContent.trim(),
      flask:document.querySelector('.key-btn[data-keyfor="flask1"]')?.textContent.trim(),
      closed:!document.querySelector('.binding-conflict-dialog'),
      focused:document.activeElement?.matches('.rebind-key[data-action="endTurn"]')===true,
      overlay:!!document.querySelector('.overlay-modal'),
    }))()`);
    check(cancelled.end === 'E' && cancelled.flask === 'F' && cancelled.closed
      && cancelled.focused && cancelled.overlay, 'CONFLICT-CANCEL',
    `Cancel preserves both bindings, returns focus, and keeps Controls open (${JSON.stringify(cancelled)})`);
  } else {
    check(false, 'CONFLICT-COPY', 'conflict dialog never opened');
    check(false, 'CONFLICT-MOBILE', 'conflict dialog never opened');
    check(false, 'CONFLICT-CANCEL', 'conflict dialog never opened');
  }

  // Choose another: the same control stays armed and accepts a free key.
  check(await openControls(), 'CHOOSE-OPEN', 'Controls reopens for Choose another');
  const chooseDialog = await armConflict();
  if (chooseDialog) {
    await click('.binding-conflict-choose');
    const rearmed = await ev(`(() => ({
      listening:document.querySelector('.rebind-key[data-action="endTurn"]')?.classList.contains('listening')===true,
      focused:document.activeElement?.matches('.rebind-key[data-action="endTurn"]')===true,
      closed:!document.querySelector('.binding-conflict-dialog'),
    }))()`);
    await key('x', 'KeyX');
    const chosen = await ev(`(() => ({
      end:document.querySelector('.key-btn[data-keyfor="endTurn"]')?.textContent.trim(),
      flask:document.querySelector('.key-btn[data-keyfor="flask1"]')?.textContent.trim(),
      listening:document.querySelector('.rebind-key[data-action="endTurn"]')?.classList.contains('listening')===true,
    }))()`);
    check(rearmed.listening && rearmed.focused && rearmed.closed && chosen.end === 'X'
      && chosen.flask === 'F' && !chosen.listening, 'CONFLICT-CHOOSE',
    `Choose another rearms the same action and accepts a free key (${JSON.stringify({ rearmed, chosen })})`);
  } else check(false, 'CONFLICT-CHOOSE', 'conflict dialog never opened');

  // Replace: target receives the key and the former owner becomes explicitly unbound.
  check(await openControls(), 'REPLACE-OPEN', 'Controls reopens for Replace');
  const replaceDialog = await armConflict();
  if (replaceDialog) {
    await click('.binding-conflict-replace');
    const replaced = await ev(`(() => ({
      end:document.querySelector('.key-btn[data-keyfor="endTurn"]')?.textContent.trim(),
      flask:document.querySelector('.key-btn[data-keyfor="flask1"]')?.textContent.trim(),
      closed:!document.querySelector('.binding-conflict-dialog'),
      focused:document.activeElement?.matches('.rebind-key[data-action="endTurn"]')===true,
      overlay:!!document.querySelector('.overlay-modal'),
    }))()`);
    check(replaced.end === 'F' && replaced.flask === '—' && replaced.closed
      && replaced.focused && replaced.overlay, 'CONFLICT-REPLACE',
    `Replace transfers the key, visibly unbinds its former owner, and keeps Controls open (${JSON.stringify(replaced)})`);
  } else check(false, 'CONFLICT-REPLACE', 'conflict dialog never opened');

  await cdp.send('Target.closeTarget', { targetId });
  if (!checks) throw new Error('no checks ran');
  if (failures) console.error(`binding-conflict: RED - ${checks - failures}/${checks} checks passed; ${failures} failed`);
  else console.log(`binding-conflict: OK - ${checks} checks passed`);
  console.log('BOUNDARY: source tree, one private headless browser, 390x844, real pointer/key input through Map -> quick menu -> Controls; browser pad injection is not claimed, so controller parity is model-level in this focused door.');
  process.exitCode = failures ? 1 : 0;
} catch (error) {
  console.error(`binding-conflict: UNKNOWN - ${error.stack || error.message}`);
  process.exitCode = 2;
} finally {
  try { cdp?.close(); } catch { /* already closed */ }
  try { await closeBrowser(); } catch { /* cleanup is reported by browser.mjs */ }
  try { server?.close(); } catch { /* already closed */ }
}
