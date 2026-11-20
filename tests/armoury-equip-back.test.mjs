// The empty-slot confirm returns to the list it came from on every way out but Equip.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/engine/runCombat.js';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { resolveUpgradedEquipment } from '../src/model/itemUpgrades.js';
import { resetModalState } from '../src/ui/modalManager.js';
import { OpenEquipConfirmModal, OpenSlotChoiceModal } from '../src/ui/components/armouryEquipModals.js';
import { withKitDom } from './helpers/dom.mjs';
import { createRunState } from '../src/model/state.js';
import { createMemoryStorage, createSaveManager } from '../src/engine/save.js';

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
      OpenEquipConfirmModal({ registries, item, name: piece.name, slotLabel: 'Hand · 1', onBack: () => out.backs++, onEquip: () => out.equips++ });
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

for (const disabled of [false, true]) {
  test(`remembered slot is highlighted only while available (disabled=${disabled})`, () => withKitDom(dom => {
    resetModalState();
    let chosen = null;
    const modal = OpenSlotChoiceModal({ selectedId: 'off', options: [
      { id: 'main', label: 'Main Hand' }, { id: 'off', label: 'Off Hand', disabled },
    ], onChoose: id => { chosen = id; } });
    const main = modal.panel.querySelector('[data-slot-option="main"]');
    const off = modal.panel.querySelector('[data-slot-option="off"]');
    assert.equal(off.getAttribute('aria-pressed'), String(!disabled));
    assert.equal(chosen, null, 'remembering never commits a choice');
    main.click();
    assert.equal(chosen, 'main', 'a different slot can still be chosen');
  }));
}

test('remembered equipment slots survive real save/load and older saves need no preference', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 511 });
  const saves = createSaveManager(createMemoryStorage());
  assert.equal(run.equipmentSlotChoices, undefined);
  saves.saveRun(run);
  assert.ok(saves.loadRun(registries), 'an older run without preferences loads');
  run.equipmentSlotChoices = { 'armament:ashStaff': 'leftHand:0', 'armament:roundShield': 'rightHand:0' };
  saves.saveRun(run);
  const loaded = saves.loadRun(registries);
  assert.ok(loaded, saves.runStatus().reason);
  assert.notEqual(loaded, run, 'reload creates a new run object');
  assert.deepEqual(loaded.equipmentSlotChoices, run.equipmentSlotChoices);
  assert.equal(createRunState({ registries, classId: 'reaver', seed: 512 }).equipmentSlotChoices, undefined, 'a new run starts without another run’s preferences');
});
