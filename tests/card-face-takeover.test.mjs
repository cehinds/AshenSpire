// A hand card rebuilt because its preview or affordability moved takes over the
// face of the card it replaces (renderCard's `reuseFace`): the markup is parsed
// and fitted once, not on every play. The result must be the card a fresh
// renderCard would have made, byte for byte, and the door must be the new one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, previewCard } from '../src/engine/combat.js';
import { applyStatus } from '../src/engine/statuses.js';
import { renderCard } from '../src/ui/components/card.js';
import { mountHand } from '../src/ui/components/hand.js';
import { openBoundCardInspection } from '../src/ui/components/cardInspection.js';
import { clearSelection, resetSelection } from '../src/ui/components/cardSelection.js';
import { withModalDom } from './helpers/modal-dom.mjs';

const registries = createRegistries(contentBundle);
const player = {
  id: 'a', classId: 'reaver', hp: 80, maxHp: 80, energyMax: 20, maxStamina: 20, stamina: 20, drawPerTurn: 5, relicIds: [],
  deck: ['strike', 'defend', 'bashingBlow', 'warcry', 'strike', 'defend'].map((cardId, i) => ({ instanceId: `c${i}`, cardId, upgraded: false })),
};
const fightWith = (statuses = []) => {
  const combat = createCombat({ registries, rng: createRng(7), player: structuredClone(player), enemyIds: ['wanderingSoldier'] });
  for (const [who, id, stacks] of statuses) applyStatus(combat, who === 'enemy' ? combat.enemies[0] : combat.player, id, stacks);
  return combat;
};
const faceOf = (card) => card.querySelector('.illustrated-card-face');
const options = (preview, affordable = true, extra = {}) => ({ preview, affordable, faceLineLimit: 3, actionOwnsTouch: true, range: true, ...extra });

test('a card rebuilt for new numbers is the fresh card, on the donor\'s face nodes', () => withModalDom(() => {
  const calm = fightWith();
  const strong = fightWith([['player', 'strength', 3], ['enemy', 'vulnerable', 3]]);
  let moved = 0, kept = 0;
  for (const inst of calm.piles.hand) {
    const before = previewCard(calm, inst.instanceId);
    const after = previewCard(strong, inst.instanceId);
    const donor = renderCard(registries, inst, options(before));
    const donorFace = faceOf(donor);
    const rebuilt = renderCard(registries, inst, options(after, false, { reuseFace: donor }));
    const fresh = renderCard(registries, inst, options(after, false));
    assert.equal(rebuilt.outerHTML, fresh.outerHTML, `${inst.cardId}: the taken-over card equals a fresh render`);
    assert.equal(faceOf(rebuilt), donorFace, `${inst.cardId}: the face nodes were taken over`);
    assert.equal(faceOf(donor), null, 'the donor gave its face up');
    assert.equal(rebuilt.querySelectorAll('[data-damage-receipt]').length, fresh.querySelectorAll('[data-damage-receipt]').length,
      `${inst.cardId}: damage numbers explain themselves as on a fresh card`);
    if (JSON.stringify(before) === JSON.stringify(after)) kept++; else moved++;
  }
  assert.ok(moved > 0 && kept > 0, 'the fixture covers cards whose numbers moved and cards whose did not');
}));

test('affordability flips and an unchanged preview take the face over untouched', () => withModalDom(() => {
  const combat = fightWith();
  const inst = combat.piles.hand[0];
  const preview = previewCard(combat, inst.instanceId);
  const donor = renderCard(registries, inst, options(preview, true));
  const face = faceOf(donor);
  const rules = face.querySelector('.ic-text[data-card-binding="rules"]');
  rules.dataset.fittedFont = '17';
  const rebuilt = renderCard(registries, inst, options(preview, false, { reuseFace: donor }));
  assert.equal(faceOf(rebuilt), face);
  assert.equal(face.querySelector('.ic-text[data-card-binding="rules"]'), rules, 'rows that did not change keep their node and the fit written on it');
  assert.equal(rules.dataset.fittedFont, '17');
  assert.ok(rebuilt.classList.contains('unaffordable'));
  assert.ok(!donor.classList.contains('unaffordable'));
}));

test('a donor that is a different card, or an inspect face, is not taken over', () => withModalDom(() => {
  const combat = fightWith();
  const [first, other] = combat.piles.hand.filter((inst, i, all) => all.findIndex(o => o.cardId === inst.cardId) === i);
  const donor = renderCard(registries, first, options(previewCard(combat, first.instanceId)));
  const face = faceOf(donor);
  const rebuilt = renderCard(registries, other, options(previewCard(combat, other.instanceId), true, { reuseFace: donor }));
  assert.notEqual(faceOf(rebuilt), face);
  assert.equal(faceOf(donor), face, 'a refused donor keeps its face');
  assert.equal(rebuilt.outerHTML, renderCard(registries, other, options(previewCard(combat, other.instanceId))).outerHTML);
  const reading = renderCard(registries, first, { inspection: false, level: 'inspect', reuseFace: donor });
  assert.notEqual(faceOf(reading), face);
}));

test('the rebuilt hand card opens a door that says the current availability', () => withModalDom(() => {
  globalThis.NodeFilter ??= { SHOW_ELEMENT: 1 };
  document.createTreeWalker = () => ({ nextNode: () => false, currentNode: null });
  document.getSelection = () => ({ removeAllRanges() {}, rangeCount: 0 });
  resetSelection(); clearSelection();
  const combat = fightWith();
  const inst = combat.piles.hand[0];
  const preview = previewCard(combat, inst.instanceId);
  document.documentElement ??= { dataset: { handLayout: 'paging' }, getAttribute: () => null };
  const handEl = document.createElement('div');
  document.body.append(handEl);
  const hand = mountHand(handEl, { registries, reuseCards: true });
  const entry = (affordable, availability) => ({ inst, preview, affordable, selected: false, surface: 'combat', availability, commands: { play: () => {} } });
  hand.render({ cards: [entry(true, { play: true })] });
  const first = handEl.children[0];
  const face = faceOf(first);
  hand.render({ cards: [entry(false, { play: 'Not enough stamina for this card.' })] });
  const second = handEl.children[0];
  assert.notEqual(second, first, 'the card is rebuilt: its wiring captured the old affordability');
  assert.equal(faceOf(second), face, 'and carries the same face');
  assert.ok(openBoundCardInspection(second), 'the door opens');
  assert.match(document.body.outerHTML, /Not enough stamina for this card\./);
  hand.teardown();
}));
