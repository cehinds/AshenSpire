// Owner, 2026-11-17 (playtest item 24): Core's progression ladder lists the bonuses a
// level really pays, with a class-specific bonus at every odd level, and that bonus applies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { awardLevelXp, xpToNext } from '../src/model/levelup.js';
import { gameProfileEffectiveAttributes } from '../src/model/gameProfileGear.js';
import { ClassLevelAttributeBonus, ClassBonusCount, IsClassBonusLevel } from '../src/model/classLevelBonus.js';
import { classLevelBonuses } from '../src/content/classLevelBonuses.js';
import { characterLadder } from '../src/ui/models/CharacterSheetModel.js';
import { deckMinimum } from '../src/model/loadout.js';
import { deckRules } from '../src/content/deckRules.js';

const core = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, core)), core);
const make = (classId = 'reaver') => createRunState({ seed: 3, classId, registries, runId: `bonus-${classId}`, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const climbTo = (run, level) => {
  let xp = 0;
  for (let at = run.level.level; at < level; at += 1) xp += xpToNext(registries, at);
  awardLevelXp(registries, run, xp, { pointsPerLevel: 1 });
  assert.equal(run.level.level, level);
};

test('odd levels from 3 carry the class bonus', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(IsClassBonusLevel), [false, false, true, false, true, false, true]);
  assert.deepEqual([1, 2, 3, 5, 9].map(ClassBonusCount), [0, 0, 1, 2, 4]);
});

for (const [classId, attribute] of Object.entries(classLevelBonuses.attributeByClass)) {
  test(`${classId}: the odd-level bonus raises ${attribute} where a fight and the pools read it`, () => {
    const run = make(classId);
    const before = gameProfileEffectiveAttributes(registries, run)[attribute];
    climbTo(run, 3);
    assert.deepEqual(ClassLevelAttributeBonus(run), { [attribute]: 1 });
    assert.equal(gameProfileEffectiveAttributes(registries, run)[attribute], before + 1);
    climbTo(run, 5);
    assert.equal(gameProfileEffectiveAttributes(registries, run)[attribute], before + 2);
    assert.equal(run.attributes[attribute], make(classId).attributes[attribute], 'nothing is written onto the allocated attributes');
  });
}

test('a class taken off pays no class bonus', () => {
  const run = make('reaver');
  climbTo(run, 3);
  run.classUnequipped = true;
  assert.deepEqual(ClassLevelAttributeBonus(run), {});
});

test('the Core ladder shows the real grants: points, class bonus on odd levels, deck minimum down, a level card; no feat pick', () => {
  const run = make('reaver');
  const ladder = characterLadder(registries, run);
  const kinds = (level) => ladder.rows.find((row) => row.level === level).grants.map((g) => g.kind);
  assert.ok(kinds(2).includes('points'));
  assert.ok(!kinds(2).includes('classBonus'));
  assert.ok(kinds(3).includes('classBonus'));
  assert.equal(ladder.rows.find((row) => row.level === 3).grants.find((g) => g.kind === 'classBonus').attribute, 'Strength');
  for (const row of ladder.rows.filter((r) => r.level > 1)) {
    assert.equal(row.grants.some((g) => g.kind === 'classBonus'), IsClassBonusLevel(row.level), `level ${row.level}`);
    assert.ok(row.grants.some((g) => g.kind === 'levelCard'), `level ${row.level} offers its card`);
    assert.ok(!row.grants.some((g) => ['featChoice', 'featOrNodeChoice', 'classNodeChoice', 'deckMinimum'].includes(g.kind)), `level ${row.level} promises no feat or rising floor`);
  }
  for (const level of deckRules.minimumReductionLevels) {
    const grant = ladder.rows.find((row) => row.level === level).grants.find((g) => g.kind === 'deckMinimumDown');
    assert.ok(grant, `level ${level} lowers the minimum`);
  }
  assert.equal(ladder.rows.find((row) => row.level === 12).grants.find((g) => g.kind === 'deckMinimumDown').amount, deckRules.defaults.deckMinSize - 3);
});

test('the Core Armoury floor is the deck editor minimum, which levels lower', () => {
  const run = make('reaver');
  assert.equal(deckMinimum(registries, run), deckRules.defaults.deckMinSize);
  climbTo(run, 4);
  assert.equal(deckMinimum(registries, run), deckRules.defaults.deckMinSize - 1);
});

// Review of #2815 (blocker): a save made before the class bonus existed must still load. Such a run carries no
// classLevelBonusVersion; its pools were derived without the bonus, so the load door must not price one in.
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { createRng } from '../src/engine/rng.js';
import { CLASS_LEVEL_BONUS_VERSION } from '../src/model/classLevelBonus.js';

for (const classId of Object.keys(classLevelBonuses.attributeByClass)) for (const level of [3, 5]) {
  test(`${classId} L${level}: a save on the old run shape (no class bonus field) loads, and pays no bonus`, () => {
    const run = make(classId);
    delete run.classLevelBonusVersion;
    climbTo(run, level);
    const saves = createSaveManager(createMemoryStorage());
    saves.saveRun(run, createRng(run.seed));
    const loaded = saves.loadRun(registries);
    assert.ok(loaded, saves.runStatus().reason);
    assert.equal(loaded.classLevelBonusVersion, undefined);
    assert.deepEqual(ClassLevelAttributeBonus(loaded), {});
    assert.equal(loaded.maxHp, run.maxHp);
  });
  test(`${classId} L${level}: a run born with the class bonus saves and loads with it`, () => {
    const run = make(classId);
    assert.equal(run.classLevelBonusVersion, CLASS_LEVEL_BONUS_VERSION);
    climbTo(run, level);
    const saves = createSaveManager(createMemoryStorage());
    saves.saveRun(run, createRng(run.seed));
    const loaded = saves.loadRun(registries);
    assert.ok(loaded, saves.runStatus().reason);
    assert.deepEqual(ClassLevelAttributeBonus(loaded), { [classLevelBonuses.attributeByClass[classId]]: ClassBonusCount(level) });
  });
}
