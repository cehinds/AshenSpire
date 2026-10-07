// tests/character-sheet.test.mjs — the Character sheet's two ladders, read as
// a model (ui/models/CharacterSheetModel.js). Every assertion is against the
// function that PAYS the reward, so the sheet cannot drift from the door.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { legacyContentBundle } from './helpers/legacy-progression-content.mjs';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { xpToNext as levelXpToNext, awardLevelXp } from '../src/model/levelup.js';
import {
  awardSkillXp, classSkillId, levelQueuesAttributePick, levelQueuesRankUp, levelQueuesSkillFeat,
  skillMaxLevel, skillTracks, xpToNext as skillXpToNext,
} from '../src/model/skills.js';
import { deckMinimum } from '../src/model/loadout.js';
import { deriveStat } from '../src/model/derivedStats.js';
import { characterSheetModel, characterLadder, rowState } from '../src/ui/models/CharacterSheetModel.js';
import { cadenceLine, grantText } from '../src/ui/screens/characterSheet.js';
import { queueClassMilestone, classRewardBudget } from '../src/model/classMilestones.js';
import { abilityRankAt } from '../src/model/abilityGrades.js';
import { openRunClassMastery, registriesForClassMastery } from '../src/model/classMasteryRun.js';

// These historical assertions replay the pre-expansion ladder. The expanded
// contract below is checked against its actual paid milestone receipts.
const registries = createRegistries(legacyContentBundle);
const freshRun = () => createRunState({ seed: 4242, classId: 'reaver', registries });
const kinds = (row) => row.grants.map((g) => g.kind);

test('the character ladder runs 1 to the cap, each step the curve the ledger climbs', () => {
  const sheet = characterSheetModel(registries, freshRun());
  const { rows, maxLevel } = sheet.character;
  assert.equal(maxLevel, registries.balance.levelUp.maxLevels);
  assert.equal(rows.length, maxLevel);
  assert.deepEqual(rows[0].grants, [], 'level 1 is where a run starts');
  let total = 0;
  for (const row of rows.slice(1)) {
    assert.equal(row.stepXp, levelXpToNext(registries, row.level - 1), `level ${row.level}'s step`);
    total += row.stepXp;
    assert.equal(row.totalXp, total);
  }
});

test('every character level past 1 grants the authored points; the deck floor rises where deckMinimum does', () => {
  const run = freshRun();
  const { rows } = characterLadder(registries, run);
  for (const row of rows.slice(1)) {
    const points = row.grants.find((g) => g.kind === 'points');
    assert.equal(points.amount, registries.balance.levelUp.pointsPerLevel);
    const floor = deckMinimum(registries, { level: { level: row.level } });
    const rose = floor > deckMinimum(registries, { level: { level: row.level - 1 } });
    const deck = row.grants.find((g) => g.kind === 'deckMinimum');
    assert.equal(!!deck, rose, `level ${row.level}: deck floor grant iff it rises`);
    if (deck) assert.equal(deck.amount, floor);
  }
});

test('pool growth is the run\'s own snapshot: the grants sum to what deriveStat adds from 1 to the cap', () => {
  const run = freshRun();
  const { rows, maxLevel } = characterLadder(registries, run);
  const classDef = registries.classes.get(run.class);
  const at = (stat, level) => deriveStat(run.derivedStatRuleSnapshot.rules, stat, { attributes: run.attributes, classDef, level }).value;
  for (const stat of ['hp', 'stamina', 'mana']) {
    const sum = rows.reduce((n, row) => n + ((row.grants.find((g) => g.kind === 'stat' && g.stat === stat) || {}).amount || 0), 0);
    assert.equal(sum, at(stat, maxLevel) - at(stat, 1), stat);
  }
  assert.ok(rows.slice(1).every((row) => row.grants.some((g) => g.kind === 'stat' && g.stat === 'hp')), 'max HP rises at every level');
  assert.deepEqual(characterLadder(registries, { ...run, derivedStatRuleSnapshot: undefined }).rows[1].grants.filter((g) => g.kind === 'stat'), [], 'no snapshot, no claim');
});

test('the level offers follow the player\'s reward settings', () => {
  const run = freshRun();
  const on = characterLadder(registries, run, { statPoints: true, feats: true, classTree: true, levelCards: true, pointsPerLevel: 3 });
  assert.deepEqual(kinds(on.rows[1]).filter((k) => ['points', 'featChoice', 'classNodeChoice', 'featOrNodeChoice', 'levelCard'].includes(k)), ['points', 'featOrNodeChoice', 'levelCard'],
    'feats and class nodes share ONE level choice (main.js rollLevelChoices)');
  assert.ok(kinds(characterLadder(registries, run, { feats: false, classTree: true }).rows[1]).includes('classNodeChoice'));
  const unequipped = characterLadder(registries, { ...run, classUnequipped: true }, { feats: true, classTree: true });
  assert.ok(kinds(unequipped.rows[1]).includes('featChoice') && !kinds(unequipped.rows[1]).some((k) => /Node/.test(k)), 'no class equipped, no node offered');
  assert.equal(on.rows[1].grants[0].amount, 3, 'the Level-up value dial replaces the authored points');
  const off = characterLadder(registries, run, { statPoints: false, feats: false, classTree: false, levelCards: false });
  assert.ok(!kinds(off.rows[1]).some((k) => ['points', 'featChoice', 'classNodeChoice', 'levelCard'].includes(k)));
});

test('row states track the held level', () => {
  const run = freshRun();
  awardLevelXp(registries, run, levelXpToNext(registries, 1) + levelXpToNext(registries, 2));
  const { level, rows } = characterLadder(registries, run);
  assert.equal(level, 3);
  assert.deepEqual(rows.slice(0, 5).map((r) => r.state), ['reached', 'reached', 'current', 'next', 'locked']);
  assert.equal(rowState(1, 0), 'next', 'a track at 0 reads its level 1 as next');
});

test('a skill ladder pays exactly what the ledger queues at each level', () => {
  const sheet = characterSheetModel(registries, freshRun());
  const blade = sheet.tracks.find((t) => t.id === 'item:blade');
  assert.equal(blade.rows.length, skillMaxLevel(registries, 'weapon'));
  const s = registries.balance.skill;
  for (const row of blade.rows) {
    assert.equal(row.stepXp, skillXpToNext(registries, 'weapon', row.level - 1));
    assert.equal(kinds(row).includes('rankUp'), levelQueuesRankUp('weapon', row.level), `rank-up at ${row.level}`);
    assert.equal(kinds(row).includes('feat'), levelQueuesSkillFeat(registries, 'item:blade', row.level), `feat at ${row.level}`);
    assert.equal(kinds(row).includes('attribute'), levelQueuesAttributePick(registries, 'item:blade', row.level), `attribute at ${row.level}`);
    assert.equal(kinds(row).includes('flat'), row.level % s.flatEvery === 0, `flat at ${row.level}`);
    assert.equal(row.grants.find((g) => g.kind === 'cardDraft').rank, Math.min(row.level, s.rankMax));
  }
  const four = blade.rows[3];
  assert.ok(four.grants.some((g) => g.kind === 'rarity' && g.rarity === 'uncommon'), 'uncommon opens at its rarityUnlock level');
  assert.deepEqual(four.grants.find((g) => g.kind === 'attribute').options, ['Strength', 'Dexterity']);
  assert.equal(blade.rows[9].grants.find((g) => g.kind === 'flat').total, 10 / s.flatEvery);
  assert.equal(blade.rows[0].milestone, false);
  assert.equal(four.milestone, true);
});

test('the class track opens its tree tiers at tierAt and lists only the run\'s own class', () => {
  const run = freshRun();
  const sheet = characterSheetModel(registries, run);
  const classTracks = sheet.tracks.filter((t) => t.kind === 'class');
  assert.deepEqual(classTracks.map((t) => t.id), [classSkillId('reaver')]);
  assert.equal(sheet.tracks[0].id, classSkillId('reaver'), 'the own class leads');
  const cls = classTracks[0];
  const tierAt = registries.balance.skill.class.tierAt;
  tierAt.forEach((level, index) => {
    const tier = cls.rows[level - 1].grants.find((g) => g.kind === 'classTier');
    assert.equal(tier.tier, index + 1);
    assert.ok(tier.nodes.length > 0);
  });
  assert.equal(sheet.tracks.length, skillTracks(registries).filter((t) => t.kind !== 'class').length + 1);
});

test('a trained track reads its level and XP', () => {
  const run = freshRun();
  awardSkillXp(registries, run, 'item:blade', skillXpToNext(registries, 'weapon', 0) + 7);
  const blade = characterSheetModel(registries, run).tracks.find((t) => t.id === 'item:blade');
  assert.equal(blade.level, 1);
  assert.equal(blade.xp, 7);
  assert.equal(blade.touched, true);
  assert.equal(blade.rows[0].state, 'current');
});

test('the model is frozen and every grant has words', () => {
  const sheet = characterSheetModel(registries, freshRun(), { offers: { classTree: true, levelCards: true } });
  assert.ok(Object.isFrozen(sheet) && Object.isFrozen(sheet.tracks) && Object.isFrozen(sheet.character.rows));
  const all = [...sheet.character.rows, ...sheet.tracks.flatMap((t) => t.rows)].flatMap((r) => r.grants);
  for (const grant of all) {
    const text = grantText(grant);
    assert.ok(text && text !== grant.kind && !/\{\w+\}/.test(text), `${grant.kind} reads "${text}"`);
  }
});

test('a class level also pays the source bonuses: a feat choice and a chance at a class card', () => {
  const cls = characterSheetModel(registries, freshRun()).tracks[0];
  const bonus = registries.balance.rewards.sourceBonuses;
  for (const row of cls.rows) {
    assert.equal((row.grants.find((g) => g.kind === 'classFeat') || {}).pct, bonus.classFeatChancePct);
    assert.equal((row.grants.find((g) => g.kind === 'classCard') || {}).pct, bonus.classCardChancePct);
  }
});

test('the cadence line promises only what that track pays', () => {
  const sheet = characterSheetModel(registries, freshRun());
  const line = (id) => cadenceLine(registries, sheet.tracks.find((t) => t.id === id));
  assert.match(line('item:blade'), /rank-up/);
  assert.match(line('item:blade'), /linked attribute/);
  assert.match(line('item:blade'), /card power/);
  const armour = line('armour:heavy');
  assert.doesNotMatch(armour, /rank-up|card power|skill feat|linked attribute/, armour);
  assert.match(line(classSkillId('reaver')), /class-tree pick/);
});

const expandedRegistries = createRegistries(contentBundle);
const expandedRun = (classId = 'reaver') => {
  const run = createRunState({ seed: 4242, classId, registries: expandedRegistries });
  openRunClassMastery(expandedRegistries, run, {}, { receiptId: `ladder:${classId}` });
  return run;
};

test('expanded class rows describe the exact funded milestone schedule and four skill XP awards', () => {
  for (const classId of expandedRegistries.classes.ids()) {
    const run = expandedRun(classId), before = structuredClone(run);
    const cls = characterSheetModel(expandedRegistries, run).tracks[0];
    assert.deepEqual(run, before, 'opening the sheet cannot pay XP or consume RNG/receipts');
    const scoped = registriesForClassMastery(expandedRegistries, run);
    const earned = structuredClone(run);
    for (const row of cls.rows) {
      const receipt = queueClassMilestone(scoped, earned, classId, row.level);
      assert.deepEqual(row.grants.filter(g => g.kind === 'classMilestone').map(g => g.rewardKind).sort(), Object.keys(receipt.grants).sort());
      assert.ok(!row.grants.some(g => ['classFeat','classCard','feat','attribute'].includes(g.kind)), 'no legacy chance or duplicate milestone grants');
      const xp = row.grants.find(g => g.kind === 'skillXp');
      assert.equal(xp.amount, scoped.balance.progression.skillBonusXp);
      assert.equal(xp.tracks.length, 4);
      assert.ok(xp.tracks.every(label => !label.includes(':')));
      for (const grant of row.grants) assert.ok(grantText(grant) && grantText(grant) !== grant.kind);
    }
    for (const level of [12,20]) {
      const listed = Object.fromEntries(Object.keys(scoped.balance.progression.cadence).map(kind => [kind, cls.rows.slice(0,level).flatMap(row => row.grants).filter(grant => grant.kind === 'classMilestone' && grant.rewardKind === kind).length]));
      assert.deepEqual(listed, classRewardBudget(scoped,level));
    }
    assert.doesNotMatch(cadenceLine(scoped,cls), /chance/);
    assert.match(cadenceLine(scoped,cls), /2, 4, 6, 8, 10, 12, 14, 16, 18, 20/);
    const unlockNames = cls.rows.flatMap(row => row.grants.filter(grant => grant.kind === 'masteryUnlock').flatMap(grant => grant.names));
    assert.ok(unlockNames.some(name => name !== classId), 'registered module unlock names remain visible');
  }
});

test('expanded ability ladders use free activation, authored ranks and linear steps without proficiency overlays', () => {
  const run = expandedRun(), sheet = characterSheetModel(expandedRegistries,run);
  for (const id of ['combatManeuvers','item:magic-focus']) {
    const track = sheet.tracks.find(track => track.id === id);
    assert.deepEqual(track.rows.map(row => row.grants.find(g => g.kind === 'cardDraft').rank), [0,1,1,2,2,3,3,4,4,5]);
    assert.deepEqual(track.rows.slice(0,4).map(row => row.stepXp),[0,100,150,200]);
    assert.ok(track.rows.every(row => !row.grants.some(g => ['rankUp','rarity','flat'].includes(g.kind))));
    assert.match(grantText(track.rows[0].grants.find(g => g.kind === 'cardDraft')), /3 families at rank 0/);
    assert.doesNotMatch(cadenceLine(expandedRegistries,track), /rank-up|card power/);
  }
});

test('saved progression rules drive cadence, ranks and named catalog unlocks after global edits', () => {
  const run = expandedRun();
  run.progressionRuleSnapshot.cadence.cards = [3,7];
  run.progressionRuleSnapshot.ability.ranksAt = [1,3,5,7,9,10];
  run.progressionRuleSnapshot.skillBonusXp = 17;
  const edited = { ...expandedRegistries, classMastery: [...expandedRegistries.classMastery, {classId:'reaver',level:7,kind:'cards',ref:'progression-ember-hew'}] };
  const sheet = characterSheetModel(edited,run), cls = sheet.tracks[0];
  assert.deepEqual(cls.rows.filter(row => row.grants.some(g => g.kind === 'classMilestone' && g.rewardKind === 'cards')).map(row => row.level),[3,7]);
  assert.equal(cls.rows[0].grants.find(g => g.kind === 'skillXp').amount,17);
  const ability = sheet.tracks.find(track => track.id === 'combatManeuvers');
  assert.equal(ability.rows[1].grants.find(g => g.kind === 'cardDraft').rank,0);
  assert.equal(ability.rows[2].grants.find(g => g.kind === 'cardDraft').rank,abilityRankAt(registriesForClassMastery(edited,run),3));
  assert.ok(cls.rows[6].grants.some(g => g.kind === 'masteryUnlock' && g.names.includes(edited.cards.get('progression-ember-hew').name)), 'a newly registered module row needs no manual ladder edit');
});

test('an actual legacy save read through the aggregate root keeps legacy chance rewards and focus ranks', () => {
  const run = freshRun();
  const sheet = characterSheetModel(expandedRegistries,run), legacy = characterSheetModel(registries,run);
  assert.equal(run.progressionRulesVersion,undefined);
  assert.deepEqual(sheet.tracks,legacy.tracks);
  assert.equal(sheet.tracks.find(track => track.id === 'item:magic-focus').rows[0].grants.find(g => g.kind === 'cardDraft').rank,1);
  assert.ok(sheet.tracks[0].rows.every(row => row.grants.some(g => g.kind === 'classFeat') && row.grants.some(g => g.kind === 'classCard')));
});
