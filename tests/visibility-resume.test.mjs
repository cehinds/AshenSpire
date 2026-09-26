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
//      input layer (`initInput`) with an input gate AND a held key press
//      armed, and a card drag held in flight (`trackGesture` ending in
//      `finishCardDrag`, the very function combat.js hands it) — and a full
//      hidden→visible cycle is dispatched. The run and the fight must
//      deep-equal their snapshots from before, minus timestamps; the gate and
//      the press must be told CANCEL; the drag must end CANCELLED and drop
//      nothing.
//   2. INVENTORY. Every listener registered on the page itself — any
//      `addEventListener(` on window/document/globalThis/self or a bare
//      global — and EVERY WRITE TO A MEMBER of those four receivers (dotted,
//      bracketed, or through Object.assign / Object.defineProperty /
//      Object.defineProperties / Reflect.set / Reflect.defineProperty, so any
//      spelling of `on<event> =`) in src/ is pinned below, ONE ENTRY PER
//      CALL SITE, whatever its argument or key is. A new call site, or a
//      second one for an event already listed, fails this file until it is
//      added here; a page-lifecycle event, a computed event name or a
//      computed member key must also say why it cannot move state. The registrations the behaviour
//      half makes are also captured at runtime and checked against the pins.
//
// WHY A STATIC INVENTORY AND NOT ONLY RUNTIME CAPTURE. The node runner has no
// DOM (no jsdom, no package.json), so main.js cannot boot here; and most page
// listeners register only when their screen or modal mounts (the prologue's
// `visibilitychange`, a modal's keydown), so capturing a boot would miss them
// anyway. Runtime capture is used where it can run — the two modules the
// behaviour half boots — and the call-site inventory covers everything else.
import test, { after } from 'node:test';
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
import { finishCardDrag } from '../src/ui/cardDragEnd.js';
import { affordableCards } from '../tools/simbot.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LIFECYCLE_EVENTS = ['visibilitychange', 'pagehide', 'pageshow', 'freeze', 'resume', 'blur', 'focus', 'beforeunload', 'unload'];

// ---- a stand-in page: window + document as real EventTargets -----------------
let hidden = false;
const win = new EventTarget();
const doc = new EventTarget();
Object.defineProperties(doc, {
  hidden: { get: () => hidden },
  visibilityState: { get: () => (hidden ? 'hidden' : 'visible') },
});
Object.assign(doc, {
  body: { classList: { add() {}, remove() {}, contains: () => false }, contains: () => true },
  activeElement: null,
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
});

// RUNTIME CAPTURE. Every listener the booted modules put on the page — by
// addEventListener or by an on<event> property — is recorded with the src/
// file that registered it, read off the call stack.
const captured = [];
function callerFile() {
  const frame = (new Error().stack || '').split('\n').find((line) => /[\\/]src[\\/].+\.m?js/.test(line));
  const m = frame && frame.match(/([\\/]src[\\/][^:)]+\.m?js)/);
  return m ? `src/${m[1].split(/[\\/]src[\\/]/).pop().split('\\').join('/')}` : '(outside src)';
}
for (const [name, target] of [['window', win], ['document', doc]]) {
  const add = target.addEventListener.bind(target);
  target.addEventListener = (type, ...rest) => { captured.push({ target: name, type: String(type), file: callerFile() }); return add(type, ...rest); };
  for (const event of LIFECYCLE_EVENTS) {
    let handler = null;
    Object.defineProperty(target, `on${event}`, {
      configurable: true,
      get: () => handler,
      set: (fn) => {
        captured.push({ target: name, type: event, file: callerFile(), property: true });
        if (handler) target.removeEventListener(event, handler);
        handler = fn;
        if (fn) add(event, fn);
      },
    });
  }
}

// Remember what was there so the stand-ins never leak past this file, even if
// the runner is ever switched to run several files in one process.
const STUBBED = ['window', 'document', 'addEventListener', 'removeEventListener', 'navigator'];
const ORIGINAL = Object.fromEntries(STUBBED.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
after(() => {
  for (const k of STUBBED) {
    try {
      if (ORIGINAL[k]) Object.defineProperty(globalThis, k, ORIGINAL[k]);
      else delete globalThis[k];
    } catch { /* non-configurable global: nothing was replaced */ }
  }
});
globalThis.window = win;
globalThis.document = doc;
globalThis.addEventListener = (...args) => win.addEventListener(...args);
globalThis.removeEventListener = win.removeEventListener.bind(win);
if (typeof globalThis.navigator === 'undefined' || !('getGamepads' in globalThis.navigator)) {
  try { Object.defineProperty(globalThis, 'navigator', { value: { ...(globalThis.navigator || {}), getGamepads: () => [] }, configurable: true }); } catch { /* read-only navigator: input.js guards the call */ }
}

const { initInput, setInputGate, setActionControl } = await import('../src/ui/input.js');
const { trackGesture, PRESS_EVENT, RELEASE_EVENT } = await import('../src/ui/gesture.js');

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

// combat.js's side of finishCardDrag, pointed at a real fight: a drag had
// begun, the release is off the hand over a live enemy, and `play` really
// plays a card. So the ONLY thing between a backgrounded drag and a played
// card is finishCardDrag's own cancelled check.
function liveDragOps(combat, played) {
  const cardId = combat.piles.hand[0]?.instanceId;
  assert.ok(cardId, 'the hand still holds a card to drag');
  return {
    teardown: () => true,
    overHand: () => false,
    reorder: () => assert.fail('a drag released off the hand never reorders'),
    dropPlan: () => ({ legal: true, targetId: combat.enemies.find((e) => e.alive).id }),
    play: (targetId) => { played.push(cardId); dispatch(combat, { type: 'playCard', cardInstanceId: cardId, targetId }); },
  };
}

// THE CYCLE IS A TABLE. Each page-lifecycle event → the target the browser
// fires it on (Page Lifecycle API: `freeze`/`resume` on document; HTML:
// `visibilitychange` on document, `pagehide`/`pageshow`/`blur`/`focus` on
// window). The inventory below checks that every lifecycle listener pinned in
// KNOWN listens on the target this table fires at, so a pinned listener can
// never sit on a target the cycle does not reach.
const LIFECYCLE_TARGET = { visibilitychange: 'document', freeze: 'document', resume: 'document', pagehide: 'window', pageshow: 'window', blur: 'window', focus: 'window' };
// Going to the background and coming back, in spec order: lose focus, hide,
// pagehide, freeze — then resume, pageshow, show, regain focus.
const CYCLE = [
  { event: 'blur' },
  { event: 'visibilitychange', hidden: true },
  { event: 'pagehide' },
  { event: 'freeze' },
  { event: 'resume' },
  { event: 'pageshow' },
  { event: 'visibilitychange', hidden: false },
  { event: 'focus' },
];
function backgroundAndResume() {
  for (const step of CYCLE) {
    if ('hidden' in step) hidden = step.hidden;
    (LIFECYCLE_TARGET[step.event] === 'document' ? doc : win).dispatchEvent(new Event(step.event));
  }
}

test('the cycle fires every lifecycle event in the table, on its table target', () => {
  assert.deepEqual([...new Set(CYCLE.map((s) => s.event))].sort(), Object.keys(LIFECYCLE_TARGET).sort(), 'every table event is in the cycle');
  const seen = [];
  const probes = [];
  for (const [target, node] of [['window', win], ['document', doc]]) {
    for (const event of Object.keys(LIFECYCLE_TARGET)) {
      const probe = () => seen.push(`${target} ${event}`);
      node.addEventListener(event, probe);
      probes.push(() => node.removeEventListener(event, probe));
    }
  }
  const wasHidden = hidden;
  backgroundAndResume();
  hidden = wasHidden;
  probes.forEach((off) => off());
  assert.deepEqual(seen, CYCLE.map((s) => `${LIFECYCLE_TARGET[s.event]} ${s.event}`));
});

test('the drag ops are live: an UNcancelled drag through finishCardDrag really plays the card', () => {
  // The control for the test below — without it, "nothing changed" could mean
  // the ops never reached the fight at all.
  const { combat } = midCombat();
  const handBefore = combat.piles.hand.length;
  const played = [];
  assert.equal(finishCardDrag({ clientX: 0, clientY: 0 }, { cancelled: false }, liveDragOps(combat, played)), 'played');
  assert.equal(played.length, 1, 'play ran once');
  assert.notEqual(combat.piles.hand.length, handBefore, 'and the fight moved: the card left the hand');
});

test('a hidden→visible cycle mid-combat leaves the run and the fight unchanged', () => {
  initInput({ getSettings: () => ({}) });
  const { run, combat } = midCombat();
  const before = { run: snapshot(run), combat: snapshot(combat) };

  // A card is mid-drag when the phone goes to the background. Its gesture ends
  // in finishCardDrag — the function combat.js hands trackGesture — with ops
  // that WOULD play the card into this fight (proved live by the test above).
  const el = new EventTarget();
  el.setPointerCapture = () => {}; el.releasePointerCapture = () => {};
  const outcomes = [];
  const played = [];
  const ops = liveDragOps(combat, played);
  trackGesture({ pointerId: 7, pointerType: 'touch', currentTarget: el }, {
    onEnd: (up, info) => outcomes.push(finishCardDrag(up, info, ops)),
  });

  // A key is HELD on a control with a live hold beat (End Turn's `e`, the
  // S7-wide key door) when the phone goes away: blur must end that press
  // cancelled, never let it commit.
  const endTurn = new EventTarget();
  Object.assign(endTurn, { isConnected: true, dataset: { holdMs: '600' }, matches: () => false, closest: () => null });
  const releases = [];
  endTurn.addEventListener(PRESS_EVENT, (ev) => ev.preventDefault());
  endTurn.addEventListener(RELEASE_EVENT, (ev) => { releases.push(ev.detail.cancelled); ev.preventDefault(); });
  endTurn.addEventListener('click', () => assert.fail('a backgrounded hold must not click End Turn'));
  setActionControl('endTurn', endTurn);
  const down = Object.assign(new Event('keydown', { cancelable: true }), { key: 'e', repeat: false });
  win.dispatchEvent(down);
  assert.ok(down.defaultPrevented, 'the fixture really armed the held press (input.js claimed the key)');
  assert.deepEqual(releases, [], 'the press is live, not yet released');

  // A first-input owner holds the input gate when the phone goes away: blur
  // must hand it a cancel, never a commit.
  const gateSeen = [];
  const releaseGate = setInputGate((input) => { gateSeen.push(input.phase); return true; });

  backgroundAndResume();
  releaseGate();
  setActionControl('endTurn', null);

  assert.deepEqual(gateSeen, ['cancel'], 'the armed input gate was told cancel, and nothing else, on blur');
  assert.deepEqual(releases, [true], 'the held press was released once, CANCELLED — backgrounding never commits a hold');
  assert.deepEqual(outcomes, ['cancelled'], 'the in-flight drag ended once, cancelled');
  assert.deepEqual(played, [], 'no card was played');
  assert.deepStrictEqual(snapshot(run), before.run, 'the run is unchanged');
  assert.deepStrictEqual(snapshot(combat), before.combat, 'the fight is unchanged: hand, piles, enemies, intents, resources');
});

test('combat.js ends a card drag through finishCardDrag, so the unit above is the shipped one', () => {
  const text = readFileSync(join(ROOT, 'src/ui/screens/combat.js'), 'utf8');
  assert.match(text, /import \{ finishCardDrag \} from '\.\.\/cardDragEnd\.js';/);
  const drags = [...text.matchAll(/trackGesture\(ev, \{[\s\S]*?\n {6}\}\);/g)].map((m) => m[0]);
  assert.equal(drags.length, 1, 'combat.js has one card-drag trackGesture');
  assert.match(drags[0], /onEnd: \(up, info\) => finishCardDrag\(up, info, \{/, 'its onEnd is finishCardDrag, handed the gesture\'s own cancelled flag');
  assert.doesNotMatch(drags[0], /\bif \(\s*!?\s*(?:info\??\.)?cancelled\b/, 'no second cancelled decision beside it in combat.js');
});

// ---- inventory of page listeners ---------------------------------------------
// file → one entry per call site. An entry is the call's first argument as
// written (whitespace collapsed); a member write on the page is `.<key>` when
// the key is literal (`.onblur`, `.__combat`, `.title`) and `[<expr>]` when it
// is computed; an Object.assign / defineProperties source that is not an
// object literal is `Object.assign(<expr>)`. A plain string is enough for a
// literal, non-lifecycle event or key; a page-lifecycle event (`'blur'` or
// `.onblur`), a computed event name or a computed key must be
// [entry, why it cannot move run/combat state].
const KNOWN = {
  'src/main.js': ["'resize'", "'load'", "'resize'", '.__worldJourney', '.__uiScale', '.__equipCfg', '.__profile', '.__archives', '.__runstatus', '.__spoils', '.__fxProbe', '.__coopSnapshotForShot', '.__coopSentForShot', '.__receiveCoopSnapshotForShot', '.__shotAgeSlot'],
  'src/ui/audio.js': [['ev', "one of 'pointerdown', 'pointerup', 'touchend', 'keydown' (the literal list beside it): unlocks/resumes the AudioContext and music only"]],
  'src/ui/components/armamentRadial.js': ["'pointerdown'", "'keydown'"],
  'src/ui/components/battlefieldStage.js': ["'resize'"],
  'src/ui/components/card.js': ["'resize'"],
  'src/ui/components/cardInspection.js': ["'resize'"],
  'src/ui/components/confirmationModal.js': [['type', "one of keyEvents = ['keydown', 'keyup']: swallows keys while the confirmation shield stands"], "'keydown'"],
  'src/ui/components/creationInfoLayer.js': ["'resize'"],
  'src/ui/components/dialogueStage.js': ["'resize'"],
  'src/ui/components/flask.js': ["'keydown'", "'click'"],
  'src/ui/components/handInspectionOverlay.js': ["'resize'"],
  'src/ui/components/hints.js': ["'pointerdown'", "'pointerup'", "'pointercancel'", "'pointerout'", "'gamepadconnected'", "'gamepaddisconnected'"],
  'src/ui/components/holdconfirm.js': ["'keydown'", "'keydown'"],
  'src/ui/components/hudQuickSettings.js': ["'fullscreenchange'", "'webkitfullscreenchange'"],
  'src/ui/components/iconTray.js': ["'pointerdown'"],
  'src/ui/components/intro.js': ["'keydown'"],
  'src/ui/components/localMapCamera.js': ["'pointerup'"],
  'src/ui/components/modalShell.js': ["'keydown'"],
  'src/ui/components/overlay.js': ["'ashenspire:quicknav-mode-change'", "'keydown'"],
  'src/ui/components/quicknav.js': ["'keydown'", ['type', "one of the four literal fullscreen change/error events in the loop: re-syncs the quick-nav rows only"]],
  'src/ui/components/saveSlotSelector.js': ["'keydown'"],
  'src/ui/components/smithUpgradeModal.js': ["'keydown'"],
  'src/ui/components/tooltip.js': ["'pointerover'", "'focusin'", "'click'", "'keydown'", "'pointerdown'", "'keydown'", "'resize'"],
  'src/ui/components/trayComponents.js': ["'pointermove'", "'pointerup'", "'pointercancel'"],
  'src/ui/components/tutorial.js': ["'keydown'", "'resize'"],
  'src/ui/debuglog.js': ["'error'", "'unhandledrejection'"],
  'src/ui/fx.js': ["'pointerdown'", "'pointerup'", "'pointercancel'", "'pointerdown'", '.__fx'],
  'src/ui/gesture.js': [["'blur'", 'aborts the in-flight gesture as CANCELLED; driven above through finishCardDrag, which drops nothing'], "'pointerdown'", "'pointermove'", "'pointerup'", "'pointercancel'"],
  'src/ui/input.js': ["'keydown'", "'keyup'", ["'blur'", 'cancels the input gate and ends any held press CANCELLED (nothing commits); both halves armed and exercised above'], "'gamepadconnected'", "'gamepaddisconnected'"],
  'src/ui/kit/categoryNav.js': ["'keydown'"],
  'src/ui/screens/combat.js': ["'keydown'", '.__combat', '.__combatRunForShot', '.__renderCombatForShot'],
  'src/ui/screens/coop.js': ["'keydown'", "'keydown'", '.__coopSnapshot', '.__guardCoopTool'],
  'src/ui/screens/customize.js': ["'pointermove'", "'pointerup'", "'keydown'"],
  'src/ui/screens/equipment.js': ["'pointermove'", "'pointerup'", "'pointercancel'", "'keydown'"],
  'src/ui/screens/map.js': ["'click'", "'keydown'", "'resize'", ['type', "one of 'fullscreenchange', 'webkitfullscreenchange' (the literal loop): re-centres the map camera only"]],
  'src/ui/screens/profileNotice.js': ["'keydown'"],
  'src/ui/screens/prologue.js': [["'visibilitychange'", 'resets the opening slideshow frame clock (`last = 0`) only; the prologue runs before any run or fight exists'], ['ART_SOURCE_EVENT', "the constant 'ashen:art-source' (src/ui/highResArt.js), fired by the Art quality setting, not the page cycle: repaints the prologue character canvas from assetUrl() only"]],
  'src/ui/screens/settings.js': ["'resize'", "'fullscreenchange'", "'webkitfullscreenchange'", "'fullscreenerror'", "'webkitfullscreenerror'"],
  'src/ui/screens/title.js': ["'keydown'"],
  'src/ui/screens/combatTest.js': ['.title'],
  'src/ui/previews/itemCards.js': ['.title'],
  'src/ui/previews/tooltipReviewScene.js': ['.__tooltipReviewRun'],
};

// A call on the page itself: `window.` / `document.` / `globalThis.` / `self.`
// (also `?.` and `['addEventListener']`), or a bare global call. An element's
// own listener (`el.addEventListener`, `window.visualViewport?.addEventListener`)
// is not the page and is not listed.
const CALL = /(?:\b(window|document|globalThis|self)\s*(?:\??\.\s*|\[\s*['"`])|(?<![.\w$]))addEventListener(?:['"`]\s*\])?\s*(?:\?\.\s*)?\(/g;

// MEMBER WRITES ON THE PAGE, closed at the receiver rather than per spelling:
// any assignment to a member of window/document/globalThis/self, and any
// Object.assign / Object.defineProperty / Object.defineProperties /
// Reflect.set / Reflect.defineProperty whose target is one of them. Scanned on
// a copy with comments and string/template/regex literal CONTENTS blanked (so
// `"self.maxHp=+4"` in content data is not a write), then keys are read from
// the real text at the same offsets.
const RECEIVER = String.raw`(?<![.\w$])(?:window|document|globalThis|self)`;
const MEMBER = new RegExp(String.raw`${RECEIVER}\s*(?:\.\s*([\w$]+)|\[)`, 'g');
const ASSIGN = /^\s*(?:\*\*|<<|>>>?|&&|\|\||\?\?|[-+*/%&|^])?=(?![=>])/;
const DEFINE = new RegExp(String.raw`\b(Object\s*\.\s*(?:assign|defineProperty|defineProperties)|Reflect\s*\.\s*(?:set|defineProperty))\s*\(\s*${RECEIVER}\s*,`, 'g');

// Same length, same newlines: comments and the contents of strings, templates
// (except their ${…} code) and regex literals become spaces.
export function blankNonCode(src) {
  const out = src.split('');
  const blank = (i) => { if (out[i] !== '\n') out[i] = ' '; };
  const stack = [];         // open template ${ … } depths
  let depth = 0, i = 0, prev = '';
  const regexCanStart = () => !prev || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /\b(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/.test(prev);
  const template = () => { // i is just past a ` or a closing } of ${…}
    while (i < src.length) {
      if (src[i] === '\\') { blank(i); blank(i + 1); i += 2; continue; }
      if (src[i] === '`') { i++; return; }
      if (src[i] === '$' && src[i + 1] === '{') { stack.push(depth); depth++; i += 2; prev = '{'; return 'code'; }
      blank(i); i++;
    }
  };
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') blank(i++); continue; }
    if (c === '/' && d === '*') { blank(i++); blank(i++); while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) blank(i++); blank(i++); blank(i++); continue; }
    if (c === "'" || c === '"') { i++; while (i < src.length && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') blank(i++); blank(i++); } i++; prev = 'str'; continue; }
    if (c === '`') { i++; template(); prev = 'str'; continue; }
    if (c === '/' && regexCanStart()) {
      i++; let cls = false;
      while (i < src.length && src[i] !== '\n' && (cls || src[i] !== '/')) { if (src[i] === '\\') blank(i++); else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; blank(i++); }
      i++; prev = 'regex'; continue;
    }
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (stack.length && depth === stack[stack.length - 1]) { stack.pop(); i++; template(); prev = 'str'; continue; }
    }
    if (!/\s/.test(c)) prev = /[\w$]/.test(c) ? (/[\w$]$/.test(prev) ? prev + c : c) : c;
    i++;
  }
  return out.join('');
}

// The text between an opening bracket at `open` and its match, in `code`.
function closing(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if ('([{'.includes(code[i])) depth++;
    else if (')]}'.includes(code[i]) && --depth === 0) return i;
  }
  return code.length;
}
// Top-level comma-separated pieces of real text between two offsets, split on
// the blanked copy so a comma inside a string never splits.
function pieces(text, code, from, to) {
  const out = []; let depth = 0, start = from;
  for (let i = from; i < to; i++) {
    if ('([{'.includes(code[i])) depth++;
    else if (')]}'.includes(code[i])) depth--;
    else if (code[i] === ',' && depth === 0) { out.push([start, i]); start = i + 1; }
  }
  out.push([start, to]);
  return out.map(([a, b]) => {
    while (a < b && /\s/.test(text[a])) a++;
    while (b > a && /\s/.test(text[b - 1])) b--;
    return { text: text.slice(a, b), code: code.slice(a, b) };
  }).filter((p) => p.text);
}
// A quoted key is literal (`['onblur']` is `.onblur`); anything else — a
// name, a template with ${…}, an expression — is computed.
const norm = (s) => s.trim().replace(/\s+/g, ' ');
const keyEntry = (raw) => {
  raw = norm(raw);
  const m = raw.match(/^(['"])([\w$]+)\1$/) || raw.match(/^(`)([\w$]+)`$/);
  return m ? `.${m[2]}` : `[${raw}]`;
};
// Every key an object-literal source would write, or one computed entry.
function objectKeys(piece, verb) {
  if (!piece.text.startsWith('{')) return [`${verb}(${norm(piece.text)})`];
  const inner = pieces(piece.text, blankNonCode(piece.text), 1, piece.text.length - 1);
  return inner.map((p) => {
    if (p.text.startsWith('...')) return `${verb}(${norm(p.text)})`;
    if (p.text.startsWith('[')) return keyEntry(p.text.slice(1, closing(p.code, 0)));
    const key = p.text.match(/^(?:(?:get|set|async)\s+)?(['"]?)([\w$]+)\1\s*(?:[:(]|$)/);
    return key ? `.${key[2]}` : `${verb}(${norm(p.text)})`;
  });
}

// BOUNDARY — WHAT THIS SCAN CANNOT SEE, AND WHAT GUARDS IT INSTEAD. The scan
// reads text, so it is closed at the receiver only for writes whose receiver
// is written out: `window.x =`, `window[k] =`, Object.assign / defineProperty /
// defineProperties / Reflect.set / Reflect.defineProperty on it. It does NOT
// see:
//   - destructuring targets: `({ onpagehide: window.onpagehide } = handlers)`;
//   - `with (window) onpagehide = f`;
//   - code built from strings: `eval(…)`, `new Function(…)`, `setTimeout('…')`;
//   - writes through an aliased receiver: `const w = window; w.onpagehide = f`,
//     or a receiver passed in as a parameter.
// Nothing in src/ uses any of these on a page member today. For code that runs
// at import, the runtime setter capture above (window/document on<lifecycle>
// setters and addEventListener, wrapped before input.js and gesture.js load)
// is the guard: it sees the write however it was spelled. A further finding of
// one of these shapes is answered by this note, not by more scanning, unless it
// shows real src/ code slipping past or a hole in the runtime capture (owner
// direction on #1298).

// Every write to a member of the page in one file's text: { entry, receiver }.
function writeSites(text) {
  const code = blankNonCode(text);
  const sites = [];
  const receiverAt = (at) => code.slice(at).match(/^(window|document|globalThis|self)/)[1];
  for (const m of code.matchAll(MEMBER)) {
    let key, end;
    if (m[1]) { key = `.${m[1]}`; end = m.index + m[0].length; }
    else {
      const open = m.index + m[0].length - 1;
      end = closing(code, open) + 1;
      key = keyEntry(text.slice(open + 1, end - 1));
    }
    if (ASSIGN.test(code.slice(end, end + 5))) sites.push({ entry: key, receiver: receiverAt(m.index) });
  }
  for (const m of code.matchAll(DEFINE)) {
    const verb = m[1].replace(/\s+/g, '');
    const receiver = m[0].match(/(window|document|globalThis|self)\s*,$/)[1];
    const open = code.indexOf('(', m.index);
    const args = pieces(text, code, open + 1, closing(code, open)).slice(1);
    const add = (entry) => sites.push({ entry, receiver });
    if (/assign$/.test(verb)) for (const source of args) objectKeys(source, verb).forEach(add);
    else if (/defineProperties$/.test(verb)) (args[0] ? objectKeys(args[0], verb) : []).forEach(add);
    else if (args[0]) add(keyEntry(args[0].text));
  }
  return sites;
}

/** Every write to a member of the page in one file's text, one entry each. */
export function pageWriteSites(text) {
  return writeSites(text).map((s) => s.entry);
}

function firstArgument(text, start) {
  let depth = 0, quote = null, i = start;
  for (; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) { if (depth === 0) break; depth--; }
    else if (c === ',' && depth === 0) break;
  }
  return text.slice(start, i).trim().replace(/\s+/g, ' ');
}

// Every page-listener call site with the target it listens on: `document` for
// the document, `window` for window/globalThis/self or a bare global.
function listenerSites(text) {
  const target = (receiver) => (receiver === 'document' ? 'document' : 'window');
  return [
    ...[...text.matchAll(CALL)].map((m) => ({ entry: firstArgument(text, m.index + m[0].length), target: target(m[1]) })),
    ...writeSites(text).map((s) => ({ entry: s.entry, target: target(s.receiver) })),
  ];
}

/** Every page-listener call site in one file's text, one entry each. */
export function pageListenerSites(text) {
  return listenerSites(text).map((s) => s.entry);
}

// What an entry is: a literal event ('blur', or the handler property .onblur),
// a literal member key that is no handler (.title, .__combat), or computed.
function kindOf(arg) {
  const handler = arg.match(/^\.on([a-z]+)$/);
  if (handler) return { kind: 'event', event: handler[1] };
  if (/^\.[\w$]+$/.test(arg)) return { kind: 'member' };
  const m = arg.match(/^(['"`])([\w:-]+)\1$/);
  return m ? { kind: 'event', event: m[2] } : { kind: 'computed' };
}
// The event a site names, when it names one literally; null otherwise.
const literalEvent = (arg) => kindOf(arg).event ?? null;
const needsReason = (arg) => kindOf(arg).kind === 'computed' || LIFECYCLE_EVENTS.includes(literalEvent(arg));

/** Every way `files` ({ path: text }) disagrees with `known`. Empty = pass. */
export function inventoryProblems(files, known = KNOWN) {
  const problems = [];
  const where = 'tests/visibility-resume.test.mjs KNOWN';
  const count = (list) => list.reduce((m, a) => m.set(a, (m.get(a) || 0) + 1), new Map());
  for (const [file, text] of Object.entries(files)) {
    const found = count(pageListenerSites(text));
    const entries = known[file] || [];
    const listed = count(entries.map((e) => (Array.isArray(e) ? e[0] : e)));
    for (const [arg, n] of found) {
      const m = listed.get(arg) || 0;
      if (n > m) problems.push(`${file}: ${n - m} unlisted page listener(s) on ${arg} (${n} call site(s), ${m} in KNOWN). Every page listener is pinned per call site: add one entry for it to ${where}${needsReason(arg) ? ', with why it cannot move run/combat state (and cover it in the cycle above)' : ''}`);
    }
    for (const [arg, m] of listed) {
      const n = found.get(arg) || 0;
      if (m > n) problems.push(`${file}: KNOWN lists ${m} page listener(s) on ${arg}, the file has ${n}; drop the stale entry from ${where}`);
    }
    for (const e of entries) {
      const arg = Array.isArray(e) ? e[0] : e;
      if (needsReason(arg) && !(Array.isArray(e) && typeof e[1] === 'string' && e[1].trim())) {
        problems.push(`${file}: ${arg} is ${kindOf(arg).kind === 'computed' ? 'a computed event name or member key' : 'a page-lifecycle event'} — its KNOWN entry must be [${arg}, why it cannot move run/combat state]`);
      }
    }
  }
  for (const file of Object.keys(known)) if (!(file in files)) problems.push(`${file} is in KNOWN but not in src/; drop it`);
  return problems;
}

/** Every pinned lifecycle listener whose target is not the one the cycle fires its event at. */
export function cycleProblems(files, known = KNOWN) {
  const problems = [];
  for (const [file, text] of Object.entries(files)) {
    const pinned = new Set((known[file] || []).map((e) => (Array.isArray(e) ? e[0] : e)));
    for (const { entry, target } of listenerSites(text)) {
      const event = literalEvent(entry);
      if (!LIFECYCLE_EVENTS.includes(event) || !pinned.has(entry)) continue;
      if (!LIFECYCLE_TARGET[event]) problems.push(`${file}: ${entry} on ${target} is pinned, but '${event}' is not in the cycle table (LIFECYCLE_TARGET/CYCLE) — add it with its spec target so the cycle runs it`);
      else if (LIFECYCLE_TARGET[event] !== target) problems.push(`${file}: ${entry} is pinned on ${target}, but the cycle fires '${event}' on ${LIFECYCLE_TARGET[event]} — the listener would never run in the cycle`);
    }
  }
  return problems;
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.m?js$/.test(name) ? [path] : [];
  });
}
const SRC = Object.fromEntries(walk(join(ROOT, 'src')).map((path) => [relative(ROOT, path).split('\\').join('/'), readFileSync(path, 'utf8')]));

test('every page listener call site in src/ is pinned, and each lifecycle or computed one says why it is safe', () => {
  assert.deepEqual(inventoryProblems(SRC), []);
});

test('every pinned lifecycle listener listens on the target the cycle fires its event at', () => {
  assert.deepEqual(cycleProblems(SRC), []);
});

test('the listeners the booted modules registered at runtime are the pinned ones', () => {
  // Captured while the behaviour test ran initInput and trackGesture.
  assert.ok(captured.length > 0, 'runtime capture saw registrations');
  for (const { target, type, file, property } of captured) {
    if (file === '(outside src)') continue; // this file's own stand-ins
    const args = (KNOWN[file] || []).map((e) => (Array.isArray(e) ? e[0] : e));
    const named = args.some((a) => literalEvent(a) === type);
    const computed = args.some((a) => kindOf(a).kind === 'computed');
    assert.ok(named || computed, `${file} registered '${type}' on ${target}${property ? ` via on${type}` : ''} at runtime, and KNOWN has no site that could be it`);
  }
  for (const c of captured) {
    if (c.file === '(outside src)' || !LIFECYCLE_EVENTS.includes(c.type)) continue;
    assert.equal(c.target, LIFECYCLE_TARGET[c.type], `${c.file} registered '${c.type}' on ${c.target} at runtime; the cycle fires it on ${LIFECYCLE_TARGET[c.type] || 'nothing'}`);
  }
  const lifecycle = captured.filter((c) => LIFECYCLE_EVENTS.includes(c.type) && c.file !== '(outside src)').map((c) => `${c.file} ${c.type}`);
  assert.ok(lifecycle.includes('src/ui/input.js blur') && lifecycle.includes('src/ui/gesture.js blur'), `both blur listeners were really registered: ${lifecycle.join(', ')}`);
});

// ---- the inventory can fail: known-bads against the real tree ----------------
const plant = (file, extra) => ({ ...SRC, [file]: `${SRC[file]}\n${extra}\n` });

test('known-bad: a lifecycle listener behind a computed event name is caught', () => {
  const problems = inventoryProblems(plant('src/ui/screens/combat.js', "const e = 'pagehide'; window.addEventListener(e, () => endTurn());"));
  assert.ok(problems.some((p) => p.startsWith('src/ui/screens/combat.js') && p.includes(' e ')), problems.join('\n'));
});

test('known-bad: a second listener for an already-known event in the same file is caught', () => {
  const problems = inventoryProblems(plant('src/ui/input.js', "addEventListener('blur', () => dispatch(combat, { type: 'endTurn' }));"));
  assert.ok(problems.some((p) => p.startsWith("src/ui/input.js: 1 unlisted page listener(s) on 'blur'")), problems.join('\n'));
});

test('known-bad: other spellings of a page listener are caught too', () => {
  for (const extra of [
    'window.addEventListener("pagehide", save);',
    'document.addEventListener(`visibilitychange`, save);',
    'globalThis.addEventListener(\'freeze\', save);',
    'self.addEventListener(\'pagehide\', save);',
    'window?.addEventListener(\'pagehide\', save);',
    'window[\'addEventListener\'](\'pagehide\', save);',
    'window.onpagehide = save;',
    'document.onvisibilitychange = save;',
    'window.addEventListener(\'keydown\', save);',
  ]) {
    assert.ok(inventoryProblems(plant('src/ui/screens/map.js', extra)).length > 0, `not caught: ${extra}`);
  }
  // …and an element's own listener is not the page.
  assert.deepEqual(inventoryProblems(plant('src/ui/screens/map.js', "button.addEventListener('blur', f); window.visualViewport?.addEventListener('resize', f);")), []);
});

test('known-bad: a lifecycle entry with no reason is refused', () => {
  const known = { ...KNOWN, 'src/ui/screens/prologue.js': ["'visibilitychange'"] };
  assert.ok(inventoryProblems(SRC, known).some((p) => p.includes('page-lifecycle event')));
});

test('known-bad: every form of writing a member of the page is a call site, at the receiver', () => {
  // [planted line, the entry it must be reported as]
  const forms = [
    ['window.onpagehide = save;', '.onpagehide'],
    ['document.onvisibilitychange = save;', '.onvisibilitychange'],
    ['window.onblur ||= save;', '.onblur'],
    ["window['onpagehide'] = save;", '.onpagehide'],
    ['self["onfreeze"] = save;', '.onfreeze'],
    ["const k = 'onpagehide'; window[k] = save;", '[k]'],
    ['globalThis[`on${name}`] = save;', '[`on${name}`]'],
    ['Object.assign(window, { onpagehide: save });', '.onpagehide'],
    ["Object.assign(document, { 'onvisibilitychange': save });", '.onvisibilitychange'],
    ['Object.assign(window, { onpagehide() { endTurn(); } });', '.onpagehide'],
    ['Object.assign(window, { [k]: save });', '[k]'],
    ["Object.assign(window, { ['onpagehide']: save });", '.onpagehide'],
    ['window[  prefix +  name  ] = save;', '[prefix + name]'],
    ['Object.assign(window, { ...handlers });', 'Object.assign(...handlers)'],
    ['Object.assign(window, handlers);', 'Object.assign(handlers)'],
    ["Object.defineProperty(document, 'onvisibilitychange', { value: save });", '.onvisibilitychange'],
    ['Object.defineProperty(window, k, { value: save });', '[k]'],
    ['Object.defineProperties(window, { onpagehide: { value: save } });', '.onpagehide'],
    ["Reflect.set(window, 'onpagehide', save);", '.onpagehide'],
    ["Reflect.defineProperty(self, 'onfreeze', { value: save });", '.onfreeze'],
    ['const x = `${window.onpagehide = save}`;', '.onpagehide'],
    ['window.__stash = combat;', '.__stash'],
  ];
  for (const [extra, entry] of forms) {
    const problems = inventoryProblems(plant('src/ui/screens/map.js', extra));
    assert.ok(problems.some((p) => p.startsWith('src/ui/screens/map.js: 1 unlisted') && p.includes(` on ${entry} `)), `not caught as ${entry}: ${extra}\n${problems.join('\n')}`);
  }
  // Pinned without a reason, a lifecycle handler or a computed key is refused.
  for (const entry of ['.onpagehide', '[k]', 'Object.assign(handlers)']) {
    const known = { ...KNOWN, 'src/ui/screens/map.js': [...KNOWN['src/ui/screens/map.js'], entry] };
    const extra = { '.onpagehide': 'window.onpagehide = save;', '[k]': 'window[k] = save;', 'Object.assign(handlers)': 'Object.assign(window, handlers);' }[entry];
    assert.ok(inventoryProblems(plant('src/ui/screens/map.js', extra), known).some((p) => p.includes(`${entry} is a`)), `${entry} pinned with no reason was accepted`);
  }
  // Not writes to the page: prose, strings, templates, regexes, elements, reads.
  assert.deepEqual(inventoryProblems(plant('src/ui/screens/map.js', [
    '// window.onpagehide = save;',
    "const mod = 'window.onpagehide = save'; const t = `self.maxHp=+4`;",
    'const re = /window.onblur = f/;',
    "el.onblur = f; input['onpagehide'] = f; Object.assign(el, { onpagehide: f });",
    'if (window.onpagehide === f || document.title == t) run(window.innerWidth);',
  ].join('\n'))), []);
});

test('known-bad: a pinned lifecycle listener on a target the cycle does not fire at is caught', () => {
  const file = 'src/ui/screens/map.js';
  const pin = (entry) => ({ ...KNOWN, [file]: [...KNOWN[file], [entry, 'planted with a reason, so only the target check can object']] });
  for (const [extra, entry, target] of [
    ["document.addEventListener('freeze', save); // spec target, so fine", "'freeze'", null],
    ["window.addEventListener('freeze', save);", "'freeze'", 'window'],
    ["globalThis.addEventListener('resume', save);", "'resume'", 'window'],
    ["document.addEventListener('pagehide', save);", "'pagehide'", 'document'],
    ["document.addEventListener('blur', save);", "'blur'", 'document'],
    ['addEventListener(`visibilitychange`, save);', '`visibilitychange`', 'window'],
    ['window.onfreeze = save;', '.onfreeze', 'window'],
    ['Object.assign(document, { onpagehide: save });', '.onpagehide', 'document'],
    ["window.addEventListener('beforeunload', save);", "'beforeunload'", 'window'],
  ]) {
    const files = plant(file, extra);
    assert.deepEqual(inventoryProblems(files, pin(entry)), [], `the plant is pinned: ${extra}`);
    const problems = cycleProblems(files, pin(entry));
    if (!target) assert.deepEqual(problems, [], `${extra} is on its spec target`);
    else assert.ok(problems.some((p) => p.startsWith(`${file}: ${entry}`) && p.includes(target)), `not caught: ${extra}\n${problems.join('\n')}`);
  }
});
