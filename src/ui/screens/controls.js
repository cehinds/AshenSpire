// src/ui/screens/controls.js — the Controls tab: rebind each action's keyboard
// key AND gamepad button (SPEC §7.3).
//
// Every rebindable action shows two chips: its keyboard key and its gamepad
// button. Click a "Rebind" to arm it, then press a key / pad button. Bindings
// persist in settings.keyBindings + settings.bindings and apply live via
// onChange({ keyBindings } / { bindings }). Confirm's keyboard key is fixed
// (Enter always activates the cursor); everything else is rebindable.

import {
  ACTIONS,
  getBindings,
  getKeyBindings,
  keyLabel,
  captureNextButton,
  cancelCapture,
  captureNextKey,
  cancelKeyCapture,
} from '../input.js';
import { padName } from '../uiContent.js';

// Standard-mapping button labels (navigator gamepad "standard" layout).
// Button names come from the shared PAD_BUTTONS table (uiContent.js) — this
// screen shows the readable word, the hint bar shows the compact glyph.
const btnName = padName;

export function renderControls(container, { settings, onChange }) {
  const padConnected =
    typeof navigator !== 'undefined' && navigator.getGamepads
      ? Array.from(navigator.getGamepads()).some(Boolean)
      : false;

  container.innerHTML = `
    <h3 class="set-cat">Navigation</h3>
    <p class="set-note" style="max-width:520px">
      Move the focus cursor with the <b>arrow keys</b>, <b>D-pad</b>, or <b>left stick</b>;
      activate with <b>Enter</b> / <b>A</b>. In combat, number keys <b>1–9</b> select cards and targets.
    </p>
    <h3 class="set-cat">Bindings ${padConnected ? '<span class="pad-live">● pad connected</span>' : '<span class="pad-off">(no pad detected)</span>'}</h3>
    <div class="rebind-list"></div>
    <p class="set-note" style="margin-top:10px">Click a <b>Rebind</b>, then press a key or controller button. Arrow keys / D-pad always navigate.</p>`;

  const list = container.querySelector('.rebind-list');
  const bindings = getBindings();
  const keyBindings = getKeyBindings();

  for (const a of ACTIONS) {
    const rebindableKey = !!a.defKey; // Confirm's key (Enter) is fixed
    const row = document.createElement('div');
    row.className = 'set-row rebind-row';
    row.innerHTML = `
      <div><b>${a.label}</b></div>
      <div class="rebind-ctl">
        ${
          rebindableKey
            ? `<span class="pad-btn key-btn" data-keyfor="${a.id}">${keyLabel(a.id)}</span>
               <button class="subtle rebind-btn rebind-key" data-action="${a.id}">Key</button>`
            : `<span class="pad-btn">${a.keyHint || '—'}</span>`
        }
        <span class="pad-btn" data-for="${a.id}">${btnName(bindings[a.id])}</span>
        <button class="subtle rebind-btn rebind-pad" data-action="${a.id}">Pad</button>
      </div>`;
    list.appendChild(row);
  }

  let capturing = null; // the armed <button>, or null
  const reset = (btn, label) => {
    btn.textContent = label;
    btn.classList.remove('listening');
  };

  // Gamepad rebinds.
  list.querySelectorAll('.rebind-pad').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (capturing) {
        cancelCapture();
        cancelKeyCapture();
        reset(capturing, capturing.classList.contains('rebind-key') ? 'Key' : 'Pad');
        if (capturing === btn) {
          capturing = null;
          return;
        }
      }
      capturing = btn;
      btn.textContent = 'Press…';
      btn.classList.add('listening');
      captureNextButton((buttonIndex) => {
        const id = btn.dataset.action;
        const next = { ...getBindings(), [id]: buttonIndex };
        settings.bindings = next;
        onChange({ bindings: next });
        const badge = container.querySelector(`.pad-btn[data-for="${id}"]`);
        if (badge) badge.textContent = btnName(buttonIndex);
        reset(btn, 'Pad');
        capturing = null;
      });
    });
  });

  // Keyboard rebinds.
  list.querySelectorAll('.rebind-key').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (capturing) {
        cancelCapture();
        cancelKeyCapture();
        reset(capturing, capturing.classList.contains('rebind-key') ? 'Key' : 'Pad');
        if (capturing === btn) {
          capturing = null;
          return;
        }
      }
      capturing = btn;
      btn.textContent = 'Press…';
      btn.classList.add('listening');
      captureNextKey((key) => {
        const id = btn.dataset.action;
        const next = { ...getKeyBindings(), [id]: key };
        settings.keyBindings = next;
        onChange({ keyBindings: next });
        const badge = container.querySelector(`.key-btn[data-keyfor="${id}"]`);
        if (badge) badge.textContent = keyLabel(id);
        reset(btn, 'Key');
        capturing = null;
      });
    });
  });
}
