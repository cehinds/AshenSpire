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
import { rebindConflictModel, applyRebind } from '../models/RebindCaptureModel.js';

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
    <div class="controls-intro"><h3 class="set-cat">Navigation</h3>
    <p class="set-note">
      Move the focus cursor with the <b>arrow keys</b>, <b>D-pad</b>, or <b>left stick</b>;
      activate with <b>Enter</b> / <b>A</b>. In combat, number keys <b>1–9</b> select cards and targets.
    </p></div>
    <h3 class="set-cat">Bindings ${padConnected ? '<span class="pad-live">● pad connected</span>' : '<span class="pad-off">(no pad detected)</span>'}</h3>
    <div class="rebind-list"><div class="rebind-head" aria-hidden="true"><span>Action</span><span>Keyboard</span><span>Controller</span></div></div>
    <div class="binding-conflict" role="alertdialog" aria-modal="false" hidden></div>
    <p class="set-note" style="margin-top:10px">Click a <b>Rebind</b>, then press a key or controller button. Arrow keys / D-pad always navigate.</p>`;

  const list = container.querySelector('.rebind-list');
  const bindings = getBindings();
  const keyBindings = getKeyBindings();

  for (const a of ACTIONS) {
    const rebindableKey = !!a.defKey; // Confirm's key (Enter) is fixed
    const row = document.createElement('div');
    row.className = 'set-row rebind-row';
    row.innerHTML = `
      <div class="rebind-action"><b>${a.label}</b></div>
      <div class="rebind-ctl">
        ${
          rebindableKey
            ? `<span class="pad-btn key-btn" data-keyfor="${a.id}">${keyLabel(a.id)}</span>
               <button class="subtle rebind-btn rebind-key" data-action="${a.id}">Change</button>`
            : `<span class="pad-btn">${a.keyHint || '—'}</span>`
        }
        <span class="pad-btn" data-for="${a.id}">${btnName(bindings[a.id])}</span>
        <button class="subtle rebind-btn rebind-pad" data-action="${a.id}">Change</button>
      </div>`;
    list.appendChild(row);
  }

  let capturing = null; // the armed <button>, or null
  const reset = (btn, label = 'Change') => {
    btn.textContent = label;
    btn.classList.remove('listening');
  };
  const conflictHost = container.querySelector('.binding-conflict');

  const requestResolution = (model, current, commit, retry) => {
    if (!model.hasConflict) { commit(applyRebind(model, current)); return; }
    conflictHost.hidden = false;
    conflictHost.innerHTML = `<b>${model.kind === 'key' ? 'Key' : 'Controller button'} already assigned</b>
      <p>${model.conflictingLabel} already uses this input.</p>
      <div><button type="button" class="subtle conflict-retry">Choose another</button>
      <button type="button" class="conflict-replace">Replace</button>
      <button type="button" class="subtle conflict-cancel">Cancel</button></div>`;
    const dismiss = () => { conflictHost.hidden = true; conflictHost.innerHTML = ''; };
    conflictHost.querySelector('.conflict-retry').addEventListener('click', () => { dismiss(); retry(); });
    conflictHost.querySelector('.conflict-replace').addEventListener('click', () => { dismiss(); commit(applyRebind(model, current, { replace: true })); });
    conflictHost.querySelector('.conflict-cancel').addEventListener('click', dismiss);
    conflictHost.querySelector('.conflict-retry').focus();
  };

  // Gamepad rebinds.
  list.querySelectorAll('.rebind-pad').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (capturing) {
        cancelCapture();
        cancelKeyCapture();
        reset(capturing);
        if (capturing === btn) {
          capturing = null;
          return;
        }
      }
      capturing = btn;
      btn.textContent = 'Press…';
      btn.classList.add('listening');
      const arm = () => captureNextButton((buttonIndex) => {
        const id = btn.dataset.action;
        const current = getBindings();
        const model = rebindConflictModel({ kind: 'pad', actionId: id, value: buttonIndex, bindings: current, actions: ACTIONS });
        const commit = (next) => {
          settings.bindings = next; onChange({ bindings: next });
          container.querySelector(`.pad-btn[data-for="${id}"]`).textContent = btnName(buttonIndex);
          if (model.conflictingId) container.querySelector(`.pad-btn[data-for="${model.conflictingId}"]`).textContent = btnName(next[model.conflictingId]);
          reset(btn); capturing = null;
        };
        requestResolution(model, current, commit, () => { btn.textContent = 'Press…'; arm(); });
      });
      arm();
    });
  });

  // Keyboard rebinds.
  list.querySelectorAll('.rebind-key').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (capturing) {
        cancelCapture();
        cancelKeyCapture();
        reset(capturing);
        if (capturing === btn) {
          capturing = null;
          return;
        }
      }
      capturing = btn;
      btn.textContent = 'Press…';
      btn.classList.add('listening');
      const arm = () => captureNextKey((key) => {
        const id = btn.dataset.action;
        const current = getKeyBindings();
        const model = rebindConflictModel({ kind: 'key', actionId: id, value: key, bindings: current, actions: ACTIONS });
        const commit = (next) => {
          settings.keyBindings = next; onChange({ keyBindings: next });
          container.querySelector(`.key-btn[data-keyfor="${id}"]`).textContent = keyLabel(id);
          if (model.conflictingId) {
            const displaced = ACTIONS.find((action) => action.id === model.conflictingId);
            const value = next[model.conflictingId] || displaced?.keyHint || displaced?.key || '—';
            container.querySelector(`.key-btn[data-keyfor="${model.conflictingId}"]`).textContent = value.length === 1 ? value.toUpperCase() : value;
          }
          reset(btn); capturing = null;
        };
        requestResolution(model, current, commit, () => { btn.textContent = 'Press…'; arm(); });
      }, { onCancel: () => { reset(btn); capturing = null; } });
      arm();
    });
  });
}
