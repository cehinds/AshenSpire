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
  'input[type="range"]',
  'input[type="text"]',
  '[data-focusable]',
].join(',');

// Actions whose gamepad button is rebindable. Each maps to how it's delivered:
// 'cursor' actions are handled here; 'key' actions dispatch a synthetic keydown
// so a screen's own handler runs (parity with mouse+keyboard play).
export const ACTIONS = [
  { id: 'confirm', label: 'Confirm / Play', kind: 'cursor', keyHint: 'Enter', defBtn: 0 },
  { id: 'cancel', label: 'Cancel / Back', kind: 'key', key: 'Escape', keyHint: 'Esc', defBtn: 1 },
  { id: 'menu', label: 'Open Menu', kind: 'key', key: 'm', keyHint: 'M', defBtn: 9 },
  { id: 'endTurn', label: 'End Turn', kind: 'key', key: 'e', keyHint: 'E', defBtn: 2 },
];

const DEADZONE = 0.5;
const REPEAT_MS = 180;
const POLL_MS = 16; // ~60 Hz input polling (only while a pad is connected)

let bindings = {}; // action id → gamepad button index
let pollTimer = null;
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

// ---- focus cursor -----------------------------------------------------------

function visible(el) {
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}

function focusables() {
  return Array.from(document.querySelectorAll(FOCUS_SELECTOR)).filter(visible);
}

function current() {
  return document.querySelector('.gp-focus');
}

function setFocus(el) {
  const prev = current();
  if (prev && prev !== el) prev.classList.remove('gp-focus');
  if (el) {
    el.classList.add('gp-focus');
    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
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
  else synthKey(a.key);
}

// ---- keyboard navigation ----------------------------------------------------

function onKeydown(ev) {
  if (!enabled) return;
  const tag = (ev.target && ev.target.tagName) || '';
  const typing = tag === 'INPUT' || tag === 'TEXTAREA';
  const cur = current();

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
      if (rebindCapture) {
        const cb = rebindCapture;
        rebindCapture = null;
        cb(i);
        continue;
      }
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
  setBindings((getSettings && getSettings().bindings) || {});
  addEventListener('keydown', onKeydown, true);
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
