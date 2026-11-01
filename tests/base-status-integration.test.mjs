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
import { knowledgeIntentProjection } from '../src/engine/enemyKnowledge.js';
import { proposalTurn } from '../src/engine/proposalStatusRuntime.js';
import { beginEnemyBurdens, endEnemyBurdens } from '../src/engine/enemyBurdens.js';

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
    ...(profileId === 'current' ? { ruleset: combatRules } : {}), ratingsRules: null,
    ...(expanded ? { combatExpansionVersion: 2, reactionRulesVersion: 1 } : {}),
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
  assert.ok(read.effects.some(effect => effect.op === 'applyStatus' && effect.target === 'self' && effect.status === 'base.read-intent'));
  for (const effect of read.effects) action(c, effect);
  assert.equal(c.player.statuses['base.read-intent']?.stacks, 1);
  assert.equal(previewIntent(c, target.id).hidden, false, 'the explicit card read overrides a failed private intent read');
  const before = projectEnemyBurdenHand(target, { turn: c.turn, registries: c.registries,
    ownerId: c.playerKey || 'player', legacySolo: true });
  assert.equal(before.cards[0].name, c.registries.cards.get('base.stagger-status-card').name);
  const snapshot = serializeCombatSnapshot(c);
  const restored = restoreCombatSnapshot({ registries: c.registries, snapshot,
    rng: createRng(c.rng.seed, c.rng.getCounters()), expectedGameProfile: c.gameProfile });
  assert.deepEqual(projectEnemyBurdenHand(restored.enemies[0], { turn: restored.turn, registries: c.registries,
    ownerId: restored.playerKey || 'player', legacySolo: true }), before);
  restored.turn = target.proposalIntentRevealedUntilByOwner[c.playerKey || 'player'];
  proposalTurn(restored, restored.player, 'start'); drain(restored);
  assert.equal(projectEnemyBurdenHand(restored.enemies[0], { turn: restored.turn, registries: c.registries,
    ownerId: restored.playerKey || 'player', legacySolo: true }), null);
  assert.equal(previewIntent(restored, restored.enemies[0].id).hidden, true, 'the normal private read gate resumes at expiry');
});

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

test('one multi-hit action reuses its failed Veil perception check instead of rerolling contact', () => {
  const c = fight(), target = c.enemies[0]; status(c, target, 'base.veil', 2);
  let checks = 0;
  c.rng.float = () => (++checks === 1 ? 0.99 : 0);
  executeAction(c, { effect: { op: 'damage', target: 'enemy', amount: 4, hits: 2 },
    source: c.player, owner: c.player, target, card: physical, meta: {} }); drain(c);
  assert.equal(target.hp, 200, 'a later hit cannot retry a failed target check');
  assert.equal(checks, 1);
});


test('current expanded damage receipts apply shared numeric statuses as well as foundation hits', () => {
  const plain = fight('current', true), baseline = hit(plain);
  const weak = fight('current', true); status(weak, weak.player, 'base.weak');
  assert.ok(hit(weak) < baseline);
  const mirrors = fight('current', true); status(mirrors, mirrors.player, 'base.mirrors');
  assert.ok(hit(mirrors) > baseline);
  const intangible = fight('current', true); status(intangible, intangible.enemies[0], 'base.intangible');
  assert.equal(hit(intangible), 1);
});

test('authored Ward Armor replenishes both protection pools at owner start and spends only a matching stack', () => {
  const c = fight('current', true);
  play(c, 'base.persistent-protection', c.player);
  for (const enemy of c.enemies) enemy.skipNextTurn = true;
  dispatch(c, { type: 'endTurn' });
  const blockStacks = c.player.statuses['base.persistent-block'].stacks;
  const barrierStacks = c.player.statuses['base.persistent-barrier'].stacks;
  assert.equal(c.player.block, blockStacks, 'pool matches actual status potency, with no second rating bonus');
  assert.equal(c.player.statuses.barrier?.stacks, barrierStacks, 'the Barrier pool is Barrier stacks now (SPEC 4.1a), one per point');
  applyAttackDamage(c, c.enemies[0], c.player, 2, [], physical); drain(c);
  assert.equal(c.player.statuses['base.persistent-block'].stacks, blockStacks - 1);
  assert.equal(c.player.statuses['base.persistent-barrier'].stacks, barrierStacks);
  applyAttackDamage(c, c.enemies[0], c.player, 2, [], { ...fire, resolvedSource: undefined }); drain(c);
  assert.equal(c.player.statuses['base.persistent-block'].stacks, blockStacks - 1);
  assert.equal(c.player.statuses['base.persistent-barrier'].stacks, barrierStacks - 1);
});

test('real tagged Decay spell becomes healing under Necrotic Renewal, without spending protection', () => {
  const c = fight('current', true), target = c.enemies[0];
  target.hp = 100; target.block = 5; target.barrier = 5;
  status(c, target, 'base.necrotic-healing', 2);
  const spell = c.registries.cards.get('blightTouch');
  for (const effect of spell.effects) executeAction(c, { effect, source: c.player, owner: c.player,
    target, card: { ...spell, resolvedSource: { ...fire.resolvedSource, damageType: 'decay' } }, meta: {} });
  drain(c);
  assert.ok(target.hp > 100, 'incoming tagged Decay converts to actual healing');
  assert.equal(target.block, 5); assert.equal(target.barrier, 5);
});

test('real Divine healing becomes HP damage under Profane Inversion; ordinary healing remains healing', () => {
  const c = fight(), target = c.player; target.hp = 100;
  status(c, target, 'base.divine-harm', 2);
  const sacred = c.registries.cards.get('urgentHeal');
  for (const effect of sacred.effects) executeAction(c, { effect, source: target, owner: target,
    target, card: sacred, meta: {} }); drain(c);
  assert.ok(target.hp < 100, 'school:divine tagged healing is inverted');
  const hp = target.hp, ordinary = c.registries.cards.get('base.exhaust');
  for (const effect of ordinary.effects) executeAction(c, { effect, source: target, owner: target,
    target, card: ordinary, meta: {} }); drain(c);
  assert.ok(target.hp > hp, 'an untyped healing card is unaffected');
});

test('automatic counter and sweep resolve their real reaction packets and consume one charge without looping', () => {
  const c = fight(), target = c.enemies[0];
  status(c, target, 'base.auto-counter'); status(c, target, 'base.auto-sweep');
  status(c, c.player, 'base.reflect');
  hit(c, 4);
  assert.ok(c.player.hp < 200, 'counter and sweep hit the original attacker');
  assert.equal(target.statuses['base.auto-counter'], undefined);
  assert.equal(target.statuses['base.auto-sweep'], undefined);
  assert.equal(c.queue.length, 0);
});
