#!/usr/bin/env node
// Real-browser acceptance for FixModal W8: acting inside a modal never resets
// the screen underneath, and never reloads the page.
//
//   TITLE-NEW-NO-RESET  New Game modal open / slot pick / back keep the same
//                       `.title-screen` node, no reload, and no new animate().
//   SETTINGS-NO-RESET   Settings modal open, scroll inside it, and a General
//                       select change keep the Title node, the page and the
//                       modal, and keep the scrolled position within 40 px.
//                       If nothing scrolls at 390x844 that is UNKNOWN, not a pass.
//   NO-RELOAD           beforeunload never fires and the probe survives the run.

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
    tool: 'modal-no-reset.mjs',
    timeoutMs: 120000,
    plants: [
      {
        name: 'opening New Game rebuilds the whole Title instead of the modal layer',
        file: 'src/ui/screens/title.js',
        find: '    selectedSlot = saveSlotSelectionModel(currentSlots, { kind }).properties.selectedSlot;\n    renderModal();',
        replace: '    selectedSlot = saveSlotSelectionModel(currentSlots, { kind }).properties.selectedSlot;\n    render(); // modal-no-reset selftest plant',
        expectRed: /RED TITLE-NEW-NO-RESET/,
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
let unknowns = 0;
function check(ok, code, detail) {
  checks += 1;
  if (ok) console.log(`PASS ${code} - ${detail}`);
  else { failures += 1; console.error(`RED ${code} - ${detail}`); }
}
function unknown(code, detail) {
  unknowns += 1;
  console.log(`UNKNOWN ${code} – ${detail}`);
}

let server;
let serverPort;
let cdp;
let closeBrowser = async () => {};
try {
  if (!browserPath) throw new Error('no supported Chrome or Edge binary found');
  ({ server, port: serverPort } = await serve({ root: ROOT, port: 8253, open: false }));
  const launched = await launchBrowser({ prefix: 'modal-no-reset-', browser: browserPath, headless: '--headless=new', timeoutMs: 20000 });
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
    const point = await ev(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return null; e.scrollIntoView({block:'center',inline:'nearest'}); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    if (!point) throw new Error(`missing ${selector}`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
    await wait(120);
  };

  // One snapshot of everything the no-reset claim rests on. A reload leaves
  // `window.__modalProbe` unset and `__titleRoot` undefined in the new document,
  // so `root` and `probe` both go false.
  const snap = () => ev(`({
    root: document.querySelector('.title-screen') === window.__titleRoot && !!window.__titleRoot,
    probe: window.__modalProbe === 1,
    animate: window.__animateCalls ?? null,
    unloaded: window.__unloaded === true
  })`);
  // The animate counter is asserted for the New Game steps only; the Settings
  // step's assertions are the Title node, the probe, and the scroll position.
  const judge = (code, label, before, after, { animate = true } = {}) => {
    const animateOk = !animate || (before.animate != null && after.animate != null && after.animate <= before.animate);
    const animateText = animate ? `, animate ${before.animate}->${after.animate}` : '';
    check(after.root && after.probe && !after.unloaded && animateOk, code,
      `${label}: same Title node=${after.root}, probe=${after.probe}, unloaded=${after.unloaded}${animateText}`);
  };

  const url = `http://127.0.0.1:${serverPort}/?shot=title`;
  await cdp.send('Page.navigate', { url }, sessionId);
  await until(`!!document.querySelector('[data-title-action="new"]')`, 'title');
  await ev(`(() => {
    window.__modalProbe = 1;
    window.__titleRoot = document.querySelector('.title-screen');
    window.__unloaded = false;
    window.addEventListener('beforeunload', () => { window.__unloaded = true; });
    if (!window.__animateWrapped) {
      window.__animateWrapped = true;
      window.__animateCalls = 0;
      const original = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        window.__animateCalls += 1;
        return original.apply(this, args);
      };
    }
    return true;
  })()`);

  // 1. TITLE-NEW-NO-RESET: open New Game, pick a different slot, go back.
  const titleBase = await snap();
  await click('#new-game');
  await until(`!!document.querySelector('.title-menu-modal')`, 'New Game modal');
  const afterOpen = await snap();
  judge('TITLE-NEW-NO-RESET', 'after #new-game', titleBase, afterOpen);

  const pick = await ev(`(() => {
    const row = [...document.querySelectorAll('[data-slot-pick]')]
      .find((button) => !button.disabled && button.getAttribute('aria-pressed') !== 'true');
    return row ? row.dataset.slotPick : null;
  })()`);
  if (!pick) throw new Error('no different [data-slot-pick] row to choose');
  await click(`[data-slot-pick="${pick}"]`);
  await until(`!!document.querySelector('[data-slot-pick="${pick}"][aria-pressed="true"]')`, `slot ${pick} selected`);
  const afterPick = await snap();
  judge('TITLE-NEW-NO-RESET', `after slot ${pick} pick`, afterOpen, afterPick);

  await click('[data-title-action="back"], [data-title-action="close-modal"]');
  await until(`!document.querySelector('.title-menu-modal')`, 'New Game modal closed');
  const afterBack = await snap();
  judge('TITLE-NEW-NO-RESET', 'after back', afterPick, afterBack);

  // 2. SETTINGS-NO-RESET: open Settings, scroll inside it, change a General select.
  const settingsBase = await snap();
  await click('#settings');
  await until(`!!document.querySelector('[aria-modal="true"] [data-settings-host]')`, 'Settings modal', 15000);
  const afterSettings = await snap();
  judge('SETTINGS-NO-RESET', 'after #settings opens', settingsBase, afterSettings, { animate: false });

  // The scroller is the first element from [data-settings-host] up to the
  // [aria-modal] ancestor, host included, with scrollHeight > clientHeight that
  // really moves when scrolled. Walking past the modal would pick the page.
  const scroll = await ev(`(async () => {
    const host = document.querySelector('[aria-modal="true"] [data-settings-host]');
    if (!host) return { found: false };
    const modal = host.closest('[aria-modal="true"]');
    // The panel that scrolls usually sits INSIDE the host (.set-panel), so the
    // host's descendants are tried first, then the host and its ancestors.
    const candidates = [...host.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight + 4
      && /(auto|scroll)/.test(getComputedStyle(el).overflowY));
    for (let el = host; el; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight) candidates.push(el);
      if (el === modal) break;
    }
    for (const el of candidates) {
      const before = el.scrollTop;
      el.scrollTop = before + 300;
      await new Promise((r) => setTimeout(r, 250));
      const moved = el.scrollTop - before;
      if (moved > 0) {
        window.__settingsScroller = el;
        return { found: true, before, at: el.scrollTop, moved, tag: el.tagName, cls: String(el.className) };
      }
    }
    const sizes = (el) => el ? el.scrollHeight + '/' + el.clientHeight : 'none';
    return { found: false, candidates: candidates.length, host: sizes(host), modal: sizes(modal) };
  })()`);

  // A setting changed WITHIN the open topic: the first checkbox or switch now in
  // view inside the scrolled panel. (A General topic select is not used: it
  // shows another topic, where starting at the top is the intent.)
  const select = await ev(`(() => {
    const panel = window.__settingsScroller;
    if (!panel) return null;
    const box = panel.getBoundingClientRect();
    // A setting's own control: a choice button that is not the current one, a
    // switch that is not an action, or a dropdown with another option.
    const control = [...panel.querySelectorAll('button.choice[data-key]:not(.on):not([disabled]), [role="switch"][data-key]:not([data-action]):not([disabled]), select.set-choice-select[data-key]')]
      .find((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.top >= box.top && r.bottom <= box.bottom
        && (el.tagName !== 'SELECT' || el.options.length > 1); });
    if (!control) return null;
    const label = control.getAttribute('data-key') || control.getAttribute('aria-label') || control.tagName;
    const before = control.tagName === 'SELECT' ? control.value : (control.getAttribute('aria-pressed') ?? control.getAttribute('aria-checked'));
    if (control.tagName === 'SELECT') {
      control.selectedIndex = control.selectedIndex === 0 ? 1 : 0;
      control.dispatchEvent(new Event('change', { bubbles: true }));
    } else control.click();
    return { kind: 'setting ' + label, before: String(before), after: 'toggled', panelClass: String(panel.className) };
  })()`);
  await wait(300);

  // After the change the panel may have been rebuilt; re-find it by its class
  // and read where it is now.
  const settingsAfter = await ev(`(() => {
    const live = window.__settingsScroller && window.__settingsScroller.isConnected ? window.__settingsScroller : null;
    const cls = window.__settingsScroller ? String(window.__settingsScroller.className).split(/\\s+/).filter(Boolean).map((c) => '.' + c).join('') : '';
    const el = live || (cls ? document.querySelector('[aria-modal="true"] ' + cls) : null);
    return { connected: !!live, top: el ? el.scrollTop : null, modalOpen: !!document.querySelector('[aria-modal="true"] [data-settings-host]') };
  })()`);
  const settingsEnd = await snap();

  // The reset facts are always RED-able: a rebuilt Title, a reload, or a closed
  // modal fails whether or not anything scrolled. Only the scroll and select
  // measurements can be UNKNOWN, and they never count as a pass on their own.
  const resetHeld = settingsEnd.root && settingsEnd.probe && !settingsEnd.unloaded && settingsAfter.modalOpen;
  const resetText = `Title node=${settingsEnd.root}, probe=${settingsEnd.probe}, modal open=${settingsAfter.modalOpen}`;
  if (!resetHeld) {
    check(false, 'SETTINGS-NO-RESET', `${resetText}; select ${select ? `${select.before}->${select.after}` : 'absent'}`);
  } else if (!scroll.found) {
    unknown('SETTINGS-NO-RESET', `nothing scrolls inside the Settings modal at 390x844 `
      + `(candidates=${scroll.candidates ?? 0}, host scroll/client=${scroll.host}, modal=${scroll.modal}); `
      + `scroll position not measured; ${select ? `${select.kind} ${select.before}->${select.after}, Title node kept` : 'no General select'}`);
  } else if (!select) {
    unknown('SETTINGS-NO-RESET', `scrolled ${scroll.moved}px, but no setting control was in view inside the panel; change not exercised`);
  } else {
    const drift = settingsAfter.top == null ? Infinity : Math.abs(settingsAfter.top - scroll.at);
    check(drift <= 40, 'SETTINGS-NO-RESET',
      `${scroll.tag}.${scroll.cls} scrolled ${scroll.moved}px to ${scroll.at}, ${select.kind} ${select.before}->${select.after}; `
      + `now ${settingsAfter.top} (drift ${Number.isFinite(drift) ? drift : 'n/a'}px, element ${settingsAfter.connected ? 'kept' : 'rebuilt'}); ${resetText}`);
  }

  // 3. NO-RELOAD: the probe survived the whole run and beforeunload never fired.
  const final = await snap();
  check(final.probe && !final.unloaded, 'NO-RELOAD',
    `probe=${final.probe}, beforeunload fired=${final.unloaded} across the run`);

  await cdp.send('Target.closeTarget', { targetId });

  if (!checks && !unknowns) throw new Error('no checks ran');
  const summary = `${checks - failures}/${checks} checks passed; ${failures} failed; ${unknowns} UNKNOWN`;
  if (failures) console.error(`modal-no-reset: RED - ${summary}`);
  else if (unknowns) console.log(`modal-no-reset: UNKNOWN - ${summary}`);
  else console.log(`modal-no-reset: OK - ${checks} checks passed`);
  console.log('BOUNDARY: source tree, one private headless browser, 390x844 pointer flow through the New Game modal (open, slot pick, back) and the Settings modal (open, scroll, General select change); no real device, no physical controller, no real-device Safari.');
  process.exitCode = failures ? 1 : unknowns ? 2 : 0;
} catch (error) {
  console.error(`modal-no-reset: UNKNOWN - ${error.stack || error.message}`);
  process.exitCode = 2;
} finally {
  try { cdp?.close(); } catch { /* already closed */ }
  try { await closeBrowser(); } catch { /* cleanup is reported by browser.mjs */ }
  try { server?.close(); } catch { /* already closed */ }
}
