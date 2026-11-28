// Owner, 2026-11-14: Reaction is an upgrade option on a card of any stance, except a Defense or Counter card, one with `trait:reaction`,
// a Power or an X-cost card; the weight is the other effect steps' (8). Owner ruling 2026-11-28: no shipped Core card carries the trait.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries, profile } from './helpers/fixcore-combat-rules.mjs';
import { nextUpgradeOptions } from '../src/model/cardUpgradeLimits.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { dispatch } from '../src/engine/combat.js';
import { ReactionCarrierProfile } from './helpers/reaction-carriers.mjs';

const RUN = { seed: 7, level: { level: 10 }, gameProfile: profile, rangePolicy: {} };
const REACTION = [{ k: 'fx', fx: 'reaction' }];
const carrierProfile = ReactionCarrierProfile();
const carrierRegistries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, carrierProfile)), carrierProfile);
const offered = (cardId, cardRegistries = registries) => nextUpgradeOptions(RUN, { instanceId: 'k1', cardId, rank: 2, upgraded: false }, cardRegistries.cards.get(cardId), cardRegistries, 60, { noAuthored: true, everyFamily: true })
  .some((step) => step.k === 'fx' && step.fx === 'reaction');

test('Reaction is offered on attack, Smash, Sweep, spell and skill cards', () => {
  for (const id of ['core.strike', 'core.smash', 'core.sweep', 'core.cantrip', 'core.mendingTouch']) assert.ok(offered(id), id);
});
test('Reaction is never offered on a Defense card, a Counter card or a card that already has it', () => {
  for (const id of ['core.defend', 'core.counter', 'core.backstep']) assert.equal(offered(id), false, id);
  assert.equal(offered('core.jab', carrierRegistries), false, 'a Jab carrying trait:reaction');
  assert.equal(offered('core.jab'), true, 'the shipped Jab is an attack without the trait');
});
test('no Core Power or X-cost card is offered Reaction', () => {
  for (const base of registries.cards.all().filter((c) => c.id.startsWith('core.') && (c.type === 'power' || c.cost === 'X'))) assert.equal(offered(base.id), false, base.id);
});

const coreProfile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, coreProfile)), coreProfile);
const carrierReg = carrierRegistries;
function fight(inst, registries = reg) {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  combat.piles.hand.length = 0;
  combat.piles.hand.push(inst);
  combat.player.stamina = combat.player.maxStamina = 20;
  combat.player.mana = combat.player.maxMana = 20;
  for (const enemy of combat.enemies) enemy.intentRevealed = false;
  return combat;
}
const offerFor = (inst, registries = reg) => { const combat = fight(inst, registries); dispatch(combat, { type: 'endTurn' }); return { combat, offer: combat.pendingReaction }; };

test('an unupgraded Defend and Counter carrying trait:reaction are offered in the reaction prompt; the shipped ones are not', () => {
  for (const cardId of ['core.defend', 'core.counter']) {
    const { offer } = offerFor({ instanceId: 'r1', cardId, upgraded: false }, carrierReg);
    assert.ok(offer?.options.some((row) => row.cardId === cardId), cardId);
    const shipped = offerFor({ instanceId: 'r1', cardId, upgraded: false }).offer;
    assert.equal(shipped?.options.some((row) => row.cardId === cardId) || false, false, `shipped ${cardId}`);
  }
});
test('an unupgraded Smash is not offered; upgraded with Reaction, a Smash and a spell are, and resolve before the hit', () => {
  assert.equal(offerFor({ instanceId: 'r1', cardId: 'core.smash', upgraded: false }).offer?.options.some((row) => row.cardId === 'core.smash') || false, false);
  for (const cardId of ['core.smash', 'core.cantrip']) {
    const { combat, offer } = offerFor({ instanceId: 'r1', cardId, upgraded: true, upgradeSteps: REACTION });
    const option = offer?.options.find((row) => row.cardId === cardId);
    assert.ok(option, `${cardId} is offered`);
    const out = dispatch(combat, { type: 'chooseReaction', offerId: offer.id, optionId: option.id });
    const types = out.events.map((event) => event.type);
    assert.ok(types.includes('cardPlayed'), cardId);
    if (types.includes('attackHit')) assert.ok(types.indexOf('cardPlayed') < types.indexOf('attackHit'), `${cardId} resolves before the hit`);
  }
});
