import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat, runCombatPlayer } from '../src/engine/runCombat.js';
import { createCoopCombat, endTurn, joinCombat } from '../src/engine/coopCombat.js';
import { rangePairKey } from '../src/model/combatEngagement.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function run(classId, seed = 2) {
  return createRunState({ registries, classId, seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a','b','c'] } } } });
}
function member(id, run) {
  return { ...runCombatPlayer(run), id, level: run.level.level, combatExpansionVersion: run.combatExpansionVersion };
}
function coop(runs) {
  return createCoopCombat({ registries, rng: createRng(2), gameProfile: profile, rangePolicy: runs[0].rangePolicy,
    combatExpansionVersion: 2, ratingsRules: null, enemyIds: ['wanderingSoldier'], players: runs.map((row, i) => member(String(i), row)) });
}

test('real Core co-op seats match solo configured pools, gear ratings, attributes and opening hands', () => {
  const runs = ['reaver','herald','starseer','vagabond'].filter(id => registries.classes.has(id)).map(id => run(id));
  assert.ok(runs.length >= 3);
  const combat = coop(runs);
  for (const [index, row] of runs.entries()) {
    const solo = createRunCombat({ registries, run: row, rng: createRng(2), enemyIds: ['wanderingSoldier'] });
    const seat = combat.players.get(String(index));
    for (const key of ['maxHp','maxMana','maxStamina','energyMax','ratings','ratingSources','attributes','baseEvasionBonus','basePrecisionBonus']) {
      assert.deepEqual(seat.entity[key], solo.player[key], `${row.class}/${key}`);
    }
    assert.equal(seat.piles.hand.length, solo.piles.hand.length, `${row.class}/opening hand`);
    assert.equal(seat.handMax, solo.handMax);
    assert.equal(seat.entity.rangeActorKey, `player:${index}`);
  }
  const solo = createRunCombat({ registries, run: runs[0], rng: createRng(2), enemyIds: ['wanderingSoldier'] });
  for (const key of ['maxStamina','maxMana','ratings','attributes','baseEvasionBonus','basePrecisionBonus','persistentPoise','persistentWard']) {
    assert.deepEqual(combat.enemies[0][key], solo.enemies[0][key], `configured enemy/${key}`);
  }
});

test('Core co-op player phases and mid-fight joins preserve configured hand and pool rules', () => {
  const runs = [run('reaver'), run('herald')], combat = coop(runs);
  const baselines = [...combat.players.values()].map(seat => ({ hand: seat.piles.hand.length, ratings: structuredClone(seat.entity.ratings), max: seat.entity.maxStamina }));
  for (const seat of combat.players.values()) { seat.entity.stamina = 0; seat.entity.hp = 500; seat.entity.maxHp = 500; }
  endTurn(combat, '0'); endTurn(combat, '1');
  assert.equal(combat.turn, 2);
  for (const [index, seat] of [...combat.players.values()].entries()) {
    assert.equal(seat.piles.hand.length, baselines[index].hand);
    assert.equal(seat.entity.stamina, baselines[index].max);
    assert.deepEqual(seat.entity.ratings, baselines[index].ratings);
  }
  const extra = run('starseer');
  const previousPair = rangePairKey('player:0', 'enemy:e1');
  combat.rangeState.engagements[previousPair] = 0;
  joinCombat(combat, member('joiner', extra));
  const solo = createRunCombat({ registries, run: extra, rng: createRng(2), enemyIds: ['wanderingSoldier'] });
  const joined = combat.players.get('joiner');
  assert.equal(joined.piles.hand.length, solo.piles.hand.length);
  assert.deepEqual(joined.entity.ratings, solo.player.ratings);
  assert.equal(joined.entity.maxStamina, solo.player.maxStamina);
  assert.equal(joined.entity.rangeActorKey, 'player:joiner');
  assert.equal(combat.rangeState.engagements[previousPair], 0, 'joining cannot reset an existing engagement');
  assert.equal(combat.rangeState.engagements[rangePairKey('player:joiner', 'enemy:e1')], solo.rangeState.engagements[rangePairKey('player:player', 'enemy:e1')]);
});
