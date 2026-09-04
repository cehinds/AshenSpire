#!/usr/bin/env node
// Focused acceptance for QA remediation #2: New Game keeps the selected empty
// slot visibly selected, carries that exact slot through creation, and saves the
// new run there without replacing either of the other slots.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { saveSlotSelectionModel } from '../src/ui/models/SaveSlotSelectionModel.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = resolve(ROOT, 'docs', 'preview');
const CAPTURE_SHOTS = process.argv.includes('--screenshots');
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
        find: '        activateSlot(+button.dataset.slotPick);',
        replace: '        activateSlot(+button.dataset.slot); // title-new-slot selftest plant',
        expectRed: /RED NEW-SLOT-CHANGE/,
      },
      {
        name: 'New Game focuses the first row instead of its selected empty slot',
        file: 'src/ui/screens/title.js',
        find: '    focusModal(selectedSlot == null ? undefined : `[data-slot-pick="${selectedSlot}"]`);',
        replace: '    focusModal(); // title-new-slot selftest plant',
        expectRed: /RED NEW-SLOT-INITIAL/,
      },
      {
        name: 'New Game selection model prefers an occupied slot over the first empty slot',
        file: 'src/ui/models/SaveSlotSelectionModel.js',
        find: "records.find((record) => record.selectable && (kind !== 'new' || !record.hasSave))",
        replace: "records.find((record) => record.selectable) // title-new-slot selftest plant",
        expectRed: /RED NEW-SLOT-MODEL-DEFAULT/,
      },
      {
        name: 'primary action targets slot 1 instead of the selected slot',
        file: 'src/ui/models/SaveSlotSelectionModel.js',
        find: '  const actionSlot = selected?.slot ?? null;',
        replace: '  const actionSlot = records[0]?.slot ?? null; // title-new-slot selftest plant',
        expectRed: /RED NEW-SLOT-(?:MODEL-REQUESTED|CHANGE)/,
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
  const modelSlots = [
    { slot: 1, summary: { className: 'Reaver' } },
    { slot: 2, summary: null },
    { slot: 3, summary: null },
  ];
  const newDefault = saveSlotSelectionModel(modelSlots, { kind: 'new' });
  const requested = saveSlotSelectionModel(modelSlots, { kind: 'new', selectedSlot: 3 });
  const invalid = saveSlotSelectionModel(modelSlots, { kind: 'new', selectedSlot: 0 });
  const loadDefault = saveSlotSelectionModel(modelSlots, { kind: 'load' });
  const row = (model, slot) => model.children.find((child) => child.properties.slot === slot);
  check(newDefault.properties.selectedSlot === 2 && newDefault.properties.actionSlot === 2
      && row(newDefault, 2)?.properties.selected === true && Object.isFrozen(newDefault),
    'NEW-SLOT-MODEL-DEFAULT', 'New Game defaults to the first empty slot and freezes the same action target');
  check(requested.properties.selectedSlot === 3 && requested.properties.actionSlot === 3
      && row(requested, 3)?.properties.selected === true,
    'NEW-SLOT-MODEL-REQUESTED', 'a requested empty slot owns selected styling and the primary command target');
  check(invalid.properties.selectedSlot == null && invalid.properties.actionSlot == null
      && invalid.properties.canContinue === false,
    'NEW-SLOT-MODEL-INVALID', 'an explicit invalid selection fails closed instead of targeting another slot');
  check(loadDefault.properties.selectedSlot === 1 && loadDefault.properties.actionSlot === 1
      && row(loadDefault, 2)?.properties.selectable === true,
    'NEW-SLOT-MODEL-LOAD', 'the shared model prefers the occupied Load slot and keeps an empty Load row selectable (it leads to a new game)');

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
  const key = async (keyName, activeSessionId = sessionId) => {
    const vk = keyName === 'Enter' ? 13 : keyName.startsWith('Arrow')
      ? { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 }[keyName]
      : keyName.toUpperCase().charCodeAt(0);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code: keyName, windowsVirtualKeyCode: vk }, activeSessionId);
    await wait(80);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code: keyName, windowsVirtualKeyCode: vk }, activeSessionId);
    await wait(140);
  };
  const screenshot = async (name, activeSessionId = sessionId) => {
    mkdirSync(SHOT_DIR, { recursive: true });
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, activeSessionId);
    const path = resolve(SHOT_DIR, name);
    writeFileSync(path, Buffer.from(data, 'base64'));
    return path;
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
      actionSlot:document.querySelector('[data-title-action="modal-continue"]')?.dataset.actionSlot||null,
      continueEnabled:document.querySelector('[data-title-action="modal-continue"]')?.disabled===false };
  })()`);
  check(initial.selected === '2' && initial.focused === '2' && initial.actionSlot === '2' && initial.continueEnabled,
    'NEW-SLOT-INITIAL', `next empty slot is selected, focused, and actionable (${JSON.stringify(initial)})`);

  await click('[data-slot-pick="3"]');
  const changed = await ev(`(() => {
    const row=document.querySelector('[data-slot-pick="3"]')?.closest('.title-slot-row');
    const button=document.querySelector('[data-slot-pick="3"]');
    return { selected:row?.classList.contains('is-selected')===true,
      pressed:button?.getAttribute('aria-pressed')||null,
      focused:button?.classList.contains('gp-focus')===true,
      actionSlot:document.querySelector('[data-title-action="modal-continue"]')?.dataset.actionSlot||null,
      continueEnabled:document.querySelector('[data-title-action="modal-continue"]')?.disabled===false };
  })()`);
  check(changed.selected && changed.pressed === 'true' && changed.focused && changed.actionSlot === '3' && changed.continueEnabled,
    'NEW-SLOT-CHANGE', `slot 3 styling, aria state, focus, and Continue survive rerender (${JSON.stringify(changed)})`);
  const mobileLayout = await ev(`(() => {
    const modal=document.querySelector('.title-menu-modal')?.getBoundingClientRect();
    const slot=document.querySelector('[data-slot-pick="3"]')?.getBoundingClientRect();
    const action=document.querySelector('[data-title-action="modal-continue"]')?.getBoundingClientRect();
    return {overflow:document.documentElement.scrollWidth-window.innerWidth,
      modal:modal&&{left:modal.left,right:modal.right,top:modal.top,bottom:modal.bottom},
      slot:slot&&{width:slot.width,height:slot.height},action:action&&{width:action.width,height:action.height}};
  })()`);
  check(mobileLayout.overflow <= 0 && mobileLayout.modal?.left >= 0 && mobileLayout.modal?.right <= 390
      && mobileLayout.modal?.top >= 0 && mobileLayout.modal?.bottom <= 844
      && mobileLayout.slot?.width >= 44 && mobileLayout.slot?.height >= 44
      && mobileLayout.action?.width >= 44 && mobileLayout.action?.height >= 44,
    'NEW-SLOT-MOBILE-LAYOUT', `390x844 selected slot and primary action fit at the tap floor (${JSON.stringify(mobileLayout)})`);
  if (CAPTURE_SHOTS) await screenshot('qa-new-slot-selected-mobile-390x844.png');

  await click('[data-title-action="modal-continue"]');
  await until(`!!document.querySelector('[data-title-action="review-new"]')`, 'new-game decision door for slot 3');
  await click('[data-title-action="review-new"]');
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

  const { targetId: desktopTargetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: desktopSessionId } = await cdp.send('Target.attachToTarget', { targetId: desktopTargetId, flatten: true });
  await cdp.send('Page.enable', {}, desktopSessionId);
  await cdp.send('Runtime.enable', {}, desktopSessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1200, height: 730, deviceScaleFactor: 1, mobile: false,
  }, desktopSessionId);
  const desktopEv = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    }, desktopSessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'desktop evaluation failed');
    return result.result.value;
  };
  const desktopUntil = async (expression, label, timeout = 15000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await desktopEv(expression).catch(() => false)) return;
      await wait(60);
    }
    throw new Error(`timeout waiting for desktop ${label}`);
  };
  const desktopClick = async (selector) => {
    const point = await desktopEv(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    if (!point) throw new Error(`missing desktop ${selector}`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }, desktopSessionId);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }, desktopSessionId);
    await wait(120);
  };
  await cdp.send('Page.navigate', { url }, desktopSessionId);
  await desktopUntil(`!!document.querySelector('[data-title-action="new"]')`, 'title');
  await desktopClick('[data-title-action="new"]');
  await desktopUntil(`!!document.querySelector('.title-menu-modal')`, 'New Game slot picker');
  const desktopInitial = await desktopEv(`(() => ({
    selected:document.querySelector('[data-slot-pick][aria-pressed="true"]')?.dataset.slotPick||null,
    focused:document.querySelector('[data-slot-pick].gp-focus')?.dataset.slotPick||null,
    actionSlot:document.querySelector('[data-title-action="modal-continue"]')?.dataset.actionSlot||null,
    enabled:document.querySelector('[data-title-action="modal-continue"]')?.disabled===false
  }))()`);
  check(desktopInitial.selected === '2' && desktopInitial.focused === '2'
      && desktopInitial.actionSlot === '2' && desktopInitial.enabled,
    'NEW-SLOT-DESKTOP-INITIAL', `1200x730 opens on one selected/focused/actionable empty slot (${JSON.stringify(desktopInitial)})`);

  await key('Enter', desktopSessionId);
  const idempotent = await desktopEv(`(() => ({
    selected:document.querySelector('[data-slot-pick][aria-pressed="true"]')?.dataset.slotPick||null,
    focused:document.querySelector('[data-slot-pick].gp-focus')?.dataset.slotPick||null,
    actionSlot:document.querySelector('[data-title-action="modal-continue"]')?.dataset.actionSlot||null
  }))()`);
  check(idempotent.selected === '2' && idempotent.focused === '2' && idempotent.actionSlot === '2',
    'NEW-SLOT-KEY-IDEMPOTENT', `keyboard activation of the selected slot is deterministic (${JSON.stringify(idempotent)})`);

  await key('ArrowDown', desktopSessionId);
  await key('Enter', desktopSessionId);
  const keyboardChanged = await desktopEv(`(() => ({
    selected:document.querySelector('[data-slot-pick][aria-pressed="true"]')?.dataset.slotPick||null,
    focused:document.querySelector('[data-slot-pick].gp-focus')?.dataset.slotPick||null,
    actionSlot:document.querySelector('[data-title-action="modal-continue"]')?.dataset.actionSlot||null,
    enabled:document.querySelector('[data-title-action="modal-continue"]')?.disabled===false
  }))()`);
  check(keyboardChanged.selected === '3' && keyboardChanged.focused === '3'
      && keyboardChanged.actionSlot === '3' && keyboardChanged.enabled,
    'NEW-SLOT-KEY-CHANGE', `keyboard selection moves styling, focus, and command target together (${JSON.stringify(keyboardChanged)})`);
  const desktopLayout = await desktopEv(`(() => {
    const modal=document.querySelector('.title-menu-modal')?.getBoundingClientRect();
    const slot=document.querySelector('[data-slot-pick="3"]')?.getBoundingClientRect();
    const action=document.querySelector('[data-title-action="modal-continue"]')?.getBoundingClientRect();
    return {overflow:document.documentElement.scrollWidth-window.innerWidth,
      modal:modal&&{left:modal.left,right:modal.right,top:modal.top,bottom:modal.bottom},
      slot:slot&&{width:slot.width,height:slot.height},action:action&&{width:action.width,height:action.height}};
  })()`);
  check(desktopLayout.overflow <= 0 && desktopLayout.modal?.left >= 0 && desktopLayout.modal?.right <= 1200
      && desktopLayout.modal?.top >= 0 && desktopLayout.modal?.bottom <= 730
      && desktopLayout.slot?.width >= 44 && desktopLayout.slot?.height >= 44
      && desktopLayout.action?.width >= 44 && desktopLayout.action?.height >= 44,
    'NEW-SLOT-DESKTOP-LAYOUT', `1200x730 selected slot and primary action fit at the tap floor (${JSON.stringify(desktopLayout)})`);
  if (CAPTURE_SHOTS) await screenshot('qa-new-slot-selected-wide-1200x730.png', desktopSessionId);
  await cdp.send('Target.closeTarget', { targetId: desktopTargetId });

  if (!checks) throw new Error('no checks ran');
  if (failures) console.error(`title-new-slot: RED - ${checks - failures}/${checks} checks passed; ${failures} failed`);
  else console.log(`title-new-slot: OK - ${checks} checks passed`);
  console.log('BOUNDARY: source tree, one private headless browser, memory-backed shot storage, 390x844 pointer flow through title/creation/map/Save and Quit/Load plus 1200x730 keyboard selection; no physical controller or real-device Safari.');
  process.exitCode = failures ? 1 : 0;
} catch (error) {
  console.error(`title-new-slot: UNKNOWN - ${error.stack || error.message}`);
  process.exitCode = 2;
} finally {
  try { cdp?.close(); } catch { /* already closed */ }
  try { await closeBrowser(); } catch { /* cleanup is reported by browser.mjs */ }
  try { server?.close(); } catch { /* already closed */ }
}
