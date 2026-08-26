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
import { bindingConflictModel } from '../models/BindingConflictModel.js';
import { mountBindingConflictDialog } from '../components/bindingConflictDialog.js';

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

  const syncBadges = (family, ids) => {
    for (const id of new Set(ids.filter(Boolean))) {
      const badge = container.querySelector(family === 'keyboard'
        ? `.key-btn[data-keyfor="${id}"]`
        : `.pad-btn[data-for="${id}"]`);
      if (badge) badge.textContent = family === 'keyboard'
        ? keyLabel(id)
        : btnName(getBindings()[id]);
    }
  };

  const applyBinding = (family, id, value, conflictId = null) => {
    const next = { ...(family === 'keyboard' ? getKeyBindings() : getBindings()) };
    if (conflictId) next[conflictId] = null;
    next[id] = value;
    if (family === 'keyboard') {
      settings.keyBindings = next;
      onChange({ keyBindings: next });
    } else {
      settings.bindings = next;
      onChange({ bindings: next });
    }
    syncBadges(family, [id, conflictId]);
  };

  const resolveCandidate = (family, btn, value, listenAgain) => {
    const id = btn.dataset.action;
    const model = bindingConflictModel({
      family,
      actionId: id,
      value,
      bindings: family === 'keyboard' ? getKeyBindings() : getBindings(),
      actions: ACTIONS,
      candidateLabel: family === 'controller' ? btnName(value) : '',
    });
    if (!model) {
      applyBinding(family, id, value);
      reset(btn, family === 'keyboard' ? 'Key' : 'Pad');
      capturing = null;
      return;
    }

    mountBindingConflictDialog(document.body, model, {
      returnFocusElement: btn,
      onChooseAnother: () => {
        capturing = btn;
        btn.textContent = 'Press…';
        btn.classList.add('listening');
        btn.focus({ preventScroll: true });
        listenAgain(btn);
      },
      onReplace: () => {
        applyBinding(family, id, value, model.properties.conflictActionId);
        reset(btn, family === 'keyboard' ? 'Key' : 'Pad');
        capturing = null;
      },
      onCancel: () => {
        reset(btn, family === 'keyboard' ? 'Key' : 'Pad');
        capturing = null;
      },
    });
  };

  const listenForPad = (btn) => {
    captureNextButton((buttonIndex) => resolveCandidate('controller', btn, buttonIndex, listenForPad));
  };
  const listenForKey = (btn) => {
    captureNextKey((key) => resolveCandidate('keyboard', btn, key, listenForKey));
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
      listenForPad(btn);
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
      listenForKey(btn);
    });
  });
}
