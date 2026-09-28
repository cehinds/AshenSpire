import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { advancedConfigSnapshot, configuredContentBundle, updatedXpSnapshot, xpSnapshotFromProfile } from '../src/model/advancedConfig.js';
import { createRunCombat, enemyLevelsForFight } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { createEnemyCombatEntity, createRunState } from '../src/model/state.js';
import { combatLevelXp, xpToNext as characterXpToNext } from '../src/model/levelup.js';
import { xpToNext as skillXpToNext } from '../src/model/skills.js';
import { levelPacePreview } from '../src/ui/models/LevelPacePreviewModel.js';

const registries = createRegistries(contentBundle);

test('the current build defaults to 100 XP per level and five XP per common skill event', () => {
  assert.equal(characterXpToNext(registries, 1), 100);
  assert.equal(characterXpToNext(registries, 10), 100);
  assert.equal(skillXpToNext(registries, 'weapon', 0), 100);
  assert.equal(skillXpToNext(registries, 'class', 0), 100);
  assert.equal(registries.balance.skill.xp.perHit, 5);
  assert.equal(registries.balance.skill.xp.perWinEquipped, 5);
  assert.equal(registries.balance.skill.class.xp.perWin, 5);
  assert.equal(registries.balance.xp.combatWin, 25);
  assert.equal(registries.balance.xp.kill.normal, 10);
});

test('kill XP uses each defeated enemy level; a live settings snapshot changes its rate', () => {
  const run = { seed: 42, actNumber: 3, floor: 2 };
  const enemyIds = ['ashRevenant', 'ashRevenant'];
  const levels = enemyLevelsForFight(registries, run, enemyIds);
  assert.deepEqual(levels, enemyLevelsForFight(registries, run, enemyIds));
  for (const level of levels) assert.ok(level >= 13 && level <= 16);
  const liveRun = createRunState({ seed: 42, classId: 'reaver', registries });
  liveRun.actNumber = 3;
  liveRun.floor = 2;
  const combat = createRunCombat({ registries, rng: createRng(42), run: liveRun, enemyIds });
  assert.deepEqual(combat.enemies.map((enemy) => enemy.level), levels);
  const dead = levels.map((level) => ({ level, hp: 0, alive: false }));
  assert.equal(createEnemyCombatEntity({ instanceId: 'e1', enemyId: enemyIds[0], hp: 10, level: levels[0] }).level, levels[0]);
  assert.equal(combatLevelXp(registries, { victory: true, enemies: dead }), 25 + 10 * (levels[0] + levels[1]));
  dead[1].hp = 1;
  dead[1].alive = true;
  assert.equal(combatLevelXp(registries, { enemies: dead }), 10 * levels[0]);

  const snapshot = advancedConfigSnapshot({ 'gameConfig.balance.level.xp.base': 175, 'gameConfig.balance.xp.kill.normal': 12 });
  const changed = updatedXpSnapshot(snapshot, { 'gameConfig.balance.xp.kill.normal': 20 });
  const updated = createRegistries(configuredContentBundle(contentBundle, changed));
  assert.equal(characterXpToNext(updated, 1), 180, 'the configured base follows the authored round-to-10 rule');
  assert.equal(combatLevelXp(updated, { enemies: dead }), 20 * levels[0]);
  assert.equal(snapshot.overrides['gameConfig.balance.xp.kill.normal'], 12);

  const resumed = xpSnapshotFromProfile(snapshot, { 'gameConfig.balance.xp.kill.normal': 25 });
  assert.equal(resumed.overrides['gameConfig.balance.xp.kill.normal'], 25);
  assert.equal(resumed.overrides['gameConfig.balance.level.xp.base'], undefined, 'a profile reset clears an old run XP override');
});

test('the preview responds to the same settings as character and skill awards', () => {
  const settings = {
    'gameConfig.progression.xpMultiplier': 2,
    'gameConfig.balance.level.xp.base': 200,
    'gameConfig.balance.skill.xp.base': 150,
    'gameConfig.balance.xp.kill.normal': 15,
  };
  const updated = createRegistries(configuredContentBundle(contentBundle, settings));
  const preview = levelPacePreview(settings);
  assert.equal(preview.curve[0].step, characterXpToNext(updated, 1));
  assert.equal(preview.curve[0].step, 200);
  assert.equal(preview.fights.find((fight) => fight.pool === 'normal').xp, 140);
  assert.equal(preview.skillText.includes('10 XP'), true);
  assert.equal(preview.skillText.includes('150 XP'), true);
  assert.equal(skillXpToNext(updated, 'weapon', 0), 150);
});
