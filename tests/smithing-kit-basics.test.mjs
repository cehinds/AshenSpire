// The Smith's plan names every card a promotion improves, the complete-kit
// Strike and Guard included (SPEC, Complete armament kits: "Its Strike and
// Guard use its own profiles, attribute scaling, damage school, and smithing
// level"). Kit basics are `equipmentRole: 'granted'` with the role in
// `kitRole`; resolveCard applies tier rows by that role, so a plan that read
// only `equipmentRole` hid cards the commit then improved, and the receipt's
// "N basic cards improved" undercounted them.

import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { smithingPlan, commitSmithing } from '../src/model/smithing.js';

const registries = createRegistries(contentBundle);
const amount = (card, op) => {
  const effect = (resolveCard(registries, card).effects || []).find((row) => row.op === op);
  return effect?.amount ?? effect?.stacks ?? null;
};

test('a kit Strike and Guard are in the plan, the receipt and the role previews', () => {
  const run = createRunState({ seed: 211, classId: 'reaver', registries });
  const kitIds = ['kit:straightSword:attack', 'kit:straightSword:guard'];
  for (const id of kitIds) assert.ok(run.deck.some((card) => card.instanceId === id), `${id} is dealt`);

  const sword = smithingPlan(registries, run).candidates.find((row) => row.armamentId === 'straightSword');
  const planned = sword.affectedCards.map((row) => row.instanceId);
  for (const id of kitIds) assert.ok(planned.includes(id), `${id} is in the plan`);
  const kitGuard = sword.affectedCards.find((row) => row.instanceId === 'kit:straightSword:guard');
  assert.equal(kitGuard.role, 'guard');
  assert.ok(kitGuard.changes.some((change) => change.op === 'block' && change.after > change.before));
  const guardPreview = sword.previewCards.find((row) => row.role === 'guard');
  assert.equal(guardPreview.used, true, 'the sword lends a live Guard, so its Guard preview is used');
  assert.equal(guardPreview.activeCopies, 1);

  const before = new Map(run.deck.map((card) => [card.instanceId, [amount(card, 'damage'), amount(card, 'block')]]));
  run.smithingStones = 1;
  const receipt = commitSmithing(registries, run, 'straightSword');
  const improved = run.deck.filter((card) => {
    const [damage, block] = before.get(card.instanceId);
    return amount(card, 'damage') !== damage || amount(card, 'block') !== block;
  }).map((card) => card.instanceId).sort();
  assert.deepEqual(receipt.affectedCards.map((row) => row.instanceId).sort(), improved,
    'the receipt names exactly the cards the promotion improved');
  for (const id of kitIds) assert.ok(improved.includes(id), `${id} improved`);
});
