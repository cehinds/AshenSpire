// BACKGROUND AND RESUME KEEP THE RUN (docs/FINISH.md §8 Mobile).
//
// On a phone, switching apps, locking the screen or pulling down the shade
// sends the page `visibilitychange` (hidden), usually `blur` and `pagehide`
// with it, and the mirror set on the way back. Nothing in that cycle is a
// player decision, so nothing in it may move the run or the fight: no card
// played, no turn ended, no HP, pile, intent or resource changed.
//
// Two halves:
//   1. BEHAVIOUR. A real run and a real fight are taken mid-combat (a card
//      played, the enemies holding intents), the production lifecycle
//      listeners are installed on a stand-in window/document — the global
//      input layer (`initInput`) and a card drag held in flight
//      (`trackGesture`, wired exactly as combat.js wires its drag) — and a full
//      hidden→visible cycle is dispatched. The run and the fight must
//      deep-equal their snapshots from before, minus timestamps, and the drag
//      must end CANCELLED (a cancelled drag drops nothing).
//   2. INVENTORY. Every page-lifecycle listener in src/ is listed below with
//      the reason it is safe. A new one fails this file until it is added
//      here — so a handler that would mutate state on background cannot land
//      unseen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { affordableCards } from '../tools/simbot.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// ---- a stand-in page: window + document as real EventTargets -----------------
let hidden = false;
const win = new EventTarget();
const doc = new EventTarget();
Object.defineProperties(doc, {
  hidden: { get: () => hidden },
  visibilityState: { get: () => (hidden ? 'hidden' : 'visible') },
});
Object.assign(doc, {
  body: { classList: { add() {}, remove() {}, contains: () => false } },
  activeElement: null,
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
});
globalThis.window = win;
globalThis.document = doc;
globalThis.addEventListener = win.addEventListener.bind(win);
globalThis.removeEventListener = win.removeEventListener.bind(win);
if (typeof globalThis.navigator === 'undefined' || !('getGamepads' in globalThis.navigator)) {
  try { Object.defineProperty(globalThis, 'navigator', { value: { ...(globalThis.navigator || {}), getGamepads: () => [] }, configurable: true }); } catch { /* read-only navigator: input.js guards the call */ }
}

const { initInput } = await import('../src/ui/input.js');
const { trackGesture } = await import('../src/ui/gesture.js');

// ---- snapshot: deep copy, cycles kept, functions by identity, no timestamps ---
const TIMESTAMP = /^(savedAt|updatedAt|createdAt|startedAt|timestamp|ts|now)$/;
function snapshot(value, seen = new Map()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Map) { const out = new Map(); seen.set(value, out); for (const [k, v] of value) out.set(k, snapshot(v, seen)); return out; }
  if (value instanceof Set) { const out = new Set(); seen.set(value, out); for (const v of value) out.add(snapshot(v, seen)); return out; }
  const out = Array.isArray(value) ? [] : {};
  seen.set(value, out);
  for (const key of Object.keys(value)) if (!TIMESTAMP.test(key)) out[key] = snapshot(value[key], seen);
  return out;
}

function midCombat() {
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 83, classId: 'reaver', registries });
  const combat = createRunCombat({ registries, rng: createRng(83), run, enemyIds: ['wanderingSoldier'], settings: {} });
  const target = combat.enemies.find((e) => e.alive).id;
  let played = false;
  for (const card of affordableCards(registries, combat)) {
    try { dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: target }); played = true; break; }
    catch { /* not playable at that target; try the next */ }
  }
  assert.ok(played, 'the fixture plays a card, so the fight is genuinely mid-turn');
  assert.ok(!combat.result, 'the fight is still live');
  return { run, combat };
}

function backgroundAndResume() {
  hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  win.dispatchEvent(new Event('blur'));
  win.dispatchEvent(new Event('pagehide'));
  win.dispatchEvent(new Event('freeze'));
  win.dispatchEvent(new Event('resume'));
  win.dispatchEvent(new Event('pageshow'));
  win.dispatchEvent(new Event('focus'));
  hidden = false;
  doc.dispatchEvent(new Event('visibilitychange'));
}

test('a hidden→visible cycle mid-combat leaves the run and the fight unchanged', () => {
  initInput({ getSettings: () => ({}) });
  const { run, combat } = midCombat();
  const before = { run: snapshot(run), combat: snapshot(combat) };

  // A card is mid-drag when the phone goes to the background — wired the way
  // combat.js wires it: a completed drag plays, a cancelled one drops nothing.
  const el = new EventTarget();
  el.setPointerCapture = () => {}; el.releasePointerCapture = () => {};
  const ends = [];
  const hand = combat.piles.hand.map((h) => h.instanceId);
  trackGesture({ pointerId: 7, pointerType: 'touch', currentTarget: el }, {
    onEnd: (_up, { cancelled }) => {
      ends.push(cancelled);
      if (!cancelled && hand.length) dispatch(combat, { type: 'playCard', cardInstanceId: hand[0], targetId: combat.enemies[0].id });
    },
  });

  backgroundAndResume();

  assert.deepEqual(ends, [true], 'the in-flight drag ended once, cancelled — backgrounding never commits a card');
  assert.deepStrictEqual(snapshot(run), before.run, 'the run is unchanged');
  assert.deepStrictEqual(snapshot(combat), before.combat, 'the fight is unchanged: hand, piles, enemies, intents, resources');
});

// ---- inventory of page-lifecycle listeners -----------------------------------
// file → event → why it cannot move run or combat state on background.
const KNOWN = {
  'src/ui/input.js': { blur: 'cancels the input gate and any held press (cancelled, nothing commits); exercised above' },
  'src/ui/gesture.js': { blur: 'aborts the in-flight gesture as CANCELLED; exercised above' },
  'src/ui/screens/prologue.js': { visibilitychange: 'pauses/resumes the opening slideshow timer only; the prologue runs before any fight' },
};
// Page-level only: `window.`/`document.` or a bare global `addEventListener`.
// An element's own blur/focus (an input, a menu item) is not page lifecycle.
const LIFECYCLE = /(?:\b(?:window|document)\.|(?<![.\w]))addEventListener\(\s*'(visibilitychange|pagehide|pageshow|freeze|resume|blur|focus|beforeunload|unload)'/g;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.m?js$/.test(name) ? [path] : [];
  });
}

test('every page-lifecycle listener in src/ is known to leave state alone', () => {
  const found = {};
  for (const path of walk(join(ROOT, 'src'))) {
    const file = relative(ROOT, path).split('\\').join('/');
    const text = readFileSync(path, 'utf8');
    for (const [, event] of text.matchAll(LIFECYCLE)) {
      (found[file] ||= new Set()).add(event);
    }
  }
  for (const [file, events] of Object.entries(found)) {
    for (const event of events) {
      assert.ok(KNOWN[file]?.[event], `${file} listens for '${event}' — say why it cannot move run/combat state in tests/visibility-resume.test.mjs KNOWN (and cover it in the cycle above)`);
    }
  }
  for (const [file, events] of Object.entries(KNOWN)) {
    for (const event of Object.keys(events)) assert.ok(found[file]?.has(event), `${file} no longer listens for '${event}'; drop it from KNOWN`);
  }
});
