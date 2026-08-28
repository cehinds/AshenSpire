// src/ui/input.js — unified keyboard + gamepad navigation (SPEC §7.3).
//
// Two layers that make every screen playable without a mouse:
//   1. A focus cursor over interactive elements (buttons, cards, reachable map
//      nodes, tabs, toggles, targetable enemies…). Arrow keys / D-pad / left
//      stick move it spatially; Enter / A activates the focused element.
//   2. A gamepad poller (started only while a pad is connected — no idle loop)
//      that maps buttons to actions. Confirm activates the cursor; Cancel /
//      Menu / End-turn dispatch the same synthetic keys the screens already
//      listen for, so the existing keyboard handlers work with a controller
//      too. Which pad BUTTON drives each action is rebindable (Controls tab).
//
// The number keys (1–9) and letter hotkeys stay owned by the screens; this
// module adds navigation + controller parity on top without touching them.

import { padGlyph } from './uiContent.js';
import { topVeil } from './components/veil.js';

const FOCUS_SELECTOR = [
  'button:not([disabled])',
  '.card',
  '.map-node.reachable',
  '.combatant.enemy.targetable',
  '.ov-tab',
  '.choice',
  '.toggle',
  '.slot-continue',
  '.slot-new',
  '.class-pick:not(.locked)', // character creation + custom-run class picks
  '.cz-opt',
  '.cz-keepsake',
  '.cr-class',
  '.mod-chip',
  'input[type="range"]',
  'input[type="text"]',
  '[data-focusable]',
].join(',');

// "Chrome" the focus cursor skips during normal play — the top bar, piles, map
// side panel, zoom, and end-turn/energy. These are reached by their dedicated
// (rebindable) keys / the Menu overlay instead of by wandering into them
// (StS2-style: navigation stays on cards, targets, and map nodes). Ignored when
// a modal/overlay is open, where its own contents ARE the scope.
const CHROME = '.topbar, .pile, .map-buttons, .map-zoom, .map-side, .end-turn, .energy-orb';

// Rebindable actions. Each carries BOTH a keyboard key (defKey) and a gamepad
// button (defBtn), and both are rebindable (Controls tab). Delivery:
//   'cursor' — handled here (activates the focus cursor).
//   'key'    — the canonical binding is the keyboard key; screens match it via
//              matchAction(ev, id). A pad press dispatches that same key, so the
//              screens' own handlers run for controller + keyboard alike.
// The deck/relics/stats actions jump the in-run overlay straight to that tab
// (StS2-style dedicated zone keys) instead of only the generic Menu.
export const ACTIONS = [
  // confirm (Enter) and cancel (Esc) keep FIXED keyboard keys so cursor-activate
  // and overlay-close always work; only their pad button is rebindable.
  { id: 'confirm', label: 'Confirm / Play', short: 'Confirm', kind: 'cursor', keyHint: 'Enter', defBtn: 0 },
  { id: 'cancel', label: 'Cancel / Back', short: 'Cancel', kind: 'key', key: 'Escape', keyHint: 'Esc', defBtn: 1 },
  { id: 'endTurn', label: 'End Turn', short: 'End Turn', kind: 'key', defKey: 'e', defBtn: 2 },
  { id: 'menu', label: 'Open Menu', short: 'Menu', kind: 'key', defKey: 'm', defBtn: 9 },
  { id: 'deck', label: 'Open Deck', short: 'Deck', kind: 'key', defKey: 'd', defBtn: 3 },
  { id: 'relics', label: 'Open Relics', short: 'Relics', kind: 'key', defKey: 'r', defBtn: 4 },
  { id: 'stats', label: 'Open Stats', short: 'Stats', kind: 'key', defKey: 't', defBtn: 5 },
  // Flask quick-use (StS2 gives pads a potion shortcut but keyboards nothing —
  // we give both a rebindable key per slot).
  { id: 'flask1', label: 'Use Flask 1', short: 'Flask 1', kind: 'key', defKey: 'f', defBtn: 6 },
  { id: 'flask2', label: 'Use Flask 2', short: 'Flask 2', kind: 'key', defKey: 'g', defBtn: 7 },
  { id: 'flask3', label: 'Use Flask 3', short: 'Flask 3', kind: 'key', defKey: 'h', defBtn: 10 },
];

/** Compact label for the hint bar. The full `label` reads as a settings row
 *  ("Open Deck"); the bar wants the short form ("Deck"). One action registry,
 *  two presentations — the bar used to restate these and could drift. */
export function actionShort(id) {
  const a = ACTIONS.find((x) => x.id === id);
  return a ? a.short || a.label : id;
}

// ---- the tab ring (Law 3: bumpers ride the tabs) ----------------------------
//
// A tabbed surface registers its own set here while it is open; the pad poller
// and the keyboard handler below give buttons 4/5 and `[`/`]` to that set in
// preference to whatever they are globally bound to. That preference is the
// whole clause: EldenSpire's defaults already SPEND LB/RB on Relics and Stats
// (ACTIONS above, defBtn 4 and 5), so without contextual precedence the two
// bindings race and the winner is whoever notices first.
//
// It binds the SET, not the widget — a strip, a two-row wrapped strip, or one
// folded "Deck ▾" switcher all register the same ring and cycle in the same
// order (Law 3 clause 1a). Wrap is the ring's own job, and it is the edge that
// breaks: last → first and first → last.
//
// `[` / `]` is Marina's proposed keyboard analogue and is NOT yet ratified —
// Q/E was rejected because E is already End Turn. It earns its keep here beyond
// the proposal: it is the only way to observe the wrap without a pad attached,
// and no pad was attached when this was built.
let tabRing = null; // { prev(), next() } | null

/** setTabRing(ring | null) — a tabbed surface claims the bumpers while open. */
export function setTabRing(ring) {
  tabRing = ring && typeof ring.next === 'function' && typeof ring.prev === 'function' ? ring : null;
}

/**
 * hasTabRing() → is a tab set already holding the bumpers?
 *
 * LAW 3 CLAUSE 6, FOR TWO TAB SETS AND ONE PAIR OF BUMPERS. Settings now has
 * its own tab strip, and Settings is ALSO one tab of the in-run overlay — so on
 * that door two strips are on screen at once and RB has to mean one thing.
 *
 * THE ANSWER IS THE OUTER STRIP, and it is a legibility call, not a technical
 * one. A player who learns "RB moves the menu tabs" on the Deck tab must not
 * find that the same button means something else two tabs later; a global
 * button whose meaning changes with where you are standing is the defect clause
 * 6 exists to prevent. The inner strip is reached by the focus cursor and by
 * touch — which is clause 6's own corollary, one level down.
 *
 * It is DERIVED, not declared: a strip claims the bumpers only if nothing holds
 * them. openOverlay claims before it renders any panel, so the overlay's
 * Settings tab finds them taken and the title-screen modal finds them free. No
 * caller passes a flag, and nobody has to remember which door they are on.
 *
 * NOT A STACK, deliberately. Push/pop would hand the bumpers to the innermost
 * strip, which is the behaviour this rejects.
 */
export function hasTabRing() {
  return !!tabRing;
}

const TAB_PREV_BTN = 4; // LB, standard mapping
const TAB_NEXT_BTN = 5; // RB
const TAB_PREV_KEY = '[';
const TAB_NEXT_KEY = ']';

/** True if this pad button was consumed by an open tab set. */
function tabRingButton(i) {
  if (!tabRing) return false;
  if (i === TAB_PREV_BTN) tabRing.prev();
  else if (i === TAB_NEXT_BTN) tabRing.next();
  else return false;
  return true;
}

const DEADZONE = 0.5;
const REPEAT_MS = 180;
const POLL_MS = 16; // ~60 Hz input polling (only while a pad is connected)

let bindings = {}; // action id → gamepad button index
let keyBindings = {}; // action id → keyboard key (e.g. 'm', 'Escape')
let pollTimer = null;
let engaged = false; // has the user driven with keyboard/gamepad this session?

/**
 * True once the player has actually navigated with keyboard or gamepad. Screens
 * use this to gate auto-focus defaults so mouse-only players never see an
 * unrequested focus ring.
 */
export function isEngaged() {
  return engaged;
}
let padPrev = {}; // gamepad index → last pressed-button booleans
let lastNav = 0; // step counter gate for held-direction repeat
let enabled = true;

function defaultBindings() {
  const b = {};
  for (const a of ACTIONS) b[a.id] = a.defBtn;
  return b;
}

export function setBindings(stored) {
  bindings = { ...defaultBindings(), ...(stored || {}) };
}

export function getBindings() {
  return { ...bindings };
}

export function actionForButton(btn) {
  return ACTIONS.find((a) => bindings[a.id] === btn) || null;
}

// ---- keyboard bindings ------------------------------------------------------

function defaultKeyBindings() {
  const b = {};
  for (const a of ACTIONS) if (a.defKey) b[a.id] = a.defKey;
  return b;
}

export function setKeyBindings(stored) {
  keyBindings = { ...defaultKeyBindings(), ...(stored || {}) };
}

export function getKeyBindings() {
  return { ...keyBindings };
}

/** True if a keydown event matches the key currently bound to an action. */
export function matchAction(ev, id) {
  const k = keyBindings[id];
  if (!k) return false;
  return (ev.key || '').toLowerCase() === k.toLowerCase();
}

// Compact standard-mapping button glyphs for the hint bar / on-screen prompts.
/** Label for the gamepad button currently bound to an action (hint bar).
 *  Glyphs come from the shared PAD_BUTTONS table (uiContent.js) so the hint bar
 *  and the controls screen can't drift apart. */
export function padLabel(id) {
  const btn = bindings[id];
  return btn == null ? '' : padGlyph(btn);
}

/** True if at least one gamepad is currently connected. */
export function hasGamepad() {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.getGamepads === 'function' &&
    Array.from(navigator.getGamepads()).some(Boolean)
  );
}

/** Human label for an action's bound key (Controls tab + reference). */
export function keyLabel(id) {
  let k = keyBindings[id] || '';
  if (!k) {
    // Fixed-key actions (confirm=Enter, cancel=Esc) aren't in the rebind map.
    const a = ACTIONS.find((x) => x.id === id);
    if (a && (a.keyHint || a.key)) return a.keyHint || a.key;
    return '—';
  }
  if (k === 'Escape') return 'Esc';
  if (k === ' ') return 'Space';
  return k.length === 1 ? k.toUpperCase() : k;
}

// ---- focus cursor -----------------------------------------------------------

function visible(el) {
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}

// The active focus scope: the topmost open veil if any, else the app.
//
// The selector and the "which one is topmost" rule used to live here, inline —
// which made this function the SECOND home of a question overlay.js also
// answered, in different words and about one veil only. Both now ask
// components/veil.js; read the header there for what counts as a veil, why
// `.tut-veil` deliberately does not, and why topmost is paint order rather
// than DOM order.
function scopeRoot() {
  return topVeil() || document.getElementById('app') || document.body;
}

function focusables() {
  const root = scopeRoot();
  const inModal = root.classList && root.classList.contains('modal-veil');
  return Array.from(root.querySelectorAll(FOCUS_SELECTOR)).filter(
    (el) => visible(el) && (inModal || !(el.closest && el.closest(CHROME)))
  );
}

function current() {
  return document.querySelector('.gp-focus');
}

// A stable identity for the focused element, so focus can be restored to the
// "same" element after a screen re-render (focus memory between inputs).
let focusKey = null;
function keyOf(el) {
  if (!el) return null;
  const d = el.dataset || {};
  if (d.instanceId) return `i:${d.instanceId}`;
  if (d.eid) return `e:${d.eid}`;
  if (d.classId) return `c:${d.classId}`;
  if (d.mod) return `m:${d.mod}`;
  if (d.deck) return `d:${d.deck}`;
  if (d.tab) return `t:${d.tab}`;
  if (d.slot) return `s:${el.className}:${d.slot}`;
  if (el.id) return `#${el.id}`;
  return `x:${(el.textContent || '').trim().slice(0, 28)}`;
}
function findByKey(k) {
  if (!k) return null;
  return focusables().find((el) => keyOf(el) === k) || null;
}

function setFocus(el, remember = true) {
  const prev = current();
  if (prev && prev !== el) {
    prev.classList.remove('gp-focus');
    // Focus-mode tooltips: tooltip.js listens for these so controller players
    // get every tooltip a mouse hover would show (SPEC §7.3).
    prev.dispatchEvent(new CustomEvent('gpblur'));
  }
  if (el) {
    el.classList.add('gp-focus');
    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (prev !== el) el.dispatchEvent(new CustomEvent('gpfocus'));
    if (remember) focusKey = keyOf(el);
  } else if (remember) {
    focusKey = null;
  }
}

/** Focus the first focusable matching a selector (used for combat targeting). */
export function focusFirst(selector) {
  const el = focusables().find((e) => e.matches && e.matches(selector));
  if (el) setFocus(el);
  return !!el;
}

function ensureFocus() {
  let el = current();
  if (el && visible(el)) return el;
  const list = focusables();
  el = list[0] || null;
  setFocus(el);
  return el;
}

// Move the cursor to the nearest focusable in a direction, scored by distance
// along the axis plus lateral offset (so navigation feels 2D-natural).
function moveFocus(dir) {
  const list = focusables();
  if (!list.length) return;
  const cur = current();
  if (!cur || !visible(cur)) {
    setFocus(list[0]);
    return;
  }
  const cr = cur.getBoundingClientRect();
  const cx = cr.left + cr.width / 2;
  const cy = cr.top + cr.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const ex = r.left + r.width / 2;
    const ey = r.top + r.height / 2;
    const dx = ex - cx;
    const dy = ey - cy;
    let primary;
    let cross;
    if (dir === 'right') {
      if (dx <= 2) continue;
      primary = dx;
      cross = Math.abs(dy);
    } else if (dir === 'left') {
      if (dx >= -2) continue;
      primary = -dx;
      cross = Math.abs(dy);
    } else if (dir === 'down') {
      if (dy <= 2) continue;
      primary = dy;
      cross = Math.abs(dx);
    } else {
      if (dy >= -2) continue;
      primary = -dy;
      cross = Math.abs(dx);
    }
    const score = primary + cross * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) setFocus(best);
}

function activate() {
  const el = ensureFocus();
  if (!el) return;
  if (el.matches('input[type="range"]')) return; // adjusted with left/right instead
  if (el.matches('input[type="text"]')) {
    el.focus();
    return;
  }
  // dispatchEvent (not .click()) so SVG map nodes — which lack HTMLElement.click
  // — activate the same as HTML buttons/cards.
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

// Left/right on a focused slider nudges its value (keyboard + pad parity).
function nudgeRange(el, delta) {
  const step = Number(el.step) || 1;
  const min = Number(el.min);
  const max = Number(el.max);
  let v = Number(el.value) + delta * step;
  if (!isNaN(min)) v = Math.max(min, v);
  if (!isNaN(max)) v = Math.min(max, v);
  el.value = String(v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function synthKey(key) {
  dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function doAction(id) {
  const a = ACTIONS.find((x) => x.id === id);
  if (!a) return;
  if (a.kind === 'cursor') activate();
  // Dispatch the CURRENTLY bound key so a pad press stays in sync with keyboard
  // rebinds (screens match by binding via matchAction). Fixed-key actions
  // (cancel) fall back to a.key.
  else synthKey(keyBindings[id] || a.defKey || a.key);
}

// ---- keyboard navigation ----------------------------------------------------

// Controls tab: capture the next keypress to rebind a keyboard action.
let keyCapture = null;
export function captureNextKey(cb) {
  keyCapture = cb;
}
export function cancelKeyCapture() {
  keyCapture = null;
}

function onKeydown(ev) {
  // Key-rebind capture runs even while nav is enabled and ignores lone modifiers.
  if (keyCapture) {
    const k = ev.key;
    if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta') return;
    ev.preventDefault();
    ev.stopPropagation();
    const cb = keyCapture;
    keyCapture = null;
    cb(k);
    return;
  }
  if (!enabled) return;
  const tag = (ev.target && ev.target.tagName) || '';
  const typing = tag === 'INPUT' || tag === 'TEXTAREA';
  const cur = current();

  if (!typing && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown' || ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'Enter')) {
    engaged = true;
  }
  // Tab cycling, keyboard side. Ahead of everything else for the same reason
  // the pad side is: while a tab set is open it owns these two, and no screen
  // hotkey may take them first.
  if (!typing && tabRing && (ev.key === TAB_PREV_KEY || ev.key === TAB_NEXT_KEY)) {
    engaged = true;
    ev.preventDefault();
    if (ev.key === TAB_NEXT_KEY) tabRing.next();
    else tabRing.prev();
    return;
  }
  if (!typing && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown' || ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
    // On a focused slider, horizontal arrows tune it rather than navigate.
    if (cur && cur.matches('input[type="range"]') && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
      nudgeRange(cur, ev.key === 'ArrowRight' ? 1 : -1);
      ev.preventDefault();
      return;
    }
    ev.preventDefault();
    moveFocus({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[ev.key]);
    return;
  }
  if (!typing && ev.key === 'Enter') {
    const el = current();
    if (el) {
      ev.preventDefault();
      activate();
    }
  }
}

// ---- gamepad polling (started only while a pad is present) -------------------

let rebindCapture = null; // callback awaiting the next pad button (Controls UI)

/** Wait for the next gamepad button press; resolves with its index. */
export function captureNextButton(cb) {
  rebindCapture = cb;
}
export function cancelCapture() {
  rebindCapture = null;
}

function pollPads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let any = false;
  if (lastNav > 0) lastNav -= 1; // held-direction repeat gate (in poll ticks)
  for (const pad of pads) {
    if (!pad) continue;
    any = true;
    const prev = padPrev[pad.index] || [];
    const pressed = pad.buttons.map((b) => b.pressed || b.value > 0.5);

    for (let i = 0; i < pressed.length; i++) {
      const rising = pressed[i] && !prev[i];
      if (!rising) continue;
      engaged = true;
      if (rebindCapture) {
        const cb = rebindCapture;
        rebindCapture = null;
        cb(i);
        continue;
      }
      // CONTEXTUAL PRECEDENCE (Law 3 clause 2), and the order is the rule:
      // an open tab set takes LB/RB BEFORE actionForButton() can hand them to
      // Relics/Stats. Without this line the defaults win and the law is prose.
      if (tabRingButton(i)) continue;
      const a = actionForButton(i);
      if (a) doAction(a.id);
      // D-pad (12–15) navigates regardless of rebinds.
      else if (i === 12) moveFocus('up');
      else if (i === 13) moveFocus('down');
      else if (i === 14) moveFocus('left');
      else if (i === 15) moveFocus('right');
    }
    padPrev[pad.index] = pressed;

    // Left stick → navigation, rate-limited so a held stick steps, not races.
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    if (!rebindCapture && (Math.abs(ax) > DEADZONE || Math.abs(ay) > DEADZONE)) {
      if (lastNav <= 0) {
        lastNav = Math.round(REPEAT_MS / POLL_MS);
        if (Math.abs(ax) > Math.abs(ay)) moveFocus(ax > 0 ? 'right' : 'left');
        else moveFocus(ay > 0 ? 'down' : 'up');
      }
    }
  }
  if (!any) stopPolling(); // no pads → idle until one reconnects
}

function startPolling() {
  if (pollTimer == null) pollTimer = setInterval(pollPads, POLL_MS);
}
function stopPolling() {
  if (pollTimer != null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/**
 * initInput({ getSettings }) — install keyboard nav + gamepad support.
 * Bindings come from settings.bindings (rebindable in the Controls tab).
 */
export function initInput({ getSettings } = {}) {
  const s = (getSettings && getSettings()) || {};
  setBindings(s.bindings || {});
  setKeyBindings(s.keyBindings || {});
  addEventListener('keydown', onKeydown, true);

  // Focus memory: after a re-render drops the cursor, restore it to the same
  // logical element (by key) if it still exists — so navigation doesn't snap
  // back to the top between inputs. A full screen change won't match, leaving
  // focus cleared until the next nav press (correct).
  const appRoot = document.getElementById('app');
  if (appRoot && typeof MutationObserver !== 'undefined') {
    let scheduled = false;
    const mo = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        if (!enabled || current() || !focusKey) return;
        const el = findByKey(focusKey);
        if (el) setFocus(el, false);
      }, 0);
    });
    mo.observe(appRoot, { childList: true, subtree: true });
  }
  addEventListener('gamepadconnected', () => {
    document.body.classList.add('has-gamepad');
    startPolling();
  });
  addEventListener('gamepaddisconnected', () => {
    if (!navigator.getGamepads || !Array.from(navigator.getGamepads()).some(Boolean)) {
      document.body.classList.remove('has-gamepad');
    }
  });
  // If a pad is already connected at load (some browsers report it immediately).
  if (navigator.getGamepads && Array.from(navigator.getGamepads()).some(Boolean)) startPolling();
  return {
    setEnabled: (v) => {
      enabled = v;
    },
    refocus: () => setFocus(null),
  };
}
