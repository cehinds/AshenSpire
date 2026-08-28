#!/usr/bin/env node
// AS-HD-20260826-017 — exact title/save-slot tooltip acceptance door.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '4a68b309e5517f4eb0ceee396bea3d43e7635383';
const BASE_TREE = '2f3ec85c9ae891d87065206953358191c941d855';
const GRANT_SHA = '42706D71D108C83C2D8DEC0645B86FF34F13A001E82A34CBEB8E1377C4130E3A';
const COPY = 'Activate again—or hold—to load.';
const SOURCE_CONTRACT = process.argv.includes('--source-contract');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const browserPath = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => candidate && existsSync(candidate));

const read = (path) => existsSync(resolve(ROOT, path)) ? readFileSync(resolve(ROOT, path), 'utf8') : '';
function sourceContract() {
  const selector = read('src/ui/components/saveSlotSelector.js');
  const adapter = read('src/ui/components/titleSaveSlotTooltip.js');
  const combined = `${selector}\n${adapter}`;
  return [
    [Boolean(adapter), 'ADAPTER-EXISTS', 'the title-only adapter exists'],
    [/from '.\/titleSaveSlotTooltip\.js'/.test(selector), 'SELECTOR-IMPORT', 'the accepted selector calls only the title adapter'],
    [(combined.match(/Activate again—or hold—to load\./g) || []).length === 1,
      'LOCKED-COPY-ONCE', 'the locked sentence occurs exactly once across the two product files'],
    [/owner: selectedButton\(\)/.test(selector) && /aria-pressed="\$\{selected\}"/.test(selector),
      'MODEL-OWNER', 'the adapter receives the selected model projection and aria-pressed remains authoritative'],
    [/export function mountTitleSaveSlotTooltip/.test(adapter)
      && /role', 'tooltip'/.test(adapter)
      && /data-component', 'tooltip'/.test(adapter),
    'SINGLETON-SEMANTICS', 'the adapter exposes one inert role=tooltip component'],
    [/hardExclusions/.test(adapter) && /mountReserve/.test(adapter) && /sideCandidates/.test(adapter),
      'HARD-EXCLUSION-RESERVE', 'hard exclusions and the owner-local reserve are both explicit'],
    [!/from ['"].*(?:tooltip\.js|fx\.js|TooltipPlacementModel|combat)/.test(adapter),
      'NO-SHARED-IMPORT', 'the adapter imports no forbidden shared/combat geometry owner'],
    [!/localStorage|sessionStorage|fetch\(|XMLHttpRequest|WebSocket|sendBeacon|resumeRun|onRequestLoad|armHold|beatArmer/.test(adapter),
      'PRESENTATION-ONLY', 'the adapter owns no persistence, network, load, hold or confirmation behavior'],
    [/let activatedLoadSlot = null;/.test(selector)
      && /selectedSlot === slot && activatedLoadSlot === slot/.test(selector)
      && /setTimeout\(\(\) => \{ if \(!closed\) requestLoad\(slot, 'hold'\); \}, 0\)/.test(selector),
    'PRESERVE-016', 'the accepted #016 activation/hold/release boundary remains present'],
    [BASE.length === 40 && BASE_TREE.length === 40 && GRANT_SHA.length === 64,
      'EXACT-PINS', 'base, tree and Main grant identities are pinned in the acceptance door'],
  ];
}

if (SOURCE_CONTRACT) {
  let failed = 0;
  for (const [ok, code, detail] of sourceContract()) {
    console.log(`${ok ? 'PASS' : 'RED'} UI17-SOURCE-${code} - ${detail}`);
    if (!ok) failed += 1;
  }
  console.log(`title-save-slot-tooltip source-contract: ${10 - failed}/10; ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const code = await doorSelftest({
    tool: 'title-save-slot-tooltip.mjs',
    timeoutMs: 180000,
    plants: [
      {
        name: 'R1 locked sentence drifts',
        file: 'src/ui/components/titleSaveSlotTooltip.js',
        find: "export const TITLE_SAVE_SLOT_TOOLTIP_COPY = 'Activate again—or hold—to load.';",
        replace: "export const TITLE_SAVE_SLOT_TOOLTIP_COPY = 'Hold to load.'; // UI17 plant R1",
        expectRed: /RED UI17-G2-COPY/,
      },
      {
        name: 'R2 visual row replaces selected model owner',
        file: 'src/ui/components/saveSlotSelector.js',
        find: 'owner: selectedButton(),',
        replace: "owner: veil.querySelector('[data-slot-pick]:not([aria-pressed=\"true\"])'), // UI17 plant R2",
        expectRed: /RED UI17-G3-OWNER/,
      },
      {
        name: 'R3 natural dimensions remain stale across replans',
        file: 'src/ui/components/titleSaveSlotTooltip.js',
        find: '  resetNaturalSize(tip);',
        replace: "  tip.style.minHeight = '0'; tip.style.width = '1px'; tip.style.height = '1px'; tip.style.overflow = 'hidden'; // UI17 plant R3: stale natural size",
        expectRed: /RED UI17-G12-TEXT-SCROLL/,
      },
      {
        name: 'R4 floating candidate may cover its owner',
        edits: [
          {
            file: 'src/ui/components/titleSaveSlotTooltip.js',
            find: '  const candidates = sideCandidates(ownerRect, natural, visual.bounds, gap);',
            replace: "  const candidates = [{ side: 'plant-owner', left: ownerRect.left, top: ownerRect.top }]; // UI17 plant R4",
          },
          {
            file: 'src/ui/components/titleSaveSlotTooltip.js',
            find: '      && !intersects(rect, ownerRect)',
            replace: '      && true // UI17 plant R4: owner exclusion removed',
          },
        ],
        expectRed: /RED UI17-G10-HARD-EXCLUSIONS/,
      },
      {
        name: 'R5 peer controls disappear from the exclusion set',
        file: 'src/ui/components/titleSaveSlotTooltip.js',
        find: '  const exclusions = hardExclusions(root, owner);',
        replace: '  const exclusions = []; // UI17 plant R5',
        expectRed: /RED UI17-G10-HARD-EXCLUSIONS/,
      },
      {
        name: 'R6 selected owner is shrunk below the tap floor',
        file: 'src/ui/components/titleSaveSlotTooltip.js',
        find: "  owner.style.removeProperty('min-height');",
        replace: "  owner.style.minHeight = '12px'; owner.style.height = '12px'; owner.style.padding = '0'; owner.style.overflow = 'hidden'; // UI17 plant R6",
        expectRed: /RED UI17-G5-TARGETS/,
      },
      {
        name: 'R7 compact layout attempts floating placement',
        file: 'src/ui/components/titleSaveSlotTooltip.js',
        find: '  if (visual.width <= NARROW_MAX_WIDTH) return mountReserve(next);',
        replace: '  if (visual.width <= 0) return mountReserve(next); // UI17 plant R7',
        expectRed: /RED UI17-G11-NOFIT-RESERVE|RED UI17-G8-COMPACT/,
      },
      {
        name: 'R8 copy clips inside a second scroll owner',
        edits: [
          {
            file: 'src/ui/components/titleSaveSlotTooltip.js',
            find: "  tip.style.overflow = 'visible';",
            replace: "  tip.style.overflow = 'hidden'; // UI17 plant R8",
          },
          {
            file: 'src/ui/components/titleSaveSlotTooltip.js',
            find: "  tip.style.maxHeight = 'none';",
            replace: "  tip.style.minHeight = '0'; tip.style.maxHeight = '1px'; // UI17 plant R8",
          },
        ],
        expectRed: /RED UI17-G12-TEXT-SCROLL/,
      },
      {
        name: 'R9 tooltip becomes a pointer target',
        file: 'src/ui/components/titleSaveSlotTooltip.js',
        find: "  tip.style.pointerEvents = 'none';",
        replace: "  tip.style.pointerEvents = 'auto'; // UI17 plant R9",
        expectRed: /RED UI17-G15-INERT/,
      },
      {
        name: 'R10 cleanup leaves stale aria ownership',
        file: 'src/ui/components/titleSaveSlotTooltip.js',
        find: '    removeDescription(owner, TOOLTIP_ID);',
        replace: '    void owner; // UI17 plant R10',
        expectRed: /RED UI17-G16-ARIA/,
      },
      {
        name: 'R11 reduced motion keeps a spatial transition',
        file: 'src/ui/components/titleSaveSlotTooltip.js',
        find: "  tip.style.setProperty('transition', 'none', 'important');",
        replace: "  tip.style.setProperty('transition', 'left 2s, top 2s', 'important'); // UI17 plant R11",
        expectRed: /RED UI17-G17-REDUCED-MOTION/,
      },
      {
        name: 'R12 presentation adapter dispatches an action',
        file: 'src/ui/components/titleSaveSlotTooltip.js',
        find: '  owner.style.removeProperty(\'min-height\');',
        replace: "  owner.style.removeProperty('min-height'); owner.addEventListener('click', () => window.dispatchEvent(new Event('ashenspire:title-tooltip-action'))); // UI17 plant R12",
        expectRed: /RED UI17-G18-BOUNDARY/,
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
  console.log(`${ok ? 'PASS' : 'RED'} UI17-${code} - ${detail}`);
  if (!ok) failures += 1;
}

const source = sourceContract();
const sourceGreen = source.every(([ok]) => ok);
let server;
let cdp;
let closeBrowser = async () => {};
const results = [];

try {
  if (!browserPath) throw new Error('no supported Chrome or Edge binary found');
  const served = await serve({ root: ROOT, port: 8267, open: false });
  server = served.server;
  const launched = await launchBrowser({ prefix: 'title-slot-tooltip-', browser: browserPath, headless: '--headless=new', timeoutMs: 20000 });
  closeBrowser = launched.close;
  cdp = connectCdp(launched.wsUrl);
  await cdp.ready;

  const runViewport = async ({ width, height, mobile, label, safe }) => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Log.enable', {}, sessionId);
    await cdp.send('Network.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile }, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }, sessionId);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sessionId);
    let nativeSafeArea = true;
    try {
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: safe }, sessionId);
    } catch {
      nativeSafeArea = false;
    }
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      const state={connected:false,buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
      const gamepad={id:'ui17-test-pad',index:0,connected:true,mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:state.buttons};
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>state.connected?[gamepad]:[]});
      window.__ui17Pad={connect(){state.connected=true;const e=new Event('gamepadconnected');Object.defineProperty(e,'gamepad',{value:gamepad});dispatchEvent(e);},set(i,p){state.buttons[i]={pressed:p,value:p?1:0};gamepad.timestamp+=1;}};
      window.__ui17TooltipActions=0; window.addEventListener('ashenspire:title-tooltip-action',()=>window.__ui17TooltipActions++);
    })();` }, sessionId);
    const diagnostics = { console: [], network: [], mutations: [], external: [] };
    const releaseEvents = cdp.onEvent((message) => {
      if (message.sessionId !== sessionId) return;
      if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) {
        diagnostics.console.push(message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '));
      }
      if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
        diagnostics.network.push(`${message.params.response.status} ${message.params.response.url}`);
      }
      if (message.method === 'Network.requestWillBeSent') {
        const { method, url } = message.params.request;
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) diagnostics.mutations.push(`${method} ${url}`);
        if (!url.startsWith(`http://127.0.0.1:${served.port}/`) && !url.startsWith('data:') && !url.startsWith('blob:')) diagnostics.external.push(url);
      }
    });
    const ev = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluation failed');
      return result.result.value;
    };
    const until = async (expression, waitingFor, timeout = 20000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (await ev(expression).catch(() => false)) return;
        await wait(60);
      }
      throw new Error(`timeout waiting for ${label} ${waitingFor}`);
    };
    const center = async (selector) => ev(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    const click = async (selector) => {
      const p = await center(selector); if (!p) throw new Error(`missing ${selector}`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'none' }, sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 }, sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 }, sessionId);
      await wait(180);
    };
    const key = async (name) => {
      const vk = name === 'Escape' ? 27 : name === 'Enter' ? 13 : 9;
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: vk }, sessionId);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: vk }, sessionId);
      await wait(220);
    };
    const touch = async (selector) => {
      const p = await center(selector); if (!p) throw new Error(`missing ${selector}`);
      const points = [{ x: p.x, y: p.y, radiusX: 1, radiusY: 1, force: 1, id: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points }, sessionId);
      await wait(90);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId);
      await wait(260);
    };
    const pad = async () => {
      await ev(`window.__ui17Pad.connect()`); await wait(180);
      await ev(`window.__ui17Pad.set(0,true)`); await wait(100);
      await ev(`window.__ui17Pad.set(0,false)`); await wait(260);
    };
    const snapshot = async () => ev(`(() => {
      const tip=document.querySelector('[data-title-save-slot-tooltip]');
      const owner=document.querySelector('[data-slot-pick][aria-pressed="true"]');
      const modal=document.querySelector('.title-menu-modal');
      const list=document.querySelector('.title-slot-list');
      const rect=(e)=>e?Object.fromEntries(['left','top','right','bottom','width','height'].map(k=>[k,e.getBoundingClientRect()[k]])):null;
      const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      const exclusions=[...document.querySelectorAll('[data-slot-pick], [data-slot-delete], .title-modal-close, .title-modal-actions button, #title-modal-heading, .title-modal-rule, .hold-hint')].filter(e=>e!==tip&&e.getClientRects().length);
      const tr=rect(tip); const collisions=tr?exclusions.map(e=>({name:e.dataset.component||e.className||e.id,area:overlap(tr,rect(e))})).filter(x=>x.area>.01):[];
      const buttons=[...document.querySelectorAll('.title-menu-modal button:not([disabled])')].map(e=>rect(e));
      const scrollables=[document.documentElement,document.body,document.querySelector('.title-modal-veil'),modal,list].filter(Boolean).filter(e=>{const s=getComputedStyle(e);return /(auto|scroll)/.test(s.overflowY)&&e.scrollHeight>e.clientHeight+1;});
      const os=owner?getComputedStyle(owner):null; const ts=tip?getComputedStyle(tip):null;
      let safe={top:0,right:0,bottom:0,left:0}; try{safe=JSON.parse(tip?.dataset.safeInsets||'{}')}catch{}
      const vv=visualViewport||{offsetLeft:0,offsetTop:0,width:innerWidth,height:innerHeight};
      const bounds={left:vv.offsetLeft+safe.left,top:vv.offsetTop+safe.top,right:vv.offsetLeft+vv.width-safe.right,bottom:vv.offsetTop+vv.height-safe.bottom};
      return {
        mode:tip?.dataset.placement||null, copy:tip?.textContent||null, role:tip?.getAttribute('role')||null,
        tooltipCount:document.querySelectorAll('[role="tooltip"]:not([hidden])').length,
        describedBy:owner?.getAttribute('aria-describedby')||'', ownerId:owner?.dataset.slotPick||null,
        ownerPressed:owner?.getAttribute('aria-pressed')||null, activeOwner:document.activeElement===owner,
        focusVisible:!!os&&(os.outlineStyle!=='none'||os.boxShadow!=='none'), pointerEvents:ts?.pointerEvents||null,
        transitionDuration:ts?.transitionDuration||null, animationName:ts?.animationName||null,
        tip:tr, owner:rect(owner), modal:rect(modal), collisions, targets:buttons,
        inside:!!tr&&tr.left>=bounds.left-.5&&tr.top>=bounds.top-.5&&tr.right<=bounds.right+.5&&tr.bottom<=bounds.bottom+.5,
        safe,bounds, overflowX:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        scrollOwners:scrollables.map(e=>e.className||e.tagName), tipClipped:!!tip&&(tip.scrollHeight>tip.clientHeight+1||tip.scrollWidth>tip.clientWidth+1),
        live:tip?.getAttribute('aria-live')||null, loads:window.__ui17Loads||0, actions:window.__ui17TooltipActions||0,
        storageKeys:Object.keys(localStorage).sort(), pageScrollY:scrollY,
      };
    })()`);
    const open = async () => {
      await ev(`(async()=>{
        document.documentElement.style.fontSize='';
        document.documentElement.style.setProperty('--title-tooltip-safe-top','${safe.top}px');
        document.documentElement.style.setProperty('--title-tooltip-safe-right','${safe.right}px');
        document.documentElement.style.setProperty('--title-tooltip-safe-bottom','${safe.bottom}px');
        document.documentElement.style.setProperty('--title-tooltip-safe-left','${safe.left}px');
        const {openSaveSlotSelector}=await import('/src/ui/components/saveSlotSelector.js');
        const launcher=document.querySelector('[data-title-action="load"]'); window.__ui17Loads=0;
        openSaveSlotSelector({host:document.body,slots:[
          {slot:1,summary:{className:'Reaver',actNumber:2,floor:9,hp:51,maxHp:72,seedString:'UI17-A'}},
          {slot:2,summary:{className:'Starseer',actNumber:1,floor:4,hp:43,maxHp:58,seedString:'UI17-B'}},
          {slot:3,summary:null}],meta:{settings:{}},registries:{balance:{ui:{titleLoadHold:{ms:600}}}},inlineReview:true,
          returnFocusElement:launcher,onRequestLoad:()=>{window.__ui17Loads+=1;}}); return true;
      })()`);
      await until(`!!document.querySelector('[data-title-save-slot-tooltip]')`, 'tooltip mount');
      await wait(180);
    };
    const close = async () => {
      await ev(`window.__ui17ClosingOwner=document.querySelector('[data-slot-pick][aria-pressed="true"]'); true`);
      await key('Escape');
      await until(`!document.querySelector('[data-component="title-save-slot-list"]')`, 'selector close');
      return ev(`({focus:document.activeElement?.dataset?.titleAction||document.activeElement?.id||null,stale:window.__ui17ClosingOwner?.getAttribute('aria-describedby')?.includes('title-save-slot-tooltip')?1:0,tooltip:document.querySelectorAll('[data-title-save-slot-tooltip]').length})`);
    };

    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${served.port}/index.html?shot=title` }, sessionId);
    await until(`!!document.querySelector('[data-title-action="load"]')`, 'title boot');
    const storageBefore = await ev(`JSON.stringify(Object.entries(localStorage).sort())`);
    await open(); const initial = await snapshot();
    await click('[data-slot-pick="2"]'); const pointer = await snapshot(); const pointerClose = await close();
    await open(); await key('Enter'); const keyboard = await snapshot(); const keyboardClose = await close();
    await open(); await touch('[data-slot-pick="2"]'); const touchResult = await snapshot(); const touchClose = await close();
    await open(); await pad(); const padResult = await snapshot(); const padClose = await close();
    await open();
    await ev(`document.documentElement.style.fontSize='200%'; dispatchEvent(new Event('resize')); true`);
    await wait(260); const text200 = await snapshot();
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, sessionId);
    const shot = Buffer.from(data, 'base64');
    const screenshot = { sha256: createHash('sha256').update(shot).digest('hex').toUpperCase(), bytes: shot.length };
    const textClose = await close();
    const storageAfter = await ev(`JSON.stringify(Object.entries(localStorage).sort())`);
    const unexpectedConsole = diagnostics.console.filter((entry) => !/^\[map\] the framing does not fit:/.test(entry)
      && !/^\[map\] act plate missing:/.test(entry));
    const unexpectedNetwork = diagnostics.network.filter((entry) => !/favicon\.ico/.test(entry)
      && !/\/api\/lan\/info/.test(entry)
      && !/\/assets\/sfx\/holdTick_loadSave\.ogg$/.test(entry)
      && !/\.(?:png|webp|jpe?g|gif|svg|ogg|mp3|wav)(?:\?|$)/i.test(entry));
    const unexpectedExternal = [...new Set(diagnostics.external.filter((url) => !url.startsWith('chrome-extension:')))];
    releaseEvents();
    await cdp.send('Target.closeTarget', { targetId });
    return { label, width, height, safe, nativeSafeArea, initial, pointer, keyboard, touch: touchResult, pad: padResult, text200,
      closes: [pointerClose, keyboardClose, touchClose, padClose, textClose], screenshot,
      storageUnchanged: storageBefore === storageAfter, diagnostics: { console: unexpectedConsole, network: unexpectedNetwork, mutations: diagnostics.mutations, external: unexpectedExternal } };
  };

  results.push(await runViewport({ width: 1200, height: 730, mobile: false, label: 'WIDE', safe: { top: 0, right: 0, bottom: 0, left: 0 } }));
  results.push(await runViewport({ width: 390, height: 844, mobile: true, label: 'MOBILE', safe: { top: 24, right: 8, bottom: 16, left: 8 } }));
  results.push(await runViewport({ width: 320, height: 640, mobile: true, label: 'COMPACT', safe: { top: 20, right: 8, bottom: 12, left: 8 } }));
} catch (error) {
  console.error(`RED UI17-BROWSER-DOOR - ${error.stack || error.message}`);
  failures += 1;
} finally {
  try { cdp?.close(); } catch { /* best effort */ }
  try { await closeBrowser(); } catch { /* best effort */ }
  if (server) await new Promise((done) => server.close(done));
}

if (results.length === 3) {
  const [wide, mobile, compact] = results;
  const everyState = (predicate) => results.every((result) => [result.initial, result.pointer, result.keyboard, result.touch, result.pad, result.text200].every(predicate));
  console.log(`UI17 GEOMETRY DIAGNOSTICS ${JSON.stringify(results.map((result) => ({
    label: result.label,
    states: [result.initial, result.pointer, result.keyboard, result.touch, result.pad, result.text200].map((state) => ({
      mode: state.mode, inside: state.inside, tip: state.tip, owner: state.owner, modal: state.modal, bounds: state.bounds,
      transitionDuration: state.transitionDuration, animationName: state.animationName, live: state.live,
    })),
    diagnostics: result.diagnostics,
  })))}`);
  check(sourceGreen, 'G1-BASE-SOURCE', `exact source contract is green against base ${BASE} / tree ${BASE_TREE}`);
  check(everyState((s) => s.copy === COPY), 'G2-COPY', 'the visible singleton uses the locked sentence in every state');
  check(everyState((s) => s.ownerPressed === 'true' && s.describedBy.includes('title-save-slot-tooltip')), 'G3-OWNER', 'owner equals aria-pressed selected projection');
  check(everyState((s) => s.role === 'tooltip' && s.tooltipCount === 1), 'G4-IDS', 'one role=tooltip singleton and no duplicate visible tooltip');
  check(everyState((s) => s.targets.every((r) => r.width >= 44 && r.height >= 44)), 'G5-TARGETS', 'every enabled modal control remains at least 44x44');
  check(wide.initial.inside && wide.initial.collisions.length === 0 && ['inline-end', 'inline-start', 'block-end', 'block-start', 'reserve'].includes(wide.initial.mode),
    'G6-WIDE', `1200x730 emits contained rects and collision0 (${JSON.stringify({ mode: wide.initial.mode, tip: wide.initial.tip })})`);
  check(mobile.initial.inside && mobile.initial.collisions.length === 0 && mobile.initial.overflowX <= 0,
    'G7-MOBILE', `390x844 collision0 and horizontal overflow0 (${JSON.stringify({ mode: mobile.initial.mode, safe: mobile.initial.safe })})`);
  check(compact.initial.inside && compact.initial.collisions.length === 0 && compact.initial.overflowX <= 0,
    'G8-COMPACT', `320x640 collision0 and horizontal overflow0 (${JSON.stringify({ mode: compact.initial.mode, safe: compact.initial.safe })})`);
  check(everyState((s) => s.inside), 'G9-SAFE-CONTAINMENT', 'tooltip remains inside measured safe visual viewport');
  check(everyState((s) => s.collisions.length === 0), 'G10-HARD-EXCLUSIONS', 'owner, peers, headings, actions and hold hints intersect by 0px2');
  check(mobile.initial.mode === 'reserve' && compact.initial.mode === 'reserve', 'G11-NOFIT-RESERVE', 'narrow cells use owner-local reserve rather than overlap');
  check(results.every((r) => !r.text200.tipClipped && r.text200.overflowX <= 0 && r.text200.scrollOwners.length <= 1
      && (!r.text200.scrollOwners.length || r.text200.scrollOwners.some((name) => String(name).includes('title-menu-modal')))),
    'G12-TEXT-SCROLL', '200% text is unclipped with at most the modal as sole scroll owner');
  check(results.every((r) => [r.pointer, r.keyboard, r.touch, r.pad].every((s) => s.copy === COPY && s.loads === 0)),
    'G13-INPUT-PARITY', 'pointer, keyboard, touch and pad-equivalent expose the same facts without load');
  check(results.every((r) => [r.initial, r.pointer, r.keyboard, r.touch, r.pad].every((s) => s.activeOwner && s.focusVisible && s.pageScrollY === 0)),
    'G14-FOCUS', 'selected owner retains visible focus; page scroll and tooltip focus moves are 0');
  check(everyState((s) => s.pointerEvents === 'none' && s.loads === 0 && s.actions === 0), 'G15-INERT', 'tooltip hit area and unintended load/action dispatches are 0');
  check(results.every((r) => r.closes.every((c) => c.stale === 0 && c.tooltip === 0 && c.focus === 'load')),
    'G16-ARIA', 'close removes tooltip and stale aria ownership and restores the Load launcher');
  check(everyState((s) => (s.transitionDuration === '0s' || s.transitionDuration === '') && s.animationName === 'none' && !s.live),
    'G17-REDUCED-MOTION', 'reduced motion has no spatial transition or repeated live announcement');
  check(results.every((r) => r.storageUnchanged && r.diagnostics.mutations.length === 0 && r.diagnostics.external.length === 0 && r.diagnostics.console.length === 0 && r.diagnostics.network.length === 0)
      && !read('src/ui/components/titleSaveSlotTooltip.js').includes('ashenspire:title-tooltip-action'),
    'G18-BOUNDARY', `persistence/network/external/console mutations0 and grant ${GRANT_SHA} remains presentation-only (${JSON.stringify(results.map((r) => r.diagnostics))})`);
  console.log(`UI17 SCREENSHOT RECEIPTS ${JSON.stringify(results.map(({ label, width, height, screenshot, nativeSafeArea }) => ({ label, width, height, screenshot, nativeSafeArea })))}`);
}

console.log(`title-save-slot-tooltip: ${checks - failures}/${checks} gates passed; ${failures} failed`);
process.exit(failures ? 1 : 0);
