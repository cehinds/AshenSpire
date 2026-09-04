// src/ui/screens/controls.js — the Controls tab: rebind each action's keyboard
// key AND gamepad button (SPEC §7.3).
//
// THE PANE IS THE KIT'S (body A): Eyebrow + Title·M + Subtitle + Hairline,
// then one Row·setting per action — a LabelStack on the left, and in the
// trail the two bindings as Keycaps with their Rebind buttons beside them.
// Click a Rebind to arm it, then press a key / pad button. Bindings persist in
// settings.keyBindings + settings.bindings and apply live via onChange.
// Confirm's keyboard key is fixed (Enter always activates the cursor).

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
import { UI_COMPONENTS as UI, markUiComponent } from '../components/uiComponents.js';
import { el, eyebrow, titleM, subtitle, hairline, row, labelStack, keycap, button } from '../kit/index.js';

const btnName = padName;

export function renderControls(container, { settings, onChange }) {
  const padConnected =
    typeof navigator !== 'undefined' && navigator.getGamepads
      ? Array.from(navigator.getGamepads()).some(Boolean)
      : false;

  container.innerHTML = '';
  const pane = el('div', { class: 'as-pane controls-pane' }, [
    eyebrow('Controls'),
    titleM('Bindings', { tag: 'h3' }),
    el('p', { class: 'as-subtitle', html: 'Move the focus cursor with the <b>arrow keys</b>, <b>D-pad</b>, or <b>left stick</b>; activate with <b>Enter</b> / <b>A</b>. In combat, number keys <b>1–9</b> select cards and targets.' }),
    el('p', { class: 'as-subtitle' }, [
      padConnected
        ? el('span', { class: 'pad-live', text: '● pad connected' })
        : el('span', { class: 'pad-off', text: 'No pad detected' }),
      ' · Click a Rebind, then press a key or controller button. Arrow keys / D-pad always navigate.',
    ]),
    hairline(),
    el('div', { class: 'rebind-list' }),
  ]);
  container.appendChild(pane);

  const list = markUiComponent(pane.querySelector('.rebind-list'), UI.controlsRebindCapture);
  const bindings = getBindings();
  const keyBindings = getKeyBindings();

  for (const a of ACTIONS) {
    const rebindableKey = !!a.defKey; // Confirm's key (Enter) is fixed
    const trail = [];
    if (rebindableKey) {
      trail.push(keycap(keyLabel(a.id), { class: 'pad-btn key-btn', dataset: { keyfor: a.id } }));
      trail.push(button({ label: 'Key', className: 'rebind-btn rebind-key', attrs: { dataset: { action: a.id } } }));
    } else {
      trail.push(keycap(a.keyHint || '—', { class: 'pad-btn' }));
    }
    trail.push(keycap(btnName(bindings[a.id]), { class: 'pad-btn', dataset: { for: a.id } }));
    trail.push(button({ label: 'Pad', className: 'rebind-btn rebind-pad', attrs: { dataset: { action: a.id } } }));
    const rowEl = row({
      tag: 'div', setting: true, className: 'set-row rebind-row',
      labelNode: labelStack({ label: a.label, hint: a.hint || '' }),
      trail: el('span', { class: 'rebind-ctl' }, trail),
    });
    list.appendChild(rowEl);
    const keyControl = rowEl.querySelector('.rebind-key');
    if (keyControl) markUiComponent(keyControl, UI.controlsKeyRebindControl, a.id);
  }
  void keyBindings;

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
        btn.focus({ preventScroll: true });
      }, { onCancel: () => {
        reset(btn, 'Key');
        btn.focus({ preventScroll: true });
        capturing = null;
      } });
    });
  });
}
