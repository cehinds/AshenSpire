import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { combatRules } from '../src/content/combatRules.js';
import { baseCardDefinitions, baseCardStatuses, baseCardStatusRules, baseCardTagging } from '../src/content/generated/baseCards.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createCombat, dispatch, previewIntent, resolvedCardPlayCosts } from '../src/engine/combat.js';
import { applyAttackDamage, executeAction } from '../src/engine/actions.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { projectEnemyBurdenHand } from '../src/ui/models/EnemyBurdenModel.js';

// These are the authored pack definitions, never substitutes for its mechanics.
function fight(profileId = 'current') {
  const gameProfile = resolveGameProfile(profileId);
  const bundle = { ...contentBundle,
    cards: [...contentBundle.cards.filter(row => !row.id.startsWith('base.')), ...baseCardDefinitions],
    statuses: [...contentBundle.statuses.filter(row => !row.id.startsWith('base.')), ...baseCardStatuses],
    tagging: [...contentBundle.tagging.filter(row => !row.objectId.startsWith('base.')), ...baseCardTagging],
    proposalStatusRules: baseCardStatusRules };
  const registries = { ...bindGameProfileRegistries(createRegistries(applyGameProfileToContent(bundle, gameProfile)), gameProfile), proposalStatusRules: baseCardStatusRules };
  const combat = createCombat({ registries, rng: createRng(311), gameProfile,
    ...(profileId === 'current' ? { ruleset: combatRules } : {}), ratingsRules: null,
    enemyIds: ['wanderingSoldier', 'wanderingSoldier'], player: { classId: 'reaver',
      hp: 200, maxHp: 200, mana: 20, maxMana: 20, stamina: 20, maxStamina: 20,
      energyMax: 20, drawPerTurn: 1, attributes: {}, relicIds: [],
      deck: [{ instanceId: 'base-test-card', cardId: profileId === 'core' ? 'core.strike' : 'strike' }] } });
  for (const actor of [combat.player, ...combat.enemies]) {
    actor.hp = actor.maxHp = 200; actor.block = 0; actor.statuses = {};
  }
  return combat;
}
function drain(c) {
  let count = 0;
  while (c.queue.length) {
    assert.ok(++count < 100, 'reactive effects terminate');
    executeAction(c, c.queue.shift());
  }
}
function action(c, effect, source = c.player, target = c.enemies[0]) {
  executeAction(c, { effect, source, owner: source, target, card: {}, meta: {} }); drain(c);
}
function status(c, target, id, stacks = 1) { action(c, { op: 'applyStatus', status: id, stacks }, target, target); }
const physical = { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee', damageType: 'slashing' },
  range: 'melee', attack: { source: 'weapon', damageType: 'slashing' } };
const fire = { combatProfile: { camp: 'spell', maneuver: 'casting', range: 'ranged', damageType: 'fire' },
  resolvedSource: { ...combatRules.fallbackSource, id: 'test-focus', sourceType: 'spell', family: 'focus', damageType: 'fire' },
  range: 'ranged', damageType: 'fire', attack: { source: 'spell', damageType: 'fire' } };
function hit(c, amount = 12, carrier = physical) {
  const enemy = c.enemies[0], hp = enemy.hp;
  applyAttackDamage(c, c.player, enemy, amount, [], carrier); drain(c);
  return hp - enemy.hp;
}

test('current foundation applies Weak, Mirrors and Intangible to real connected damage', () => {
  const plain = fight(), baseline = hit(plain);
  assert.ok(baseline > 1);
  const weak = fight(); status(weak, weak.player, 'base.weak');
  assert.ok(hit(weak) < baseline, 'Weak reduces actual HP loss');
  const mirrors = fight(); status(mirrors, mirrors.player, 'base.mirrors');
  assert.equal(hit(mirrors), baseline * 2, 'Mirrors doubles the connected hit once');
  const intangible = fight(); status(intangible, intangible.enemies[0], 'base.intangible');
  assert.equal(hit(intangible), 1, 'Intangible caps a direct hit after outgoing boosts');
});

test('Greased Fire triples a real hit, burns once and splashes original damage without a chain', () => {
  const plain = fight(), baseline = hit(plain, 4, fire);
  const c = fight(), target = c.enemies[0], other = c.enemies[1];
  status(c, target, 'base.greased', 3); status(c, other, 'base.greased', 3);
  assert.equal(hit(c, 4, fire), baseline * 3);
  assert.equal(target.statuses['base.greased'].stacks, 2);
  assert.equal(target.statuses.burn?.stacks, (plain.enemies[0].statuses.burn?.stacks || 0) + 3, 'one explicit Burn 3 rider, plus ordinary Fire buildup');
  assert.ok(other.hp < 200, 'the other same-side enemy receives the splash');
  assert.equal(other.statuses['base.greased'].stacks, 2, 'splash is still Fire and consumes one Grease charge');
  assert.equal(target.statuses['base.greased'].stacks, 2, 'splash never returns a second ignition to the original target');
});

test('fully redirected Guard still resolves its damage job and consumes one charge', () => {
  const c = fight(), target = c.enemies[0], guard = c.enemies[1];
  status(c, guard, 'base.guard-allies');
  const hp = target.hp;
  applyAttackDamage(c, c.player, target, 3, [], physical); drain(c);
  assert.equal(target.hp, hp, 'Guard intercepts the whole small hit');
  assert.ok(guard.hp < 200, 'the redirected packet reaches the guard');
  assert.equal(guard.statuses['base.guard-allies'], undefined);
});

test('persistent matching protection spends a stack even when Block absorbs the entire hit', () => {
  const c = fight(), target = c.enemies[0];
  status(c, target, 'base.persistent-block', 4);
  target.block = 100;
  applyAttackDamage(c, c.player, target, 4, [], physical); drain(c);
  assert.equal(target.hp, 200);
  assert.equal(target.statuses['base.persistent-block'].stacks, 3);
});

test('reflect on both sides settles once without recursively reflecting a reflection', () => {
  const c = fight(); status(c, c.player, 'base.reflect'); status(c, c.enemies[0], 'base.reflect');
  hit(c);
  assert.ok(c.player.hp < 200);
  assert.ok(c.enemies[0].hp < 200);
  assert.equal(c.queue.length, 0);
});

test('explicit Read Intent survives save/load with hand identities and expires without a leak', () => {
  const c = fight(), target = c.enemies[0];
  target.burdenPiles = { draw: [], hand: [{ instanceId: 'burden-1', cardId: 'base.stagger-status-card' }], discard: [], exhaust: [] };
  target.intentReads = { [c.playerKey]: false };
  const read = c.registries.cards.get('base.reveal-opponent-hand');
  for (const effect of read.effects) action(c, effect);
  assert.equal(previewIntent(c, target.id).hidden, false, 'the explicit card read overrides a failed private intent read');
  const before = projectEnemyBurdenHand(target, { turn: c.turn, registries: c.registries });
  assert.equal(before.cards[0].name, c.registries.cards.get('base.stagger-status-card').name);
  const snapshot = serializeCombatSnapshot(c);
  const restored = restoreCombatSnapshot({ registries: c.registries, snapshot,
    rng: createRng(c.rng.seed, c.rng.getCounters()), expectedGameProfile: c.gameProfile });
  assert.deepEqual(projectEnemyBurdenHand(restored.enemies[0], { turn: restored.turn, registries: c.registries }), before);
  assert.equal(projectEnemyBurdenHand(restored.enemies[0], { turn: target.proposalIntentRevealedUntil, registries: c.registries }), null);
});

function play(c, cardId, target = c.enemies[0]) {
  const instance = { instanceId: `play-${cardId}`, cardId, upgraded: false };
  c.piles.hand.push(instance);
  const def = c.registries.cards.get(cardId);
  const costs = resolvedCardPlayCosts(c, def);
  const mana = c.player.mana;
  dispatch(c, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: target.id });
  assert.equal(c.player.mana, mana - costs.mana, 'actual committed mana payment agrees with the printed cost');
  return costs;
}

test('one-MP Poison delivers its authored recurring payoff; Blight executes at the live HP threshold', () => {
  const c = fight(), target = c.enemies[0];
  assert.equal(play(c, 'base.poison').mana, 1);
  const poison = target.statuses['base.poison'].stacks;
  assert.ok(poison >= 5, 'one-MP Poison supplies at least five damage per turn');
  const hp = target.hp;
  dispatch(c, { type: 'endTurn' });
  assert.ok(target.hp <= hp - poison, 'the real enemy turn applies Poison damage');
  const b = fight(), victim = b.enemies[0]; victim.hp = 12;
  assert.equal(play(b, 'base.blight').mana, 1);
  assert.equal(victim.alive, false, 'Blight twelve executes a twelve-HP target during the committed card');
});

test('Veil checks the actual target action once; a failed check prevents damage and an area attack bypasses it', () => {
  const c = fight(); status(c, c.enemies[0], 'base.veil', 2);
  c.rng.float = () => 0.99;
  assert.equal(hit(c), 0);
  c.rng.float = () => 0;
  assert.ok(hit(c) > 0);
  c.rng.float = () => 0.99;
  assert.ok(hit(c, 12, { ...physical, targeting: 'area' }) > 0);
});

test('core explicitly disables elemental Poison and Grease mechanics while retaining common Weak', () => {
  const c = fight('core'), target = c.enemies[0];
  status(c, target, 'base.greased', 3);
  const p = fight('core');
  assert.equal(hit(c, 4, fire), hit(p, 4, fire), 'no elemental ignition multiplier in core');
  assert.equal(target.statuses['base.greased'].stacks, 3);
  status(c, target, 'base.poison', 5);
  const hp = target.hp;
  dispatch(c, { type: 'endTurn' });
  assert.equal(target.hp, hp, 'elemental Poison has no turn-start damage in core');
  const normal = hit(fight('core'));
  const weak = fight('core'); status(weak, weak.player, 'base.weak');
  assert.ok(hit(weak) < normal, 'compatible status math still applies in core');
});
