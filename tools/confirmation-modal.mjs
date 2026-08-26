#!/usr/bin/env node
// Focused acceptance for QA remediation #4: Load and Quit Without Saving use
// one reversible themed confirmation surface, with the safe action focused.

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
    tool: 'confirmation-modal.mjs',
    timeoutMs: 90000,
    extraCopy: ['assets'],
    includePng: true,
    plants: [
      {
        name: 'Load silently bypasses the shared confirmation',
        file: 'src/main.js',
        find: '  openConfirmationModal({',
        replace: '  void ({ // confirmation-modal selftest plant',
        expectRed: /RED CONFIRMATION-(?:WIDE|MOBILE)-LOAD/,
      },
      {
        name: 'the destructive action receives initial focus',
        file: 'src/ui/components/confirmationModal.js',
        find: '    if (!closed) cancelButton.focus({ preventScroll: true });',
        replace: '    if (!closed) confirmButton.focus({ preventScroll: true }); // confirmation-modal selftest plant',
        expectRed: /RED CONFIRMATION-(?:WIDE|MOBILE)-SAFE-FOCUS/,
      },
      {
        name: 'the underlying overlay consumes the confirmation Escape',
        file: 'src/ui/components/overlay.js',
        find: '      if (topVeil() !== openVeil) return;',
        replace: '      if (false) return; // confirmation-modal selftest plant',
        expectRed: /RED CONFIRMATION-(?:WIDE|MOBILE)-LAYERED-ESCAPE/,
      },
      {
        name: 'cancelling commits the destructive callback',
        file: 'src/ui/components/confirmationModal.js',
        find: '  const cancel = () => {\n    if (closed) return;\n    close();\n    onCancel();\n  };',
        replace: '  const cancel = () => {\n    if (closed) return;\n    close();\n    onConfirm?.(); // confirmation-modal selftest plant\n    onCancel();\n  };',
        expectRed: /RED CONFIRMATION-(?:WIDE|MOBILE)-CANCEL-NO-MUTATION/,
      },
      {
        name: 'the destructive callback can commit twice',
        file: 'src/ui/components/confirmationModal.js',
        find: "  confirmButton.addEventListener('click', () => {\n    if (closed) return;",
        replace: "  confirmButton.addEventListener('click', () => {\n    // confirmation-modal selftest plant: closed guard removed",
        expectRed: /RED CONFIRMATION-(?:WIDE|MOBILE)-EXACT-COMMIT/,
      },
      {
        name: 'cancellation no longer restores the invoking control',
        file: 'src/ui/components/confirmationModal.js',
        find: '      returnFocusElement.focus({ preventScroll: true });',
        replace: '      void returnFocusElement; // confirmation-modal selftest plant',
        expectRed: /RED CONFIRMATION-(?:WIDE|MOBILE)-FOCUS-RETURN/,
      },
      {
        name: 'actions shrink and force the dialog beyond its viewport',
        file: 'styles/ui.css',
        find: '  min-height: var(--tap-floor); height: auto; padding: 0.55rem 1rem;',
        replace: '  min-height: 10px; height: 12px; width: 120vw; padding: 0; /* confirmation-modal selftest plant */',
        expectRed: /RED CONFIRMATION-(?:WIDE|MOBILE|COMPACT)-LAYOUT/,
      },
    ],
  });
  process.exit(code);
}

function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method) listeners.forEach((listener) => listener(message));
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
    onEvent(listener) { listeners.add(listener); return () => listeners.delete(listener); },
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
  const served = await serve({ root: ROOT, port: 8254, open: false });
  server = served.server;
  const launched = await launchBrowser({ prefix: 'confirmation-modal-', browser: browserPath, headless: '--headless=new', timeoutMs: 20000 });
  closeBrowser = launched.close;
  cdp = connectCdp(launched.wsUrl);
  await cdp.ready;

  const runViewport = async ({ width, height, mobile, label }) => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Log.enable', {}, sessionId);
    await cdp.send('Network.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile }, sessionId);
    const diagnostics = { console: [], network: [] };
    const releaseEvents = cdp.onEvent((message) => {
      if (message.sessionId !== sessionId) return;
      if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) {
        diagnostics.console.push(`${message.params.type}: ${message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ')}`);
      }
      if (message.method === 'Log.entryAdded' && ['warning', 'error'].includes(message.params.entry.level)) {
        diagnostics.console.push(`${message.params.entry.level}: ${message.params.entry.text}`);
      }
      if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
        diagnostics.network.push(`${message.params.response.status} ${message.params.response.url}`);
      }
      if (message.method === 'Network.loadingFailed' && !message.params.canceled) {
        diagnostics.network.push(`${message.params.errorText} ${message.params.requestId}`);
      }
    });

    const ev = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
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
    const key = async (keyName) => {
      const vk = keyName === 'Escape' ? 27 : keyName === 'Tab' ? 9 : keyName.toUpperCase().charCodeAt(0);
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
    const modalState = () => ev(`(() => {
      const q=(s)=>document.querySelector(s); const rect=(e)=>{const r=e?.getBoundingClientRect();return r&&{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
      const d=q('.confirmation-modal'), back=q('.confirmation-cancel'), commit=q('.confirmation-confirm');
      return {role:d?.getAttribute('role'),modal:d?.getAttribute('aria-modal'),component:d?.dataset.uiComponent,
        title:q('#confirmation-modal-title')?.textContent,copy:q('#confirmation-modal-copy')?.textContent,
        consequence:q('.confirmation-eyebrow')?.textContent,back:back?.textContent,commit:commit?.textContent,
        cancel:back?.dataset.uiComponent,action:commit?.dataset.uiComponent,active:document.activeElement?.className || document.activeElement?.id,
        dialog:rect(d),backRect:rect(back),commitRect:rect(commit),
        overflowX:document.documentElement.scrollWidth-window.innerWidth,
        overflowY:document.documentElement.scrollHeight-window.innerHeight};
    })()`);

    const entry = ARTIFACT ? 'AshenSpire.html' : '';
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${served.port}/${entry}?shot=map` }, sessionId);
    await until(`!!document.querySelector('#open-menu')`, 'map boot');
    await ev(`window.__qaConfirmationCommits=0; window.addEventListener('ashenspire:confirmation-commit',()=>{window.__qaConfirmationCommits+=1;}); true`);

    await click('#open-menu');
    await until(`!!document.querySelector('.qn-row[data-act="load"]')`, 'Load command');
    await click('.qn-row[data-act="load"]');
    try {
      await until(`!!document.querySelector('.confirmation-modal')`, 'Load confirmation');
    } catch (error) {
      check(false, `CONFIRMATION-${label}-LOAD`, 'Load did not open the shared confirmation');
      throw error;
    }
    await wait(80);
    const load = await modalState();
    check(load.role === 'alertdialog' && load.modal === 'true' && load.component === 'confirmation-modal'
        && load.cancel === 'confirmation-cancel-control' && load.action === 'confirmation-action' && load.title === 'Load slot 1?'
        && load.consequence === 'DISCARDS UNSAVED CHANGES' && load.back === 'Back' && load.commit === 'Load saved run',
      `CONFIRMATION-${label}-LOAD`, `Load is an explicit reversible alertdialog (${JSON.stringify(load)})`);
    check(String(load.active).includes('confirmation-cancel'), `CONFIRMATION-${label}-SAFE-FOCUS`, 'Back owns initial focus');
    check(load.overflowX <= 0 && load.overflowY <= 0 && load.dialog?.left >= 0 && load.dialog?.right <= width
        && load.dialog?.top >= 0 && load.dialog?.bottom <= height
        && load.backRect?.width >= 44 && load.backRect?.height >= 44
        && load.commitRect?.width >= 44 && load.commitRect?.height >= 44,
      `CONFIRMATION-${label}-LAYOUT`, `${width}x${height} modal and actions fit the viewport and meet the 44 px input floor`);
    if (CAPTURE_SHOTS) await screenshot(`qa-confirmation-load-${label.toLowerCase()}-${width}x${height}.png`);
    await key('Escape');
    await until(`!document.querySelector('.confirmation-modal')`, 'Load cancellation');
    check(await ev(`!!document.querySelector('#open-menu') && !document.querySelector('[data-title-action="new"]')`),
      `CONFIRMATION-${label}-CANCEL-NO-MUTATION`, 'cancelling Load keeps the current map run');
    check(await ev(`document.activeElement?.id === 'open-menu'`),
      `CONFIRMATION-${label}-FOCUS-RETURN`, 'Escape restores the map menu trigger');

    await click('#open-menu');
    await until(`!!document.querySelector('.qn-row[data-act="quit"]')`, 'Quit command');
    await click('.qn-row[data-act="quit"]');
    await until(`!!document.querySelector('.confirmation-modal')`, 'Quit confirmation');
    await wait(80);
    const quit = await modalState();
    check(quit.title === 'Quit without saving?' && quit.consequence === 'LEAVES THE RUN'
        && quit.back === 'Back' && quit.commit === 'Quit without saving'
        && quit.copy.includes('existing save slot'),
      `CONFIRMATION-${label}-QUIT`, `Quit names the consequence and preserves the safe Back action (${JSON.stringify(quit)})`);
    if (CAPTURE_SHOTS) await screenshot(`qa-confirmation-quit-${label.toLowerCase()}-${width}x${height}.png`);
    await key('Escape');
    await until(`!document.querySelector('.confirmation-modal')`, 'Quit cancellation');
    check(await ev(`!!document.querySelector('#open-menu') && !document.querySelector('[data-title-action="new"]')`),
      `CONFIRMATION-${label}-CANCEL-NO-MUTATION`, 'cancelling Quit does not leave or mutate the current run');
    check(await ev(`document.activeElement?.id === 'open-menu'`),
      `CONFIRMATION-${label}-FOCUS-RETURN`, 'Escape restores focus after Quit cancellation');

    await click('#open-menu');
    await click('.qn-row[data-act="tab"][data-tab="settings"]');
    await until(`!!document.querySelector('.overlay-modal')`, 'Settings overlay');
    const overlayLauncher = await ev(`document.querySelector('#ov-quicknav') ? '#ov-quicknav' : '#ov-switch'`);
    await click(overlayLauncher);
    await until(`!!document.querySelector('.qn-row[data-act="quit"]')`, 'overlay Quit command');
    await click('.qn-row[data-act="quit"]');
    await until(`!!document.querySelector('.confirmation-modal')`, 'layered confirmation');
    await key('Escape');
    await until(`!document.querySelector('.confirmation-modal')`, 'layered confirmation cancel');
    check(await ev(`!!document.querySelector('.overlay-modal') && document.activeElement?.matches(${JSON.stringify(overlayLauncher)})`),
      `CONFIRMATION-${label}-LAYERED-ESCAPE`, 'one Escape closes only the top confirmation and restores the overlay launcher');
    await key('Escape');
    await until(`!document.querySelector('.overlay-modal')`, 'overlay close');

    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${served.port}/${entry}?shot=combat` }, sessionId);
    await until(`!!document.querySelector('#combat-menu') && !!window.__combat`, 'combat boot');
    await ev(`window.__qaConfirmationCommits=0; window.addEventListener('ashenspire:confirmation-commit',()=>{window.__qaConfirmationCommits+=1;}); true`);
    await click('#combat-menu');
    await until(`!!document.querySelector('.qn-row[data-act="load"]')`, 'combat Load command');
    await click('.qn-row[data-act="load"]');
    await until(`!!document.querySelector('.confirmation-modal')`, 'combat Load confirmation');
    const combatLoad = await modalState();
    check(combatLoad.title === 'Load slot 1?' && combatLoad.cancel === 'confirmation-cancel-control'
        && combatLoad.action === 'confirmation-action',
      `CONFIRMATION-${label}-COMBAT-LOAD`, 'Combat Load enters the same shared confirmation contract');
    await key('Escape');
    await until(`!document.querySelector('.confirmation-modal')`, 'combat Load cancellation');
    check(await ev(`!!window.__combat && document.activeElement?.id === 'combat-menu'`),
      `CONFIRMATION-${label}-COMBAT-LOAD-BACK`, 'Combat Load cancellation keeps combat and restores its launcher');

    await click('#combat-menu');
    await click('.qn-row[data-act="quit"]');
    await until(`!!document.querySelector('.confirmation-modal')`, 'combat Quit confirmation');
    const combatQuit = await modalState();
    check(combatQuit.title === 'Quit without saving?' && combatQuit.dialog?.bottom <= height
        && combatQuit.overflowX <= 0 && combatQuit.overflowY <= 0,
      `CONFIRMATION-${label}-COMBAT-QUIT`, 'Combat Quit reuses the same fitting themed confirmation');
    if (CAPTURE_SHOTS) await screenshot(`qa-confirmation-combat-quit-${label.toLowerCase()}-${width}x${height}.png`);
    await key('Escape');
    await until(`!document.querySelector('.confirmation-modal')`, 'combat Quit cancellation');
    check(await ev(`!!window.__combat && document.activeElement?.id === 'combat-menu' && window.__qaConfirmationCommits === 0`),
      `CONFIRMATION-${label}-COMBAT-QUIT-BACK`, 'Combat Quit cancellation is mutation-free and restores its launcher');

    await click('#combat-menu');
    await click('.qn-row[data-act="quit"]');
    await until(`!!document.querySelector('.confirmation-confirm')`, 'final combat Quit confirmation');
    const beforeCommit = await ev(`window.__qaConfirmationCommits`);
    await ev(`(() => { const button=document.querySelector('.confirmation-confirm'); button.click(); button.click(); return true; })()`);
    await until(`!!document.querySelector('[data-title-action="new"]')`, 'title after confirmed Quit');
    const afterCommit = await ev(`window.__qaConfirmationCommits`);
    check(beforeCommit === 0 && afterCommit === 1, `CONFIRMATION-${label}-EXACT-COMMIT`,
      `no early commit and repeated activation commits exactly once (${beforeCommit} -> ${afterCommit})`);

    const unexpectedConsole = diagnostics.console.filter((entry) => !entry.includes('AudioContext was not allowed to start')
      && !entry.includes('Failed to load resource: the server responded with a status of 404'));
    const unexpectedNetwork = diagnostics.network.filter((entry) => !/\/favicon\.ico(?:\s|$)/.test(entry)
      && !/\/api\/lan\/info(?:\s|$)/.test(entry));
    check(unexpectedConsole.length === 0 && unexpectedNetwork.length === 0,
      `CONFIRMATION-${label}-DIAGNOSTICS`, `captured console warnings/errors ${diagnostics.console.length}`
        + ` (${unexpectedConsole.length} unexpected); network failures ${diagnostics.network.length}`
        + ` (${unexpectedNetwork.length} unexpected)`
        + `${unexpectedConsole.length || unexpectedNetwork.length ? ` (${JSON.stringify({ unexpectedConsole, unexpectedNetwork })})` : ''}`);

    releaseEvents();
    await cdp.send('Target.closeTarget', { targetId });
  };

  await runViewport({ width: 1200, height: 730, mobile: false, label: 'WIDE' });
  await runViewport({ width: 390, height: 844, mobile: true, label: 'MOBILE' });
  await runViewport({ width: 320, height: 640, mobile: true, label: 'COMPACT' });
} catch (error) {
  failures += 1;
  console.error(`RED CONFIRMATION-DOOR - ${error.stack || error.message}`);
} finally {
  try { cdp?.close(); } catch { /* best effort socket close */ }
  try { await closeBrowser(); } catch (error) { console.error(`BROWSER CLEANUP WARNING ${error.message}`); }
  if (server) await new Promise((done) => server.close(done));
}

console.log(`confirmation-modal: ${checks - failures}/${checks} checks passed${ARTIFACT ? ' against shipped AshenSpire.html' : ' against source'}; ${failures} failed`);
process.exit(failures ? 1 : 0);
