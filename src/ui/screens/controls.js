// src/ui/screens/controls.js — the Controls tab: gamepad button rebinds + a
// keyboard/controller reference (SPEC §7.3).
//
// Each rebindable action shows its keyboard key (fixed — the screens own their
// letter/number hotkeys) and its gamepad button (rebindable: click "Rebind",
// then press a pad button). Bindings persist in settings.bindings and apply
// live via onChange({ bindings }).

import { ACTIONS, getBindings, captureNextButton, cancelCapture } from '../input.js';

// Standard-mapping button labels (navigator gamepad "standard" layout).
const BUTTON_NAMES = {
  0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
  8: 'Back', 9: 'Start', 10: 'L3', 11: 'R3', 12: 'D-Up', 13: 'D-Down',
  14: 'D-Left', 15: 'D-Right', 16: 'Guide',
};
const btnName = (i) => (i == null ? '—' : BUTTON_NAMES[i] || `Btn ${i}`);

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
    <h3 class="set-cat">Gamepad ${padConnected ? '<span class="pad-live">● connected</span>' : '<span class="pad-off">(none detected)</span>'}</h3>
    <div class="rebind-list"></div>
    <p class="set-note" style="margin-top:10px">Click <b>Rebind</b>, then press a button on your controller. D-pad always navigates.</p>`;

  const list = container.querySelector('.rebind-list');
  const bindings = getBindings();

  for (const a of ACTIONS) {
    const row = document.createElement('div');
    row.className = 'set-row rebind-row';
    row.innerHTML = `
      <div><b>${a.label}</b><p class="set-note">Keyboard: <b>${a.keyHint}</b></p></div>
      <div class="rebind-ctl">
        <span class="pad-btn" data-for="${a.id}">${btnName(bindings[a.id])}</span>
        <button class="subtle rebind-btn" data-action="${a.id}">Rebind</button>
      </div>`;
    list.appendChild(row);
  }

  let capturing = null;
  list.querySelectorAll('.rebind-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (capturing) {
        // A second click cancels the pending capture.
        cancelCapture();
        capturing.textContent = 'Rebind';
        capturing.classList.remove('listening');
        capturing = null;
        return;
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
        btn.textContent = 'Rebind';
        btn.classList.remove('listening');
        capturing = null;
      });
    });
  });
}
