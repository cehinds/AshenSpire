// tests/reward-progress.test.mjs — the spoils door's progression panel.
//
// Constantine, 2026-09-20: "why don't I see level progression, xp gained,
// skill progression in here either". The fight pays the character level and
// every skill track it touched BEFORE the door opens, so the numbers can only
// come from a receipt the offer carries. These checks hold both halves: the
// derivation (model/rewardprogress.js) and the panel the door draws from it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardProgress, combatXpGains } from '../src/model/rewardprogress.js';
import { awardSkillXp, bankSkillXp, claimBankedSkillLevel, pendingSkillLevelCount, xpToNext as skillXpToNext } from '../src/model/skills.js';
import { awardLevelXp, claimBankedLevel, xpToNext as levelXpToNext } from '../src/model/levelup.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape, serializeRun, deserializeRun } from '../src/model/state.js';
import { mountRewards } from '../src/ui/screens/reward.js';
import { rewardDom } from './helpers/reward-dom.mjs';

const registries = createRegistries(contentBundle);

const climber = () => ({
  class: 'reaver',
  cinders: 0, deck: [], flasks: [], relics: [], coreTags: [], loadout: { storage: [] },
  level: { xp: 40, level: 3, unspentPoints: 0 },
  skills: {
    'item:blade': { xp: 12, level: 2, pendingDrafts: 0 },
    'armour:heavy': { xp: 5, level: 1, pendingDrafts: 0 },
    'class:reaver': { xp: 20, level: 1, pendingDrafts: 0 },
    'item:shield': { xp: 3, level: 0, pendingDrafts: 0 },
  },
});

test('the character row reads the run ledger and the fight\'s own gain', () => {
  // The ledger sits partway into the level-3 step of the stock curve, and the
  // fight paid part of it, so the bar is neither empty nor full whatever the
  // curve's base is.
  const step = levelXpToNext(registries, 3);
  const run = { ...climber(), level: { xp: Math.floor(step / 2), level: 3, unspentPoints: 0 } };
  const gained = Math.max(1, Math.floor(step / 4));
  const { character } = rewardProgress(registries, run, { level: gained, tracks: {} });
  assert.equal(character.label, 'Reaver', 'the class names the character row');
  assert.deepEqual([character.level, character.xp, character.gained], [3, Math.floor(step / 2), gained]);
  assert.equal(character.xpToNext, step, 'the row quotes the curve\'s own step');
  assert.ok(character.xpToNext > 0 && character.fraction > 0 && character.fraction < 1);
  assert.equal(character.capped, false);
});

test('asked without a receipt, the derivation still reads the standing ledgers', () => {
  const run = climber();
  const progress = rewardProgress(registries, run, null);
  assert.equal(progress.character.gained, 0);
  assert.deepEqual(progress.skills.map((row) => row.gained), [0, 0, 0, 0]);
});

test('a track whose curve will not read is dropped, never shown as capped', () => {
  // balance.skill.xp is the weapon/armour/focus curve; the class track reads
  // balance.skill.class.xp, and the character level a third table again.
  const noSkillCurve = { ...registries, balance: { ...registries.balance, skill: { ...registries.balance.skill, xp: null } } };
  const progress = rewardProgress(noSkillCurve, climber(), { level: 5, tracks: { 'item:blade': 9 } });
  assert.deepEqual(progress.skills.map((row) => row.id), ['class:reaver'],
    'no curve, no row — "Max" would be a broken table reading as a ceiling, even for the track the fight paid');
  assert.ok(progress.character, 'the character curve is a different table and still reads');
  const noLevelCurve = { ...registries, balance: { ...registries.balance, level: { xp: {} }, levelUp: { ...registries.balance.levelUp, maxLevels: null } } };
  assert.ok(rewardProgress(noLevelCurve, climber(), null).character.xpToNext > 0,
    'an empty curve table falls back to the authored defaults rather than dropping the row');
  assert.ok(progress.skills.every((row) => row.capped || row.xpToNext > 0));
});

test('the tracks this fight paid lead, and every active skill has a bar', () => {
  const run = climber();
  const progress = rewardProgress(registries, run, { level: 10, tracks: { 'item:shield': 9, 'class:reaver': 4 } });
  assert.deepEqual(progress.skills.map((row) => row.id), ['item:shield', 'class:reaver', 'item:blade', 'armour:heavy'],
    'paid first, biggest gain leading; the deepest untouched track after');
  assert.equal(progress.hidden, 0, 'the fourth active track has its own bar');
  assert.equal(progress.skills[0].kind, 'weapon');
  assert.equal(progress.skills[1].kind, 'class');
});

test('only the run\'s own class track is a row, and an untouched track never is', () => {
  const run = climber();
  run.skills['class:rogue'] = { xp: 90, level: 5, pendingDrafts: 0 }; // another class's ledger
  const ids = rewardProgress(registries, run, null, { maxSkills: 99 }).skills.map((row) => row.id);
  assert.ok(!ids.includes('class:rogue'), 'a class you are not playing is not your progression');
  assert.ok(ids.includes('class:reaver'));
  assert.ok(!ids.includes('dualWield'), 'a track never touched and never paid is not a row');
});

test('a capped character level points at no next level and fills its bar', () => {
  const capped = { ...registries, balance: { ...registries.balance, levelUp: { ...registries.balance.levelUp, maxLevels: 3 } } };
  const { character } = rewardProgress(capped, climber(), { level: 5, tracks: {} });
  assert.deepEqual([character.capped, character.xpToNext, character.fraction], [true, null, 1]);
});

test('a stub run with no class and no ledgers derives nothing — the panel is absent, not empty', () => {
  const progress = rewardProgress(registries, { cinders: 0, deck: [], flasks: [], relics: [] }, null);
  assert.equal(progress.character, null);
  assert.deepEqual(progress.skills, []);
});

test('the award receipts carry the XP they paid, which is what the door shows', () => {
  const run = climber();
  assert.equal(awardSkillXp(registries, run, 'item:blade', 7).gained, 7);
  assert.equal(awardSkillXp(registries, run, 'item:blade', 0).gained, 0);
  assert.equal(awardLevelXp(registries, run, 12).gained, 12);
  assert.equal(awardLevelXp(registries, run, -3).gained, 0);
});

test('the receipt sums the combat\'s tracks with the owner\'s own awards', () => {
  // What main.js composes at onCombatEnd: the fight's per-track receipt, the
  // class award the combat cannot make, and the character level's pay.
  const gains = combatXpGains({
    receipt: { 'item:blade': 18, 'armour:heavy': 6 },
    awards: [{ skillId: 'class:reaver', gained: 10 }, null],
    levelGained: 24,
  });
  assert.deepEqual(gains, { level: 24, tracks: { 'item:blade': 18, 'armour:heavy': 6, 'class:reaver': 10 } });
  assert.deepEqual(
    combatXpGains({ receipt: { 'class:reaver': 4 }, awards: [{ skillId: 'class:reaver', gained: 10 }], levelGained: 0 }),
    { level: 0, tracks: { 'class:reaver': 14 } },
    'a track paid twice is summed, not replaced — both payments happened',
  );
  // A lost fight, an award that paid nothing, and a caller that hands none.
  assert.deepEqual(combatXpGains({ awards: [{ skillId: 'class:reaver', gained: 0 }], levelGained: -5 }), { level: 0, tracks: {} });
  assert.deepEqual(combatXpGains(), { level: 0, tracks: {} });
});

test('the receipt crosses the save door on a real run and comes back whole', () => {
  const run = createRunState({ seed: 0x5170, classId: 'reaver', registries });
  run.pendingReward = {
    schemaVersion: 1,
    source: 'elite',
    after: 'map',
    rewards: { title: 'VICTORY', cinders: 32, xpGains: combatXpGains({ receipt: { 'item:blade': 18 }, levelGained: 24 }) },
    states: {},
    chosenCardId: null,
    chosenDraftCardIds: {},
    chosenDraftNodeIds: {},
  };
  assert.deepEqual(validateRunShape(run), [], 'the load door accepts an offer carrying the receipt');
  const back = deserializeRun(serializeRun(run));
  assert.deepEqual(back.pendingReward.rewards.xpGains, { level: 24, tracks: { 'item:blade': 18 } },
    'a reload resumes the same numbers the door first showed');
});

test('the door draws the panel beside the claim status, gains and all', () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main');
    document.body.append(app);
    const run = climber();
    mountRewards(app, {
      registries, run, onDone() {},
      rewards: { cinders: 59, xpGains: { level: 25, tracks: { 'item:blade': 8 } } },
    });
    const rows = [...app.querySelectorAll('.reward-progress-row')];
    assert.equal(rows.length, 5, 'the character level and every active skill track');
    assert.equal(rows[0].dataset.kind, 'character');
    const text = (row, cls) => row.children.find((child) => child.className.includes(cls))?.textContent;
    assert.equal(text(rows[0], 'rp-name'), undefined, 'the character line has no extra label');
    assert.equal(text(rows[0], 'rp-level'), 'Level 3');
    assert.equal(text(rows[0], 'rp-next'), 'Level 4');
    assert.equal(text(rows[0], 'rp-gain'), undefined, 'the character line stays on one row');
    assert.equal(text(rows[1], 'rp-gain'), 'Gained: 8 xp', 'the track the fight paid leads the skills');
    assert.equal(rows[2].dataset.gained, '0', 'an unpaid track shows its standing level and no gain');
    assert.equal(text(rows[2], 'rp-gain'), undefined);
    assert.ok(rows.every((row) => row.children.some((child) => child.className.includes('rp-layered-bar'))), 'every row carries its layered bar');
    assert.equal(app.querySelector('.reward-side .reward-claim-status'), null, 'the compact progression column does not repeat every reward');
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('banked XP lights the bar; Level advances one level and opens its card chooser', () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main');
    document.body.append(app);
    const run = climber();
    run.level.xp = levelXpToNext(registries, 3) + 25;
    const before = run.deck.length;
    mountRewards(app, {
      registries, run, onDone() {}, onClaimLevel: () => claimBankedLevel(registries, run),
      rewards: { xpGains: { level: 30, tracks: {} }, levelCards: [{ ordinal: 0, cardIds: ['rend', 'stomp'] }] },
    });
    assert.ok(app.querySelector('.reward-level-ready .rp-bar-ready'));
    const claim = app.querySelector('.reward-level-up');
    assert.equal(claim.textContent, 'Level');
    assert.equal(app.querySelector('[data-kind="levelCard"]'), null, 'the level choice lives beside the XP bar');
    claim.click();
    assert.equal(run.level.level, 4);
    assert.equal(run.level.xp, 25);
    assert.equal(app.querySelectorAll('.reward-row .card').length, 2);
    app.querySelectorAll('.reward-row .card')[0].click();
    app.querySelector('#reward-card-confirm').click();
    assert.equal(run.deck.length, before + 1);
    assert.equal(app.querySelector('.reward-level-up'), null, 'the prompt clears after claiming');
    assert.equal(app.querySelector('.rp-bar-ready'), null, 'the XP bar returns to its normal tone');
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('each ready skill bar claims one level and opens its own draft', () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main');
    document.body.append(app);
    const run = climber();
    const before = run.skills['item:blade'].level;
    bankSkillXp(registries, run, 'item:blade', skillXpToNext(registries, 'weapon', before));
    const xp = run.skills['item:blade'].xp;
    mountRewards(app, {
      registries, run, onDone() {},
      onClaimSkill: (id) => claimBankedSkillLevel(registries, run, id),
      rewards: { xpGains: { level: 0, tracks: { 'item:blade': xp } },
        skillDrafts: [{ skillId: 'item:blade', level: before + 1, claimOrdinal: 1, cardIds: ['rend', 'stomp'] }] },
    });
    const button = app.querySelector('.reward-level-up[data-track="item:blade"]');
    assert.ok(button, 'the active skill has a Level button');
    assert.equal(button.textContent, 'Level');
    button.click();
    assert.equal(run.skills['item:blade'].level, before + 1);
    assert.equal(pendingSkillLevelCount(registries, run, 'item:blade'), 0);
    assert.equal(app.querySelectorAll('.reward-row .card').length, 2);
    app.querySelectorAll('.reward-row .card')[0].click();
    app.querySelector('#reward-card-confirm').click();
    assert.equal(run.skills['item:blade'].pendingDrafts, 0);
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('a claimed character level offers a permanent feat instead of a default card', () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main');
    document.body.append(app);
    const run = climber();
    run.level.xp = levelXpToNext(registries, 3);
    mountRewards(app, {
      registries, run, onDone() {}, onClaimLevel: () => claimBankedLevel(registries, run),
      rewards: { xpGains: { level: 30, tracks: {} }, levelChoices: [{ ordinal: 0, options: [
        { kind: 'feat', id: 'fieldStudy' }, { kind: 'feat', id: 'vitalRenewal' }, { kind: 'feat', id: 'spoilsInstinct' },
      ] }] },
    });
    app.querySelector('.reward-level-up').click();
    assert.equal(run.level.level, 4);
    assert.equal(app.querySelectorAll('.reward-row .reward-node').length, 3);
    app.querySelectorAll('.reward-row .reward-node')[0].click();
    app.querySelector('#reward-card-confirm').click();
    assert.deepEqual(run.feats, ['fieldStudy']);
    assert.equal(run.deck.length, 0, 'the level choice did not add a card');
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('a character level can offer a class-tree choice alongside feats', () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main');
    document.body.append(app);
    const run = climber();
    run.level.xp = levelXpToNext(registries, 3);
    mountRewards(app, {
      registries, run, onDone() {}, onClaimLevel: () => claimBankedLevel(registries, run),
      rewards: { xpGains: { level: 30, tracks: {} }, levelChoices: [{ ordinal: 0, options: [
        { kind: 'feat', id: 'fieldStudy' }, { kind: 'classNode', id: 'ironFooting' },
      ] }] },
    });
    app.querySelector('.reward-level-up').click();
    app.querySelectorAll('.reward-row .reward-node')[1].click();
    app.querySelector('#reward-card-confirm').click();
    assert.deepEqual(run.coreTags, ['ironFooting']);
    assert.deepEqual(run.feats || [], []);
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('a door with no fight behind it draws no progression at all', () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main');
    document.body.append(app);
    // A treasure room's offer, and an offer saved before the receipt existed:
    // both carry no xpGains, and the ledgers below are not this door's news.
    mountRewards(app, { registries, run: climber(), onDone() {}, rewards: { relicId: 'forsakenMedallion' } });
    assert.equal(app.querySelector('.reward-progress'), null);
    assert.ok(app.querySelector('.reward-claim-status'), 'the spoils themselves are untouched');
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('a saved combat reward opens compactly, then Continue reveals the full summary', () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main');
    document.body.append(app);
    const run = climber();
    const checkpoint = { schemaVersion: 1, source: 'normal', after: 'map', states: {}, rewards: { xpGains: { level: 20, tracks: {} } } };
    mountRewards(app, { registries, run, checkpoint, rewards: checkpoint.rewards, onDone() {}, onPersist() {} });
    assert.ok(app.querySelector('.reward-compact-xp'));
    assert.equal(app.querySelector('.reward-progress'), null);
    app.querySelector('#reward-expand').click();
    assert.equal(checkpoint.expanded, true);
    assert.ok(app.querySelector('.reward-progress'));
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('the click-anywhere Victory preference expands the same summary', () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main');
    document.body.append(app);
    const run = climber();
    const checkpoint = { schemaVersion: 1, source: 'normal', after: 'map', states: {}, rewards: { xpGains: { level: 10, tracks: {} } } };
    const saves = { loadMeta: () => ({ settings: { victorySummaryMode: 'anywhere' } }) };
    mountRewards(app, { registries, run, checkpoint, rewards: checkpoint.rewards, saves, onDone() {}, onPersist() {} });
    app.querySelector('.reward-veil').click();
    assert.equal(checkpoint.expanded, true);
    assert.ok(app.querySelector('.reward-progress'));
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('a door with no progression and no offer draws no side column at all', () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main');
    document.body.append(app);
    mountRewards(app, {
      registries, onDone() {},
      run: { cinders: 0, deck: [], flasks: [], relics: [], loadout: { storage: [] } },
      rewards: {},
    });
    assert.equal(app.querySelector('.reward-side'), null);
    assert.equal(app.querySelector('.reward-progress'), null);
  } finally {
    Object.assign(globalThis, saved);
  }
});
