#!/usr/bin/env node
// Focused browser acceptance for QA remediation #5: while a Controls keyboard
// rebind is armed, Escape cancels that capture and belongs to no lower layer.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = resolve(ROOT, 'docs', 'preview');
const ARTIFACT = process.argv.includes('--artifact');
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
    tool: 'rebind-capture.mjs',
    timeoutMs: 90000,
    extraCopy: ['assets'],
    includePng: true,
    plants: [
      {
        name: 'Escape is accepted as the captured binding',
        file: 'src/ui/input.js',
        find: "    if (k === 'Escape') {",
        replace: "    if (false && k === 'Escape') { // rebind-capture selftest plant",
        expectRed: /RED REBIND-(?:WIDE|MOBILE)-ESCAPE-CANCEL/,
      },
      {
        name: 'Escape reaches later capture listeners on the same target',
        file: 'src/ui/input.js',
        find: '    // Controls overlay. Capture owns the whole keydown until it settles.\n    ev.stopImmediatePropagation();\n    const capture = keyCapture;',
        replace: '    // Controls overlay. Capture owns the whole keydown until it settles.\n    ev.stopPropagation(); // rebind-capture selftest plant\n    const capture = keyCapture;',
        expectRed: /RED REBIND-(?:WIDE|MOBILE)-ESCAPE-OWNERSHIP/,
      },
      {
        name: 'cancelled capture leaves the armed UI standing',
        file: 'src/ui/screens/controls.js',
        find: "        reset(btn, 'Key');\n        btn.focus({ preventScroll: true });",
        replace: "        void btn; // rebind-capture selftest plant",
        expectRed: /RED REBIND-(?:WIDE|MOBILE)-ESCAPE-RESET/,
      },
      {
        name: 'a lone modifier is accepted as a binding',
        file: 'src/ui/input.js',
        find: "    if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta') return;",
        replace: "    if (false) return; // rebind-capture selftest plant",
        expectRed: /RED REBIND-(?:WIDE|MOBILE)-MODIFIER/,
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
  const served = await serve({ root: ROOT, port: 8255, open: false });
  server = served.server;
  const launched = await launchBrowser({
    prefix: 'rebind-capture-',
    browser: browserPath,
    headless: '--headless=new',
    timeoutMs: 20000,
  });
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
      const clicked = await ev(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false; e.click(); return true; })()`);
      if (!clicked) throw new Error(`missing ${selector}`);
      await wait(160);
    };
    const key = async (keyName, code = keyName, vk = keyName.length === 1 ? keyName.toUpperCase().charCodeAt(0) : 0) => {
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: vk }, sessionId);
      await wait(70);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: vk }, sessionId);
      await wait(180);
    };
    const screenshot = async (name) => {
      mkdirSync(SHOT_DIR, { recursive: true });
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, sessionId);
      const path = resolve(SHOT_DIR, name);
      writeFileSync(path, Buffer.from(data, 'base64'));
      return path;
    };
    const state = () => ev(`(() => {
      const button=document.querySelector('.rebind-key[data-action="endTurn"]');
      const badge=document.querySelector('.key-btn[data-keyfor="endTurn"]');
      const modal=document.querySelector('.overlay-modal');
      const body=document.querySelector('.overlay-body');
      const rect=button?.getBoundingClientRect();
      return {
        overlay:!!modal,
        map:!!document.querySelector('.mapscreen'),
        controls:!!document.querySelector('.rebind-list'),
        activeTab:document.querySelector('.ov-tab.on')?.dataset.member || document.querySelector('#ov-switch')?.textContent || '',
        label:button?.textContent || '',
        listening:button?.classList.contains('listening') || false,
        focused:document.activeElement===button,
        component:button?.dataset.uiComponent || '',
        binding:badge?.textContent || '',
        downstream:window.__qaRebindDownstream || 0,
        buttonRect:rect&&{width:rect.width,height:rect.height,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},
        overflowX:Math.max(0,document.documentElement.scrollWidth-innerWidth),
        overflowY:Math.max(0,(body?.scrollWidth||0)-(body?.clientWidth||0)),
      };
    })()`);
    const openControls = async () => {
      await click('#open-menu');
      await until(`!!document.querySelector('.qn-row[data-act="tab"][data-tab="controls"]')`, 'Controls quick-nav row');
      await click('.qn-row[data-act="tab"][data-tab="controls"]');
      await until(`!!document.querySelector('.rebind-key[data-action="endTurn"]')`, 'Controls rebind list');
    };

    const entry = ARTIFACT ? 'AshenSpire.html' : '';
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${served.port}/${entry}?shot=map` }, sessionId);
    await until(`!!document.querySelector('#open-menu')`, 'map boot');
    await ev(`window.__qaRebindDownstream=0; addEventListener('keydown',(event)=>{if(event.key==='Escape')window.__qaRebindDownstream+=1;},true); true`);
    await openControls();
    const initial = await state();
    check(initial.controls && initial.component === 'controls-key-rebind-control', `REBIND-${label}-CONTRACT`, `Controls exposes the stable keyboard-rebind control (${JSON.stringify(initial)})`);
    check(initial.overflowX === 0 && initial.overflowY === 0 && initial.buttonRect?.left >= 0 && initial.buttonRect?.right <= width,
      `REBIND-${label}-LAYOUT`, `${width}x${height} Controls and the rebind target fit horizontally`);

    await click('.rebind-key[data-action="endTurn"]');
    await key('Shift', 'ShiftLeft', 16);
    const modifier = await state();
    check(modifier.overlay && modifier.controls && modifier.listening && modifier.label === 'Press…' && modifier.binding === initial.binding,
      `REBIND-${label}-MODIFIER`, `lone Shift leaves capture armed and binding unchanged (${JSON.stringify(modifier)})`);

    await key('Escape', 'Escape', 27);
    const cancelled = await state();
    check(cancelled.overlay && cancelled.controls && cancelled.binding === initial.binding,
      `REBIND-${label}-ESCAPE-CANCEL`, `armed Escape performs zero visible binding mutation and keeps Controls open (${JSON.stringify(cancelled)})`);
    check(!cancelled.listening && cancelled.label === 'Key' && cancelled.focused,
      `REBIND-${label}-ESCAPE-RESET`, 'armed Escape resets Press… and restores focus to the same rebind control');
    check(cancelled.downstream === 0,
      `REBIND-${label}-ESCAPE-OWNERSHIP`, `armed Escape reached no later capture listener (${cancelled.downstream})`);
    if (CAPTURE_SHOTS) await screenshot(`qa-rebind-escape-cancel-${label.toLowerCase()}-${width}x${height}.png`);

    if (!cancelled.controls) await openControls();
    await click('.rebind-key[data-action="endTurn"]');
    await key('v', 'KeyV', 86);
    const rebound = await state();
    check(rebound.overlay && rebound.controls && !rebound.listening && rebound.binding === 'V' && rebound.focused,
      `REBIND-${label}-REARM`, `re-arm accepts free key V and returns to a settled focused control (${JSON.stringify(rebound)})`);

    await key('Escape', 'Escape', 27);
    const closed = await state();
    check(!closed.overlay && closed.map,
      `REBIND-${label}-UNARMED-ESCAPE`, 'a later unarmed Escape closes exactly the Controls overlay and leaves the map');
    const unexpectedConsole = diagnostics.console.filter((entry) =>
      !entry.includes('The AudioContext was not allowed to start')
      && !entry.includes('Failed to load resource: the server responded with a status of 404'));
    const unexpectedNetwork = diagnostics.network.filter((entry) => !entry.endsWith('/favicon.ico'));
    check(unexpectedConsole.length === 0 && unexpectedNetwork.length === 0,
      `REBIND-${label}-DIAGNOSTICS`, `unexpected console/network events ${unexpectedConsole.length}/${unexpectedNetwork.length}; ignored autoplay/favicon ${diagnostics.console.length - unexpectedConsole.length}/${diagnostics.network.length - unexpectedNetwork.length}`);

    releaseEvents();
    await cdp.send('Target.closeTarget', { targetId });
  };

  await runViewport({ width: 1200, height: 730, mobile: false, label: 'WIDE' });
  await runViewport({ width: 390, height: 844, mobile: true, label: 'MOBILE' });
} catch (error) {
  failures += 1;
  console.error(`RED REBIND-DOOR - ${error.stack || error.message}`);
} finally {
  try { cdp?.close(); } catch { /* best effort socket close */ }
  try { await closeBrowser(); } catch (error) { console.error(`BROWSER CLEANUP WARNING ${error.message}`); }
  if (server) await new Promise((done) => server.close(done));
}

console.log(`rebind-capture: ${checks - failures}/${checks} checks passed${ARTIFACT ? ' against shipped AshenSpire.html' : ' against source'}; ${failures} failed`);
process.exit(failures ? 1 : 0);
