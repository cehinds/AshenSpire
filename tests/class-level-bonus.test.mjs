// Character level rewards retain the saved cadence after updates to authored balance.
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
import { grantText } from '../src/ui/screens/characterSheet.js';
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
  test(`${classId}: the current class-primary bonus raises ${attribute} where a fight and the pools read it`, () => {
    const run = make(classId);
    const before = gameProfileEffectiveAttributes(registries, run)[attribute];
    climbTo(run, 2);
    assert.deepEqual(ClassLevelAttributeBonus(run), { [attribute]: 1 });
    assert.equal(gameProfileEffectiveAttributes(registries, run)[attribute], before + 1);
    climbTo(run, 6);
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

test('the Core ladder shows current class, free-point and rank rewards alongside existing level cards', () => {
  const run = make('reaver');
  const ladder = characterLadder(registries, run);
  const kinds = (level) => ladder.rows.find((row) => row.level === level).grants.map((g) => g.kind);
  assert.ok(!kinds(2).includes('points'));
  assert.ok(kinds(2).includes('classBonus'));
  assert.ok(!kinds(3).includes('classBonus'));
  assert.equal(ladder.rows.find((row) => row.level === 2).grants.find((g) => g.kind === 'classBonus').attribute, 'Strength');
  for (const row of ladder.rows.filter((r) => r.level > 1)) {
    assert.equal(row.grants.some((g) => g.kind === 'classBonus'), [2, 6, 10, 14, 18].includes(row.level), `level ${row.level}`);
    assert.equal(row.grants.some((g) => g.kind === 'points'), [4, 12, 20].includes(row.level), `level ${row.level}`);
    assert.deepEqual(row.grants.find((g) => g.kind === 'rankUp'), { kind: 'rankUp', amount: 1 });
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
    delete run.levelRewardRuleSnapshot;
    delete run.classLevelBonusVersion;
    climbTo(run, level);
    const saves = createSaveManager(createMemoryStorage());
    saves.saveRun(run, createRng(run.seed));
    const loaded = saves.loadRun(registries);
    assert.ok(loaded, saves.runStatus().reason);
    assert.equal(loaded.classLevelBonusVersion, undefined);
    assert.equal(loaded.levelRewardRuleSnapshot, undefined, 'old saves stay on their own rule shape');
    assert.deepEqual(ClassLevelAttributeBonus(loaded), {});
    assert.equal(loaded.maxHp, run.maxHp);
    const ladder = characterLadder(registries, loaded);
    assert.deepEqual(ladder.rows.filter(row => row.grants.some(grant => grant.kind === 'classBonus')).map(row => row.level), []);
    assert.deepEqual(ladder.rows.filter(row => row.grants.some(grant => grant.kind === 'points')).map(row => row.level), [4, 8, 12, 16, 20]);
  });
  test(`${classId} L${level}: an archived odd-level run saves and loads with its original bonus`, () => {
    const run = make(classId);
    delete run.levelRewardRuleSnapshot;
    run.classLevelBonusVersion = CLASS_LEVEL_BONUS_VERSION;
    climbTo(run, level);
    const saves = createSaveManager(createMemoryStorage());
    saves.saveRun(run, createRng(run.seed));
    const loaded = saves.loadRun(registries);
    assert.ok(loaded, saves.runStatus().reason);
    assert.deepEqual(ClassLevelAttributeBonus(loaded), { [classLevelBonuses.attributeByClass[classId]]: ClassBonusCount(level) });
    const ladder = characterLadder(registries, loaded);
    assert.deepEqual(ladder.rows.filter(row => row.grants.some(grant => grant.kind === 'classBonus')).map(row => row.level), [3, 5, 7, 9, 11, 13, 15, 17, 19]);
  });
}

test('a current run earns its free points and rank-up credits exactly once across a save', () => {
  const run = make('reaver');
  climbTo(run, 2);
  assert.deepEqual(run.level, { xp: 0, level: 2, unspentPoints: 0, pendingRankUps: 1 });
  climbTo(run, 4);
  assert.equal(run.level.unspentPoints, 1);
  climbTo(run, 8);
  assert.equal(run.level.unspentPoints, 1);
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run, createRng(run.seed));
  const loaded = saves.loadRun(registries);
  assert.ok(loaded, saves.runStatus().reason);
  assert.deepEqual(loaded.levelRewardRuleSnapshot, run.levelRewardRuleSnapshot);
  assert.deepEqual(loaded.level, run.level);
  assert.deepEqual(ClassLevelAttributeBonus(loaded), { strength: 2 });
  const changedRegistries = { ...registries, balance: { ...registries.balance, levelUp: {
    ...registries.balance.levelUp,
    characterLevelRewards: { ...registries.balance.levelUp.characterLevelRewards, freeAttribute: { firstLevel: 3, every: 2, amount: 5 } },
  } } };
  for (let level = 8; level < 12; level += 1) awardLevelXp(changedRegistries, loaded, xpToNext(changedRegistries, level));
  assert.equal(loaded.level.level, 12);
  assert.equal(loaded.level.unspentPoints, 2);
  assert.equal(loaded.level.pendingRankUps, 11);
  climbTo(loaded, 20);
  assert.deepEqual(ClassLevelAttributeBonus(loaded), { strength: 5 });
  assert.equal(loaded.level.unspentPoints, 3);
  assert.equal(loaded.level.pendingRankUps, 19);
});


for (const [name, modules] of [
  ['stats disabled', { stats: false }],
  ['attribute points disabled', { progression: { attributePointsPerLevel: 0 } }],
]) test(`${name}: saved and new ladders respect the free-point opt-out`, () => {
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules });
  const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  for (const archived of [false, true]) {
    const run = createRunState({ seed: 3, classId: 'reaver', registries: reg });
    if (archived) delete run.levelRewardRuleSnapshot;
    else assert.ok(run.levelRewardRuleSnapshot);
    for (const from of [1, 2, 3]) awardLevelXp(reg, run, xpToNext(reg, from));
    assert.equal(run.level.level, 4);
    assert.equal(run.level.unspentPoints, 0);
    assert.equal(run.level.pendingRankUps, 3);
    assert.deepEqual(ClassLevelAttributeBonus(run), archived ? {} : { strength: 1 }, 'the automatic class reward is independent');
    const ladder = characterLadder(reg, run);
    assert.ok(ladder.rows.every(row => row.grants.every(grant => grant.kind !== 'points')));
  }
});


test('custom rank credit counts are paid and shown together', () => {
  const levelUp = registries.balance.levelUp;
  const custom = { ...registries, balance: { ...registries.balance,
    levelUp: { ...levelUp, characterLevelRewards: { ...levelUp.characterLevelRewards, cardRankUpsPerLevel: 2 } },
  } };
  const run = createRunState({ registries: custom, seed: 3, classId: 'reaver' });
  awardLevelXp(custom, run, xpToNext(custom, 1));
  const grant = characterLadder(custom, run).rows[1].grants.find(row => row.kind === 'rankUp');
  assert.equal(run.level.pendingRankUps, 2);
  assert.equal(grantText(grant), 'Rank up 2 cards');
  assert.equal(grantText({ kind: 'rankUp', amount: 1 }), 'Rank up a card');
});
