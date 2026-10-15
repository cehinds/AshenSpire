import { trackGesture } from '../gesture.js';

const HUD = '.intent, .nm, .resbars, .statuses';
// Shared by the solo and snapshot screens: only an actual stage/background
// press dismisses reading identity. Card and toolbar bubbling is not blank.
export function isCombatBlankPress(event) {
  return !event.target.closest('.combatant, .combatant-inspector-host, .combatant-door, .modal, .hand, .hand-area, .card, .combat-action-row, .combat-tools, .combat-hud, .combat-footer, button, input, select, textarea, a, [role="button"], [data-focusable], [data-combat-read-only]');
}

export function markCombatantInspectionSurfaces(frame, { playback = false } = {}) {
  for (const surface of frame.querySelectorAll('.intent, .nm, .resbars, .statuses, .combatant-info')) {
    surface.setAttribute('data-combat-read-only', '');
  }
  const sprite = frame.querySelector('.sprite');
  if (sprite) {
    if (playback) sprite.setAttribute('data-combat-read-only', '');
    else sprite.removeAttribute('data-combat-read-only');
  }
}

// Reading gestures arbitrate before any child targeting/tooltip listener.
// The caller owns activation and live eligibility; this module owns timers.
export function bindCombatantInspectionGesture(frame, {
  isSelected, canInspect, canActivate = canInspect, open, activate, onPress = () => {},
  holdMs = 600, movePx = 8, doubleClickMs = 500,
} = {}) {
  let pending = null, hold = null, abort = null, suppressed = false, released = false, pressedHud = null;
  const clearPending = () => { clearTimeout(pending); pending = null; };
  const clearHold = () => { clearTimeout(hold); hold = null; };
  const consume = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  const inspect = opener => {
    clearPending(); clearHold();
    if (canInspect()) open(opener);
  };
  const cancel = () => { clearPending(); clearHold(); abort?.(); abort = null; };
  const click = event => {
    if (event.target.closest('.combatant-info')) { clearPending(); clearHold(); return; }
    if (suppressed) { suppressed = false; consume(event); return; }
    const hud = pressedHud || event.target.closest(HUD);
    pressedHud = null;
    if (hud) { consume(event); inspect(hud); return; }
    if (event.detail >= 2) {
      consume(event); clearPending();
      if (isSelected()) inspect(frame);
      return;
    }
    // Keyboard/button activation has no pointer click sequence to arbitrate.
    if (event.detail === 0) return;
    if (isSelected()) {
      consume(event); clearPending();
      pending = setTimeout(() => {
        pending = null;
        if (!released && frame.isConnected && isSelected() && canActivate()) activate();
      }, doubleClickMs);
    }
  };
  const doubleClick = event => { consume(event); clearPending(); };
  const pointerDown = event => {
    if (event.button > 0 || event.isPrimary === false || event.target.closest('.combatant-info') || !canInspect()) return;
    onPress();
    clearPending(); clearHold(); abort?.(); suppressed = false;
    pressedHud = event.target.closest(HUD);
    const x = event.clientX, y = event.clientY;
    abort = trackGesture(event, {
      onMove: move => {
        if (Math.hypot(move.clientX - x, move.clientY - y) > movePx) { clearHold(); clearPending(); suppressed = true; }
      },
      onEnd: (_event, { cancelled }) => {
        clearHold(); abort = null;
        if (cancelled) { clearPending(); suppressed = true; }
      },
    });
    hold = setTimeout(() => {
      hold = null;
      if (!released && frame.isConnected && canInspect()) { suppressed = true; inspect(frame); }
    }, holdMs);
  };
  const key = event => {
    if (!['Enter', ' '].includes(event.key) || !event.target.closest(HUD)) return;
    consume(event); inspect(event.target);
  };
  const contextMenu = event => { if (hold != null || suppressed) consume(event); };
  frame.addEventListener('contextmenu', contextMenu, true);
  frame.addEventListener('click', click, true);
  frame.addEventListener('dblclick', doubleClick, true);
  frame.addEventListener('pointerdown', pointerDown, true);
  frame.addEventListener('keydown', key, true);
  window.addEventListener('scroll', cancel, true);
  window.addEventListener('blur', cancel);
  return { cancel, release() {
    released = true; cancel();
    frame.removeEventListener('contextmenu', contextMenu, true);
    frame.removeEventListener('click', click, true);
    frame.removeEventListener('dblclick', doubleClick, true);
    frame.removeEventListener('pointerdown', pointerDown, true);
    frame.removeEventListener('keydown', key, true);
    window.removeEventListener('scroll', cancel, true);
    window.removeEventListener('blur', cancel);
  } };
}
