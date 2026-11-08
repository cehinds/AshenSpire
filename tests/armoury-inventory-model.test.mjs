// tests/armoury-inventory-model.test.mjs — the Armoury inventory block's data
// (ui/models/ArmouryInventoryModel.js), read without a DOM. Expected values were
// captured from the expressions mountEquipment's inventoryBlock used before the extraction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { normalizeArmouryLayout } from '../src/model/armouryLayout.js';
import {
  armouryInventoryModel, combatPowerRoleLabels, inventoryRowPresentation, inventorySelectionContextText,
  inventoryRowUsable, inventoryClassChoice,
} from '../src/ui/models/ArmouryInventoryModel.js';

const registries = createRegistries(contentBundle);
const eq = registries.equipment;
const layout = normalizeArmouryLayout(eq.armouryUi && eq.armouryUi.layout);
const meta = { found: eq.armaments.map((row) => row.id) };
const fresh = () => {
  const run = createRunState({ seed: 11, classId: 'reaver', registries });
  run.loadout.storage = ['ashStaff', 'roundShield'];
  return run;
};

test('outside a picker only usable non-equippable items are listed (none here)', () => {
  const model = armouryInventoryModel({ registries, run: fresh(), meta, eq, picking: null, inCombat: false });
  assert.equal(model.selectedSlot, null);
  assert.equal(model.booksOnly, true);
  assert.equal(model.allRows.length, 11);
  assert.deepEqual(model.rows, []);
  assert.equal(model.itemCount, 0);
});

test('a picked Off Hand lists the rows that fit it, in inventory order', () => {
  const model = armouryInventoryModel({ registries, run: fresh(), meta, eq, picking: { slotId: 'leftHand', setIndex: 0 }, inCombat: false });
  assert.equal(model.selectedSlot.id, 'leftHand');
  assert.equal(model.booksOnly, false);
  assert.deepEqual(model.rows.map((row) => row.id), ['straightSword', 'roundShield', 'ashStaff']);
  assert.equal(model.itemCount, 3);
});

test('a row is presented as an armament with its equip words; without a target it has none', () => {
  const model = armouryInventoryModel({ registries, run: fresh(), meta, eq, picking: { slotId: 'leftHand', setIndex: 0 }, inCombat: false });
  const row = model.rows[0];
  const target = { kind: 'equip', slot: model.selectedSlot, setIndex: 0, pieceId: row.id };
  const shown = inventoryRowPresentation(row, { target, selectedSlot: model.selectedSlot, layout });
  assert.equal(shown.armament, true);
  assert.equal(shown.draggable, true);
  assert.equal(shown.actionLabel, 'Equip to Off Hand · 1');
  assert.equal(shown.faceActionLabel, 'Equip to Off Hand · 1');
  assert.equal(shown.cardClass, layout.cardClasses.armamentItem);
  const idle = inventoryRowPresentation(row, { target: null, selectedSlot: null, layout });
  assert.equal(idle.actionLabel, '');
  assert.equal(idle.faceActionLabel, '');
});

test('context line, role labels and usability', () => {
  assert.equal(inventorySelectionContextText({ slotLabel: 'Off Hand', index: 0, activeIndex: 0, currentName: 'Empty' }), 'Off Hand · 1 — Active · Empty');
  assert.equal(inventorySelectionContextText({ slotLabel: 'Off Hand', index: 1, activeIndex: 0, currentName: 'Empty' }), 'Off Hand · 2 — Reserve · Empty');
  assert.deepEqual(combatPowerRoleLabels(layout), { attack: 'Strike', technique: 'Magic', guard: 'Defense' });
  const run = fresh();
  assert.equal(inventoryRowUsable({ read: true }, { inCombat: true, run }), true);
  assert.equal(inventoryRowUsable({ classCard: true }, { inCombat: true, run }), false);
  assert.equal(inventoryClassChoice({ inCombat: false, run }), false);
});
