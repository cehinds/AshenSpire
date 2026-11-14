import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { combatRules } from '../src/content/combatRules.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createCombat, dispatch, previewIntent, resolvedCardPlayCosts } from '../src/engine/combat.js';
import { applyAttackDamage, executeAction } from '../src/engine/actions.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { projectEnemyBurdenHand } from '../src/ui/models/EnemyBurdenModel.js';
import { knowledgeIntentProjection, rollEnemyKnowledge } from '../src/engine/enemyKnowledge.js';
import { proposalTurn } from '../src/engine/proposalStatusRuntime.js';
import { beginEnemyBurdens, endEnemyBurdens } from '../src/engine/enemyBurdens.js';
import { legacyPerceptionRoll } from './legacyHitRules.mjs';

// Exercise the real aggregated catalog and profile adapter, not replacement definitions.
function fight(profileId = 'current', expanded = false, { intentRoll = null } = {}) {
  const gameProfile = resolveGameProfile(profileId);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, gameProfile)), gameProfile);
  const rng = createRng(311), draw = rng.float.bind(rng);
  if (intentRoll !== null) rng.float = stream => {
    const value = draw(stream);
    return stream === 'enemyIntentVisibility' ? intentRoll : value;
  };
  const combat = createCombat({ registries, rng, gameProfile,
    ...(expanded ? { combatExpansionVersion: 2, reactionRulesVersion: 1 } : {}),
    enemyIds: ['wanderingSoldier', 'wanderingSoldier'], player: { classId: 'reaver',
      hp: 200, maxHp: 200, mana: 20, maxMana: 20, stamina: 20, maxStamina: 20,
      energyMax: 20, drawPerTurn: 1, attributes: {}, relicIds: [],
      deck: [{ instanceId: 'base-test-card', cardId: profileId === 'core' ? 'core.strike' : 'strike' }] } });
  for (const actor of [combat.player, ...combat.enemies]) {
    actor.hp = actor.maxHp = 200; actor.block = 0; actor.statuses = {};
  }
  // A forced failed read needs the perception check, which a fight saved before the exact-reads ruling (2026-11-14) still rolls:
  // give the fight those rules and read every enemy again with the forced roll.
  if (intentRoll !== null) { legacyPerceptionRoll(combat); for (const enemy of combat.enemies) rollEnemyKnowledge(combat, enemy); }
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







test('Read Intent status alone does not reveal enemy intents, including to its living owner', () => {
  // Core2 uses the authority-owned per-action perception read. Make that
  // actual check fail; changing legacy intent flags cannot revoke a passed read.
  const c = fight('core', false, { intentRoll: 0 }), target = c.enemies[0];
  const read = target.knowledgeAction.reads[c.playerKey || 'player'];
  assert.equal(read.perception.passed, false);
  assert.equal(read.visibility, 'unknown');
  assert.equal(previewIntent(c, target.id).hidden, true, 'the real failed read conceals the move before applying any marker');
  target.intentRevealed = false;
  target.intentReads = { [c.playerKey]: false };
  status(c, c.player, 'base.read-intent');
  assert.equal(previewIntent(c, target.id).hidden, true, 'the marker status does not bypass the selected-target read gate');
  proposalTurn(c, c.player, 'start'); drain(c);
  assert.equal(c.player.statuses['base.read-intent'], undefined, 'the authored start decay removes one stack');
  assert.equal(previewIntent(c, target.id).hidden, true, 'the enemy remains unknown after status decay');

  const gameProfile = resolveGameProfile('core');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, gameProfile)), gameProfile);
  const p1 = { id: 'p1', kind: 'player', alive: true, statuses: { 'base.read-intent': { stacks: 1 } } };
  const p2 = { id: 'p2', kind: 'player', alive: true, statuses: {} };
  const coop = { playerKey: 'p1', gameProfile, registries,
    players: new Map([['p1', { entity: p1, connected: true }], ['p2', { entity: p2, connected: true }]]),
    enemyKnowledge: {}, enemies: [] };
  const hiddenEnemy = { id: 'e1', intent: { kind: 'attack' }, knowledgeAction: { reads: {
    p1: { visibility: 'unknown' }, p2: { visibility: 'unknown' },
  } } };
  assert.equal(knowledgeIntentProjection(coop, hiddenEnemy, 'p1').exact, false, 'the status alone cannot reveal an enemy');
  assert.equal(knowledgeIntentProjection(coop, hiddenEnemy, 'p2').exact, false, 'another co-op observer remains unknown');
  p1.statuses = {};
  assert.equal(knowledgeIntentProjection(coop, hiddenEnemy, 'p1').exact, false, 'the owner also returns to unknown after decay');
});

test('generated burden cards apply their authored marker while held and remove it on exit', () => {
  const cases = [
    ['base.stagger-status-card', 'base.stagger'],
    ['base.paralysis-status-card', 'base.paralysis'],
    ['base.restrained-status-card', 'base.restrained-burden'],
  ];
  for (const [cardId, statusId] of cases) {
    const c = fight('core'), enemy = c.enemies[0];
    action(c, { op: 'addBurden', target: 'enemy', card: cardId, count: 1, pile: 'hand' });
    beginEnemyBurdens(c, enemy, 0); drain(c);
    assert.equal(enemy.statuses[statusId]?.stacks, 1, `${cardId} applies ${statusId} on draw`);
    endEnemyBurdens(c, enemy); drain(c);
    assert.equal(enemy.statuses[statusId], undefined, `${cardId} removes ${statusId} when it leaves hand`);
  }
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







