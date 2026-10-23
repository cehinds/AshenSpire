import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { commitCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { recordSkillXp, skillXpReceipt, settleConfiguredSkillProgression } from '../src/engine/skillXp.js';
import { awardSkillXp, xpToNext } from '../src/model/skills.js';
import { configuredSkillProgression, configuredCharacterLevels, skillLevelNotices, acknowledgeSkillLevelNotices, acknowledgeVictoryReceipt } from '../src/model/gameProfileProgression.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { mountGameProfileLevelUp } from '../src/ui/components/gameProfileLevelUp.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { gameProfileRewardOffers } from '../src/model/gameProfileRewards.js';
import { readFileSync } from 'node:fs';
import { runCombatEnd } from '../src/engine/runCombat.js';
import { isConfiguredRun } from '../src/model/gameProfileRun.js';
import { gameModule } from '../src/model/gameProfile.js';
import { skillKindOf } from '../src/model/skills.js';
import { featMultiplier } from '../src/model/feats.js';
import { awardLevelXp, pendingLevelCount, combatXpReceipt } from '../src/model/levelup.js';
import { combatXpGains } from '../src/model/rewardprogress.js';
import { validateRunShape } from '../src/model/state.js';
import { mountRewards } from '../src/ui/screens/reward.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { withModalDom } from './helpers/modal-dom.mjs';

const profile = resolveGameProfile('core');
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function live(classId = 'reaver') {
  const run = createRunState({ registries: reg, seed: 511, classId,
    profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  // A second, different group must not gain XP merely by being equipped.
  run.loadout.sets.leftHand[0] = 'roundShield';
  const combat = createRunCombat({ registries: reg, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
  return { run, combat };
}
function play(combat, id, extra = {}) {
  const card = Object.values(combat.piles).flat().find(card => card.cardId === id);
  assert.ok(card, id);
  for (const pile of Object.values(combat.piles)) {
    const at = pile.indexOf(card);
    if (at >= 0) pile.splice(at, 1);
  }
  Object.assign(card, extra);
  combat.piles.hand.push(card);
  combat.player.energy = combat.player.energyMax;
  combat.player.stamina = combat.player.maxStamina;
  combat.player.mana = combat.player.maxMana;
  return dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId,
    ...(id === 'core.strike' ? { targetId: combat.enemies[0].id } : {}) });
}

test('live Core implicit Strike pays its used weapon group; previews and unused offhand pay nothing', () => {
  const { combat } = live();
  const card = combat.piles.hand.find(card => card.cardId === 'core.strike');
  const before = structuredClone(combat.skillXp);
  if (card) previewCard(combat, card.instanceId, combat.enemies[0].id);
  assert.deepEqual(combat.skillXp, before);
  play(combat, 'core.strike');
  const hit = combat.eventLog.find(event => event.type === 'damageDealt' && event.sourceId === 'player');
  assert.equal(hit.usedArmamentId, 'greatsword');
  assert.deepEqual(combat.skillXp.player.usedArmaments, ['greatsword']);
  const committed = combat.eventLog.find(event => event.type === 'cardPlayed').cardInstance;
  assert.equal(committed.usedArmamentId, 'greatsword');
  assert.equal(committed.sourceArmamentId, undefined, 'receipt identity cannot alter rating scope');
  assert.equal(hit.amount, 9, 'attribution does not scope or change the existing damage rating');
  assert.ok(skillXpReceipt(combat)['item:blade'] > 0);
  assert.equal(skillXpReceipt(combat)['item:shield'], undefined);
  recordSkillXp(combat, { type: 'combatEnd', victory: true });
  assert.equal(skillXpReceipt(combat)['item:shield'], undefined);
});

test('an explicitly used offhand pays that group, and a granted utility card records its lending focus', () => {
  const { combat } = live();
  play(combat, 'core.strike', { sourceHand: 'left' });
  assert.ok(skillXpReceipt(combat)['item:shield'] > 0);
  assert.equal(skillXpReceipt(combat)['item:blade'], undefined);
  const { combat: herald } = live('herald');
  play(herald, 'core.manaSurge');
  assert.deepEqual(herald.skillXp.player.xp, { 'item:magic-focus': 0 });
  recordSkillXp(herald, { type: 'combatEnd', victory: true });
  assert.ok(skillXpReceipt(herald)['item:magic-focus'] > 0);
  assert.equal(skillXpReceipt(herald)['item:shield'], undefined);
});

test('a physical Strike that resolves unarmed does not credit the held focus for its aggregate AR', () => {
  for (const extra of [{}, { sourceHand: 'right' }]) {
    const { combat } = live('herald');
    combat.piles.hand.push({ instanceId: 'earned-strike', cardId: 'core.strike', upgraded: false });
    play(combat, 'core.strike', extra);
    recordSkillXp(combat, { type: 'combatEnd', victory: true });
    assert.equal(skillXpReceipt(combat)['item:magic-focus'], undefined);
    assert.equal(combat.eventLog.find(event => event.type === 'cardResolved').usedArmamentId, null);
  }
});

test('an unarmed Counter keeps explicit null on its Block event and never credits the held focus', () => {
  const { combat } = live('herald');
  combat.piles.hand.push({ instanceId: 'earned-counter', cardId: 'core.counter', upgraded: false });
  play(combat, 'core.counter', { sourceHand: 'right' });
  const block = combat.eventLog.find(event => event.type === 'blockGained');
  assert.ok(block, 'the real Counter resolves its authored Block');
  assert.equal(Object.hasOwn(block, 'usedArmamentId'), true);
  assert.equal(block.usedArmamentId, null);
  assert.equal(combat.eventLog.find(event => event.type === 'cardResolved').usedArmamentId, null);
  recordSkillXp(combat, { type: 'combatEnd', victory: true });
  assert.equal(skillXpReceipt(combat)['item:magic-focus'], undefined);
  assert.equal(combat.skillXp.player?.usedArmaments, undefined);
});

test('source receipt metadata leaves actual Strike damage identical with progression disabled', () => {
  const disabledProfile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { progression: false } });
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, disabledProfile)), disabledProfile);
  const run = createRunState({ registries, seed: 511, classId: 'reaver' });
  run.loadout.sets.leftHand[0] = 'roundShield';
  const control = createRunCombat({ registries, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
  const { combat } = live();
  play(control, 'core.strike'); play(combat, 'core.strike');
  const hit = state => state.eventLog.find(event => event.type === 'damageDealt');
  for (const field of ['amount', 'blocked', 'hpLoss', 'poiseMitigated', 'wardMitigated']) assert.equal(hit(combat)[field], hit(control)[field], field);
  assert.equal(control.enemies[0].hp, combat.enemies[0].hp);
  assert.deepEqual(control.rng.getCounters(), combat.rng.getCounters());
  assert.equal(hit(control).usedArmamentId, 'greatsword', 'action identity remains available when XP is disabled');
  assert.deepEqual(skillXpReceipt(control), {});
  assert.equal(hit(combat).usedArmamentId, 'greatsword');
});

test('used groups survive a real checkpoint and late receipts keep the committed source after swapping', () => {
  const { run, combat } = live();
  play(combat, 'core.strike');
  const before = skillXpReceipt(combat)['item:blade'];
  commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
  const invalid = structuredClone(run.combatEntered.snapshot);
  invalid.skillXp.player.usedArmaments = ['greatsword', 'greatsword'];
  assert.ok(combatSnapshotProblems(invalid).some(problem => problem.includes('usedArmaments')));
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run, combat.rng);
  const loaded = saves.loadRun(reg);
  assert.ok(loaded, JSON.stringify(saves.runStatus()));
  const resumed = restoreCombatSnapshot({ registries: reg, rng: createRng(run.seed), expectedGameProfile: loaded.gameProfile, snapshot: loaded.combatEntered.snapshot });
  resumed.loadout.sets.rightHand[0] = 'boneSceptre';
  assert.deepEqual(resumed.skillXp.player.usedArmaments, ['greatsword']);
  assert.equal(resumed.eventLog.find(event => event.type === 'cardPlayed').cardInstance.usedArmamentId, 'greatsword', 'the committed identity survives resume and a later swap');
  resumed.emit('damageDealt', { sourceId: 'player', targetId: resumed.enemies[0].id, amount: 1, usedArmamentId: 'greatsword', sourceHand: 'right' });
  resumed.emit('combatEnd', { victory: true });
  assert.ok(skillXpReceipt(resumed)['item:blade'] > before);
  assert.equal(skillXpReceipt(resumed)['item:magic-focus'], undefined);
  assert.equal(skillXpReceipt(resumed)['item:shield'], undefined);
});

test('actual crossings use authored curves without legacy queues or extra configured reward rolls', () => {
  const { run, combat } = live();
  run.skills['item:blade'] = { level: 0, xp: xpToNext(reg, 'weapon', 0) - 1, pendingDrafts: 0 };
  run.skills['class:reaver'] = { level: 0, xp: xpToNext(reg, 'class', 0) - 1, pendingDrafts: 0 };
  play(combat, 'core.strike');
  const counters = combat.rng.getCounters();
  const awards = settleConfiguredSkillProgression(reg, run, combat, { victory: true });
  assert.deepEqual(combat.rng.getCounters(), counters, 'numeric skill progression consumes no reward RNG');
  assert.equal(run.skills['item:blade'].level, 1);
  assert.equal(run.skills['class:reaver'].level, 1);
  assert.equal(run.skills['item:shield'], undefined);
  const progression = skillLevelNotices(reg, [awards.classAward, ...awards.trackAwards], { usedArmaments: combat.skillXp.player.usedArmaments });
  assert.deepEqual(progression.map(row => row.skillId), ['class:reaver', 'item:blade']);
  assert.deepEqual(progression[1].weapons, ['Greatsword']);
  assert.equal(run.skills['item:blade'].pendingDrafts, 0);
  assert.equal(run.skills['class:reaver'].pendingDrafts, 0);
  assert.equal(run.gameProfileRewardOffers, undefined);
  // Cross the higher cadences too: no inaccessible ranks, feats or attributes.
  awardSkillXp(reg, run, 'item:blade', 10000, { queueRewards: false });
  assert.deepEqual(Object.keys(run.skills['item:blade']).sort(), ['level', 'pendingDrafts', 'xp']);
  const ledger = structuredClone(run.skills);
  assert.deepEqual(settleConfiguredSkillProgression(reg, run, combat, { victory: true }), { trackAwards: [], classAward: null });
  assert.deepEqual(run.skills, ledger, 'a duplicated terminal callback cannot pay the same combat twice');
  const control = structuredClone(run);
  const rewardRng = createRng(811), controlRng = createRng(811);
  assert.deepEqual(gameProfileRewardOffers(reg, run, rewardRng, { offerId: 'same' }), gameProfileRewardOffers(reg, control, controlRng, { offerId: 'same' }));
  assert.deepEqual(rewardRng.getCounters(), controlRng.getCounters());
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run, combat.rng);
  assert.deepEqual(saves.loadRun(reg)?.skills, run.skills, 'crossed levels and empty unsupported queues survive the real save door');
});

test('the summary survives save/load, acknowledges once, and cannot reopen after acknowledgement', () => {
  const { run } = live();
  const rows = skillLevelNotices(reg, [{ skillId: 'class:reaver', before: 0, after: 1, levelUps: 1 }, { skillId: 'item:blade', before: 0, after: 2, levelUps: 2 }], { usedArmaments: ['greatsword'] });
  assert.deepEqual(skillLevelNotices(reg, [{ skillId: 'item:blade', levelUps: 0 }]), []);
  run.gameProfilePendingReward = { offerId: 'notice', source: 'combat', after: 'map', levelOffers: 0, progression: rows };
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run, createRng(run.seed));
  const loaded = saves.loadRun(reg);
  assert.ok(loaded, JSON.stringify(saves.runStatus()));
  withModalDom(() => {
    const app = document.createElement('main'); document.body.append(app);
    let continued = 0;
    mountGameProfileLevelUp(app, { rows: loaded.gameProfilePendingReward.progression, onContinue() {
      acknowledgeSkillLevelNotices(loaded.gameProfilePendingReward); continued++;
      saves.saveRun(loaded, createRng(run.seed));
    } });
    assert.match(app.querySelector('[data-skill="class:reaver"]').textContent, /Level 0 → 1/);
    assert.match(app.querySelector('[data-skill="item:blade"]').textContent, /Level 0 → 2/);
    assert.match(app.querySelector('[data-skill="item:blade"]').textContent, /Greatsword \(Blade group\)/);
    assert.equal(app.querySelector('.reward-door').dataset.size, 'md', 'keep the shared modal width when adding receipt attributes');
    const done = app.querySelector('#reward-level-continue');
    done.click(); done.click();
    assert.equal(continued, 1);
    assert.equal(saves.loadRun(reg).gameProfilePendingReward.progression, undefined);
  });
});

test('Legacy/Current keep existing XP reward queues; disabled configured progression stays off', () => {
  const legacy = createRegistries(contentBundle);
  const run = createRunState({ registries: legacy, seed: 511, classId: 'reaver' });
  assert.equal(configuredSkillProgression(run), false);
  awardSkillXp(legacy, run, 'item:blade', xpToNext(legacy, 'weapon', 0));
  assert.equal(run.skills['item:blade'].pendingDrafts, 1);
  const { combat } = live();
  const disabled = { ...combat, gameProfile: { ...combat.gameProfile, modules: { ...combat.gameProfile.modules, progression: undefined } }, skillXp: {} };
  recordSkillXp(disabled, { type: 'damageDealt', sourceId: 'player', targetId: disabled.enemies[0].id, amount: 10, usedArmamentId: 'greatsword' });
  assert.deepEqual(disabled.skillXp, {});
});

test('actual main defeat settlement persists earned weapon notice, resumes once, then finishes the loss', async () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const body = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
  const { run, combat } = live();
  run.skills['item:blade'] = { level: 0, xp: xpToNext(reg, 'weapon', 0) - 1, pendingDrafts: 0 };
  play(combat, 'core.strike');
  combat.player.hp = 0;
  run.combatPendingOutcome = { result: 'defeat' };
  const saves = createSaveManager(createMemoryStorage());
  const screens = [], notices = [], deps = { runCombatEnd, isConfiguredRun, configuredSkillProgression, configuredCharacterLevels,
    skillXpReceipt, skillKindOf, featMultiplier, settleConfiguredSkillProgression, skillLevelNotices,
    pendingLevelCount, combatXpReceipt, gameModule, awardLevelXp, combatXpGains, acknowledgeSkillLevelNotices, acknowledgeVictoryReceipt };
  const make = run => new Function('deps', 'run', 'combat', 'registries', 'saves', 'screens', 'notices', `
    const { ${Object.keys(deps).join(', ')} } = deps;
    const activeSlot = 1, rng = combat.rng, app = {}; let xpCombat = combat;
    const persist = () => saves.saveRun(run, rng);
    const audio = { stopMusic() {} }, sfx = { play() {} }, sendLanStatus = () => {};
    const rollLevelChoices = () => [], showFinishedRun = victory => screens.push(victory);
    const showMap = () => { throw Error('Defeat cannot return to map'); };
    const advanceAct = () => { throw Error('Defeat cannot advance act'); };
    const gameProfileRewardOffers = () => { throw Error('Defeat cannot roll rewards'); };
    const mountGameProfileLevelUp = (_app, model) => notices.push(model);
    ${body('async function onCombatEnd(', '\n/**\n * The spoils')}
    ${body('function beginGameProfileReward(', '\nfunction showShop(')}
    return { settle: () => onCombatEnd('defeat', combat, { pool: 'normal' }), resume: showGameProfileReward,
      emptyDefeat: () => beginGameProfileReward({ after: 'defeat', noticeOnly: true }) };
  `)(deps, run, combat, reg, saves, screens, notices);
  const main = make(run);
  await main.settle();
  assert.equal(run.skills['item:blade'].level, 1);
  assert.equal(run.skills['class:reaver']?.level || 0, 0, 'loss does not invent class XP');
  assert.deepEqual(screens, [], 'the earned notice precedes the finished loss');
  assert.equal(notices.length, 1);
  assert.equal(run.gameProfilePendingReward.after, 'defeat');
  assert.equal(run.gameProfilePendingReward.noticeOnly, true);
  const loaded = saves.loadRun(reg);
  assert.ok(loaded, saves.runStatus().reason);
  assert.equal(loaded.hp, 0);
  assert.equal(loaded.combatPendingOutcome, undefined);
  assert.equal(loaded.combatEntered, null);
  const ledger = structuredClone(loaded.skills);
  await main.settle();
  assert.equal(notices.length, 1, 'duplicate terminal callback cannot redisplay or pay');
  const resumed = make(loaded);
  resumed.resume();
  assert.equal(notices.length, 2);
  assert.match(notices[1].rows[0].weapons.join(', '), /Greatsword/);
  notices[1].onContinue();
  assert.deepEqual(screens, [false]);
  assert.equal(saves.loadRun(reg).gameProfilePendingReward, undefined);
  assert.deepEqual(saves.loadRun(reg).skills, ledger, 'resume and acknowledgement cannot repay XP');
  assert.equal(loaded.gameProfileRewardOffers, undefined);
  for (const change of [{ noticeOnly: false }, { source: 'level' }, { levelOffers: 1 }]) {
    const invalid = { ...run, gameProfilePendingReward: { ...run.gameProfilePendingReward, ...change } };
    assert.ok(validateRunShape(invalid).some(problem => /Defeat progression/.test(problem)));
  }
  resumed.emptyDefeat();
  assert.deepEqual(screens, [false, false], 'a loss without crossings finishes without a notice or map visit');
  assert.equal(loaded.gameProfilePendingReward, undefined);
});

test('Core XP affects only class and used weapon groups with independently configurable rates', () => {
  const settleAt = (multiplier, weaponMultiplier = multiplier) => {
    const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {
      progression: { classXpMultiplier: multiplier, weaponXpMultiplier: weaponMultiplier },
    } });
    const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
    const run = createRunState({ registries, seed: 511, classId: 'reaver' });
    const combat = createRunCombat({ registries, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
    recordSkillXp(combat, { type: 'damageDealt', sourceId: 'player', targetId: combat.enemies[0].id, amount: 10, usedArmamentId: 'greatsword' });
    recordSkillXp(combat, { type: 'impactDealt', targetId: 'player', amount: 1000 });
    recordSkillXp(combat, { type: 'attackEvaded', targetId: 'player' });
    recordSkillXp(combat, { type: 'combatEnd', victory: true });
    const receipt = skillXpReceipt(combat);
    const awards = settleConfiguredSkillProgression(registries, run, combat, { victory: true });
    return { receipt, awards, run };
  };
  const fast = settleAt(1), slow = settleAt(0.5), off = settleAt(0), weaponOnlySlow = settleAt(1, 0.5);
  assert.equal(weaponOnlySlow.awards.classAward.gained, fast.awards.classAward.gained);
  assert.equal(weaponOnlySlow.awards.trackAwards[0].gained, slow.awards.trackAwards[0].gained);
  assert.deepEqual(slow.receipt, fast.receipt, 'rate changes settlement, never combat receipt attribution');
  assert.equal(slow.awards.classAward.gained, Math.floor(fast.awards.classAward.gained / 2));
  assert.equal(slow.awards.trackAwards[0].gained, Math.floor(fast.awards.trackAwards[0].gained / 2));
  assert.deepEqual(Object.keys(slow.run.skills).sort(), ['class:reaver', 'item:blade']);
  assert.equal(off.awards.classAward, null);
  assert.equal(off.awards.trackAwards[0].gained, 0);
  assert.equal(gameModule(profile, 'progression').weaponXpMultiplier, 1);
});

test('old snapshots keep their original rate and invalid authored rates are refused', async () => {
  const { configuredSkillXpMultiplier } = await import('../src/model/gameProfileProgression.js');
  assert.equal(configuredSkillXpMultiplier({ gameProfile: { modules: { progression: { mode: 'configured' } } } }), 1);
  for (const weaponXpMultiplier of [-1, 11, 'slow']) assert.throws(() => resolveGameProfile({
    formatVersion: 1, core: 'ashen.core@2.0.0', modules: { progression: { weaponXpMultiplier } },
  }));
});


test('Core skill-only policy preserves earned character ledgers and blocks old snapshot character leveling', async () => {
  const { coreSkillOnlyProgression, CORE_PROGRESSION_POLICY_VERSION } = await import('../src/model/gameProfileProgression.js');
  const { previewGameProfileRest, beginGameProfileRest } = await import('../src/model/gameProfileRest.js');
  const { gameProfileRestModel } = await import('../src/ui/models/GameProfileRestModel.js');
  const { run } = live();
  const old = structuredClone(run);
  old.gameProfile.modules.progression.characterLevels = true;
  old.level = { level: 3, xp: 200, unspentPoints: 2 };
  const earned = structuredClone({ level: old.level, attributes: old.attributes });
  assert.equal(CORE_PROGRESSION_POLICY_VERSION, 1);
  assert.equal(coreSkillOnlyProgression(old), true);
  assert.equal(configuredCharacterLevels(old), false);
  assert.equal(gameModule(profile, 'progression').characterLevels, false);
  old.mapNodeId = 'rest-test';
  old.mapGraph = { nodes: { 'rest-test': { id: 'rest-test', type: 'shrine', actualType: 'rest' } } };
  const visit = beginGameProfileRest(old);
  assert.equal(gameProfileRestModel(reg, old, visit).services.some(row => row.id === 'levelUp'), true, 'already earned attributes remain claimable');
  assert.equal(previewGameProfileRest(reg, old, 'levelUp', { attributeId: 'strength' }).run.level.unspentPoints, 1);
  const spent = structuredClone(old); spent.level.unspentPoints = 0;
  assert.throws(() => previewGameProfileRest(reg, spent, 'levelUp', { attributeId: 'strength' }), /leveling is disabled/);
  assert.equal(gameProfileRestModel(reg, spent, visit).services.some(row => row.id === 'levelUp'), false);
  assert.deepEqual({ level: old.level, attributes: old.attributes }, earned);
  assert.equal(configuredCharacterLevels({ gameProfile: resolveGameProfile('current') }), true);
});

test('a pending Core opening survives the normal save door without changing earned progression', () => {
  const { run } = live();
  run.prologue = { version: 2, status: 'pending', scene: 0 };
  const skills = structuredClone(run.skills);
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run, createRng(run.seed));
  const loaded = saves.loadRun(reg);
  assert.ok(loaded, JSON.stringify(saves.runStatus()));
  assert.deepEqual(loaded.prologue, run.prologue);
  assert.deepEqual(loaded.skills, skills);
});


test('Core Victory bars resume the paid slow-rate receipt and Continue acknowledges once without paying XP', () => {
  const { run, combat } = live();
  recordSkillXp(combat, { type: 'damageDealt', sourceId: 'player', targetId: combat.enemies[0].id, amount: 10, usedArmamentId: 'greatsword' });
  recordSkillXp(combat, { type: 'combatEnd', victory: true });
  const before = structuredClone(run.skills);
  const awards = settleConfiguredSkillProgression(reg, run, combat, { victory: true });
  const gains = combatXpGains({ awards: [awards.classAward, ...awards.trackAwards] });
  assert.equal(gains.level, 0);
  assert.equal(gains.tracks['item:blade'], awards.trackAwards[0].gained);
  assert.equal(gains.tracks['item:shield'], undefined);
  run.gameProfilePendingReward = { offerId: 'battle', source: 'combat', after: 'map', levelOffers: 0,
    victoryReceipt: { title: 'Victory', xpGains: gains, xpBefore: { tracks: before } } };
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run, createRng(run.seed));
  const loaded = saves.loadRun(reg);
  assert.ok(loaded, saves.runStatus().reason);
  const paid = structuredClone(loaded.skills);
  const pending = loaded.gameProfilePendingReward;
  assert.throws(() => acknowledgeVictoryReceipt(pending, () => { throw Error('save refused'); }), /save refused/);
  assert.ok(pending.victoryReceipt, 'a failed save retains the receipt');
  withKitDom(({ document }) => {
    document.documentElement ??= document.body;
    document.body.classList.add('reduced-motion');
    const app = document.createElement('main'); document.body.append(app);
    let continues = 0;
    mountRewards(app, { registries: reg, run: loaded, rewards: pending.victoryReceipt, receiptOnly: true,
      onDone() {
        // Reentrant activation during a screen transition cannot acknowledge twice.
        app.querySelector('#reward-continue').click();
        acknowledgeVictoryReceipt(pending, () => saves.saveRun(loaded, createRng(loaded.seed)));
        continues++;
      } });
    assert.equal(app.querySelectorAll('.reward-progress-row').length, 2);
    assert.equal(app.querySelector('[data-track="character"]'), null);
    assert.ok(app.querySelector('[role="progressbar"][data-track="class:reaver"]'));
    assert.ok(app.querySelector('[role="progressbar"][data-track="item:blade"]'));
    const done = app.querySelector('#reward-continue'); done.click(); done.click();
    assert.equal(continues, 1);
    assert.equal(saves.loadRun(reg).gameProfilePendingReward.victoryReceipt, undefined);
    assert.deepEqual(saves.loadRun(reg).skills, paid);
    assert.equal(acknowledgeVictoryReceipt(pending, () => { throw Error('already done'); }), false);
  });
});
