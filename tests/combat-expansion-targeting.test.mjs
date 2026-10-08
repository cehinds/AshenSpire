import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { cardTargetPlan, assertCardTarget } from '../src/model/cardTargets.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat, runCombatPlayer } from '../src/engine/runCombat.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createCoopCombat, previewCoopCard, playCard } from '../src/engine/coopCombat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { combatCardView } from '../src/ui/models/CombatCardView.js';
import { createSession } from '../tools/session.mjs';
import { initialClassTreeChoices } from '../src/model/classTree.js';
import { registriesForClassMastery } from '../src/model/classMasteryRun.js';

const registries = createRegistries(contentBundle);
function equippedRun(version) {
  const run = createRunState({ registries, seed: 11, classId: 'reaver', combatExpansionVersion: version });
  const card = run.deck.find(card => card.cardId === 'shieldBash' && card.grantedBy === 'roundShield');
  assert.ok(card, 'exercise the actual equipment-granted art instance');
  run.deck = [card, ...run.deck.filter(row => row !== card)];
  return { run, card };
}
const unchanged = combat => JSON.stringify({ player: combat.player, piles: combat.piles,
  seats: combat.players && [...combat.players], enemies: combat.enemies, events: combat.eventLog,
  counters: combat.rng.getCounters(), queue: combat.queue });

for (const version of [1, 2]) test(`equipped Shield Bash solo target projection actually plays under version ${version}`, () => {
  const { run, card } = equippedRun(version);
  const combat = createRunCombat({ registries, run, rng: createRng(11), enemyIds: ['wanderingSoldier'], settings: { playInDeckOrder: true } });
  assert.ok(combat.piles.hand.some(row => row.instanceId === card.instanceId));
  const preview = previewCard(combat, card.instanceId);
  const definition = { ...resolveCombatCard(combat, card), combatPreview: preview };
  const plan = cardTargetPlan(definition, combat.player.id, combat.enemies,
    [{ ...combat.player, connected: true }], { solo: true });
  const target = version === 2 ? combat.player.id : combat.enemies[0].id;
  const wrongTarget = version === 2 ? combat.enemies[0].id : combat.player.id;
  assert.deepEqual(plan, { mode: version === 2 ? 'friendly' : 'enemy', legalIds: [target] });
  assert.throws(() => assertCardTarget(plan, wrongTarget), /Invalid .*target/);
  const before = unchanged(combat);
  assert.throws(() => dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: wrongTarget }), /Invalid .*target/);
  assert.equal(unchanged(combat), before, 'refused UI destination spends no resources, card, RNG or effects');
  const hp = combat.enemies[0].hp, block = combat.player.block;
  const { events } = dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: assertCardTarget(plan, target) });
  assert.ok(events.some(event => event.type === 'cardPlayed' && event.cardInstanceId === card.instanceId));
  assert.equal(combat.piles.hand.some(row => row.instanceId === card.instanceId), false);
  if (version === 2) {
    assert.equal(combat.enemies[0].hp, hp, 'preparing a Counter does not strike the selected enemy');
    assert.ok(combat.player.block > block);
    assert.equal(combat.player.combatCounter.version, 2);
    assert.equal(combat.player.combatCounter.charges, 1);
  } else assert.ok(combat.enemies[0].hp < hp, 'the legacy equipment art retains its immediate enemy hit');
});

test('selected upcast tier changes the same target plan committed by the engine', () => {
  const id = 'target-tier-fixture';
  const local = createRegistries({ ...contentBundle, cards: [...contentBundle.cards, {
    id, name: 'Target Tier Fixture', type: 'skill', kindIds: ['classification.skill'], cost: 0, manaCost: 0,
    tags: ['camp:physical', 'maneuver:defend', 'reach:contact', 'targeting:single'],
    effects: [{ op: 'block', target: 'self', amount: 2 }], textTemplate: 'Gain {block} Block.',
    upcast: { baseTier: 2, unlockedTiers: [3, 5], maximumTier: 5, blockPerRank: 1,
      breakpoints: [{ ranks: 3, effects: [{ op: 'buildup', target: 'enemy', status: 'weak', amount: 1 }] }] },
  }] });
  const instance = { instanceId: id, cardId: id };
  const combat = createCombat({ registries: local, rng: createRng(14), combatExpansionVersion: 2,
    player: { classId: 'reaver', hp: 80, maxHp: 80, maxMana: 10, mana: 10, maxStamina: 10,
      stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [instance] }, enemyIds: ['wanderingSoldier'] });
  const wireCard = { ...instance, combatPreview: previewCard(combat, id),
    upcastPreviews: Object.fromEntries([3, 5].map(tier => [tier, previewCard(combat, id, undefined, tier)])) };
  const plan = (tier, wire = wireCard) => cardTargetPlan(combatCardView(combat, wire, tier), combat.player.id, combat.enemies,
  [{ ...combat.player, connected: true }], { solo: true });
  assert.deepEqual(plan(undefined), { mode: 'friendly', legalIds: ['player'] }, 'omission uses authored base tier 2');
  assert.deepEqual(plan(3), { mode: 'friendly', legalIds: ['player'] });
  const selected = plan(5);
  assert.deepEqual(selected, { mode: 'enemy', legalIds: ['e1'] }, 'threshold support gains an immediate enemy destination');
  assert.deepEqual(plan(5, { ...wireCard, upcastPreviews: undefined }), selected,
    'missing selected-tier wire data resolves that tier instead of reusing the stale base preview');
  const before = combat.player.energy, mana = combat.player.mana;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: id,
    targetId: assertCardTarget(selected, 'e1'), upcastTier: 5 });
  assert.ok(out.events.some(event => event.type === 'cardPlayed'));
  assert.equal(combat.player.energy, before - 3);
  assert.equal(combat.player.mana, mana - 3);
  assert.equal(combat.player.block, 5);
  const coop = createCoopCombat({ registries: local, rng: createRng(14), combatExpansionVersion: 2,
    players: [{ id: 'a', classId: 'reaver', combatExpansionVersion: 2, hp: 80, maxHp: 80,
      maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1,
      deck: [instance], orderedDraw: true }], enemyIds: ['wanderingSoldier'] });
  const coopPreview = previewCoopCard(coop, 'a', id);
  assert.equal(coopPreview.resolvedDefinition.upcast.baseTier, 2, 'co-op omitted tier uses authored base');
  const beforeCoop = unchanged(coop);
  assert.throws(() => previewCoopCard(coop, 'a', id, undefined, 0), /Upcast ranks/);
  assert.throws(() => playCard(coop, 'a', id, 'a', undefined, 0), /Upcast ranks/);
  assert.equal(unchanged(coop), beforeCoop, 'explicit invalid tier 0 is refused atomically');
  assert.doesNotThrow(() => playCard(coop, 'a', id, 'a'), 'omitted tier plays its base rather than an invalid 0');
  assert.equal(coop.players.get('a').entity.block, 2);
  const host = createSession({ registries: local, seedString: 'TIERBASE2' });
  const member = host.addMember({ id: 'a', name: 'A', classId: 'reaver' });
  member.run.deck.unshift(instance);
  host.start();
  while (member.run.classMasteryState.initialTreeTiers.length) host.chooseMasteryNode('a',
    initialClassTreeChoices(registriesForClassMastery(local, member.run), member.run)[0]);
  assert.equal(host.chooseNode('a', host.session.reachableIds[0]).ok, true);
  const owner = host.live.combat.players.get('a');
  for (const pile of ['hand', 'draw', 'discard', 'exhaust']) owner.piles[pile] = owner.piles[pile].filter(card => card.instanceId !== id);
  owner.piles.hand.unshift(instance);
  const refused = host.combatPlay('a', id, 'a', undefined, 0);
  assert.equal(refused.ok, false);
  assert.match(refused.error, /Upcast ranks/);
  const accepted = host.combatPlay('a', id, 'a');
  assert.equal(accepted.ok, true, accepted.error);
  assert.ok(host.live.combat.players.get('a').entity.block >= 2, 'network omission reaches the authored base unchanged');
});

test('co-op equipment art targeting follows its owner version rather than the previously active seat', () => {
  const rows = [1, 2].map((version, index) => {
    const { run, card } = equippedRun(version);
    return { id: index ? 'expanded' : 'legacy', run, card };
  });
  const combat = createCoopCombat({ registries, rng: createRng(11), enemyIds: ['wanderingSoldier'],
    breakMeterVersion: 2, combatExpansionVersion: 2,
    players: rows.map(({ id, run }) => ({ ...runCombatPlayer(run), id, combatExpansionVersion: run.combatExpansionVersion, orderedDraw: true })) });
  for (const { id, run, card } of rows) {
    const seat = combat.players.get(id);
    assert.ok(seat.piles.hand.some(row => row.instanceId === card.instanceId));
    const before = unchanged(combat);
    const preview = previewCoopCard(combat, id, card.instanceId);
    const context = { ...combat, player: seat.entity, combatExpansionVersion: seat.entity.combatExpansionVersion };
    const definition = combatCardView(context, { ...card, combatPreview: preview });
    assert.deepEqual(combatCardView(context, card).effects, definition.effects,
      'the client fallback uses this owner version when no host preview is present');
    const plan = cardTargetPlan(definition, id, combat.enemies,
      [...combat.players.values()].map(row => ({ ...row.entity, id: row.id, connected: row.connected })));
    const target = run.combatExpansionVersion === 2 ? id : combat.enemies[0].id;
    const wrongTarget = run.combatExpansionVersion === 2 ? combat.enemies[0].id : id;
    assert.deepEqual(plan, { mode: run.combatExpansionVersion === 2 ? 'friendly' : 'enemy', legalIds: [target] });
    assert.equal(unchanged(combat), before, 'owner-specific client projection does not rebind the live active seat');
    assert.throws(() => playCard(combat, id, card.instanceId, wrongTarget), /Invalid .*target/);
    assert.equal(unchanged(combat), before, 'rejected owner target is atomic');
    const hp = combat.enemies[0].hp, block = seat.entity.block;
    const { events } = playCard(combat, id, card.instanceId, assertCardTarget(plan, target));
    assert.ok(events.some(event => event.type === 'cardPlayed' && event.playerId === id));
    const actual = combat.players.get(id);
    if (run.combatExpansionVersion === 2) {
      assert.equal(combat.enemies[0].hp, hp);
      assert.ok(actual.entity.block > block);
      assert.equal(actual.entity.combatCounter.version, 2);
      assert.equal(actual.entity.combatCounter.charges, 1);
      assert.equal(combat.players.get('legacy').entity.combatCounter?.version === 2, false);
    } else assert.ok(combat.enemies[0].hp < hp);
  }
});
