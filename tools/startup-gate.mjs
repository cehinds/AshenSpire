#!/usr/bin/env node
// Issue #229 — the cold boot belongs to the startup gate until one complete
// physical press releases. Source is served by tools/serve.mjs and driven in
// real Chromium through tools/browser.mjs. No DOM click substitutes are used
// for the input-family claims.
//
// Usage: node tools/startup-gate.mjs
//        node tools/startup-gate.mjs --selftest
// Exit: 0 all contracts green · 1 product finding · 2 unavailable/tool failure

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { padOrdinal, readOrdinal, release, sourceDigest } from './buildversion.mjs';
import { serve } from './serve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const args = process.argv.slice(2);
const ONLY = (() => { const i = args.indexOf('--only'); return i >= 0 ? args[i + 1] : ''; })();
const SELFTEST_LANE = ONLY === 'selftest';
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const browserPath = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => candidate && existsSync(candidate));

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

if (args.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const code = await doorSelftest({
    tool: 'startup-gate.mjs',
    args: ['--only', 'selftest'],
    timeoutMs: 180000,
    plants: [
      {
        name: 'title controls are mounted behind the cold-boot surface',
        file: 'src/ui/components/startupGate.js',
        find: '    <section class="screen startup-gate"',
        replace: '    <div class="title-screen"><button class="slot-new">PLANT</button></div>\n    <section class="screen startup-gate"',
        expectRed: /RED A1\.COLD-ONLY/,
      },
      {
        name: 'startup uses a non-startup build-stamp placement',
        file: 'src/ui/components/startupGate.js',
        find: "${buildStampHtml('startup')}",
        replace: "${buildStampHtml('title')}",
        expectRed: /RED A2\.STARTUP-STAMP/,
      },
      {
        name: 'last-input family stops changing the visible prompt',
        file: 'src/ui/components/startupGate.js',
        find: 'prompt.textContent = properties.prompts[next];',
        replace: "prompt.textContent = properties.prompts.keyboard; // startup-gate selftest plant",
        expectRed: /RED A3\.PROMPT-FAMILY/,
      },
      {
        name: 'analog-stick activity bypasses the startup input-family owner',
        file: 'src/ui/input.js',
        find: "      gateInput({ family: 'controller', kind: 'axis', phase: 'move' });",
        replace: "      false; // startup-gate selftest plant",
        expectRed: /RED A3\.PROMPT-ANALOG/,
      },
      {
        name: 'Space is no longer an activation key',
        file: 'src/ui/components/startupGate.js',
        find: "if (input.family === 'keyboard') return input.key === 'Enter' || input.key === ' ';",
        replace: "if (input.family === 'keyboard') return input.key === 'Enter'; // startup-gate selftest plant",
        expectRed: /RED A5\.SPACE\.REVEAL-ONCE/,
      },
      {
        name: 'controller reveals on button-down instead of release',
        file: 'src/ui/components/startupGate.js',
        find: '      if (!input.repeat) armed = identity;',
        replace: "      if (input.family === 'controller') finish(input.family);\n      if (!input.repeat) armed = identity;",
        expectRed: /RED A7\.GAMEPAD-RELEASE/,
      },
      {
        name: 'Start or Menu button 9 is no longer an activation button',
        file: 'src/ui/components/startupGate.js',
        find: "  if (input.family === 'controller') {",
        replace: "  if (input.family === 'controller' && input.button !== 9 && input.action !== 'menu') {",
        expectRed: /RED A7\.GAMEPAD-REVEAL/,
      },
      {
        name: 'returning to title re-opens the startup gate',
        file: 'src/main.js',
        find: 'startupGatePending = false;',
        replace: 'startupGatePending = true; // startup-gate selftest plant',
        expectRed: /RED A8\.RETURN-BYPASS/,
      },
      {
        name: 'startup outranks the corrupt-profile crisis notice',
        file: 'src/main.js',
        find: '  if (showProfileNoticeIfNeeded()) return;',
        replace: '  if (false && showProfileNoticeIfNeeded()) return; // startup-gate selftest plant',
        expectRed: /RED A9\.CRISIS-PRECEDENCE/,
      },
      {
        name: 'interrupted startup presses stay armed',
        file: 'src/ui/components/startupGate.js',
        find: "      if (!input.family || armed?.startsWith(`${input.family}:`)) armed = null;",
        replace: '      armed = armed; // startup-gate selftest plant',
        expectRed: /RED A7\.INTERRUPT-CANCEL/,
      },
      {
        name: 'window blur leaves a held controller activation armed',
        file: 'src/ui/input.js',
        find: '    cancelInputGate();',
        replace: "    cancelInputGate('keyboard'); // startup-gate selftest plant",
        expectRed: /RED A7\.GAMEPAD-BLUR-CANCEL/,
      },
      {
        name: 'a controller button held before the first poll becomes a rising edge',
        file: 'src/ui/input.js',
        find: '      padPrev[pad.index] = pressed;',
        replace: '      padPrev[pad.index] = pressed.map(() => false); // startup-gate selftest plant',
        expectRed: /RED A7\.HELD-AT-BOOT/,
      },
      {
        name: 'startup activation is removed from the accessibility tree',
        file: 'src/ui/models/StartupGateModels.js',
        find: "      role: 'button',",
        replace: "      role: 'region', // startup-gate selftest plant",
        expectRed: /RED A1\.ACTION-SEMANTICS/,
      },
      {
        name: 'pointer reveal publishes the persistent gamepad cursor',
        file: 'src/main.js',
        find: "        focusCursor: family === 'keyboard' || family === 'controller',",
        replace: '        focusCursor: true, // startup-gate selftest plant',
        expectRed: /RED A6\.POINTER-CURSOR/,
      },
      {
        name: 'reveal transition skips its deterministic cleanup deadline',
        file: 'src/ui/components/startupGate.js',
        find: "    const delay = document.body.classList.contains('reduced-motion') ? 140 : 180;",
        replace: "    const delay = document.body.classList.contains('reduced-motion') ? 900 : 180; // startup-gate selftest plant",
        expectRed: /RED A10\.REVEAL-CLEANUP/,
      },
      {
        name: 'reduced-motion setting no longer reaches the rendered page',
        file: 'src/main.js',
        find: "document.body.classList.toggle('reduced-motion', settings.reducedMotion === true);",
        replace: "document.body.classList.toggle('reduced-motion', false); // startup-gate selftest plant",
        expectRed: /RED A10\.REDUCED-MOTION/,
      },
    ],
  });
  if (code === 0) console.log('startup-gate-selftest: OK — 16 plants, 16 caught');
  process.exit(code);
}

if (!browserPath) {
  console.error('startup-gate: UNKNOWN — no Chrome/Chromium/Edge found; set CHROME.');
  console.error('UNKNOWN BLOCKS: no browser acceptance work ran.');
  process.exit(2);
}

let server;
let serverPort;
let browser;
let dropBrowser = async () => {};
let cdp;
let checks = 0;
let failures = 0;
function servedStamp(root) {
  const digest = sourceDigest(root).digest;
  let version = release(root);
  try {
    const recorded = readOrdinal(root);
    if (recorded.digest === digest) version += `.${padOrdinal(recorded.ordinal)}`;
  } catch { /* serve.mjs truthfully omits an unavailable or stale ordinal */ }
  return `BUILD ${version} · src ${digest}`;
}
const expectedStamp = servedStamp(ROOT);

function verdict(condition, code, detail) {
  checks += 1;
  if (condition) console.log(`  OK  ${code} — ${detail}`);
  else { failures += 1; console.error(`  RED ${code} — ${detail}`); }
}

async function page({
  query = '', width = 1200, height = 730, mobile = false,
  pad = false, heldButton = null, corruptProfile = false, reduced = false,
} = {}) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile,
  }, sessionId);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 }, sessionId);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }],
  }, sessionId);
  const bootstrap = `(() => {
    localStorage.clear();
    ${corruptProfile ? "localStorage.setItem('sote_meta_v1', '{torn'); localStorage.removeItem('sote_meta_backup_v1');" : ''}
    const state = { connected: ${pad}, buttons: Array.from({length: 16}, () => ({pressed:false,value:0})) };
    ${Number.isInteger(heldButton) ? `state.buttons[${heldButton}]={pressed:true,value:1};` : ''}
    const gamepad = { id:'startup-gate-test-pad', index:0, connected:true, mapping:'standard',
      timestamp:0, axes:[0,0,0,0], buttons:state.buttons };
    Object.defineProperty(navigator, 'getGamepads', { configurable:true, value:() => state.connected ? [gamepad] : [] });
    window.__startupPad = {
      connect() { state.connected=true; dispatchEvent(new Event('gamepadconnected')); },
      disconnect() { state.connected=false; dispatchEvent(new Event('gamepaddisconnected')); },
      set(index, pressed) { state.buttons[index]={pressed,value:pressed?1:0}; gamepad.timestamp += 1; },
      setAxis(index, value) { gamepad.axes[index]=value; gamepad.timestamp += 1; }
    };
  })();`;
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: bootstrap }, sessionId);
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
  const url = `http://127.0.0.1:${serverPort}/${query}`;
  await cdp.send('Page.navigate', { url }, sessionId);
  await until(`location.href === ${JSON.stringify(url)} && document.readyState !== 'loading'`, url);
  if (pad) await wait(80);
  return {
    targetId, sessionId, ev, until,
    async key(key) {
      const vk = key === 'Enter' ? 13 : key === ' ' ? 32 : key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0;
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key === ' ' ? 'Space' : key, windowsVirtualKeyCode: vk }, sessionId);
      await wait(60);
      return async () => {
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key === ' ' ? 'Space' : key, windowsVirtualKeyCode: vk }, sessionId);
        await wait(100);
      };
    },
    async mouse(type = 'click') {
      const point = await ev(`(() => { const r=document.querySelector('.startup-gate').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      if (type === 'move') {
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y }, sessionId);
      } else {
        await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
      }
      await wait(100);
    },
    async click(selector) {
      const point = await ev(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
      if (!point) throw new Error(`missing ${selector}`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
      await wait(120);
    },
    async close() { await cdp.send('Target.closeTarget', { targetId }); },
  };
}

async function startupFacts(p) {
  return p.ev(`(() => {
    const gate=document.querySelector('.startup-gate');
    const stamp=document.querySelector('[data-role="build-version"]');
    const focusables=[...document.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')]
      .filter(e => e.tabIndex >= 0 && !e.hidden && getComputedStyle(e).display !== 'none');
    return { gate:!!gate, title:!!document.querySelector('.title-screen'), titleControls:document.querySelectorAll('.slot-new,.slot-continue,.title-menu button').length,
       focusables:focusables.map(e=>e.outerHTML.slice(0,80)), active:document.activeElement?.className||document.activeElement?.tagName,
       role:gate?.getAttribute('role')||'', label:gate?.getAttribute('aria-label')||'',
      prompt:document.querySelector('.startup-prompt')?.textContent.trim()||'', family:gate?.dataset.inputFamily||'',
      stamp:stamp?.textContent.trim()||'', place:stamp?.dataset.place||'' };
  })()`);
}

async function assertColdAndStamp() {
  const p = await page();
  await p.until(`!!document.querySelector('.startup-gate,.title-screen,.profile-notice')`, 'cold boot surface');
  let f = await startupFacts(p);
  verdict(f.gate && !f.title && f.titleControls === 0, 'A1.COLD-ONLY', `startup=${f.gate}, title=${f.title}, title controls=${f.titleControls}`);
  verdict(f.focusables.length === 1 && f.focusables[0].includes('startup-gate'), 'A1.TAB-EXPOSURE', `Tab ring exposes only the startup action (${f.focusables.join(', ') || 'none'})`);
  verdict(f.role === 'button' && /continue/i.test(f.label), 'A1.ACTION-SEMANTICS', `role=${f.role || 'none'}, label=${JSON.stringify(f.label)}`);
  const releaseTab = await p.key('Tab'); await releaseTab();
  f = await startupFacts(p);
  verdict(!f.title && f.titleControls === 0, 'A1.TAB-CONSUMPTION', 'Tab cannot reach or activate a title control behind startup');
  verdict(f.place === 'startup' && f.stamp === expectedStamp, 'A2.STARTUP-STAMP', `place=${f.place}, text="${f.stamp}", expected="${expectedStamp}"`);
  await p.close();
}

async function assertPromptFamilies() {
  const p = await page();
  await p.until(`!!document.querySelector('.startup-prompt')`, 'startup prompt');
  await p.mouse('move');
  let f = await startupFacts(p);
  verdict(f.family === 'pointer' && f.prompt === 'CLICK TO CONTINUE', 'A3.PROMPT-FAMILY', `mouse -> ${f.family}: ${f.prompt}`);
  await p.ev(`window.__startupPad.connect()`); await wait(80);
  await p.ev(`window.__startupPad.set(12,true)`); await wait(80);
  f = await startupFacts(p);
  verdict(f.gate && f.family === 'controller' && /A \/ CROSS/.test(f.prompt), 'A3.PROMPT-CONTROLLER', `D-pad -> ${f.family}: ${f.prompt}`);
  await p.ev(`window.__startupPad.set(12,false)`); await wait(50);
  await p.mouse('move');
  await p.ev(`window.__startupPad.setAxis(0,1)`); await wait(100);
  f = await startupFacts(p);
  verdict(f.gate && f.family === 'controller' && /A \/ CROSS/.test(f.prompt), 'A3.PROMPT-ANALOG', `left stick -> ${f.family}: ${f.prompt}`);
  await p.ev(`window.__startupPad.setAxis(0,0)`); await wait(50);
  await p.close();
}

async function assertKeyboard(key, code) {
  const p = await page();
  await p.until(`!!document.querySelector('.startup-gate')`, `${key} startup`);
  const release = await p.key(key);
  verdict(await p.ev(`!!document.querySelector('.startup-gate') && !document.querySelector('.title-screen')`), `${code}.DOWN-CONSUMED`, `${JSON.stringify(key)} down is consumed and does not reveal`);
  await release();
  await wait(180);
  const receipt = await p.ev(`({startup:!!document.querySelector('.startup-gate'), title:!!document.querySelector('.title-screen'), customize:!!document.querySelector('.customize'), active:document.activeElement?.className||''})`);
  verdict(!receipt.startup && receipt.title && !receipt.customize, `${code}.REVEAL-ONCE`, `${JSON.stringify(key)} release reveals title without activating it (${JSON.stringify(receipt)})`);
  verdict(/slot-(new|continue)/.test(receipt.active), `${code}.TITLE-FOCUS`, `default title control owns DOM focus (${receipt.active || 'none'})`);
  await p.close();
}

async function assertPointerCursor() {
  const mouse = await page();
  await mouse.until(`!!document.querySelector('.startup-gate')`, 'pointer startup');
  await mouse.mouse();
  await mouse.until(`!!document.querySelector('.title-screen')`, 'pointer reveal');
  verdict(await mouse.ev(`!document.querySelector('.startup-gate') && !!document.querySelector('.title-screen') && !!document.activeElement?.matches('.slot-new,.slot-continue')`), 'A6.POINTER', 'real mouse press reveals once and focuses the title default');
  verdict(await mouse.ev(`!!document.activeElement?.matches('.slot-new,.slot-continue') && !document.activeElement.classList.contains('gp-focus')`), 'A6.POINTER-CURSOR', 'pointer reveal keeps DOM focus without publishing the persistent gamepad cursor');
  await mouse.close();
}

async function assertTouch() {
  const touch = await page({ width: 390, height: 844, mobile: true });
  await touch.until(`!!document.querySelector('.startup-gate')`, 'touch startup');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 422, radiusX: 2, radiusY: 2, force: 1, id: 1 }] }, touch.sessionId);
  await wait(80);
  const down = await startupFacts(touch);
  verdict(down.gate && down.family === 'touch' && down.prompt === 'TAP TO CONTINUE', 'A6.TOUCH-DOWN', `touch down updates prompt but leaves gate standing (${down.family}: ${down.prompt})`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, touch.sessionId);
  await touch.until(`!!document.querySelector('.title-screen')`, 'touch reveal');
  verdict(await touch.ev(`!document.querySelector('.startup-gate') && !!document.activeElement?.matches('.slot-new,.slot-continue')`), 'A6.TOUCH-UP', 'real touch completion reveals once and focuses the title default');
  verdict(await touch.ev(`!!document.activeElement?.matches('.slot-new,.slot-continue') && !document.activeElement.classList.contains('gp-focus')`), 'A6.TOUCH-CURSOR', 'touch reveal keeps DOM focus without publishing the persistent gamepad cursor');
  await touch.close();
}

async function assertGamepad(button) {
  const p = await page({ pad: true });
  await p.until(`!!document.querySelector('.startup-gate')`, `gamepad ${button} startup`);
  await p.ev(`window.__startupPad.set(${button},true)`); await wait(100);
  verdict(await p.ev(`!!document.querySelector('.startup-gate') && !document.querySelector('.startup-gate.is-revealing') && !document.querySelector('.title-screen')`), 'A7.GAMEPAD-RELEASE', `button ${button} down is consumed without beginning reveal`);
  await p.ev(`window.__startupPad.set(${button},false)`); await wait(220);
  await wait(150);
  const r = await p.ev(`({title:!!document.querySelector('.title-screen'),startup:!!document.querySelector('.startup-gate'),customize:!!document.querySelector('.customize'),veil:!!document.querySelector('.modal-veil'),active:document.activeElement?.className||''})`);
  verdict(r.title && !r.startup, 'A7.GAMEPAD-REVEAL', `button ${button} release reveals the title (${JSON.stringify(r)})`);
  verdict(r.title && !r.startup && !r.customize && !r.veil && /slot-(new|continue)/.test(r.active), 'A7.GAMEPAD-NO-DOUBLE', `button ${button} release reveals/focuses without title activation (${JSON.stringify(r)})`);
  await p.close();
}

async function assertInterruptedPresses() {
  const keyboard = await page();
  await keyboard.until(`!!document.querySelector('.startup-gate')`, 'keyboard interrupt startup');
  const release = await keyboard.key('Enter');
  await keyboard.ev(`dispatchEvent(new Event('blur'))`);
  await release();
  await wait(220);
  verdict(await keyboard.ev(`!!document.querySelector('.startup-gate') && !document.querySelector('.title-screen')`), 'A7.INTERRUPT-CANCEL', 'blur cancels the armed keyboard press; its orphaned keyup cannot reveal title');
  const freshRelease = await keyboard.key('Enter'); await freshRelease();
  await keyboard.until(`!!document.querySelector('.title-screen')`, 'fresh keyboard press after blur');
  await keyboard.close();

  const pad = await page({ pad: true });
  await pad.until(`!!document.querySelector('.startup-gate')`, 'gamepad interrupt startup');
  await pad.ev(`window.__startupPad.set(0,true)`); await wait(100);
  await pad.ev(`window.__startupPad.disconnect()`); await wait(100);
  await pad.ev(`window.__startupPad.set(0,false); window.__startupPad.connect()`); await wait(140);
  verdict(await pad.ev(`!!document.querySelector('.startup-gate') && !document.querySelector('.title-screen')`), 'A7.INTERRUPT-CANCEL', 'disconnect cancels the armed controller press; reconnecting unpressed cannot synthesize a reveal');
  await pad.ev(`window.__startupPad.set(0,true)`); await wait(100);
  await pad.ev(`window.__startupPad.set(0,false)`); await wait(260);
  verdict(await pad.ev(`!document.querySelector('.startup-gate') && !!document.querySelector('.title-screen')`), 'A7.INTERRUPT-RECOVERY', 'a fresh complete controller press still reveals after reconnect');
  await pad.close();

  const blurredPad = await page({ pad: true });
  await blurredPad.until(`!!document.querySelector('.startup-gate')`, 'gamepad blur startup');
  await blurredPad.ev(`window.__startupPad.set(0,true)`); await wait(100);
  await blurredPad.ev(`dispatchEvent(new Event('blur'))`);
  await blurredPad.ev(`window.__startupPad.set(0,false)`); await wait(240);
  verdict(await blurredPad.ev(`!!document.querySelector('.startup-gate') && !document.querySelector('.title-screen')`), 'A7.GAMEPAD-BLUR-CANCEL', 'window blur cancels controller ownership; the orphaned release cannot reveal title');
  await blurredPad.ev(`window.__startupPad.set(0,true)`); await wait(100);
  await blurredPad.ev(`window.__startupPad.set(0,false)`); await wait(260);
  verdict(await blurredPad.ev(`!document.querySelector('.startup-gate') && !!document.querySelector('.title-screen')`), 'A7.GAMEPAD-BLUR-RECOVERY', 'a fresh complete controller press still reveals after focus returns');
  await blurredPad.close();

  const held = await page({ pad: true, heldButton: 0 });
  await held.until(`!!document.querySelector('.startup-gate')`, 'held-at-boot startup');
  await wait(120);
  await held.ev(`window.__startupPad.set(0,false)`); await wait(240);
  verdict(await held.ev(`!!document.querySelector('.startup-gate') && !document.querySelector('.title-screen')`), 'A7.HELD-AT-BOOT', 'a button already held when polling begins is seeded, not invented as a fresh activation');
  await held.ev(`window.__startupPad.set(0,true)`); await wait(100);
  await held.ev(`window.__startupPad.set(0,false)`); await wait(260);
  verdict(await held.ev(`!document.querySelector('.startup-gate') && !!document.querySelector('.title-screen')`), 'A7.HELD-RECOVERY', 'release then a fresh complete press reveals normally');
  await held.close();
}

async function assertReturnBypass() {
  const p = await page();
  await p.until(`!!document.querySelector('.startup-gate')`, 'return startup');
  const release = await p.key('Enter'); await release();
  await p.until(`!!document.querySelector('.slot-new,.slot-continue')`, 'title before return route');
  await p.click('.slot-new');
  await p.until(`!!document.querySelector('#cz-back')`, 'character creation');
  await p.click('#cz-back');
  await p.until(`!!document.querySelector('.title-screen,.startup-gate')`, 'returned title route');
  verdict(await p.ev(`!document.querySelector('.startup-gate') && !!document.querySelector('.title-screen')`), 'A8.RETURN-BYPASS', 'Back to title does not create a second startup gate');
  await p.close();
}

async function assertCrisisPrecedence() {
  const p = await page({ corruptProfile: true });
  await p.until(`!!document.querySelector('.profile-notice, .startup-gate')`, 'crisis or startup');
  const first = await p.ev(`({notice:!!document.querySelector('.profile-notice'),startup:!!document.querySelector('.startup-gate')})`);
  verdict(first.notice && !first.startup, 'A9.CRISIS-PRECEDENCE', `corrupt-profile notice is first (${JSON.stringify(first)})`);
  if (first.notice) {
    await p.click('.profile-notice .notnow');
    await p.until(`!!document.querySelector('.startup-gate')`, 'startup after non-destructive crisis exit');
    verdict(await p.ev(`!!document.querySelector('.startup-gate') && !document.querySelector('.title-screen')`), 'A9.CRISIS-THEN-STARTUP', 'leaving the notice non-destructively resumes the pending cold-start gate');
  } else {
    verdict(false, 'A9.CRISIS-THEN-STARTUP', 'precedence failed, so the continuation edge was unavailable');
  }
  await p.close();
}

async function motionSignature() {
  const p = await page({ query: `?shot=startup&shotInput=keyboard&shotSettings=${encodeURIComponent(JSON.stringify({ reducedMotion: true }))}`, reduced: true });
  await p.until(`!!document.querySelector('.startup-ash')`, 'reduced-motion startup');
  const fact = await p.ev(`(() => ({ reduced:document.body.classList.contains('reduced-motion'), particles:[...document.querySelectorAll('.startup-ash')].map(e=>({p:e.dataset.particle,style:e.getAttribute('style'),duration:getComputedStyle(e).animationDuration})), transition:getComputedStyle(document.querySelector('.startup-wordmark')).transitionDuration }))()`);
  await p.close();
  return fact;
}

async function assertReducedMotion() {
  const a = await motionSignature();
  const b = await motionSignature();
  const short = a.particles.every(({ duration }) => duration.split(',').every((d) => d.endsWith('ms') ? parseFloat(d) <= 20 : parseFloat(d) <= 0.02));
  verdict(a.reduced && short, 'A10.REDUCED-MOTION', `class=${a.reduced}, particle durations=${[...new Set(a.particles.map(x=>x.duration))].join('/')}`);
  verdict(JSON.stringify(a.particles.map(({ p, style }) => [p, style])) === JSON.stringify(b.particles.map(({ p, style }) => [p, style])), 'A10.DETERMINISTIC-ASH', `${a.particles.length} authored particle records are byte-stable across fresh boots`);

  const p = await page({ query: `?shot=startup&shotInput=keyboard&shotSettings=${encodeURIComponent(JSON.stringify({ reducedMotion: true }))}`, reduced: true });
  await p.until(`!!document.querySelector('.startup-gate')`, 'reduced-motion reveal startup');
  const started = Date.now();
  const release = await p.key('Enter'); await release();
  const during = await p.ev(`({revealing:document.querySelector('.startup-gate')?.classList.contains('is-revealing')===true,busy:document.querySelector('.startup-gate')?.getAttribute('aria-busy')})`);
  await wait(180);
  const after = await p.ev(`({startup:!!document.querySelector('.startup-gate'),title:!!document.querySelector('.title-screen'),ash:document.querySelectorAll('.startup-ash').length})`);
  const elapsed = Date.now() - started;
  verdict(during.revealing && during.busy === 'true', 'A10.READABLE-EXIT', `reduced-motion reveal retains a short marked exit state (${JSON.stringify(during)})`);
  verdict(!after.startup && after.title && after.ash === 0 && elapsed < 600, 'A10.REVEAL-CLEANUP', `startup unmounted by deterministic deadline (${elapsed}ms, ${JSON.stringify(after)})`);
  await p.close();
}

async function assertShape(shape, textSize) {
  const settings = encodeURIComponent(JSON.stringify({ textSize }));
  const p = await page({ query: `?shot=startup&shotInput=keyboard&shotSettings=${settings}`, width: shape.w, height: shape.h, mobile: shape.w <= 390 });
  await p.until(`!!document.querySelector('.startup-gate')`, `${shape.tag} Text ${textSize}`);
  const fact = await p.ev(`(() => { const e=document.querySelector('.startup-gate'); const r=e.getBoundingClientRect();
    const critical=[document.querySelector('.startup-wordmark'),document.querySelector('.startup-prompt'),document.querySelector('[data-place="startup"]')].filter(Boolean);
    const boxes=critical.map(x=>{const b=x.getBoundingClientRect();return [x.className||x.dataset.place,Math.round(b.left),Math.round(b.top),Math.round(b.right),Math.round(b.bottom)]});
    const outside=boxes.some(([,l,t,right,bottom])=>l < -1 || t < -1 || right > innerWidth+1 || bottom > innerHeight+1);
    return {font:getComputedStyle(document.documentElement).fontSize, overflow:outside, documentWidth:document.documentElement.scrollWidth, box:[Math.round(r.width),Math.round(r.height)], boxes, upright:!!document.querySelector('.upright-veil:not([hidden])')}; })()`);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, p.sessionId);
  const expectedFont = textSize === 'M' ? '10px' : '12px';
  verdict(fact.font === expectedFont && !fact.overflow && !fact.upright && shot.data.length > 5000, 'A11.RESPONSIVE-SHAPE', `${shape.tag} Text ${textSize}: font=${fact.font}, box=${fact.box.join('x')}, criticalOutside=${fact.overflow}, documentWidth=${fact.documentWidth}, upright=${fact.upright}, capture=${shot.data.length}b64 chars, critical=${JSON.stringify(fact.boxes)}`);
  await p.close();
}

async function main() {
  console.log(`startup-gate: issue #229 browser acceptance${SELFTEST_LANE ? ' (compact same-door lane)' : ''}`);
  console.log(`  source: ${ROOT}`);
  console.log(`  browser: ${browserPath}`);
  console.log(`  expected shared stamp: ${expectedStamp}`);
  ({ server, port: serverPort } = await serve({ root: ROOT, port: 8249, open: false }));
  const launched = await launchBrowser({ prefix: 'startup-gate-', browser: browserPath, headless: '--headless=new', timeoutMs: 20000 });
  browser = launched.child; dropBrowser = launched.close;
  cdp = connectCdp(launched.wsUrl); await cdp.ready;

  await assertColdAndStamp();
  await assertPromptFamilies();
  await assertKeyboard('Enter', 'A4.ENTER');
  await assertKeyboard(' ', 'A5.SPACE');
  await assertPointerCursor();
  if (!SELFTEST_LANE) await assertTouch();
  await assertGamepad(0);
  await assertGamepad(9);
  await assertInterruptedPresses();
  await assertReturnBypass();
  await assertCrisisPrecedence();
  await assertReducedMotion();
  if (!SELFTEST_LANE) {
    const shapes = [{ tag:'390x844', w:390, h:844 }, { tag:'844x344', w:844, h:344 }, { tag:'1200x730', w:1200, h:730 }];
    for (const textSize of ['M', 'XL']) for (const shape of shapes) await assertShape(shape, textSize);
  }

  if (!checks) { console.error('startup-gate: UNKNOWN — NOTHING RAN.'); process.exitCode = 2; return; }
  if (failures) console.error(`\nstartup-gate: RED — ${checks - failures}/${checks} checks passed; ${failures} failed.`);
  else console.log(`\nstartup-gate: OK — ${checks} checks passed`);
  console.log('BOUNDARY: source tree, one spawned Chromium, cold/local profile storage, keyboard, real CDP mouse/touch, and a standard-mapping gamepad shim read by the production poller.');
  process.exitCode = failures ? 1 : 0;
}

try {
  await main();
} catch (error) {
  console.error(`startup-gate: UNKNOWN — ${error.stack || error.message}`);
  process.exitCode = 2;
} finally {
  const intendedExit = process.exitCode;
  try { cdp?.close(); } catch { /* already closed */ }
  try { await dropBrowser(); } catch { /* already closed */ }
  try { server?.close(); } catch { /* already closed */ }
  process.exit(intendedExit ?? 0);
}
