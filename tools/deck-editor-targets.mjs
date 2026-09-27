#!/usr/bin/env node
// tools/deck-editor-targets.mjs — the deck editor's browser probe (SPEC §14.1
// UX, docs/FINISH.md §14 "Deck editor UI").
//
//   node tools/deck-editor-targets.mjs      exit 0 when every check holds
//
// In a real Chromium with touch emulation (so `(pointer: coarse)` matches) at
// 360×640 and 390×844, each at UI zoom 1 and 0.62, it mounts the production
// deck editor over a Reaver run (Play in deck order on, so the ▲/▼/Move row
// controls are drawn; the minimum raised so Done is refused), and checks:
//   TARGETS   every button inside the editor is at least 48 CSS px on glass
//             on both axes (a tap floor, measured, not read from CSS);
//   TEXT      no text inside the editor is under 11 px on glass;
//   NO-HSCROLL the page does not scroll sideways;
//   REFUSAL   Done is disabled and the refusal sentence is visible text.
//
// BOUNDARY — what a green here does NOT mean: it measures the editor mounted
// on its own page (the stylesheets the game loads, the real screen module),
// not the editor opened through a door in the running game; it does not drive
// a drag; and "on glass" multiplies by the UI zoom the page was given, which
// is how the app scales (body zoom), not a device the probe ran on.

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORTS = [[360, 640], [390, 844]];
const ZOOMS = [1, 0.62];
const MIN_TARGET_PX = 48;
const MIN_TEXT_PX = 11;
const STYLES = ['base', 'ui', 'kit', 'responsive-type'];
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

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

// Runs in the page: build a bare document, load the game's stylesheets and the
// production editor, and mount it. Returns once the editor is on screen.
const MOUNT = (zoom) => `(async () => {
  document.head.innerHTML = '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + ${JSON.stringify(STYLES)}.map((s) => '<link rel="stylesheet" href="/styles/' + s + '.css">').join('');
  document.body.innerHTML = '<div id="app"></div>';
  await Promise.all([...document.querySelectorAll('link[rel=stylesheet]')].map((l) => new Promise((ok) => { l.onload = ok; l.onerror = ok; })));
  document.documentElement.style.setProperty('--tap-target', '44px');
  document.documentElement.style.setProperty('--ui-zoom', '${zoom}');
  document.body.style.zoom = '${zoom}';
  const { contentBundle } = await import('/src/content/index.js');
  const { createRegistries } = await import('/src/model/registries.js');
  const { createRunState } = await import('/src/model/state.js');
  const { mountDeckEditor } = await import('/src/ui/screens/deckEditor.js');
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 7, classId: 'reaver', registries });
  const editor = mountDeckEditor(document.body, { registries, run, settings: { playInDeckOrder: true, deckMinSize: run.deck.length + 3 } });
  // One card out, so a limited tile and the refusal both exist.
  const plain = run.deck.find((c) => !c.equipmentRole && !c.grantedBy);
  editor.root.querySelector('.deck-editor-row[data-instance-id="' + plain.instanceId + '"] .deck-editor-main').click();
  return true;
})()`;

const MEASURE = `(() => {
  const zoom = Number(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  // Under standardized CSS zoom getBoundingClientRect already reports visual
  // px; otherwise it reports the zoomed element's own px. Measure which.
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;width:100px;height:1px';
  document.body.appendChild(probe);
  const reportsVisual = Math.abs(probe.getBoundingClientRect().width / 100 - 1) > 0.01 || zoom === 1;
  probe.remove();
  const glass = (n) => (reportsVisual ? n : n * zoom);
  const veil = document.querySelector('.deck-editor-veil');
  const targets = [...veil.querySelectorAll('button')].map((b) => {
    const r = b.getBoundingClientRect();
    return { label: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 40), w: glass(r.width), h: glass(r.height) };
  });
  const texts = [...veil.querySelectorAll('*')]
    .filter((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && n.getClientRects().length)
    .map((n) => ({ tag: n.className || n.tagName, px: parseFloat(getComputedStyle(n).fontSize) * zoom }));
  const done = document.querySelector('#deck-editor-done');
  const refusal = document.querySelector('#deck-editor-refusal');
  return {
    coarse: matchMedia('(pointer: coarse)').matches,
    targets, texts,
    hscroll: document.documentElement.scrollWidth > innerWidth,
    doneDisabled: !!(done && done.disabled),
    refusal: refusal && !refusal.hidden && refusal.getClientRects().length ? refusal.textContent.trim() : '',
  };
})()`;

let failures = 0;
let checks = 0;
function check(ok, code, detail) {
  checks += 1;
  if (ok) console.log(`PASS ${code} - ${detail}`);
  else { failures += 1; console.error(`RED ${code} - ${detail}`); }
}

const browser = resolveBrowser();
if (!browser || !existsSync(browser)) {
  console.error('deck-editor-targets: no Chrome/Chromium found — set CHROME=/path/to/chrome');
  process.exit(2);
}
const served = await serve({ root: ROOT, port: 8271, open: false });
const launched = await launchBrowser({ prefix: 'deck-editor-targets-', browser, headless: '--headless=new', timeoutMs: 20000 });
const cdp = connectCdp(launched.wsUrl);
try {
  await cdp.ready;
  for (const [width, height] of VIEWPORTS) {
    for (const zoom of ZOOMS) {
      const label = `${width}x${height}@${zoom}`;
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      await cdp.send('Page.enable', {}, sessionId);
      await cdp.send('Runtime.enable', {}, sessionId);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true }, sessionId);
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }, sessionId);
      await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' }, sessionId);
      // Any same-origin page will do: the probe replaces its document.
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${served.port}/__deck-editor-probe` }, sessionId);
      await wait(400);
      const ev = async (expression) => {
        const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
      };
      await ev(MOUNT(zoom));
      await wait(150);
      const m = await ev(MEASURE);
      check(m.coarse, `${label} COARSE`, '(pointer: coarse) matches under touch emulation');
      const small = m.targets.filter((t) => t.w < MIN_TARGET_PX - 0.5 || t.h < MIN_TARGET_PX - 0.5);
      check(m.targets.length > 0 && !small.length, `${label} TARGETS`,
        `${m.targets.length} editor buttons, ${small.length} under ${MIN_TARGET_PX} CSS px on glass${small.length ? `: ${JSON.stringify(small.slice(0, 5))}` : ''}`);
      const tiny = m.texts.filter((x) => x.px < MIN_TEXT_PX - 0.05);
      check(!tiny.length, `${label} TEXT`, `${m.texts.length} text runs, ${tiny.length} under ${MIN_TEXT_PX} px on glass${tiny.length ? `: ${JSON.stringify(tiny.slice(0, 5))}` : ''}`);
      check(!m.hscroll, `${label} NO-HSCROLL`, 'the page does not scroll sideways');
      check(m.doneDisabled && /\d/.test(m.refusal), `${label} REFUSAL`, `Done disabled=${m.doneDisabled}; refusal "${m.refusal}"`);
      await cdp.send('Target.closeTarget', { targetId });
    }
  }
} catch (error) {
  failures += 1;
  console.error(`RED DECK-EDITOR-TARGETS - ${error.message}`);
} finally {
  cdp.close();
  await launched.close();
  served.server.close();
}
console.log(`deck-editor-targets: ${failures ? 'RED' : 'OK'} — ${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
