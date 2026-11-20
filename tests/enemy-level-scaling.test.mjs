// SPEC §17, Enemy levels and stat budget (owner, 2026-11-20): a Core enemy's fight level comes from its act,
// tier and floor step (characters.enemyLevelScaling); each floor step makes it tougher, with SP capped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { characterSettings, resolveGameAuthor, enemyFightLevel, enemyLevel } from '../engine/kernel/gameConfig.js';

const author = JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url)));
const profile = resolveGameAuthor(author, loadGameProfileCatalog());
const settings = characterSettings(profile.modules);
const row = (tier, extra = {}) => ({ id: `probe.${tier}`, tags: ['character.enemy', `tier.${tier}`], levelProfile: { min: 1, max: 2 }, ...extra });

test('enemyFightLevel reads the act and tier row at the floor step', () => {
  const minion = row('minion'), elite = row('elite');
  const at = (r, act, floor) => enemyFightLevel(r, settings, { act, floor });
  assert.deepEqual([2, 5, 8].map(floor => at(minion, 1, floor)), [{ level: 1, step: 0 }, { level: 2, step: 1 }, { level: 3, step: 2 }]);
  assert.deepEqual([1, 3, 4, 6, 7, 9].map(floor => at(minion, 2, floor).level), [3, 3, 4, 4, 5, 5]);
  assert.deepEqual([1, 4, 7].map(floor => at(elite, 3, floor).level), [6, 7, 8]);
});

test('a boss sits at its act level and bossSteps', () => {
  const boss = row('boss');
  assert.deepEqual(enemyFightLevel(boss, settings, { act: 1, floor: 10 }), { level: 5, step: 2 });
  assert.deepEqual(enemyFightLevel(boss, settings, { act: 2, floor: 10 }), { level: 8, step: 2 });
  assert.deepEqual(enemyFightLevel(boss, settings, { act: 3, floor: 10 }), { level: 11, step: 2 });
});

test('the step stops at the last table entry and the last act holds past the table', () => {
  assert.deepEqual(enemyFightLevel(row('minion'), settings, { act: 1, floor: 30 }), { level: 3, step: 2 });
  assert.deepEqual(enemyFightLevel(row('elite'), settings, { act: 7, floor: 1 }), { level: 6, step: 0 });
  assert.deepEqual(enemyFightLevel(row('minion'), settings, { act: 1, floor: 0 }), { level: 1, step: 0 });
});

test('without enemyLevelScaling the level is the levelFrom bound at step 0', () => {
  const { enemyLevelScaling, ...old } = settings;
  assert.ok(enemyLevelScaling, 'Core carries the table');
  const minion = row('minion', { levelProfile: { min: 2, max: 3 } });
  assert.deepEqual(enemyFightLevel(minion, old, { act: 3, floor: 9 }), { level: enemyLevel(minion, old), step: 0 });
  assert.deepEqual(enemyFightLevel(row('champion'), settings, { act: 1, floor: 9 }), { level: 1, step: 0 });
});
