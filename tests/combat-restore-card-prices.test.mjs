import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard, cardPlayCosts } from '../src/engine/combat.js';
import { grantAbilityCharge } from '../src/engine/abilityRiders.js';
import { COMBAT_ROUNDS_KEY, combatRoundsFor } from '../src/model/combatRounds.js';
import { renderCard } from '../src/ui/components/card.js';
import { cardMarkupDom } from './helpers/card-markup-dom.mjs';

Object.assign(globalThis, cardMarkupDom());
const staminaRestore = { id: 'funded-stamina-fixture', name: 'Funded Stamina', type: 'skill',
  kindIds: ['classification.skill'], costRule: 'fixed', cost: 3, manaCost: 0,
  tags: ['camp:physical', 'maneuver:defend'],
  effects: [{ op: 'gainEnergy', target: 'self', amount: 2, funded: 2 }],
  textTemplate: 'Gain {gainEnergy} Stamina.' };
const queuedManaCard = { ...staminaRestore, id: 'queued-mana-fixture', cost: 1, manaCost: 2,
  effects: [{ op: 'block', target: 'self', amount: 1 }], textTemplate: 'Gain {block} Block.' };
const registries = createRegistries({ ...contentBundle, cards: [...contentBundle.cards, staminaRestore, queuedManaCard] });

function fixture(cardId, { version, discount = 0 }) {
  const ref = { cardId, instanceId: 'restore' };
  const player = id => ({ id, classId: cardId === 'emberCommunion' ? 'herald' : 'starseer',
    combatExpansionVersion: version,
    hp: 80, maxHp: 80, maxMana: 10, mana: 0, maxStamina: 10, stamina: 10,
    energyMax: 10, drawPerTurn: 1, orderedDraw: true,
    deck: [{ ...ref, instanceId: id === 'b' ? 'other' : ref.instanceId }] });
  const options = { registries, rng: createRng(11), combatExpansionVersion: version,
    enemyIds: ['wanderingSoldier'] };
  const combat = createCombat({ ...options, player: player('player') });
  const owner = combat.player;
  if (discount) grantAbilityCharge(owner, { key: 'restore-discount', manaDiscount: discount });
  const preview = () => previewCard(combat, ref.instanceId);
  const play = () => dispatch(combat, { type: 'playCard', cardInstanceId: ref.instanceId });
  return { combat, owner, ref, preview, play };
}

test('Combat Rounds restore badges respect discounts held by other queued cards', () => {
  const combat = createCombat({ registries, rng: createRng(11), combatExpansionVersion: 2,
    combatRounds: combatRoundsFor({ [COMBAT_ROUNDS_KEY]: true }), enemyIds: ['wanderingSoldier'],
    player: { classId: 'starseer', hp: 80, maxHp: 80, mana: 2, maxMana: 10,
      stamina: 10, maxStamina: 10, energyMax: 10, drawPerTurn: 2, orderedDraw: true,
      deck: [{ cardId: queuedManaCard.id, instanceId: 'held' }, { cardId: 'attune', instanceId: 'restore' }] } });
  const ref = { cardId: 'attune', instanceId: 'restore' };
  grantAbilityCharge(combat.player, { key: 'held-discount', manaDiscount: 1 });
  const manaBadge = () => playingCardModel(registries, ref, { preview: previewCard(combat, 'restore') }).costs.mana;
  assert.equal(manaBadge(), 0, 'a free discount lowers the full price');
  dispatch(combat, { type: 'playCard', cardInstanceId: 'held' });
  assert.deepEqual(combat.combatRounds.playerQueue[0].claims, ['held-discount']);
  assert.equal(manaBadge(), 1, 'Attune cannot borrow another queued card’s held discount');
  assert.equal(cardPlayCosts(combat, 'restore').mana, 1, 'the reserved discount cannot reduce upfront Mana payment');
  dispatch(combat, { type: 'unqueueCard', cardInstanceId: 'held' });
  assert.equal(manaBadge(), 0, 'unqueuing releases the discount');
  dispatch(combat, { type: 'playCard', cardInstanceId: 'restore' });
  assert.equal(manaBadge(), 0, 'a card retains its own queued discount');
});

for (const version of [1, 2]) {
  for (const cardId of ['attune', 'emberCommunion']) for (const discount of [0, 1, 3]) {
    test(`solo v${version} ${cardId} shows the full price with discount ${discount}, requires its discounted upfront Mana`, () => {
      const f = fixture(cardId, { version, discount });
      const before = JSON.stringify({ owner: f.owner, piles: f.combat.piles,
        events: f.combat.eventLog, rng: f.combat.rng.getCounters() });
      const receipt = f.preview();
      const fullMana = discount ? 0 : 1;
      assert.equal(receipt.manaCost, fullMana, 'affordability requires upfront Mana');
      const model = playingCardModel(registries, f.ref, { preview: receipt });
      assert.equal(model.costs.mana, fullMana, 'discount the full price before subtracting restore funding');
      assert.equal(JSON.stringify({ owner: f.owner, piles: f.combat.piles,
        events: f.combat.eventLog, rng: f.combat.rng.getCounters() }), before, 'preview is pure');
      const card = renderCard(registries, f.ref, { preview: receipt, affordable: !fullMana, inspection: false });
      if (fullMana) assert.match(card.innerHTML, /data-card-binding="mana"[^>]*>1<\/div>/);
      else assert.doesNotMatch(card.innerHTML, /data-component="mana-(icon|value)"/);
      assert.equal(card.classList.contains('unaffordable'), !!fullMana);
      const oldSP = f.owner.energy;
      if (fullMana) {
        assert.throws(f.play, /Not enough.*mana/i);
        f.owner.mana = fullMana;
      }
      f.play();
      const paidOwner = f.combat.player;
      assert.equal(paidOwner.mana, 2, 'after upfront payment the authored restore grants two Mana');
      assert.equal(paidOwner.energy, oldSP - receipt.cost);
      assert.ok(f.combat.eventLog.some(event => event.type === 'cardPlayed' && event.cardInstanceId === 'restore'));
    });
  }
  test(`solo v${version} Stamina restores show full SP and pay only the unfunded part`, () => {
    const f = fixture(staminaRestore.id, { version });
    const receipt = f.preview();
    const model = playingCardModel(registries, f.ref, { preview: receipt });
    assert.deepEqual([model.costs.action, model.costs.stamina], [3, 3]);
    assert.equal(receipt.cost, version === 2 ? 1 : 3, 'legacy action preview remains unchanged');
    assert.equal(receipt.staminaCost, version === 2 ? 1 : 3);
    assert.deepEqual(cardPlayCosts(f.combat, f.ref.instanceId), { energy: 1, mana: 0, stamina: 1 }, 'payment API retains its original shape and net values');
    const card = renderCard(registries, f.ref, { preview: receipt, inspection: false });
    assert.match(card.innerHTML, /data-card-binding="stamina"[^>]*>3<\/div>/);
    const oldSP = f.owner.energy;
    f.play();
    assert.equal((f.combat.player).energy, oldSP - 1);
  });
}
