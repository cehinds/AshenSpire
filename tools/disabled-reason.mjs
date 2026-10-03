#!/usr/bin/env node
// tools/disabled-reason.mjs — "A disabled Next button shows its reason as
// visible text" (docs/FINISH.md §6), measured in a real Chromium.
//
//   node tools/disabled-reason.mjs        exit 0 when every check holds
//   DR_VIEWPORTS='[[390,844]]' node …      only those viewports
//   DR_SHOTS=/some/dir node …               also save a PNG of each screen
//
// For a representative set of the forward controls the game can render
// refusing (not every one: the atlas, the Smith, mount service and the reward
// menu's level hold are not mounted here) — character
// creation's Next, the event's Continue, the reward chooser's Confirm, the
// dialogue's Continue, the title's Continue, the slot door's Continue, the
// hand-discard Confirm, the custom run's and character creation's Begin (bad
// seed), the deck editor's Done — it mounts the production screen module on a
// bare page carrying the game's stylesheets, leaves it in its refusing state,
// and checks that:
//   REFUSES  the control is disabled (or aria-disabled="true");
//   REASON   a node the control names in aria-describedby holds the reason as
//            text: non-empty, laid out (has client rects), not display:none,
//            not visibility:hidden, opacity > 0, and at least 11 px.
//
// BOUNDARY — what a green here does NOT mean: it mounts each screen on its own
// page at 390×844 and 1280×800 (zoom 1), not reached through the running game;
// it does not judge the wording, only that there is some; and controls that
// refuse only for a beat while something loads or counts (the prologue's Next,
// the victory XP count) are listed in docs/FINISH.md D-decision, not here.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORTS = (process.env.DR_VIEWPORTS ? JSON.parse(process.env.DR_VIEWPORTS) : [[390, 844], [1280, 800]]);
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

// The page prelude: the game's stylesheets, a fresh #app, the content.
const PRELUDE = `
  document.head.innerHTML = '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + ${JSON.stringify(STYLES)}.map((s) => '<link rel="stylesheet" href="/styles/' + s + '.css">').join('');
  document.body.innerHTML = '<div id="app"></div>';
  await Promise.all([...document.querySelectorAll('link[rel=stylesheet]')].map((l) => new Promise((ok) => { l.onload = ok; l.onerror = ok; })));
  const app = document.getElementById('app');
  const { contentBundle } = await import('/src/content/index.js');
  const { createRegistries } = await import('/src/model/registries.js');
  const { createRunState } = await import('/src/model/state.js');
  const { createRng } = await import('/src/engine/rng.js');
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 7, classId: 'reaver', registries });
  const frames = (n) => new Promise((done) => { const step = () => (n-- > 0 ? requestAnimationFrame(step) : done()); step(); });
`;

// Each scenario mounts one screen in its refusing state and returns the CSS
// selector of the refusing control.
const SCENARIOS = [
  ['creation-next', `
    const { mountCustomize } = await import('/src/ui/screens/customize.js');
    mountCustomize(app, { registries, meta: { settings: {} }, defaultSeedString: 'ASH-1', onBack() {}, onStart() {} });
    return '#cz-next';`],
  ['creation-begin-bad-seed', `
    const { mountCustomize } = await import('/src/ui/screens/customize.js');
    mountCustomize(app, { registries, meta: { settings: {} }, defaultSeedString: 'ASH-1', onBack() {}, onStart() {}, catalog: true });
    const seed = app.querySelector('#seed-input');
    seed.value = 'ASH!'; seed.dispatchEvent(new Event('input', { bubbles: true }));
    return '#cz-start';`],
  ['event-continue', `
    const { mountEvent } = await import('/src/ui/screens/event.js');
    mountEvent(app, { registries, run, meta: { settings: {} }, rng: createRng(3), eventId: 'abandonedCart', onDone() {} });
    return '#event-continue';`],
  ['dialogue-continue', `
    const { mountDialogue } = await import('/src/ui/screens/dialogue.js');
    const { recordEventChoice } = await import('/src/model/quests.js');
    recordEventChoice(run, { eventId: 'graveOfTheNameless', choiceId: 'digForCinders' });
    mountDialogue(app, { registries, run, meta: { settings: {} }, rng: createRng(7), eventId: 'namelessKeeper', onDone() {},
      hud: null, entrancePlayed: true,
      dialogueState: { beat: Number.MAX_SAFE_INTEGER, generation: 0, resolved: false, choiceId: null, resultText: '' } });
    await new Promise((ok) => setTimeout(ok, 1500));
    return '#dialogue-continue';`],
  ['reward-confirm', `
    const { mountRewards } = await import('/src/ui/screens/reward.js');
    const bare = { cinders: 0, deck: [], flasks: [], relics: [], loadout: { storage: [] } };
    mountRewards(app, { registries, run: bare, checkpoint: { states: {}, chosenCardId: null },
      rewards: { cardIds: ['frostNova', 'starstoneArc', 'scholarsInsight'] }, onDone() {}, onPersist() { return true; } });
    app.querySelector('[data-kind="card"]').click();
    return '#reward-card-confirm';`],
  ['title-continue', `
    const { mountTitle } = await import('/src/ui/screens/title.js');
    mountTitle(app, { slots: [{ slot: 1, summary: null }, { slot: 2, summary: null }, { slot: 3, summary: null }], meta: { settings: {} }, registries,
      onContinue() {}, onNew() {}, onDelete() {}, onSettings() {}, onQuit() {} });
    return '.slot-continue';`],
  ['slot-door-continue', `
    const { slotDoor, slotOption } = await import('/src/ui/components/saveSlotSelector.js');
    app.append(slotDoor({ eyebrow: 'Load', title: 'Choose a save', closeLabel: 'Close', rows: [slotOption({ slot: 1, summary: null, selectable: false })], canContinue: false }));
    return '.title-modal-continue';`],
  ['hand-discard-confirm', `
    const { openHandDiscard } = await import('/src/ui/components/handDiscard.js');
    openHandDiscard(registries, { minimum: 1, maximum: 2, cards: run.deck.slice(0, 3) }, () => {}, null);
    return '.hand-discard-confirm';`],
  ['custom-run-begin-bad-seed', `
    const { mountCustomRun } = await import('/src/ui/screens/customRun.js');
    mountCustomRun(app, { registries, defaultSeedString: 'ASH-1', onBack() {}, onStart() {} });
    const seed = app.querySelector('#cr-seed');
    seed.value = 'ASH!'; seed.dispatchEvent(new Event('input', { bubbles: true }));
    return '#cr-start';`],
  ['deck-editor-done', `
    const { mountDeckEditor } = await import('/src/ui/screens/deckEditor.js');
    const editor = mountDeckEditor(document.body, { registries, run, settings: { deckMinSize: run.deck.length + 3 } });
    return '#deck-editor-done';`],
];

const MEASURE = (selector) => `(() => {
  const control = document.querySelector(${JSON.stringify(selector)});
  if (!control) return { missing: true };
  const refusing = !!control.disabled || control.getAttribute('aria-disabled') === 'true';
  const ids = (control.getAttribute('aria-describedby') || '').split(/\\s+/).filter(Boolean);
  const notes = ids.map((id) => document.getElementById(id)).filter(Boolean).map((n) => {
    const cs = getComputedStyle(n);
    let hiddenAncestor = false;
    for (let a = n; a; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) {
        hiddenAncestor = (a.className || a.tagName) + ' display=' + s.display + ' visibility=' + s.visibility + ' opacity=' + s.opacity;
        break;
      }
    }
    return {
      id: n.id, text: (n.textContent || '').trim(),
      display: cs.display, visibility: cs.visibility, px: parseFloat(cs.fontSize),
      rects: n.getClientRects().length, hiddenAncestor,
    };
  });
  const visible = notes.find((n) => n.text && n.rects && n.display !== 'none' && n.visibility !== 'hidden' && !n.hiddenAncestor && n.px >= ${MIN_TEXT_PX} - 0.05);
  return { refusing, notes, visible: visible || null };
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
  console.error('disabled-reason: no Chrome/Chromium found — set CHROME=/path/to/chrome');
  process.exit(2);
}
const served = await serve({ root: ROOT, port: 0, open: false });
const port = served.port || served.server.address().port;
const launched = await launchBrowser({ prefix: 'disabled-reason-', browser, headless: '--headless=new', timeoutMs: 20000 });
const cdp = connectCdp(launched.wsUrl);
try {
  await cdp.ready;
  for (const [width, height] of VIEWPORTS) {
    for (const [name, body] of SCENARIOS) {
      const label = `${width}x${height} ${name}`;
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      try {
        await cdp.send('Page.enable', {}, sessionId);
        await cdp.send('Runtime.enable', {}, sessionId);
        await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 }, sessionId);
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/__disabled-reason-probe` }, sessionId);
        await wait(300);
        const ev = async (expression) => {
          const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
          if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
          return result.result.value;
        };
        const selector = await ev(`(async () => { ${PRELUDE} ${body} })()`);
        // Let entrances (the title's fade, a door's rise) finish: the reason is
        // judged as the player reads it once the screen has settled.
        await ev(`Promise.race([
          Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime)).map((a) => a.finished.catch(() => {}))),
          new Promise((ok) => setTimeout(ok, 4000)),
        ])`);
        await wait(120);
        const m = await ev(MEASURE(selector));
        if (process.env.DR_SHOTS) {
          mkdirSync(process.env.DR_SHOTS, { recursive: true });
          const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
          writeFileSync(resolve(process.env.DR_SHOTS, `${width}x${height}-${name}.png`), Buffer.from(shot.data, 'base64'));
        }
        if (m.missing) { check(false, `${label} MOUNT`, `no control matches ${selector}`); continue; }
        check(m.refusing, `${label} REFUSES`, `${selector} is disabled or aria-disabled`);
        check(!!m.visible, `${label} REASON`, m.visible
          ? `"${m.visible.text}" at ${m.visible.px}px`
          : `no visible reason among ${JSON.stringify(m.notes)}`);
      } catch (error) {
        check(false, `${label} MOUNT`, error.message.split('\n')[0]);
      } finally {
        await cdp.send('Target.closeTarget', { targetId });
      }
    }
  }
} catch (error) {
  failures += 1;
  console.error(`RED DISABLED-REASON - ${error.message}`);
} finally {
  cdp.close();
  await launched.close();
  served.server.close();
}
console.log(`disabled-reason: ${failures ? 'RED' : 'OK'} — ${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
