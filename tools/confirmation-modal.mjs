#!/usr/bin/env node
// Focused acceptance for QA remediation #4: Load and Quit Without Saving use
// one reversible themed confirmation surface, with the safe action focused.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = resolve(ROOT, 'docs', 'preview');
const CAPTURE_SHOTS = process.argv.includes('--screenshots');
const ARTIFACT = process.argv.includes('--artifact');
const SOURCE_CONTRACT = process.argv.includes('--source-contract');
const SOURCE_SELFTEST = process.argv.includes('--source-selftest');
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
        find: '    const shield = holdNavigationInputShield({ veil, durationMs: inputShieldMs });',
        replace: "    veil.addEventListener('click', () => { window.dispatchEvent(new CustomEvent(CONFIRMATION_COMMIT_EVENT, { detail: { component, tone } })); onConfirm?.(); }, true); // confirmation-modal selftest plant\n    const shield = holdNavigationInputShield({ veil, durationMs: inputShieldMs });",
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
      {
        name: 'commit removes the hit-test shield before destination activation settles',
        file: 'src/ui/components/confirmationModal.js',
        find: '    close({ restoreFocus: false, retainInputShield: true });',
        replace: '    close({ restoreFocus: false, retainInputShield: false }); // confirmation-modal selftest plant',
        expectRed: /RED CONFIRMATION-(?:WIDE|MOBILE|COMPACT)-(?:MAP-QUIT|COMBAT-QUIT|COMBAT-LOAD)-DOUBLE-HIT/,
      },
      {
        name: 'danger text falls back to the low-contrast ember token',
        file: 'styles/ui.css',
        find: '  color: var(--parchment);\n}\n.confirmation-copy',
        replace: '  color: var(--ember); /* confirmation-modal selftest plant */\n}\n.confirmation-copy',
        expectRed: /RED CONFIRMATION-(?:WIDE|MOBILE|COMPACT)-CONTRAST/,
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

function quickLoadSourceChecks({ main, title, selector }) {
  const confirmStart = main.indexOf('function confirmSlotLoad');
  const confirmEnd = main.indexOf('function loadActiveSlot', confirmStart);
  const confirm = confirmStart >= 0 && confirmEnd > confirmStart ? main.slice(confirmStart, confirmEnd) : '';
  const resumeCalls = confirm.match(/resumeRun\(/g) || [];
  return [
    [Boolean(selector), 'QUICK-LOAD-SHARED-SELECTOR', 'the shared save-slot selector component exists'],
    [/function loadActiveSlot[\s\S]*?openSaveSlotSelector\(/.test(main)
      && !/title: `Load slot \$\{activeSlot\}\?`/.test(main),
    'QUICK-LOAD-NO-DIRECT-ACTIVE-SLOT', 'Quick Menu Load routes through selection rather than confirming activeSlot'],
    [/openSaveSlotSelector/.test(title), 'QUICK-LOAD-TITLE-REUSE', 'Title Load uses the same selector component'],
    [/saveSlotSelectionModel\(slots, \{ kind: 'load'/.test(selector)
      && /data-component="title-save-slot-list"/.test(selector)
      && /data-component="title-save-slot"/.test(selector),
    'QUICK-LOAD-MODEL-AND-IDS', 'the shared selector preserves the Load projection and stable component IDs'],
    [/let activatedLoadSlot = null;/.test(selector)
      && /selectedSlot === slot && activatedLoadSlot === slot/.test(selector)
      && /requestLoad\(slot, 'hold'\)/.test(selector),
    'QUICK-LOAD-FIRST-THEN-HOLD', 'first activation selects; repeat and configured hold are distinct deterministic triggers'],
    [/if \(event\.target === veil\) return close\(\);/.test(selector)
      && /if \(event\.key === 'Escape'\)/.test(selector)
      && /queueMicrotask\(restoreLauncher\)/.test(selector),
    'QUICK-LOAD-CANCEL-FOCUS', 'Escape, Back, and scrim restore the invoking control'],
    [/onRequestLoad: \(slot\) => confirmSlotLoad\(slot, \{ returnFocusElement \}\)/.test(main),
    'QUICK-LOAD-NO-BYPASS', 'selection requests the exact confirmation instead of resuming directly'],
    [resumeCalls.length === 1 && /resumeRun\(slot\);/.test(confirm) && !/resumeRun\(activeSlot\)/.test(confirm),
    'QUICK-LOAD-EXACT-COMMIT', 'the confirmation commits the selected slot exactly once'],
  ];
}

if (SOURCE_CONTRACT || SOURCE_SELFTEST) {
  const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
  const sources = {
    main: read('src/main.js'),
    title: read('src/ui/screens/title.js'),
    selector: existsSync(resolve(ROOT, 'src/ui/components/saveSlotSelector.js'))
      ? read('src/ui/components/saveSlotSelector.js') : '',
  };
  if (SOURCE_CONTRACT) {
    for (const [ok, code, detail] of quickLoadSourceChecks(sources)) check(ok, code, detail);
    console.log(`\n${checks - failures}/${checks} quick-load source-contract checks passed.`);
    process.exit(failures ? 1 : 0);
  }

  const baseline = quickLoadSourceChecks(sources);
  check(baseline.every(([ok]) => ok), 'QUICK-LOAD-PLANT-CLEAN', 'clean source satisfies every focused contract');
  const plants = [
    ['direct active-slot route', 'QUICK-LOAD-NO-DIRECT-ACTIVE-SLOT', {
      ...sources, main: sources.main.replace('  openSaveSlotSelector({\n    slots: saveSlotRecords(),', '  confirmSlotLoad(activeSlot, { returnFocusElement });\n  void ({\n    slots: saveSlotRecords(),'),
    }],
    ['missing shared slot list', 'QUICK-LOAD-MODEL-AND-IDS', {
      ...sources, selector: sources.selector.replace('data-component="title-save-slot-list"', 'data-component="missing-slot-list"'),
    }],
    ['first activation already armed', 'QUICK-LOAD-FIRST-THEN-HOLD', {
      ...sources, selector: sources.selector.replace('let activatedLoadSlot = null;', 'let activatedLoadSlot = selectedSlot;'),
    }],
    ['confirmation bypass resumes immediately', 'QUICK-LOAD-NO-BYPASS', {
      ...sources, main: sources.main.replace('onRequestLoad: (slot) => confirmSlotLoad(slot, { returnFocusElement })', 'onRequestLoad: (slot) => resumeRun(slot)'),
    }],
    ['cancel loses launcher focus', 'QUICK-LOAD-CANCEL-FOCUS', {
      ...sources, selector: sources.selector.replace('queueMicrotask(restoreLauncher)', 'queueMicrotask(() => {})'),
    }],
    ['wrong-slot double commit', 'QUICK-LOAD-EXACT-COMMIT', {
      ...sources, main: sources.main.replace('      resumeRun(slot);', '      resumeRun(activeSlot);\n      resumeRun(slot);'),
    }],
  ];
  for (const [name, expectedCode, planted] of plants) {
    const result = quickLoadSourceChecks(planted).find(([, code]) => code === expectedCode);
    check(result?.[0] === false, `QUICK-LOAD-PLANT-${expectedCode}`, `${name} is caught by ${expectedCode}`);
  }
  console.log(`\n${checks - failures}/${checks} quick-load source plants passed.`);
  process.exit(failures ? 1 : 0);
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
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }, sessionId);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      const state={connected:false,buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
      const gamepad={id:'confirmation-test-pad',index:0,connected:true,mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:state.buttons};
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>state.connected?[gamepad]:[]});
      window.__confirmationPad={
        connect(){state.connected=true;const event=new Event('gamepadconnected');Object.defineProperty(event,'gamepad',{value:gamepad});dispatchEvent(event);},
        set(index,pressed){state.buttons[index]={pressed,value:pressed?1:0};gamepad.timestamp+=1;}
      };
    })();` }, sessionId);
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
    const center = async (selector) => {
      const point = await ev(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      if (!point) throw new Error(`missing ${selector}`);
      return point;
    };
    const physicalClickAt = async (point, clickCount = 1, settleMs = 180) => {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'none' }, sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount }, sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount }, sessionId);
      await wait(settleMs);
    };
    const click = async (selector) => {
      const point = await center(selector);
      await physicalClickAt(point);
    };
    const key = async (keyName) => {
      const vk = keyName === 'Escape' ? 27 : keyName === 'Tab' ? 9 : keyName === 'Enter' ? 13 : keyName.toUpperCase().charCodeAt(0);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code: keyName, windowsVirtualKeyCode: vk }, sessionId);
      await wait(80);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code: keyName, windowsVirtualKeyCode: vk }, sessionId);
      await wait(180);
    };
    const padConfirm = async () => {
      await ev(`window.__confirmationPad.set(0,true)`); await wait(100);
      await ev(`window.__confirmationPad.set(0,false)`); await wait(220);
    };
    const touchHold = async (selector, durationMs, { cancel = false } = {}) => {
      const point = await center(selector);
      const touch = [{ x: point.x, y: point.y, radiusX: 1, radiusY: 1, force: 1, id: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch }, sessionId);
      await wait(durationMs);
      await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] }, sessionId);
      await wait(220);
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
      const rgb=(value)=>{const m=String(value).match(/[0-9.]+/g)?.map(Number)||[];return {r:m[0]||0,g:m[1]||0,b:m[2]||0,a:m[3]??1};};
      const lum=(c)=>{const channel=(v)=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;};return 0.2126*channel(c.r)+0.7152*channel(c.g)+0.0722*channel(c.b);};
      const contrast=(foreground,background)=>{const fg=rgb(getComputedStyle(foreground).color),bg=rgb(getComputedStyle(background).backgroundColor);const hi=Math.max(lum(fg),lum(bg)),lo=Math.min(lum(fg),lum(bg));return {foreground:getComputedStyle(foreground).color,background:getComputedStyle(background).backgroundColor,ratio:Number(((hi+0.05)/(lo+0.05)).toFixed(2))};};
      const d=q('.confirmation-modal'), back=q('.confirmation-cancel'), commit=q('.confirmation-confirm');
      const eyebrow=q('.confirmation-eyebrow');
      return {role:d?.getAttribute('role'),modal:d?.getAttribute('aria-modal'),component:d?.dataset.uiComponent,
        title:q('#confirmation-modal-title')?.textContent,copy:q('#confirmation-modal-copy')?.textContent,
        consequence:eyebrow?.textContent,back:back?.textContent,commit:commit?.textContent,
        cancel:back?.dataset.uiComponent,action:commit?.dataset.uiComponent,active:document.activeElement?.className || document.activeElement?.id,
        contrast:{action:contrast(commit,commit),eyebrow:contrast(eyebrow,d)},
        dialog:rect(d),backRect:rect(back),commitRect:rect(commit),
        overflowX:document.documentElement.scrollWidth-window.innerWidth,
        overflowY:document.documentElement.scrollHeight-window.innerHeight};
    })()`);

    const entry = ARTIFACT ? 'AshenSpire.html' : '';
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${served.port}/${entry}?shot=map` }, sessionId);
    await until(`!!document.querySelector('#open-menu')`, 'map boot');
    await ev(`window.__qaConfirmationCommits=0; window.__qaTitleHits=[];
      window.addEventListener('ashenspire:confirmation-commit',()=>{window.__qaConfirmationCommits+=1;});
      window.addEventListener('click',(event)=>{const control=event.target.closest?.('[data-title-action]');if(control)window.__qaTitleHits.push(control.dataset.titleAction);},true); true`);

    await click('#open-menu');
    await until(`!!document.querySelector('.qn-row[data-act="load"]')`, 'Load command');
    await click('.qn-row[data-act="load"]');
    await until(`!!document.querySelector('[data-component="title-save-slot-list"]')`, 'Load slot selector');
    const mapLoadInitial = await ev(`(() => ({
      map:!!document.querySelector('.mapscreen'),
      confirmation:!!document.querySelector('.confirmation-modal'),
      selected:document.querySelector('[data-slot-pick][aria-pressed="true"]')?.dataset.slotPick||null,
      focused:document.querySelector('[data-slot-pick].gp-focus')?.dataset.slotPick||null
    }))()`);
    check(mapLoadInitial.map && !mapLoadInitial.confirmation && mapLoadInitial.selected === mapLoadInitial.focused,
      `CONFIRMATION-${label}-LOAD-SELECTOR`, `Quick Menu Load opens the occupied-slot selector without leaving Map (${JSON.stringify(mapLoadInitial)})`);
    await click(`[data-slot-pick="${mapLoadInitial.selected}"]`);
    check(await ev(`!document.querySelector('.confirmation-modal') && !!document.querySelector('.mapscreen')`),
      `CONFIRMATION-${label}-LOAD-FIRST-SELECTS`, 'first activation selects without committing or opening confirmation');
    await click(`[data-slot-pick="${mapLoadInitial.selected}"]`);
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
    check(load.contrast.action.ratio >= 4.5 && load.contrast.eyebrow.ratio >= 4.5,
      `CONFIRMATION-${label}-CONTRAST`,
      `computed confirmation action ${load.contrast.action.ratio}:1 ${load.contrast.action.foreground} on ${load.contrast.action.background}; eyebrow ${load.contrast.eyebrow.ratio}:1 ${load.contrast.eyebrow.foreground} on ${load.contrast.eyebrow.background}`);
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
    await click('.qn-row[data-act="load"]');
    await until(`!!document.querySelector('[data-component="title-save-slot-list"]')`, 'keyboard Load selector');
    await key('Enter');
    check(await ev(`!document.querySelector('.confirmation-modal')`),
      `CONFIRMATION-${label}-LOAD-KEY-FIRST`, 'first keyboard activation selects only');
    await key('Enter');
    await until(`!!document.querySelector('.confirmation-modal')`, 'keyboard exact-slot confirmation');
    check((await modalState()).title === 'Load slot 1?',
      `CONFIRMATION-${label}-LOAD-KEY-REPEAT`, 'second keyboard activation opens the exact-slot confirmation');
    await key('Escape');

    await click('#open-menu');
    await click('.qn-row[data-act="load"]');
    await until(`!!document.querySelector('[data-slot-pick][aria-pressed="true"]')`, 'touch Load selector');
    const touchSlot = await ev(`document.querySelector('[data-slot-pick][aria-pressed="true"]')?.dataset.slotPick||null`);
    await touchHold(`[data-slot-pick="${touchSlot}"]`, 180, { cancel: true });
    check(await ev(`!document.querySelector('.confirmation-modal') && !!document.querySelector('[data-component="title-save-slot-list"]')`),
      `CONFIRMATION-${label}-LOAD-HOLD-CANCEL`, 'cancelled touch hold leaves selection open and commits nothing');
    await touchHold(`[data-slot-pick="${touchSlot}"]`, 720);
    await until(`!!document.querySelector('.confirmation-modal')`, 'rearmed touch hold confirmation');
    check((await modalState()).title === `Load slot ${touchSlot}?`,
      `CONFIRMATION-${label}-LOAD-HOLD-REARM`, 'rearmed configured hold opens the exact-slot confirmation');
    await key('Escape');

    await ev(`window.__confirmationPad.connect()`); await wait(250);
    await click('#open-menu');
    await click('.qn-row[data-act="load"]');
    await until(`!!document.querySelector('[data-component="title-save-slot-list"]')`, 'controller Load selector');
    await padConfirm();
    check(await ev(`!document.querySelector('.confirmation-modal')`),
      `CONFIRMATION-${label}-LOAD-PAD-FIRST`, 'first controller activation selects only');
    await padConfirm();
    await until(`!!document.querySelector('.confirmation-modal')`, 'controller exact-slot confirmation');
    check((await modalState()).title === 'Load slot 1?',
      `CONFIRMATION-${label}-LOAD-PAD-REPEAT`, 'second controller activation opens the exact-slot confirmation');
    await key('Escape');

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

    await click('#open-menu');
    await click('.qn-row[data-act="quit"]');
    await until(`!!document.querySelector('.confirmation-confirm')`, 'physical Map Quit confirmation');
    const mapQuitPoint = await center('.confirmation-confirm');
    const mapBeforeCommit = await ev(`window.__qaConfirmationCommits`);
    await physicalClickAt(mapQuitPoint, 1, 80);
    await until(`!!document.querySelector('[data-title-action="new"]')`, 'title after physical Map Quit');
    const mapShieldHit = await ev(`(() => { const e=document.elementFromPoint(${JSON.stringify(mapQuitPoint.x)},${JSON.stringify(mapQuitPoint.y)}); return !!e?.classList.contains('confirmation-input-shield'); })()`);
    await physicalClickAt(mapQuitPoint, 2, 180);
    const mapDouble = await ev(`({commits:window.__qaConfirmationCommits,titleHits:[...window.__qaTitleHits],title:!!document.querySelector('[data-title-action="new"]'),modal:!!document.querySelector('.title-modal')})`);
    check(mapBeforeCommit === 0 && mapDouble.commits === 1, `CONFIRMATION-${label}-EXACT-COMMIT`,
      `physical Map Quit has no early commit and commits exactly once (${mapBeforeCommit} -> ${mapDouble.commits})`);
    check(mapShieldHit && mapDouble.title && mapDouble.titleHits.length === 0 && !mapDouble.modal,
      `CONFIRMATION-${label}-MAP-QUIT-DOUBLE-HIT`,
      `the second hit-tested activation landed on the transient shield and reached no Title control (${JSON.stringify(mapDouble)})`);

    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${served.port}/${entry}?shot=combat` }, sessionId);
    await until(`!!document.querySelector('#combat-menu') && !!window.__combat`, 'combat boot');
    await ev(`window.__qaConfirmationCommits=0; window.__qaTitleHits=[]; window.__qaEnemyHits=[];
      window.addEventListener('ashenspire:confirmation-commit',()=>{window.__qaConfirmationCommits+=1;});
      window.addEventListener('click',(event)=>{const control=event.target.closest?.('[data-title-action]');if(control)window.__qaTitleHits.push(control.dataset.titleAction);},true);
      window.addEventListener('click',(event)=>{const enemy=event.target.closest?.('.combatant.enemy');if(enemy)window.__qaEnemyHits.push(enemy.dataset.eid||'enemy');},true); true`);
    await click('#combat-menu');
    await until(`!!document.querySelector('.qn-row[data-act="load"]')`, 'combat Load command');
    await click('.qn-row[data-act="load"]');
    await until(`!!document.querySelector('[data-component="title-save-slot-list"]')`, 'combat Load slot selector');
    const combatSelected = await ev(`document.querySelector('[data-slot-pick][aria-pressed="true"]')?.dataset.slotPick||null`);
    await click(`[data-slot-pick="${combatSelected}"]`);
    check(await ev(`!document.querySelector('.confirmation-modal') && !!window.__combat`),
      `CONFIRMATION-${label}-COMBAT-LOAD-FIRST-SELECTS`, 'first Combat activation selects without mutating the encounter');
    await click(`[data-slot-pick="${combatSelected}"]`);
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
    await click('.qn-row[data-act="load"]');
    await until(`!!document.querySelector('[data-component="title-save-slot-list"]')`, 'physical Combat Load slot selector');
    const physicalCombatSlot = await ev(`document.querySelector('[data-slot-pick][aria-pressed="true"]')?.dataset.slotPick||null`);
    await click(`[data-slot-pick="${physicalCombatSlot}"]`);
    await click(`[data-slot-pick="${physicalCombatSlot}"]`);
    await until(`!!document.querySelector('.confirmation-confirm')`, 'physical Combat Load confirmation');
    const combatLoadPoint = await center('.confirmation-confirm');
    const combatLoadBefore = await ev(`window.__qaConfirmationCommits`);
    await physicalClickAt(combatLoadPoint, 1, 80);
    await until(`!!window.__combat && !!document.querySelector('#combat-menu')`, 'combat after physical Load');
    const combatLoadShieldHit = await ev(`(() => { const e=document.elementFromPoint(${JSON.stringify(combatLoadPoint.x)},${JSON.stringify(combatLoadPoint.y)}); return !!e?.classList.contains('confirmation-input-shield'); })()`);
    await physicalClickAt(combatLoadPoint, 2, 180);
    const combatLoadDouble = await ev(`({commits:window.__qaConfirmationCommits,enemyHits:[...window.__qaEnemyHits],combat:!!window.__combat,inspectorVisible:!!document.querySelector('.combatant-inspector-host:not([hidden])')})`);
    check(combatLoadBefore === 0 && combatLoadDouble.commits === 1,
      `CONFIRMATION-${label}-COMBAT-LOAD-EXACT-COMMIT`,
      `physical Combat Load has no early commit and commits exactly once (${combatLoadBefore} -> ${combatLoadDouble.commits})`);
    check(combatLoadShieldHit && combatLoadDouble.combat && combatLoadDouble.enemyHits.length === 0 && !combatLoadDouble.inspectorVisible,
      `CONFIRMATION-${label}-COMBAT-LOAD-DOUBLE-HIT`,
      `the second hit-tested activation landed on the transient shield and reached no enemy detail (${JSON.stringify(combatLoadDouble)})`);
    await ev(`window.__qaConfirmationCommits=0; window.__qaTitleHits=[]; true`);

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
    const combatQuitPoint = await center('.confirmation-confirm');
    await physicalClickAt(combatQuitPoint, 1, 80);
    await until(`!!document.querySelector('[data-title-action="new"]')`, 'title after confirmed Quit');
    const combatQuitShieldHit = await ev(`(() => { const e=document.elementFromPoint(${JSON.stringify(combatQuitPoint.x)},${JSON.stringify(combatQuitPoint.y)}); return !!e?.classList.contains('confirmation-input-shield'); })()`);
    await physicalClickAt(combatQuitPoint, 2, 180);
    const afterCommit = await ev(`window.__qaConfirmationCommits`);
    check(beforeCommit === 0 && afterCommit === 1, `CONFIRMATION-${label}-EXACT-COMMIT`,
      `no early commit and repeated activation commits exactly once (${beforeCommit} -> ${afterCommit})`);
    const combatQuitDouble = await ev(`({titleHits:[...window.__qaTitleHits],title:!!document.querySelector('[data-title-action="new"]'),modal:!!document.querySelector('.title-modal')})`);
    check(combatQuitShieldHit && combatQuitDouble.title && combatQuitDouble.titleHits.length === 0 && !combatQuitDouble.modal,
      `CONFIRMATION-${label}-COMBAT-QUIT-DOUBLE-HIT`,
      `the second hit-tested activation landed on the transient shield and reached no Title control (${JSON.stringify(combatQuitDouble)})`);

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
