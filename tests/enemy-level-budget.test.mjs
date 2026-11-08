// SPEC §17, Enemy levels and stat budget (owner, 2026-11-07): Core enemies are level 1-5 and carry the
// player's starting budget plus attributePointsPerLevel per level after the first, every attribute at least 1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { characterSettings, resolveGameAuthor, resolveEnemyAttributes, enemyAttributeBudget, enemyLevel } from '../engine/kernel/gameConfig.js';

const author = JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url)));
const profile = resolveGameAuthor(author, loadGameProfileCatalog());
const settings = characterSettings(profile.modules);
const enemies = profile.content.enemies;
const sum = a => Object.values(a).reduce((x, y) => x + y, 0);

const acts = {
  1: { minion: [1, 2], elite: [2, 3], boss: [3, 3], ids: 'wanderingSoldier blightHound huskBrute graveWisp lanternMoth briarHermit chainScavenger wyrmAspirant fellWarden bellKeeper thornMatriarch' },
  2: { minion: [2, 3], elite: [3, 4], boss: [4, 4], ids: 'gildedKnight courtSurgeon stitchedHound courtMarionette livingArmor mirrorScribe stitchCrab courtDuelist stitchedKing glassRegent marrowOrganist' },
  3: { minion: [3, 4], elite: [4, 5], boss: [5, 5], ids: 'ashRevenant emberStarvedPilgrim valkyrieShade charredColossus cinderMantis eclipseCantor wyrmLord blightedValkyrie furnaceSaint hollowAstronomer ashheartDragon' }
};
const expected = new Map();
for (const [n, act] of Object.entries(acts)) for (const id of act.ids.split(' ')) expected.set(id, { act: Number(n), act_: act });

test('every Core enemy levelProfile is exactly its act and tier pair', () => {
  assert.equal(enemies.length, expected.size);
  for (const e of enemies) {
    const want = expected.get(e.id);
    assert.ok(want, `${e.id} is in the map`);
    const [min, max] = want.act_[e.tier];
    assert.deepEqual({ min: e.levelProfile.min, max: e.levelProfile.max }, { min, max }, `${e.id} (act ${want.act}, ${e.tier})`);
    const level = enemyLevel(e, settings);
    assert.ok(level >= 1 && level <= 5, `${e.id} level ${level}`);
  }
});

test('own attribute total is 5 + level and every attribute is at least 1', () => {
  for (const e of enemies) {
    const level = enemyLevel(e, settings), own = resolveEnemyAttributes(e, settings);
    assert.equal(sum(own), 5 + level, `${e.id} level ${level}`);
    assert.equal(enemyAttributeBudget(e, settings), 5 + level, e.id);
    for (const [id, n] of Object.entries(own)) assert.ok(n >= 1, `${e.id} ${id} ${n}`);
  }
});

test('raising attributePointsPerLevel to 2 makes a level-3 enemy carry 10', () => {
  const e = { ...enemies[0], level: 3, attributePoints: undefined };
  assert.equal(sum(resolveEnemyAttributes(e, settings)), 8);
  const raised = { ...settings, attributePointsPerLevel: 2 };
  assert.equal(sum(resolveEnemyAttributes(e, raised)), 10);
  assert.equal(enemyAttributeBudget(e, raised), 10);
});

test('an authored attributePoints still wins over the level budget', () => {
  assert.equal(enemyAttributeBudget({ ...enemies[0], attributePoints: 9 }, settings), 9);
});

test('seeded variance never moves a stat below 1 or changes the total', () => {
  for (const e of enemies) {
    const base = resolveEnemyAttributes(e, settings);
    for (let seed = 1; seed <= 60; seed++) {
      const varied = resolveEnemyAttributes(e, settings, seed);
      assert.equal(sum(varied), sum(base), `${e.id} seed ${seed}`);
      for (const [id, n] of Object.entries(varied)) assert.ok(n >= 1, `${e.id} seed ${seed} ${id} ${n}`);
    }
  }
});

test('every Core-route encounter targetBand lies within levels 1-5', () => {
  for (const file of ['wealdEncounters', 'marchesEncounters', 'reachEncounters']) {
    for (const enc of JSON.parse(readFileSync(new URL(`../content/source/${file}.json`, import.meta.url)))) {
      const { min, max } = enc.targetBand;
      assert.ok(min >= 1 && max <= 5 && min <= max, `${file}/${enc.id} targetBand ${min}-${max}`);
    }
  }
});
