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
import { awardSkillXp, xpToNext as skillXpToNext } from '../src/model/skills.js';
import { awardLevelXp, xpToNext as levelXpToNext } from '../src/model/levelup.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape, serializeRun, deserializeRun } from '../src/model/state.js';
import { mountRewards } from '../src/ui/screens/reward.js';
import { victoryXpFormula, victoryXpPresentation, victoryXpTiming } from '../src/model/victoryXpPresentation.js';
import { orderedXpRows, xpFillDurations } from '../src/model/rewardXpPresentation.js';
import { rewardDom } from './helpers/dom.mjs';

// These tests drive the reward door's flow, not the curve: they pin the
// October 2 curves (base 100, ×1.75 for the character, skills and class) their
// XP amounts were written against, so SPEC §13.4o's curves cannot move them.
const oldCurve = (xp) => ({ ...xp, base: 100, growth: 1.75 });
const { balance } = contentBundle;
const registries = createRegistries({ ...contentBundle, balance: { ...balance,
  level: { ...balance.level, xp: oldCurve(balance.level.xp) },
  skill: { ...balance.skill, xp: oldCurve(balance.skill.xp), class: { ...balance.skill.class, xp: oldCurve(balance.skill.class.xp) } },
} });

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
  const progress = rewardProgress(noSkillCurve, climber(), { level: 5, tracks: { 'item:blade': 9, 'class:reaver': 4 } });
  assert.deepEqual(progress.skills.map((row) => row.id), ['class:reaver'],
    'no curve, no row — "Max" would be a broken table reading as a ceiling, even for the track the fight paid');
  assert.ok(progress.character, 'the character curve is a different table and still reads');
  const noLevelCurve = { ...registries, balance: { ...registries.balance, level: { xp: {} }, levelUp: { ...registries.balance.levelUp, maxLevels: null } } };
  assert.ok(rewardProgress(noLevelCurve, climber(), null).character.xpToNext > 0,
    'an empty curve table falls back to the authored defaults rather than dropping the row');
  assert.ok(progress.skills.every((row) => row.capped || row.xpToNext > 0));
});

test('the class track leads and only tracks paid by this reward have a bar', () => {
  const run = climber();
  const progress = rewardProgress(registries, run, { level: 10, tracks: { 'item:shield': 9, 'class:reaver': 4 } });
  assert.deepEqual(progress.skills.map((row) => row.id), ['class:reaver', 'item:shield'],
    'class first; standing unpaid skills stay off the reward list');
  assert.equal(progress.hidden, 0, 'no paid tracks are hidden');
  assert.equal(progress.skills[0].kind, 'class');
  assert.equal(progress.skills[1].kind, 'weapon');
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
    rewards: { title: 'VICTORY', cinders: 32, xpGains: combatXpGains({ receipt: { 'item:blade': 18 }, levelGained: 24 }),
      xpReceipt: { total: 24, rows: [{ kind: 'power', amount: 16 }, { kind: 'enemy', name: 'Blight Hound', level: 2, amount: 8 }] } },
    states: {},
    chosenCardId: null,
    chosenDraftCardIds: {},
    chosenDraftNodeIds: {},
  };
  assert.deepEqual(validateRunShape(run), [], 'the load door accepts an offer carrying the receipt');
  const back = deserializeRun(serializeRun(run));
  assert.deepEqual(back.pendingReward.rewards.xpGains, { level: 24, tracks: { 'item:blade': 18 } },
    'a reload resumes the same numbers the door first showed');
  assert.deepEqual(back.pendingReward.rewards.xpReceipt, run.pendingReward.rewards.xpReceipt,
    'the compact breakdown survives a reload with the same enemy names and amounts');
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
    assert.equal(rows.length, 2, 'only Character and Blade gained XP');
    assert.deepEqual(rows.map(row => row.dataset.track), ['character', 'item:blade']);
    const text = (row, cls) => row.children.find(child => child.className.includes(cls))?.textContent;
    assert.equal(text(rows[0], 'rp-name'), 'Character');
    assert.equal(text(rows[0], 'rp-level'), 'Level 3');
    assert.equal(text(rows[0], 'rp-next'), 'Level 4');
    assert.equal(text(rows[0], 'rp-gain'), 'Gained: 25 xp');
    assert.equal(text(rows[1], 'rp-gain'), 'Gained: 8 xp');
    assert.ok(rows.every((row) => row.children.some((child) => child.className.includes('rp-layered-bar'))), 'every row carries its layered bar');
    assert.equal(app.querySelector('.reward-side .reward-claim-status'), null, 'the compact progression column does not repeat every reward');
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
    const checkpoint = { schemaVersion: 1, source: 'normal', after: 'map', states: {}, rewards: {
      xpGains: { level: 20, tracks: {} }, xpReceipt: { total: 20, rows: [
        { kind: 'power', amount: 14 }, { kind: 'enemy', name: 'Blight Hound', level: 3, amount: 6 },
      ] },
    } };
    const saves = { loadMeta: () => ({ settings: { victoryReceiptSeconds: 0, victoryReceiptReadySeconds: 0 } }) };
    mountRewards(app, { registries, run, checkpoint, rewards: checkpoint.rewards, saves, onDone() {}, onPersist() {} });
    assert.ok(app.querySelector('.reward-compact-xp'));
    assert.equal(app.querySelector('.reward-compact-formula').textContent, '14 + 6');
    assert.equal(app.querySelector('.reward-compact-value').textContent, '20 XP');
    assert.equal(app.querySelectorAll('.reward-compact-row').length, 2);
    assert.ok(app.querySelector('#reward-expand').classList.contains('is-ready'));
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
    const saves = { loadMeta: () => ({ settings: { victorySummaryMode: 'anywhere', victoryReceiptSeconds: 0, victoryReceiptReadySeconds: 0 } }) };
    mountRewards(app, { registries, run, checkpoint, rewards: checkpoint.rewards, saves, onDone() {}, onPersist() {} });
    app.querySelector('.reward-veil').click();
    assert.equal(checkpoint.expanded, true);
    assert.ok(app.querySelector('.reward-progress'));
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('long XP arithmetic collapses after the configured term count without losing the full sum', () => {
  const rows = [25, 12, 18, 4, 3, 2, 1].map((amount) => ({ amount }));
  const expression = victoryXpFormula(rows, rows.length, 5);
  assert.deepEqual([expression.shown, expression.collapsed, expression.full],
    ['25 + 12 + 18 + 4 + 3', true, '25 + 12 + 18 + 4 + 3 + 2 + 1 = 65 XP']);
  const options = victoryXpPresentation({ victoryReceiptSeconds: 1, victoryReceiptPauseMs: 400 }, false);
  const timing = victoryXpTiming(rows.length, options);
  assert.ok(timing.pauseMs < 400, 'long encounters compress pauses');
  assert.equal(Math.round(timing.tickMs * rows.length + timing.pauseMs * (rows.length - 1)), 1000);
});

test('Continue stays closed until the configured post-receipt pause ends', async () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main');
    document.body.append(app);
    const checkpoint = { schemaVersion: 1, source: 'normal', after: 'map', states: {}, rewards: { xpGains: { level: 10, tracks: {} } } };
    const saves = { loadMeta: () => ({ settings: { victoryReceiptSeconds: 0, victoryReceiptReadySeconds: 0.01 } }) };
    mountRewards(app, { registries, run: climber(), checkpoint, rewards: checkpoint.rewards, saves, onDone() {}, onPersist() {} });
    const open = app.querySelector('#reward-expand');
    assert.equal(open.disabled, true);
    open.click();
    assert.equal(checkpoint.expanded, undefined);
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(open.disabled, false);
    assert.ok(open.classList.contains('is-ready'));
    open.click();
    assert.equal(checkpoint.expanded, true);
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


test('only gained rows sort Class, Character, then current skill level with name/id ties', () => {
  const run = climber();
  const progress = rewardProgress(registries, run, { level: 5, tracks: {
    'class:reaver': 10, 'item:blade': 2, 'armour:heavy': 90, 'item:shield': 200,
  } });
  assert.deepEqual(orderedXpRows(progress).map(row => row.id), ['class:reaver', 'character', 'item:blade', 'armour:heavy', 'item:shield']);
  const ties = orderedXpRows({ character: null, skills: [
    { id: 'z', label: 'Blade', level: 2 }, { id: 'a', label: 'Blade', level: 2 }, { id: 'b', label: 'Axe', level: 2 },
  ] });
  assert.deepEqual(ties.map(row => row.id), ['b', 'a', 'z']);
  assert.deepEqual(orderedXpRows(rewardProgress(registries, run, { level: 0, tracks: {} })), []);
});

test('all kinds and repeated partial refills travel at the same fraction per millisecond', () => {
  const durations = xpFillDurations([{ from: .2, to: 1 }, { from: .5, to: .7 }, { from: 0, to: .4 }], 1000);
  for (const [index, distance] of [.8, .2, .4].entries()) assert.ok(Math.abs(durations[index] / distance - 1000) < .00001);
  assert.ok(Math.abs(durations.reduce((a, b) => a + b, 0) - 1400) < .00001);
  assert.deepEqual(xpFillDurations([{ from: 0, to: .25 }], 800), [200]);
  assert.deepEqual(xpFillDurations([{ from: 1, to: 1 }], 1400), [0]);
  assert.deepEqual(xpFillDurations([{ from: 0, to: 1 }], 0), [0]);
});

const waitForXp = async predicate => {
  const deadline = Date.now() + 2500;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(predicate(), 'XP presentation reaches its next state');
};

test('scopeXpProgress keeps only the allowed bar kinds and leaves the input alone', async () => {
  const { scopeXpProgress } = await import('../src/model/rewardXpPresentation.js');
  const progress = Object.freeze({ character: { kind: 'character', id: 'character' },
    skills: [{ kind: 'class', id: 'class:reaver' }, { kind: 'weapon', id: 'item:blade' }], hidden: 3 });
  const scoped = scopeXpProgress(progress);
  assert.equal(scoped.character.id, 'character');
  assert.deepEqual(scoped.skills, []);
  assert.equal(progress.skills.length, 2);
  assert.deepEqual(scopeXpProgress(progress, ['class']).skills.map(row => row.id), ['class:reaver']);
  assert.equal(scopeXpProgress(null), null);
});
