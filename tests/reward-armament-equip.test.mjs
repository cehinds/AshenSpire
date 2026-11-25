// Owner 2026-11-19: armour or a weapon won from a reward door is offered to Equip beside Keep in inventory, as a
// purchase is. Since the contextual inspection (#2887) the face opens the inspection modal, whose only action was
// Confirm, so the Equip step was never reached. Equip claims the item, then opens the Armoury's own equip flow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { MountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';

const registries = createRegistries(contentBundle);
const weapon = registries.equipment.armaments[0];
const armour = registries.equipment.armour.find(item => item.classId === 'reaver');

async function withDom(fn) {
  const { globals } = withKitDom((dom, globals) => ({ globals }));
  const before = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  document.documentElement = document.body;
  document.getSelection = () => null;
  const make = document.createElement.bind(document);
  document.createElement = (...args) => { const node = make(...args); node.insertAdjacentHTML ||= () => {}; return node; };
  try { await fn(); } finally {
    clearSelection();
    for (const [key, value] of Object.entries(before)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
}

function mount(kind, id, extra = {}) {
  const app = document.createElement('main'); document.body.append(app);
  const run = { class: 'reaver', deck: [], sideboard: [], cinders: 0 };
  const offer = { id: `equip-${kind}`, options: [{ kind, id }, { kind: 'relics', id: registries.relics.all()[0].id }], taken: [], claimed: null, takeCount: 1 };
  const calls = [];
  MountGameProfileOffers(app, { registries, run, offer, title: 'Armament reward',
    onTake(i) { calls.push(`take:${i}`); offer.taken.push(i); offer.claimed = i; },
    onAddToDeck(i) { calls.push(`add:${i}`); },
    addRefusal: () => '',
    onEditEquipment(i, back) { calls.push(`equip:${i}`); back(); },
    canEditEquipment: true,
    onContinue() { calls.push('continue'); }, ...extra });
  return { app, calls };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
// Owner 2026-11-20: a tap selects the face; its (i) opens the inspection modal.
const openFace = app => { const face = app.querySelector('.reward-choice-face'); face.click(); face.querySelector('.card-info-button').click(); };
const actions = () => [...document.querySelectorAll('.card-inspection-modal .card-inspection-act')];

for (const [kind, piece] of [['armor', armour], ['weapons', weapon]]) {
  test(`a won ${kind} offers Equip and Keep in inventory`, async () => {
    await withDom(async () => {
      const { app } = mount(kind, piece.id);
      openFace(app);
      assert.deepEqual(actions().map(button => button.textContent), ['Keep in inventory', 'Equip'], 'Keep beside the primary Equip');
    });
  });

  test(`Equip on a won ${kind} claims it, then opens the Armoury equip flow for it`, async () => {
    await withDom(async () => {
      const { app, calls } = mount(kind, piece.id);
      openFace(app);
      actions().find(button => button.textContent === 'Equip').click();
      await settle();
      assert.deepEqual(calls, ['take:0', 'equip:0', 'continue']);
    });
  });

  test(`Keep in inventory on a won ${kind} claims it and never opens the Armoury`, async () => {
    await withDom(async () => {
      const { app, calls } = mount(kind, piece.id);
      openFace(app);
      actions().find(button => button.textContent === 'Keep in inventory').click();
      await settle();
      assert.deepEqual(calls, ['take:0', 'continue']);
    });
  });
}

test('with no equipment module the won armour keeps its single Confirm', async () => {
  await withDom(async () => {
    const { app } = mount('armor', armour.id, { canEditEquipment: false });
    openFace(app);
    assert.deepEqual(actions().map(button => button.textContent), ['Confirm']);
  });
});
