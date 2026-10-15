import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAuditRuntime } from '../tools/combat-audit/runtime.mjs';
import { configuredContentBundle, advancedConfigSnapshot } from '../src/model/advancedConfig.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

// Use the same configured defaults as a new production run. Raw authored
// registries omit live ratings, which hid the stance bonus in older fixtures.
function fixture(api, { classId = 'rogue', stance = null, protection = 'guard', cardId = 'strike', carrierId } = {}) {
  const run = api.createRunState({ registries: api.registries, classId, seed: 11 });
  if (carrierId) {
    assert.ok(api.applyEquipTransition(api.registries, run.loadout, 'rightHand', 0, carrierId));
    api.stampDeck(api.registries, run);
  }
  const combat = api.createRunCombat({ registries: api.registries, rng: api.createRng(11), run,
    enemyIds: ['wanderingSoldier'] });
  const native = run.deck.find(card => card.cardId === cardId && (!carrierId || card.sourceArmamentId === carrierId));
  const instance = { ...native, cardId, instanceId: 'stance-parity', upgraded: false };
  combat.piles.hand = [instance];
  for (const pile of ['draw', 'discard', 'exhaust']) combat.piles[pile] = [];
  if (stance) combat.player.combatStance = { maneuver: stance, camp: 'physical', range: 'melee' };
  else delete combat.player.combatStance;
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 36, maxHp: 36, block: protection === 'guard' ? 8 : protection === 'blocked' ? 100 : 0,
    barrier: protection === 'typed' ? 1 : 0, statuses: {},
    ratings: { ar: 0, dr: 0, pr: 0, poise: protection === 'guard' ? 10 : 0, ward: protection === 'typed' ? 6 : 0 },
    persistentPoise: { max: protection === 'guard' ? 10 : 0, value: protection === 'guard' ? 10 : 0 },
    persistentWard: { max: protection === 'typed' ? 6 : 0, value: protection === 'typed' ? 6 : 0 },
    damageResistanceFlat: protection === 'typed' ? { slashing: 2, piercing: 2, blunt: 2, arcane: 2 } : {},
    damageWeaknessPercent: {}, combatStance: { maneuver: 'defend', camp: 'physical', range: 'melee' } });
  delete enemy.combatCounter;
  delete enemy.combatEvade;
  primeAccuracyRolls(combat);
  return { combat, enemy, instance };
}

const state = combat => JSON.stringify({ snapshot: combatState(combat), rng: combat.rng.getCounters(), events: combat.eventLog });
function combatState(combat) {
  return { player: combat.player, enemies: combat.enemies, piles: combat.piles, queue: combat.queue,
    pending: combat.pendingExpansionActions, serial: combat.expansionActionSerial };
}
const losses = (events, id) => events.filter(event => event.type === 'damageDealt' && event.targetId === id)
  .map(event => event.amount - event.blocked);

for (const mode of ['native', 'bundled']) {
  const api = await loadAuditRuntime(mode);
  api.registries = api.createRegistries(configuredContentBundle(api.contentBundle,
    { ...advancedConfigSnapshot(), breakMeterVersion: 2 }));

  test(`${mode}: canonical Rogue Piercing Flurry preview includes the accepted Attack rating`, () => {
    const { combat, enemy, instance } = fixture(api);
    assert.equal(combat.player.hp, 53);
    assert.equal(combat.player.stamina, 3);
    assert.equal(combat.player.mana, 1);
    assert.equal(instance.profileId, 'daggerPierceAttack');
    assert.equal(instance.ratingValue, 2);
    const before = state(combat);
    for (const target of [undefined, enemy.id]) {
      const shown = api.previewCard(combat, instance.instanceId, target);
      const damage = shown.values.find(value => value.op === 'damage');
      assert.deepEqual(Array.from(damage.hitDamages), [1, 1]);
      assert.equal(damage.totalDamage, 2);
      assert.equal(shown.cost, 1, 'price is measured before the new stance');
      if (!target) assert.equal(damage.faceValue, 6, 'card base 3 plus prospective source Attack 3');
      assert.equal(state(combat), before, 'preview spends no RNG, grants, protection or live stance');
    }
    const out = api.dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: enemy.id });
    const damage = out.events.filter(event => event.type === 'damageDealt' && event.targetId === enemy.id);
    assert.deepEqual(Array.from(damage, event => [event.incoming, event.blocked, event.poiseAbsorbed]), [[6, 4, 1], [6, 4, 1]]);
    assert.deepEqual(Array.from(losses(out.events, enemy.id)), [1, 1]);
    assert.equal(enemy.hp, 34);
    assert.equal(combat.player.stamina, 2);
    assert.equal(out.events.filter(event => event.type === 'statusApplied' && event.status === 'precision').length, 1);
  });

  test(`${mode}: paid native class attacks agree with previews across prior stances and protection`, () => {
    for (const classId of ['reaver', 'rogue', 'starseer', 'herald'])
      for (const stance of [null, 'defend', 'attack'])
        for (const protection of ['none', 'guard', 'typed', 'blocked']) {
          const { combat, enemy, instance } = fixture(api, { classId, stance, protection });
          const before = state(combat), hp = enemy.hp;
          const shown = api.previewCard(combat, instance.instanceId, enemy.id).values.filter(value => value.op === 'damage');
          const hits = shown.flatMap(value => Array.from(value.hitDamages));
          const label = `${classId}/${stance}/${protection}`;
          assert.equal(state(combat), before, label + ': repeatable detached preview');
          const out = api.dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: enemy.id });
          assert.deepEqual(Array.from(losses(out.events, enemy.id)), Array.from(hits), label);
          assert.equal(hp - enemy.hp, hits.reduce((sum, amount) => sum + amount, 0), label + ': HP receipt');
          assert.equal(out.events.filter(event => event.type === 'cardPlayed').length, 1, label + ': paid play');
        }
  });

  test(`${mode}: prospective Defend protection and refused play previews preserve live state`, () => {
    const { combat, instance } = fixture(api, { cardId: 'defend', protection: 'none' });
    const before = state(combat);
    const shown = api.previewCard(combat, instance.instanceId).values.find(value => value.op === 'block');
    assert.equal(state(combat), before, 'Defend preview does not restore pools or grant entry Block');
    const out = api.dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId });
    const own = out.events.filter(event => event.type === 'blockGained' && event.cardInstanceId === instance.instanceId && !event.triggeredBy);
    assert.equal(own.length, 1);
    assert.equal(own[0].amount, shown.value, 'authored Block uses prospective defensive rating');

    const f = fixture(api); f.combat.player.energy = 0;
    const empty = state(f.combat);
    api.previewCard(f.combat, f.instance.instanceId, f.enemy.id);
    assert.equal(state(f.combat), empty, 'unaffordable preview leaves the fight untouched');
    assert.throws(() => api.dispatch(f.combat, { type: 'playCard', cardInstanceId: f.instance.instanceId, targetId: f.enemy.id }), /Not enough/);
    assert.equal(state(f.combat), empty, 'refused play cannot commit the preview stance or grants');

    const wound = fixture(api, { cardId: 'wound' });
    const unplayable = state(wound.combat);
    api.previewCard(wound.combat, wound.instance.instanceId);
    assert.throws(() => api.dispatch(wound.combat, { type: 'playCard', cardInstanceId: wound.instance.instanceId }), /unplayable/);
    assert.equal(state(wound.combat), unplayable, 'unplayable cards retain their refusal without entry grants');
  });

  test(`${mode}: ranged equipment and casting previews use their accepted stance`, () => {
    for (const options of [{ carrierId: 'shortbow' }, { classId: 'starseer', cardId: 'starSpark' }]) {
      const { combat, enemy, instance } = fixture(api, { ...options, stance: 'defend', protection: 'none' });
      if (options.carrierId) assert.equal(instance.profileId, 'bowPierceAttack');
      const before = state(combat);
      const shown = api.previewCard(combat, instance.instanceId, enemy.id).values.filter(value => value.op === 'damage');
      const hits = shown.flatMap(value => Array.from(value.hitDamages));
      assert.equal(state(combat), before);
      const out = api.dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: enemy.id });
      assert.deepEqual(Array.from(losses(out.events, enemy.id)), Array.from(hits));
      assert.equal(out.events.filter(event => event.type === 'cardPlayed').length, 1);
    }
  });
}
