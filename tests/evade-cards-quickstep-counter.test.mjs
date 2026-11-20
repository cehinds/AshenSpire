// W25-EvadeCards: Quickstep is a Counter card under the batch-5 card-stack rule, so it grants its own Counter stack (counter.stacksByCard.quickstep = 1)
// and the Counter line on its face is what the reply deals (shown = dealt).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { CounterStacksForCard } from '../src/model/fixCoreMechanics.js';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { cardPlainText } from '../src/ui/components/card.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function live() {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  delete combat.reactionRules.contactPolicy;
  Object.assign(combat.player, { basePrecisionBonus: 1000, hp: 9999, maxHp: 9999, energy: 99 });
  Object.assign(enemy, { hp: 5000, maxHp: 5000, statuses: {}, ratings: { poise: 20 }, ratingSources: [], attributes: { dexterity: 0 }, basePrecisionBonus: 1000 });
  enemy.combatStance = { maneuver: 'attack', camp: 'physical', range: 'melee' };
  Object.assign(enemy, { maxStamina: 3, stamina: 3, plannedMoves: [] });
  enemy.intent = { ...enemy.intent, kind: 'attack', moveId: 'slash', damage: 10, hits: 1, combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits: [], stanceTrigger: false } };
  enemy.moves = { ...enemy.moves, slash: { intent: 'attack', damage: 10, hits: 1, weight: 45 } };
  dispatch(combat, { type: 'setReactions', enabled: false });
  return { combat, enemy };
}

test('the shipped Counter rule lists Quickstep with one stack (two upgraded)', () => {
  assert.equal(shipped.counter.stacksByCard.quickstep, 1);
  assert.equal(CounterStacksForCard(shipped.counter, 'quickstep'), 1);
  assert.equal(CounterStacksForCard(shipped.counter, 'quickstep', true), 2);
});

test('playing Quickstep gives 1 Counter stack and 1 Evade stack', () => {
  const { combat } = live();
  combat.piles.hand.push({ instanceId: 'q', cardId: 'quickstep' });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'q' });
  assert.equal(combat.player.counterStacks, 1, 'Quickstep grants its Counter stack');
  assert.equal(combat.player.statuses.evade?.stacks ?? combat.player.evade, 1);
});

test('the Counter line on the Quickstep face equals the reply it deals (shown = dealt)', () => {
  const { combat } = live();
  combat.piles.hand.push({ instanceId: 'q', cardId: 'quickstep' });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'q' });
  combat.player.statuses = {}; // keep the enemy hit from being dodged: the reply, not the Evade, is under test
  const from = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const trigger = combat.eventLog.slice(from).find(event => event.type === 'combatCounterTriggered');
  assert.ok(trigger, 'the covered hit triggers the reply');
  const face = cardPlainText(registries, { cardId: 'quickstep' }, { rules: { combatExpansionVersion: 2, gameProfile: profile } });
  const shown = Number(/Counter (\d+)/.exec(face)?.[1]);
  assert.ok(Number.isFinite(shown), face);
  assert.equal(trigger.counterBase, shown, `face "${face}" shows the base the reply deals`);
  assert.equal(trigger.amount, shown + Math.floor(trigger.counterIncoming * 0.1 * trigger.counterStacks));
});

test('Quickstep pays 1 Stamina and no Mana, though the shortbow lists it as a weapon art', () => {
  const { combat } = live();
  combat.piles.hand.push({ instanceId: 'q', cardId: 'quickstep' });
  const before = { stamina: combat.player.stamina, mana: combat.player.mana, energy: combat.player.energy };
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'q' });
  const played = out.events.find(event => event.type === 'cardPlayed');
  assert.ok(played);
  assert.equal(registries.cards.get('quickstep').manaCost || 0, 0);
  assert.equal(combat.player.mana, before.mana, 'no Mana paid');
  assert.equal(before.stamina - combat.player.stamina, 1, 'one Stamina paid');
  const face = cardPlainText(registries, { cardId: 'quickstep' }, { rules: { combatExpansionVersion: 2, gameProfile: profile } });
  assert.ok(face);
});
