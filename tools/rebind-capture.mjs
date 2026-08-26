#!/usr/bin/env node
// Focused browser acceptance for QA remediation #5 and #18: capture ownership
// stays intact while the shared Settings/Controls host has one scroll owner,
// resets at every view entry, and keeps every rebind target finger-sized.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = process.env.QA18_EVIDENCE_DIR
  ? resolve(process.env.QA18_EVIDENCE_DIR)
  : resolve(ROOT, 'docs', 'preview');
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
      {
        name: 'Settings ownership leaks into the Controls host',
        file: 'src/ui/components/overlay.js',
        find: "    body.removeAttribute('data-settings-host');",
        replace: "    void body; // rebind-capture selftest plant: stale Settings host",
        expectRed: /RED REBIND-(?:WIDE|TABLET|MOBILE|NARROW)-CYCLE-1-CONTROLS/,
      },
      {
        name: 'view dispatch leaves a non-zero overlay scroll offset',
        file: 'src/ui/components/overlay.js',
        find: '    body.scrollTop = 0;',
        replace: '    setTimeout(() => { body.scrollTop = 1; }, 0); // rebind-capture selftest plant: stale view offset',
        expectRed: /RED REBIND-(?:WIDE|TABLET|MOBILE|NARROW)-CYCLE-1-(?:SETTINGS|CONTROLS)/,
      },
      {
        name: 'rebind controls lose the shared tap floor',
        file: 'styles/ui.css',
        find: '  min-width: var(--tap-floor); min-height: var(--tap-floor);',
        replace: '  min-width: 0; min-height: 0; /* rebind-capture selftest plant */',
        expectRed: /RED REBIND-(?:WIDE|TABLET|MOBILE|NARROW)-TARGETS/,
      },
      {
        name: 'Controls gains a nested vertical scroll owner',
        file: 'styles/ui.css',
        find: '.rebind-list { display: flex; flex-direction: column; }',
        replace: '.rebind-list { display: flex; flex-direction: column; max-height: 12rem; overflow-y: auto; /* rebind-capture selftest plant */ }',
        expectRed: /RED REBIND-(?:WIDE|TABLET|MOBILE|NARROW)-SCROLL-OWNER/,
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
  const served = await serve({ root: ROOT, port: 8271, open: false });
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
    const tab = async (backward = false) => {
      const modifiers = backward ? 8 : 0;
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers,
      }, sessionId);
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers,
      }, sessionId);
      await wait(45);
    };
    const wheel = async (deltaY) => {
      const point = await ev(`(() => { const r=document.querySelector('.overlay-body')?.getBoundingClientRect(); return r&&{x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      if (!point) throw new Error('missing overlay body for wheel');
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: point.x, y: point.y, deltaX: 0, deltaY }, sessionId);
      await wait(120);
    };
    const touchSwipe = async (up = true) => {
      const point = await ev(`(() => { const r=document.querySelector('.overlay-body')?.getBoundingClientRect(); return r&&{x:r.left+r.width/2,top:r.top+20,bottom:r.bottom-20}; })()`);
      if (!point) throw new Error('missing overlay body for touch');
      const startY = up ? point.bottom : point.top;
      const endY = up ? point.top : point.bottom;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: startY }] }, sessionId);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: endY }] }, sessionId);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId);
      await wait(160);
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
      const bodyRect=body?.getBoundingClientRect();
      const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      const cleanRect=(r)=>r&&({width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom});
      const controls=[...document.querySelectorAll('.rebind-btn')];
      const controlRects=controls.map((control)=>({
        action:control.dataset.action||'', kind:control.classList.contains('rebind-key')?'key':'pad', rect:cleanRect(control.getBoundingClientRect()),
      }));
      let controlOverlaps=0;
      for(let i=0;i<controlRects.length;i+=1)for(let j=i+1;j<controlRects.length;j+=1)if(overlap(controlRects[i].rect,controlRects[j].rect)>0.5)controlOverlaps+=1;
      const headings=[...document.querySelectorAll('.set-cat')];
      const navigationRect=cleanRect(headings.find((el)=>el.textContent.includes('Navigation'))?.getBoundingClientRect());
      const bindingsRect=cleanRect(headings.find((el)=>el.textContent.includes('Bindings'))?.getBoundingClientRect());
      const nestedScrollOwners=body?[...body.querySelectorAll('*')].filter((el)=>{
        const cs=getComputedStyle(el); return el.scrollHeight>el.clientHeight+1&&['auto','scroll'].includes(cs.overflowY);
      }).map((el)=>el.className||el.tagName):[];
      const settingsPanel=body?.querySelector('.set-panel');
      const firstRect=controlRects[0]?.rect;
      const finalRect=controlRects.at(-1)?.rect;
      const visible=(r)=>!!(r&&bodyRect&&r.top>=bodyRect.top-1&&r.bottom<=bodyRect.bottom+1);
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
        buttonRect:cleanRect(rect),
        controlRects,
        controlOverlaps,
        navigationRect,
        bindingsRect,
        headingIntersection:navigationRect&&bindingsRect?overlap(navigationRect,bindingsRect):null,
        settingsHost:body?.hasAttribute('data-settings-host')||false,
        bodyScrollTop:body?.scrollTop||0,
        bodyScrollMax:body?Math.max(0,body.scrollHeight-body.clientHeight):0,
        bodyOverflowY:body?getComputedStyle(body).overflowY:'',
        nestedScrollOwners,
        settingsPanelOverflowY:settingsPanel?getComputedStyle(settingsPanel).overflowY:'',
        settingsPanelScrollMax:settingsPanel?Math.max(0,settingsPanel.scrollHeight-settingsPanel.clientHeight):0,
        pageOverflowX:Math.max(0,document.documentElement.scrollWidth-innerWidth),
        bodyOverflowX:Math.max(0,(body?.scrollWidth||0)-(body?.clientWidth||0)),
        firstVisible:visible(firstRect), finalVisible:visible(finalRect),
        activeControl:document.activeElement?.matches('.rebind-btn')
          ?(document.activeElement.classList.contains('rebind-key')?'key':'pad')+':'+document.activeElement.dataset.action:'',
      };
    })()`);
    const switchView = async (id) => {
      await click(`.ov-tab[data-member="${id}"]`);
      if (id === 'settings') await until(`document.querySelector('.overlay-body')?.hasAttribute('data-settings-host')`, 'Settings host marker');
      else await until(`!!document.querySelector('.rebind-list')`, 'Controls rebind list');
    };
    const geometryOf = (facts) => JSON.stringify({
      navigation: facts.navigationRect,
      bindings: facts.bindingsRect,
      controls: facts.controlRects,
    }, (_key, value) => (typeof value === 'number' ? Math.round(value * 10) / 10 : value));
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
    check(initial.pageOverflowX === 0 && initial.bodyOverflowX === 0 && initial.buttonRect?.left >= 0 && initial.buttonRect?.right <= width,
      `REBIND-${label}-LAYOUT`, `${width}x${height} Controls and the rebind target fit horizontally`);
    check(initial.controlRects.length > 0
      && initial.controlRects.every(({ rect: target }) => target.width >= 44 && target.height >= 44)
      && initial.controlOverlaps === 0,
    `REBIND-${label}-TARGETS`, `${initial.controlRects.length} Key/Pad targets are >=44x44 with ${initial.controlOverlaps} overlap(s)`);
    check(initial.headingIntersection === 0,
      `REBIND-${label}-SECTIONS`, `Navigation and Bindings intersect by ${initial.headingIntersection || 0}px²`);
    check(!initial.settingsHost && ['auto', 'scroll'].includes(initial.bodyOverflowY)
      && initial.nestedScrollOwners.length === 0,
    `REBIND-${label}-SCROLL-OWNER`, `Controls uses overlay-body=${initial.bodyOverflowY}; nested owners ${JSON.stringify(initial.nestedScrollOwners)}`);

    const initialGeometry = geometryOf(initial);
    for (let cycle = 1; cycle <= 3; cycle += 1) {
      await ev(`(() => { const body=document.querySelector('.overlay-body'); body.style.paddingBottom='100vh'; body.scrollTop=body.scrollHeight; return body.scrollTop; })()`);
      await until(`document.querySelector('.overlay-body')?.scrollTop>0`, `cycle ${cycle} seeded scroll offset`);
      await switchView('settings');
      const settingsView = await state();
      check(settingsView.settingsHost && settingsView.bodyScrollTop === 0
        && settingsView.bodyOverflowY === 'hidden' && ['auto', 'scroll'].includes(settingsView.settingsPanelOverflowY),
      `REBIND-${label}-CYCLE-${cycle}-SETTINGS`, `Settings owns its marker/panel and view entry is top (${JSON.stringify(settingsView)})`);
      await ev(`(() => { const body=document.querySelector('.overlay-body'); body.scrollTop=body.scrollHeight; return body.scrollTop; })()`);
      await until(`document.querySelector('.overlay-body')?.scrollTop>0`, `cycle ${cycle} Settings seeded scroll offset`);
      await switchView('controls');
      const controlsView = await state();
      await ev(`(() => { const body=document.querySelector('.overlay-body'); body.style.paddingBottom=''; return true; })()`);
      check(!controlsView.settingsHost && controlsView.bodyScrollTop === 0
        && ['auto', 'scroll'].includes(controlsView.bodyOverflowY)
        && controlsView.nestedScrollOwners.length === 0,
      `REBIND-${label}-CYCLE-${cycle}-CONTROLS`, `Controls clears Settings ownership, enters at top, and keeps one scroll owner (${JSON.stringify(controlsView)})`);
      check(controlsView.headingIntersection === 0 && geometryOf(controlsView) === initialGeometry,
        `REBIND-${label}-CYCLE-${cycle}-GEOMETRY`, `Navigation/Bindings intersection ${controlsView.headingIntersection || 0}px² and geometry drift ${geometryOf(controlsView) === initialGeometry ? 0 : 1}`);
    }

    await ev(`document.querySelector('.overlay-body').scrollTop=0; true`);
    for (let i = 0; i < 6; i += 1) await wheel(900);
    const wheelBottom = await state();
    check(wheelBottom.finalVisible && (wheelBottom.bodyScrollMax === 0 || wheelBottom.bodyScrollTop > 0),
      `REBIND-${label}-WHEEL-END`, `wheel reaches the final binding (${JSON.stringify(wheelBottom)})`);
    for (let i = 0; i < 6; i += 1) await wheel(-900);
    const wheelTop = await state();
    check(wheelTop.firstVisible && wheelTop.bodyScrollTop === 0,
      `REBIND-${label}-WHEEL-TOP`, `wheel returns to the first binding (${JSON.stringify(wheelTop)})`);

    if (mobile) {
      for (let i = 0; i < 8; i += 1) await touchSwipe(true);
      const touchBottom = await state();
      check(touchBottom.finalVisible && (touchBottom.bodyScrollMax === 0 || touchBottom.bodyScrollTop > 0),
        `REBIND-${label}-TOUCH-END`, `touch reaches the final binding (${JSON.stringify(touchBottom)})`);
      for (let i = 0; i < 8; i += 1) await touchSwipe(false);
      const touchTop = await state();
      check(touchTop.firstVisible && touchTop.bodyScrollTop === 0,
        `REBIND-${label}-TOUCH-TOP`, `touch returns to the first binding (${JSON.stringify(touchTop)})`);
    }

    const controlCount = initial.controlRects.length;
    const firstControl = `${initial.controlRects[0].kind}:${initial.controlRects[0].action}`;
    const finalControl = `${initial.controlRects.at(-1).kind}:${initial.controlRects.at(-1).action}`;
    await ev(`(() => { const body=document.querySelector('.overlay-body'); body.scrollTop=0; document.querySelectorAll('.rebind-btn')[document.querySelectorAll('.rebind-btn').length-1].focus(); return true; })()`);
    await wait(160);
    const focusEnd = await state();
    check(focusEnd.activeControl === finalControl && focusEnd.finalVisible,
      `REBIND-${label}-FOCUS-END`, `focus auto-scroll reaches ${finalControl} (${JSON.stringify(focusEnd)})`);
    await ev(`document.querySelectorAll('.rebind-btn')[0].focus(); true`);
    await wait(160);
    const focusTop = await state();
    check(focusTop.activeControl === firstControl && focusTop.firstVisible,
      `REBIND-${label}-FOCUS-TOP`, `focus auto-scroll returns to ${firstControl} (${JSON.stringify(focusTop)})`);
    for (let i = 1; i < controlCount; i += 1) await tab(false);
    const tabEnd = await state();
    check(tabEnd.activeControl === finalControl && tabEnd.finalVisible,
      `REBIND-${label}-TAB-END`, `Tab reaches ${finalControl} and keeps it visible (${JSON.stringify(tabEnd)})`);
    for (let i = 1; i < controlCount; i += 1) await tab(true);
    const shiftTabTop = await state();
    check(shiftTabTop.activeControl === firstControl && shiftTabTop.firstVisible,
      `REBIND-${label}-SHIFT-TAB-TOP`, `Shift+Tab returns to ${firstControl} and keeps it visible (${JSON.stringify(shiftTabTop)})`);

    const settled = await state();
    check(settled.pageOverflowX === 0 && settled.bodyOverflowX === 0,
      `REBIND-${label}-OVERFLOW`, `page/body overflowX ${settled.pageOverflowX}/${settled.bodyOverflowX}`);
    if (CAPTURE_SHOTS) await screenshot(`qa18-controls-${ARTIFACT ? 'artifact' : 'source'}-${label.toLowerCase()}-${width}x${height}.png`);

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
    if (CAPTURE_SHOTS) await screenshot(`qa18-rebind-cancel-${ARTIFACT ? 'artifact' : 'source'}-${label.toLowerCase()}-${width}x${height}.png`);

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
  await runViewport({ width: 815, height: 1086, mobile: false, label: 'TABLET' });
  await runViewport({ width: 390, height: 844, mobile: true, label: 'MOBILE' });
  await runViewport({ width: 320, height: 640, mobile: true, label: 'NARROW' });
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
