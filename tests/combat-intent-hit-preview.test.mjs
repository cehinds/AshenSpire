import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewIntent } from '../src/engine/combat.js';
import { armCombatCounter } from '../src/engine/combatMatchups.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatRules } from '../src/content/combatRules.js';

function fight({ maneuver = 'attack', block = 6, counter = true, foundation = false, ward = 0 } = {}) {
  const bundle = { ...contentBundle,
    tagging: contentBundle.tagging.map(row => row.family === 'enemyMove' && row.scope === 'wanderingSoldier'
      && row.objectId === 'slash' && row.tagId === 'maneuver:attack' ? { ...row, tagId: `maneuver:${maneuver}` } : row),
    enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier' ? { ...enemy, firstMove: 'slash' } : enemy),
    enemyMoves: contentBundle.enemyMoves.map(move => move.enemyId === 'wanderingSoldier' && move.id === 'slash'
      ? { ...move, damage: 5, hits: 3, tags: ['camp:physical', `maneuver:${maneuver}`, 'damage:slashing', 'source:weapon', 'delivery:melee'] } : move),
  };
  const registries = createRegistries(bundle);
  const actor = { classId: 'reaver', hp: 500, maxHp: 500, energyMax: 3, drawPerTurn: 1,
    deck: [{ instanceId: 'guard', cardId: 'defend' }], relicIds: [] };
  const options = { registries, rng: createRng(50), enemyIds: ['wanderingSoldier'], ratingsRules: null,
    ...(foundation ? { ruleset: combatRules, combatProfiles: { player: { armor: 0 } } } : {}) };
  const combat = createCombat({ ...options, player: actor });
  const player = combat.player;
  player.block = block;
  player.wardBlock = ward;
  player.poiseMeter = { value: 0, max: 1000 };

  if (counter) armCombatCounter(combat, player, { combatProfile: { camp: 'physical', maneuver: 'counter' } }, { damage: 6 });
  const enemy = combat.enemies[0];
  enemy.hp = enemy.maxHp = 1000;
  enemy.poiseMeter = { value: 0, max: 1000 };
  enemy.intentRevealed = true;

  return { combat, player, enemy, registries, bundle,
    preview: () => previewIntent(combat, enemy.id),
    resolve: () => { dispatch(combat, { type: 'endTurn' }); } };
}
const amounts = ({ combat, enemy }, target = 'p1') => combat.eventLog
  .filter(event => event.type === 'damageDealt' && event.sourceId === enemy.id)
  .map(event => event.amount);

test(`solo exact Counter reads expose prepared HP and Poise separately`, () => {
  const f=fight({maneuver:'counter',counter:false});
  f.enemy.combatCounter={version:2,payload:{hp:0,poise:4,ward:0}};
  const shown=f.preview();
  assert.equal(shown.counterDamage,0);
  assert.equal(shown.counterPoiseDamage,4);
  f.enemy.intentRevealed=false;

  const hidden=f.preview();
  assert.equal(hidden.hidden,true);
  assert.equal(hidden.counterDamage,undefined);
  assert.equal(hidden.counterPoiseDamage,undefined);
});

for (const block of [1, 6]) {
  test(`solo multi-hit Counter preview spends only one charge with Block${block}`, () => {
    const f = fight({ block });
    const before = JSON.stringify({ player: f.player, enemy: f.enemy, queue: f.combat.queue,
      events: f.combat.eventLog, counters: f.combat.rng.getCounters(), playerKey: f.combat.playerKey });
    const shown = f.preview();
    assert.deepEqual(shown.hitDamages, [2, 5, 5]);
    assert.equal(shown.damage, 2);
    assert.equal(shown.totalDamage, 12);
    assert.equal(JSON.stringify({ player: f.player, enemy: f.enemy, queue: f.combat.queue,
      events: f.combat.eventLog, counters: f.combat.rng.getCounters(), playerKey: f.combat.playerKey }), before);

    f.resolve();
    assert.deepEqual(amounts(f), shown.hitDamages);
  });
}

for (const [block, ward, expected] of [[4, 0, [7, 5, 5]], [10, 0, [7, 7, 5]], [6, 6, [5, 5, 5]]]) {
  test(`Smash preview evolves ordinary Guard per hit (Block${block}, Ward${ward})`, () => {
    const f = fight({ maneuver: 'smash', counter: false, block, ward });
    const shown = f.preview();
    assert.deepEqual(shown.hitDamages, expected);
    assert.equal(shown.totalDamage, expected.reduce((sum, amount) => sum + amount, 0));
    f.resolve();
    assert.deepEqual(amounts(f), expected);
  });
}

test('saved tactical rules price every preview hit after reload despite changed live balance', () => {
  const f = fight();
  f.combat.combatMatchupRules.counter.incomingMultiplier = 0.25;
  const snapshot = serializeCombatSnapshot(f.combat);
  const registries = createRegistries({ ...f.bundle, balance: { ...contentBundle.balance,
    combatMatchups: { ...contentBundle.balance.combatMatchups,
      counter: { ...contentBundle.balance.combatMatchups.counter, incomingMultiplier: 0.9 } } } });
  const loaded = restoreCombatSnapshot({ registries, rng: createRng(50, f.combat.rng.getCounters()), snapshot });
  const shown = previewIntent(loaded, loaded.enemies[0].id);
  assert.deepEqual(shown.hitDamages, [1, 5, 5]);
  assert.equal(shown.totalDamage, 11);
  dispatch(loaded, { type: 'endTurn' });
  assert.deepEqual(amounts({ combat: loaded, enemy: loaded.enemies[0] }), shown.hitDamages);
});

