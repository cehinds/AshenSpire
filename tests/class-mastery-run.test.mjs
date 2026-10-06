import assert from 'node:assert/strict';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { createRng } from '../src/engine/rng.js';
import { rollCardRewardIds, rollSkillDraftIds, rollRelicReward, rollArmamentDrop } from '../src/engine/encounters.js';
import { openRunClassMastery, registriesForClassMastery, adoptClassMasteryProfile, refreshRunClassMastery } from '../src/model/classMasteryRun.js';
import { masterySpentXp } from '../src/model/classMasteryProfile.js';
import { masteryRowId } from '../src/model/classMastery.js';
import { awardClassXp, initialClassTreeChoices, pickInitialClassTreeNode } from '../src/model/classTree.js';
import { claimBankedSkillLevel, skillFeatOptions, takeSkillFeat, xpToNext } from '../src/model/skills.js';
import { swapRunClass } from '../src/model/classSwap.js';
import { trainingPlan, redistributePlan } from '../src/model/master.js';
import { bookLessons } from '../src/model/bookLearning.js';
import { skillBookReadPlan, commitSkillBookRead, consumableText } from '../src/model/consumables.js';
import { equipClassCard } from '../src/model/classLibrary.js';
import { creationEquipmentSectionViews, creationHandChoices } from '../src/model/characterCreation.js';
import { completeQuest } from '../src/engine/quests.js';
import { completedRunMeta } from '../src/model/runCompletion.js';
import { createSession, restoreSession } from '../tools/session.mjs';
import { executeRunEffects } from '../src/engine/actions.js';

const source = createRegistries(configuredContentBundle(contentBundle));
const freshMeta = () => createSaveManager(createMemoryStorage()).loadMeta();
function active(classId = 'reaver', meta = freshMeta(), id = 'run-1') {
  const run = createRunState({ registries: source, classId, seed: 71, profileMeta: meta });
  openRunClassMastery(source, run, meta, { receiptId: id });
  return { run, reg: registriesForClassMastery(source, run) };
}

test('fresh runs roll only core cards and ungated global equipment/relics', () => {
  const gated = contentBundle.classMastery;
  for (const cls of source.classes.all()) {
    const { run, reg } = active(cls.id);
    const rng = createRng(31);
    assert.equal(run.skills[`class:${cls.id}`].level, 0);
    assert.equal(run.skills[`class:${cls.id}`].xp, 0);
    assert.equal(run.level.xp, 0);
    assert.equal(Object.keys(run.skills).length, 1);
    for (let seed = 0; seed < 100; seed++) {
      const cards = rollCardRewardIds(reg, rng, { classId: cls.id, pool: 'boss' });
      assert.ok(cards.every(id => !gated.some(row => row.kind === 'cards' && row.ref === id)));
      const relic = rollRelicReward(reg, rng, []);
      assert.ok(!gated.some(row => row.kind === 'relic' && row.ref === relic));
      executeRunEffects({ run, registries: reg, rng }, [{ op: 'addRelic', random: true }]);
      assert.ok(run.relics.every(id => !gated.some(row => row.kind === 'relic' && row.ref === id)));
      const item = rollArmamentDrop(reg, rng, { source: 'boss' });
      assert.ok(!gated.some(row => ['armament', 'weapon'].includes(row.kind) && row.ref === `armament/${item}`));
    }
    assert.ok(reg.equipment.armour.every(item => !gated.some(row => row.ref === `armor/${item.classId}/${item.id}`)));
    assert.equal(skillFeatOptions(run, `class:${cls.id}`, 0).length, 3);
  }
});

test('explicit creation hands cannot bypass a gate opened by another class', () => {
  const meta = freshMeta();
  assert.ok(!creationHandChoices(source, 'reaver', 'rightHand', meta).some(row => row.id === 'greatsword'));
  assert.ok(!creationEquipmentSectionViews(source, 'reaver', { meta }).flatMap(row => row.choices).some(row => row.id === 'greatsword'));
  const config = { registries: source, classId: 'reaver', seed: 1, profileMeta: meta, startingHands: { rightHand: 'greatsword', leftHand: null } };
  assert.throws(() => createRunState(config), /greatsword.*mastery/);
  const gate = source.classMastery.find(row => row.ref === 'armament/greatsword');
  meta.classMastery[gate.classId].unlockedRows.push(masteryRowId(gate));
  assert.ok(creationHandChoices(source, 'reaver', 'rightHand', meta).some(row => row.id === 'greatsword'));
  assert.doesNotThrow(() => createRunState(config));
});

test('class books teach without buying XP or replacing the target mastery', () => {
  const meta = freshMeta();
  meta.classMastery.herald = { level: 5, xp: masterySpentXp(source, 5) + 12, unlockedRows: [] };
  const { run, reg } = active('reaver', meta);
  run.consumables = { heraldClassBook: 1, universalTome: 1 };
  const plan = skillBookReadPlan(reg, run, 'heraldClassBook');
  assert.equal(plan.xp, 0);
  assert.equal(commitSkillBookRead(reg, run, { ...plan, choice: plan.lessons[0] }).gained, 0);
  assert.equal(run.skills['class:herald'], undefined);
  assert.ok(!consumableText(reg, plan.def).includes('Gain 40'));
  assert.equal(skillBookReadPlan(reg, run, 'universalTome', { skillId: 'class:herald' }).xp, 0);
  equipClassCard(reg, run, 'herald');
  assert.deepEqual(run.skills['class:herald'], { level: 5, xp: 12, pendingDrafts: 0 });
});

test('feat previews include the newly claimed gate, and commits enforce the actual level', () => {
  for (const level of [6, 14]) {
    const meta = freshMeta();
    meta.classMastery.reaver = { level: level - 1, xp: masterySpentXp(source, level - 1), unlockedRows: [] };
    const { run, reg } = active('reaver', meta);
    const gate = source.classMastery.find(row => row.classId === 'reaver' && row.level === level);
    run.skills['class:reaver'].pendingSkillFeats = 1;
    assert.ok(skillFeatOptions(run, 'class:reaver', level).includes(gate.ref));
    assert.equal(takeSkillFeat(run, 'class:reaver', gate.ref), false);
    const amount = xpToNext(reg, 'class', level - 1);
    run.skills['class:reaver'].xp = amount;
    run.classMasteryState.earnedXp.reaver = amount;
    assert.ok(claimBankedSkillLevel(reg, run, 'class:reaver'));
    assert.equal(takeSkillFeat(run, 'class:reaver', gate.ref), true);
  }
  const meta = freshMeta();
  meta.classMastery.reaver.unlockedRows = source.classMastery.filter(row => row.classId === 'reaver').map(masteryRowId);
  assert.equal(skillFeatOptions(active('reaver', meta).run, 'class:reaver', 0).length, 5);
});

test('mastery curve ignores legacy shaping and preserves claims across a cost increase', () => {
  const changed = createRegistries(configuredContentBundle(contentBundle, { 'gameConfig.balance.skill.class.xp.linear': true, 'gameConfig.balance.classMastery.xp.base': 100 }));
  const meta = freshMeta();
  meta.classMastery.reaver = { level: 1, xp: 50, unlockedRows: [] };
  const run = createRunState({ registries: changed, classId: 'reaver', seed: 1 });
  openRunClassMastery(changed, run, meta, { receiptId: 'retuned' });
  const reg = registriesForClassMastery(changed, run);
  assert.equal(xpToNext(reg, 'class', 1), 125);
  const saves = createSaveManager(createMemoryStorage());
  assert.equal(saves.saveMeta(meta).ok, true);
  assert.equal(saves.bankClassMastery(run, reg).ok, true);
  run.skills['class:reaver'].xp = 125;
  run.classMasteryState.earnedXp.reaver = 125;
  assert.ok(claimBankedSkillLevel(reg, run, 'class:reaver'));
  assert.equal(saves.bankClassMastery(run, reg).ok, true);
  assert.equal(saves.loadMeta().classMastery.reaver.level, 2);
  run.skills['class:reaver'].xp += 20 + 135;
  run.classMasteryState.earnedXp.reaver += 20 + 135;
  assert.ok(claimBankedSkillLevel(reg, run, 'class:reaver'));
  assert.equal(saves.bankClassMastery(run, reg).ok, true);
  assert.equal(saves.loadMeta().classMastery.reaver.level, 3);
  assert.equal(saves.loadMeta().classMastery.reaver.spentXp, 50 + 125 + 155);
});

test('resuming another slot refreshes global unlocks and retains its earned receipt', () => {
  const { run: other, reg: otherReg } = active('herald', freshMeta(), 'other-slot');
  other.classMasteryState.earnedXp.herald = 10;
  const resumed = deserializeRun(serializeRun(other));
  const meta = freshMeta();
  const row = source.classMastery.find(row => row.classId === 'reaver' && row.level === 2);
  meta.classMastery.reaver = { level: 2, xp: masterySpentXp(source, 2), unlockedRows: [masteryRowId(row)] };
  refreshRunClassMastery(resumed, meta, source);
  assert.equal(resumed.classMasteryState.earnedXp.herald, 10);
  assert.ok(registriesForClassMastery(source, resumed).equipment.armour.some(item => `armor/${item.classId}/${item.id}` === row.ref));
  assert.ok(!otherReg.equipment.armour.some(item => `armor/${item.classId}/${item.id}` === row.ref));
});

test('quest pay is once per completion and terminal result retries are atomic', () => {
  const { run, reg } = active();
  completeQuest({ run, registries: reg }, { questId: 'nameless', source: 'event' });
  completeQuest({ run, registries: reg }, { questId: 'nameless', source: 'event' });
  assert.equal(run.classMasteryState.earnedXp.reaver, 10);
  for (const victory of [false, true]) {
    run.pendingFinish = { victory, id: `finish-${victory}` };
    const retained = deserializeRun(serializeRun(run));
    assert.deepEqual(retained.pendingFinish, run.pendingFinish);
    const result = { victory, class: run.class, maxClassLevel: 0, finishId: retained.pendingFinish.id };
    const first = completedRunMeta(reg, freshMeta(), result);
    const retry = completedRunMeta(reg, first.meta, result);
    assert.equal(retry.meta.results.length, 1);
    assert.equal(retry.meta.progress.runs, 1);
  }
});

test('co-op seats keep their own entitlements, initial tree and nonbanking state through restore', () => {
  const S = createSession({ registries: source, seedString: 'GOLDBOUGH' });
  const fresh = freshMeta();
  const veteran = freshMeta();
  veteran.classMastery.reaver = { level: 5, xp: masterySpentXp(source, 5), unlockedRows: source.classMastery.filter(row => row.classId === 'reaver').map(masteryRowId) };
  S.addMember({ id: 'a', classId: 'reaver', classMastery: fresh.classMastery });
  S.addMember({ id: 'b', classId: 'reaver', classMastery: veteran.classMastery });
  S.start();
  assert.equal(S.chooseNode('a', S.session.reachableIds[0]).ok, false);
  for (const m of S.connectedMembers()) {
    const reg = registriesForClassMastery(source, m.run);
    while (m.run.classMasteryState.initialTreeTiers.length) assert.equal(S.chooseMasteryNode(m.id, initialClassTreeChoices(reg, m.run)[0]).ok, true);
  }
  const A = S.session.members.get('a'), B = S.session.members.get('b');
  assert.equal(A.run.coreTags.length, 1);
  assert.equal(B.run.coreTags.length, 3);
  assert.ok(registriesForClassMastery(source, B.run).classes.get('reaver').cardPool.length > registriesForClassMastery(source, A.run).classes.get('reaver').cardPool.length);
  const view = S.snapshot().party.find(m => m.id === 'b');
  assert.equal(view.classMasteryState.version, 1);
  assert.equal(view.skills['class:reaver'].level, 5);
  const restored = restoreSession(source, S.serialize());
  assert.equal(restored.session.members.get('b').run.classMasteryState.bankable, false);
  const saves = createSaveManager(createMemoryStorage());
  assert.equal(saves.bankClassMastery(B.run, source).changed, false);
  // Replay a final quest exchange at its frozen position through the actual catch-up door.
  A.catchup.push({ type: 'event', eventId: 'namelessRest', open: [0], act: 1, floor: 0, mapNodeId: null });
  assert.equal(S.resolveCatchup('a', 0, { choiceIndex: 0 }).ok, true);
  assert.equal(A.run.classMasteryState.earnedXp.reaver, 10);
});

test('fight pay replaces old class awards and claimed unlocks join live pools immediately', () => {
  const saves = createSaveManager(createMemoryStorage());
  const { run, reg } = active();
  for (let fight = 0; fight < 5; fight++) assert.equal(awardClassXp(reg, run, { victory: true, bank: true }).gained, 10);
  assert.equal(claimBankedSkillLevel(reg, run, 'class:reaver').after, 1);
  const bank = saves.bankClassMastery(run, reg);
  assert.equal(bank.ok, true);
  adoptClassMasteryProfile(run, bank.meta);
  const row = source.classMastery.find(row => row.classId === 'reaver' && row.level === 1);
  assert.ok(reg.classes.get('reaver').cardPool.includes(row.ref));
  assert.equal(saves.loadMeta().classMastery.reaver.level, 1);
  assert.equal(awardClassXp(reg, run, { victory: true, pool: 'elite', bank: true }).gained, 25);
  assert.equal(awardClassXp(reg, run, { victory: true, pool: 'boss', bank: true }).gained, 50);
  assert.equal(claimBankedSkillLevel(reg, run, 'class:reaver').after, 2);
  assert.equal(saves.bankClassMastery(run, reg).meta.classMastery.reaver.xp, 125);
  const outfit = source.classMastery.find(row => row.classId === 'reaver' && row.level === 2);
  assert.ok(reg.equipment.armour.some(item => `armor/${item.classId}/${item.id}` === outfit.ref));
  const next = active('herald', saves.loadMeta(), 'herald-run');
  assert.ok(next.reg.equipment.armour.some(item => `armor/${item.classId}/${item.id}` === outfit.ref));
  const resumed = active('reaver', saves.loadMeta(), 'reaver-again').run;
  assert.equal(resumed.skills['class:reaver'].level, 2);
  assert.equal(resumed.skills['class:reaver'].xp, 125 - masterySpentXp(source, 2));
});

test('mastery five gives one new pick per opened tier, with no picks carried to another run', () => {
  for (const cls of source.classes.all()) {
    const meta = freshMeta();
    meta.classMastery[cls.id] = { level: 5, xp: masterySpentXp(source, 5), unlockedRows: source.classMastery.filter(row => row.classId === cls.id && row.level <= 5).map(masteryRowId) };
    const { run, reg } = active(cls.id, meta);
    assert.deepEqual(run.classMasteryState.initialTreeTiers, [1, 2, 3]);
    while (run.classMasteryState.initialTreeTiers.length) {
      const choices = initialClassTreeChoices(reg, run);
      assert.ok(choices.length, `${cls.id} has a legal node for each open tier`);
      assert.equal(pickInitialClassTreeNode(reg, run, choices[0]), true);
    }
    assert.equal(run.coreTags.length, 3);
    assert.deepEqual(active(cls.id, meta, 'next-run').run.coreTags, []);
  }
});

test('swap uses the new class mastery and no back-dated reward queue', () => {
  const meta = freshMeta();
  meta.classMastery.herald = { level: 5, xp: masterySpentXp(source, 5) + 12, unlockedRows: [] };
  const { run, reg } = active('reaver', meta);
  swapRunClass(reg, run, 'herald');
  assert.deepEqual(run.skills['class:herald'], { xp: 12, level: 5, pendingDrafts: 0 });
  assert.equal(run.classRewardLevels.herald, 5);
  assert.equal(trainingPlan(reg, run, 'class:herald').ok, false);
  assert.equal(redistributePlan(reg, run, 'class:herald', 1).ok, false);
});

test('books and sealed/draft content use complete tables and malformed mastery saves are refused', () => {
  const { run, reg } = active();
  const locked = source.classMastery.find(row => row.kind === 'cards' && source.cards.get(row.ref).rarity === 'common');
  assert.ok(bookLessons(reg, run, { learnAny: true, skill: '*' }, 'item:blade').some(choice => choice.id === locked.ref));
  run.classMasteryState.fullPools = true;
  assert.deepEqual(reg.classes.get('reaver').cardPool, source.classes.get('reaver').cardPool);
  const saved = JSON.parse(serializeRun(run));
  saved.classMasteryState.earnedXp.reaver = -1;
  assert.throws(() => deserializeRun(JSON.stringify(saved)), /classMasteryState.earnedXp/);
});
