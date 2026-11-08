// The empty-slot confirm returns to the list it came from on every way out but Equip.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/engine/runCombat.js';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { resolveUpgradedEquipment } from '../src/model/itemUpgrades.js';
import { resetModalState } from '../src/ui/modalManager.js';
import { openEquipConfirmModal } from '../src/ui/components/armouryEquipModals.js';
import { withKitDom } from './helpers/dom.mjs';

const piece = registries.equipment.armaments[0];
const item = resolveUpgradedEquipment(registries, `armament/${piece.id}`, 0);
const q = (dom) => dom.document.querySelector('.equip-confirm-modal');
const byText = (dom, text) => [...q(dom).querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const paths = {
  'Escape': (dom, win) => win.press('Escape'),
  'the header X': (dom) => q(dom).querySelector('.modal-close').click(),
  'the Back button': (dom) => byText(dom, 'Back').click(),
  'the backdrop': (dom) => { const veil = q(dom).parentNode; veil.dispatchEvent(new dom.Event('pointerdown', { bubbles: true })); veil.click(); },
};
function run(act, pressEquip = false) {
  const out = { backs: 0, equips: 0 };
  const queued = []; const realQ = globalThis.queueMicrotask;
  withKitDom((dom, win) => {
    resetModalState();
    globalThis.queueMicrotask = (fn) => queued.push(fn);
    try {
      openEquipConfirmModal({ registries, item, name: piece.name, slotLabel: 'Hand · 1', onBack: () => out.backs++, onEquip: () => out.equips++ });
      if (pressEquip) q(dom).querySelector('.equip-confirm-equip').click(); else act(dom, win);
      queued.splice(0).forEach((fn) => fn());
    } finally { globalThis.queueMicrotask = realQ; }
  });
  return out;
}
for (const [name, act] of Object.entries(paths)) {
  test(`empty-slot confirm: ${name} returns to the slot list`, () => {
    assert.deepEqual(run(act), { backs: 1, equips: 0 });
  });
}
test('empty-slot confirm: Equip does not reopen the list', () => {
  assert.deepEqual(run(null, true), { backs: 0, equips: 1 });
});
