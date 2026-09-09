import test from 'node:test';
import assert from 'node:assert/strict';
import { combatRules } from '../src/content/combatRules.js';
import { createPrototypeCombat, prototypeInput, prototypeBundle } from '../src/content/prototypes/combatBuilds.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createCoopCombat, playCard, endTurn } from '../src/engine/coopCombat.js';
import { createRegistries } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { resolveDamageComponents, allocateInteger, weaponImpact, resolveStackApplications, stackMagnitude } from '../src/model/combatRules.js';
import { previewFoundationAction, foundationTriggerAllowed, foundationDamage } from '../src/engine/combatRules.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { applyStatus, advanceStatusClock } from '../src/engine/statuses.js';

function inHand(c, cardId) {
  for (const pile of ['hand', 'draw', 'discard']) {
    const index = c.piles[pile].findIndex((card) => card.cardId === cardId);
    if (index < 0) continue;
    const [card] = c.piles[pile].splice(index, 1);
    c.piles.hand.push(card); return card.instanceId;
  }
  throw new Error(`Fixture lacks ${cardId}`);
}
function play(c, cardId, targetId = 'e1') { return dispatch(c, { type: 'playCard', cardInstanceId: inHand(c, cardId), targetId }); }
function state(c) { return JSON.stringify({ snapshot: serializeCombatSnapshot(c), counters: c.rng.getCounters() }); }

test('prototype content passes the production validator', () => {
  assert.deepEqual(validateContent(prototypeBundle()).errors, []);
});
test('typed mitigation applies flat damage once and floors each component', () => {
  const result = resolveDamageComponents(combatRules, { components: [{ type: 'slashing', amount: 10 }, { type: 'fire', amount: 10 }], armor: 100, resistances: { fire: 0.5 }, flatBonus: 4 });
  assert.deepEqual(result, [{ type: 'slashing', amount: 6 }, { type: 'fire', amount: 6 }]);
  assert.equal(resolveDamageComponents(combatRules, { components: [{ type: 'arcane', amount: 100 }], armor: 9999, immunities: ['arcane'] })[0].amount, 0);
});
test('multi-hit impact conserves the weapon budget while each contact applies Bleed', () => {
  const c = createPrototypeCombat('bleed', 'basic', 1);
  c.enemies[0].block = 100;
  const source = c.foundation.profiles.player.sources.mainHand;
  const result = play(c, 'prototypeFast');
  assert.equal(result.events.filter((e) => e.type === 'impactDealt').reduce((a, e) => a + e.amount, 0), weaponImpact(combatRules, source));
  assert.equal(c.enemies[0].statuses.bleed.meter.value, 2);
  assert.equal(c.enemies[0].hp, c.enemies[0].maxHp);
  assert.deepEqual(allocateInteger(5, [1, 1, 1]), [2, 2, 1]);
});
test('Evade suppresses damage, impact and attached Bleed for exactly one hit', () => {
  const c = createPrototypeCombat('bleed', 'basic', 1);
  c.enemies[0].evade = 1;
  const result = play(c, 'prototypeSetup');
  assert.equal(c.enemies[0].hp, c.enemies[0].maxHp);
  assert.equal(c.enemies[0].statuses.bleed, undefined);
  assert.equal(result.events.filter((e) => e.type === 'attackEvaded').length, 1);
  assert.equal(result.events.filter((e) => e.type === 'impactDealt').length, 0);
});
test('Dodge retains, costs weight-priced stamina and does not roll RNG', () => {
  const c = createPrototypeCombat('heavy', 'basic', 1);
  const id = inHand(c, 'dodgeRoll');
  dispatch(c, { type: 'endTurn' });
  assert(c.piles.hand.some((card) => card.instanceId === id));
  const counters = c.rng.getCounters();
  const energy = c.player.energy;
  dispatch(c, { type: 'playCard', cardInstanceId: id });
  assert.equal(c.player.energy, energy);
  assert.equal(c.player.stamina, 2);
  assert.equal(c.player.evade, 1);
  assert.deepEqual(c.rng.getCounters(), counters);
  const result = dispatch(c, { type: 'endTurn' });
  assert(result.events.some((e) => e.type === 'attackEvaded'));
  assert.equal(c.player.stamina, 3);
  assert.equal(c.player.evade, 0);
});
test('spent mana never refills automatically across turns', () => {
  const c = createPrototypeCombat('caster', 'basic', 1);
  play(c, 'prototypeComet');
  assert.equal(c.player.mana, 2);
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.player.mana, 2);
});
test('failed resolution rolls back cards, resources, events and every RNG stream', () => {
  const input = prototypeInput('heavy', 'basic', 1);
  const bundle = prototypeBundle();
  bundle.cards = bundle.cards.map((c) => c.id === 'prototypeHeavy' ? { ...c, attack: { source: 'weapon', hitWeights: [1, 1] } } : c);
  input.registries = createRegistries(bundle);
  const c = createCombat(input);
  const id = inHand(c, 'prototypeHeavy');
  const before = state(c);
  assert.throws(() => dispatch(c, { type: 'playCard', cardInstanceId: id, targetId: 'e1' }), /hitWeights/);
  assert.equal(state(c), before);
});
test('exact preview leaves live state untouched and matches subsequent execution', () => {
  const c = createPrototypeCombat('bleed', 'basic', 1);
  const intent = { type: 'playCard', cardInstanceId: inHand(c, 'prototypeFast'), targetId: 'e1' };
  const before = state(c);
  const preview = previewFoundationAction(c, (copy) => dispatch(copy, intent));
  assert.equal(state(c), before);
  const result = dispatch(c, intent);
  assert.deepEqual(result, preview.result);
  assert.equal(state(c), state(preview.state));
});
test('save/reload preserves Evade, rules and deterministic continuation', () => {
  const c = createPrototypeCombat('heavy', 'basic', 1);
  play(c, 'dodgeRoll');
  const snapshot = serializeCombatSnapshot(c);
  const restored = restoreCombatSnapshot({ registries: c.registries, rng: createRng(c.rng.seed, c.rng.getCounters()), snapshot });
  assert.deepEqual(dispatch(c, { type: 'endTurn' }), dispatch(restored, { type: 'endTurn' }));
  assert.equal(state(c), state(restored));
  snapshot.foundation.rules.armor.cap = 0.9;
  assert.throws(() => restoreCombatSnapshot({ registries: c.registries, rng: c.rng, snapshot }), /fingerprint/);
});
test('chance caches at declared scope, isolates RNG and prevents ancestry loops', () => {
  const c = createPrototypeCombat('heavy', 'basic', 1);
  const before = c.rng.getCounters();
  for (let i = 0; i < 5; i++) foundationTriggerAllowed(c, 'rune:a', { chance: 0.5, rollScope: 'target' }, { targetId: 'e1', eventId: i });
  const after = c.rng.getCounters();
  assert.equal(after.combatProcs, before.combatProcs + 1);
  for (const key of Object.keys(before)) if (key !== 'combatProcs') assert.equal(after[key], before[key]);
  assert.equal(foundationTriggerAllowed(c, 'rune:a', { allowSecondary: true }, { ancestry: ['rune:a'] }), false);
});
test('strongest stacking restores a weaker independent source after expiry', () => {
  const bundle = prototypeBundle();
  bundle.statuses = [...bundle.statuses, { id: 'prototypeStrength', name: 'Strength', stackMode: 'add', decay: 'none', stacking: { mode: 'strongest', cap: 10, duration: 2, clock: 'ownerTurnEnd' }, modifiers: { attackDamageAdd: 1 } }];
  const input = prototypeInput('heavy', 'basic', 1); input.registries = createRegistries(bundle);
  const c = createCombat(input);
  applyStatus(c, c.player, 'prototypeStrength', 5, { id: 'runeA' });
  advanceStatusClock(c, c.player, 'ownerTurnEnd');
  applyStatus(c, c.player, 'prototypeStrength', 2, { id: 'runeB' });
  assert.equal(c.player.statuses.prototypeStrength.stacks, 5);
  advanceStatusClock(c, c.player, 'ownerTurnEnd');
  assert.equal(c.player.statuses.prototypeStrength.stacks, 2);
  advanceStatusClock(c, c.player, 'ownerTurnEnd');
  assert.equal(c.player.statuses.prototypeStrength, undefined);
  const rows = resolveStackApplications([{ sourceId: 'a', value: 4, expires: 1 }], { sourceId: 'b', value: 8, expires: 3 }, { mode: 'refresh', cap: 9 });
  assert.equal(stackMagnitude(rows, 'refresh', 9), 4);
});
test('co-op commits seat-local Evade and resource costs without corrupting another seat', () => {
  const input = prototypeInput('heavy', 'basic', 1);
  const c = createCoopCombat({ ...input, players: [{ ...input.player, id: 'p1' }, { ...input.player, id: 'p2' }], combatProfiles: { p1: input.combatProfiles.player, p2: { ...input.combatProfiles.player, weightClass: 'light' }, e1: input.combatProfiles.e1 } });
  const p1 = c.players.get('p1');
  const id = inHand({ piles: p1.piles }, 'dodgeRoll');
  playCard(c, 'p1', id);
  assert.equal(c.players.get('p1').entity.stamina, 2);
  assert.equal(c.players.get('p2').entity.stamina, 5);
  assert.equal(c.players.get('p1').entity.evade, 1);
  endTurn(c, 'p1'); endTurn(c, 'p2');
  assert.equal(c.players.get('p1').entity.stamina, 3);
  assert.equal(c.players.get('p2').entity.stamina, 5);
  assert(c.eventLog.some((e) => e.type === 'attackEvaded' && e.targetPlayerId === 'p1'));
});

test('grouped resistance does not multiply equivalent sources; logs conserve typed HP damage', () => {
  const input = prototypeInput('heavy', 'basic', 1);
  input.combatProfiles.e1 = { ...input.combatProfiles.e1, armor: 0, resistanceSources: [
    { type: 'fire', group: 'ward', amount: 0.5 }, { type: 'fire', group: 'ward', amount: 0.25 }, { type: 'fire', group: 'armor', amount: 0.5 },
  ] };
  const bundle = prototypeBundle();
  bundle.cards = bundle.cards.map((c) => c.id === 'prototypeHeavy' ? { ...c, attack: { source: 'weapon', components: [{ type: 'slashing', weight: 1 }, { type: 'fire', weight: 1 }] } } : c);
  input.registries = createRegistries(bundle);
  const c = createCombat(input); c.enemies[0].block = 3;
  const event = play(c, 'prototypeHeavy').events.find((e) => e.type === 'damageDealt');
  assert.deepEqual(event.components, [{ type: 'slashing', amount: 5 }, { type: 'fire', amount: 1 }]);
  assert.equal(event.hpComponents.reduce((n, e) => n + e.amount, 0), 3);
});
test('themes are inert and previews handle absent targets and recovery values', () => {
  const c = createPrototypeCombat('heavy', 'basic', 1);
  assert.equal(foundationDamage(c, c.player, null, 10, null, ['theme:blood']).amount, 10);
  assert.equal(c.player.statuses.bleed, undefined);
  const id = inHand(c, 'prototypeRecover');
  assert.equal(previewCard(c, id).tokens.restoreStamina, 2);
});
test('secondary attack triggers terminate without inheriting weapon Bleed or impact', () => {
  const input = prototypeInput('bleed', 'boss', 1), bundle = prototypeBundle();
  bundle.relics = [...bundle.relics, ...['A', 'B'].map((id) => ({ id: `prototypeLoop${id}`, name: id, rarity: 'common', textTemplate: 'Test', triggers: [{ on: 'damageDealt', allowSecondary: true, if: { p: 'eventSourceIsOwner' }, do: [{ op: 'damage', target: 'enemy', amount: 1 }] }] }))];
  input.registries = createRegistries(bundle); input.player.relicIds = ['prototypeLoopA', 'prototypeLoopB'];
  const c = createCombat(input), result = play(c, 'prototypeFast');
  assert.equal(result.events.filter((e) => e.type === 'damageDealt').length, 10);
  assert.equal(result.events.filter((e) => e.type === 'impactDealt').length, 2);
  assert.equal(c.enemies[0].statuses.bleed.meter.value, 2);
});
test('co-op hooks keep event ownership distinct between seats', () => {
  const input = prototypeInput('heavy', 'boss', 1), bundle = prototypeBundle();
  bundle.relics = [...bundle.relics, { id: 'prototypeOwnedHit', name: 'Owned Hit', rarity: 'common', textTemplate: 'Test', triggers: [{ on: 'damageDealt', if: { p: 'eventSourceIsOwner' }, do: [{ op: 'block', target: 'self', amount: 2 }] }] }];
  input.registries = createRegistries(bundle);
  const c = createCoopCombat({ ...input, players: [{ ...input.player, id: 'p1', relicIds: ['prototypeOwnedHit'] }, { ...input.player, id: 'p2', relicIds: ['prototypeOwnedHit'] }], combatProfiles: { p1: input.combatProfiles.player, p2: input.combatProfiles.player, e1: input.combatProfiles.e1 } });
  playCard(c, 'p1', inHand({ piles: c.players.get('p1').piles }, 'prototypeHeavy'), 'e1');
  assert.equal(c.players.get('p1').entity.block, 2);
  assert.equal(c.players.get('p2').entity.block, 0);
});
