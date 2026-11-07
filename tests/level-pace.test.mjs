// tests/level-pace.test.mjs — SPEC §15.2, levelling pace you can see.
//
// The owner: "I change XP settings and I'm levelling up way too much". Settings
// → Progression now carries a Levelling preview drawn from `levelPace(balance,
// settings)` (model/levelup.js), the same climb `awardLevelXp` runs, so the
// preview cannot disagree with play. `balance.level.maxLevelsPerFight` caps
// how many levels one award can climb; the XP past the cap stays on the ledger.
//
// The first three tests are §15.2's Falsify lines. Per the review of #1348:
// the XP multiplier is applied once, by configuredContentBundle; Level-up value
// REPLACES the authored points per level; maxLevelsPerFight ships 0 (no cap)
// and, above 0, DISCARDS the XP past the cap.

import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { advancedConfigRows, configuredContentBundle } from '../src/model/advancedConfig.js';
import { validateContent } from '../src/model/validate.js';
import { awardLevelXp, combatLevelXp, emptyLevel, xpToNext } from '../src/model/levelup.js';

const CAP = 'gameConfig.balance.level.maxLevelsPerFight';

const REG = createRegistries(contentBundle);
const configured = (settings) => createRegistries(configuredContentBundle(contentBundle, settings));
// The cap tests measure the cap, not the curve: they pin the October 2 curve
// (base 100, ×1.75) their XP amounts were written against, so a later owner
// curve (SPEC §13.4o) cannot move what they prove.
const OLD_CURVE = { 'gameConfig.balance.level.xp.base': 100, 'gameConfig.balance.level.xp.growth': 1.75 };
const oldLevel = { ...contentBundle.balance.level, xp: { ...contentBundle.balance.level.xp, base: 100, growth: 1.75 } };
const withCap = (cap) => configured({ ...OLD_CURVE, [CAP]: cap });
// What play pays: the configured registries a new run is born from, a fresh
// ledger, and the award main.js makes at the end of a won fight.
function playAward(settings, pool, kills, startLevel = 1) {
  const reg = configured(settings);
  const run = { level: { ...emptyLevel(), level: startLevel } };
  const gain = combatLevelXp(reg, { victory: true, pool, kills });
  return { gain, award: awardLevelXp(reg, run, gain), run, reg };
}

test('§15.2 falsify: with maxLevelsPerFight 1, a large boss award gains exactly one level and leaves xp < xpToNext', () => {
  const settings = { ...OLD_CURVE, [CAP]: 1, 'gameConfig.balance.xp.kill.boss': 1000, 'gameConfig.balance.xp.killLevelMultiplier': 0.4 };
  const { award, run, reg } = playAward(settings, 'boss', 1);
  assert.equal(award.levelUps, 1);
  assert.equal(run.level.level, 2);
  assert.ok(run.level.xp < xpToNext(reg, 2), `xp ${run.level.xp} must stay under the step ${xpToNext(reg, 2)}`);
  // With 0 — the shipped cap — a large award can cross two levels.
  assert.equal(playAward({ ...settings, [CAP]: 0 }, 'boss', 1).award.levelUps, 2);
  assert.equal(playAward({}, 'boss', 1).award.levelUps, 0);
});

test('§15.2: the XP past the cap is discarded, one short of the next step at most', () => {
  const reg = withCap(1);
  const run = { level: emptyLevel() };
  awardLevelXp(reg, run, 345);
  assert.equal(run.level.xp, xpToNext(reg, 2) - 1, 'the ledger keeps one XP short of the next level');
  // So the next award climbs on at most that, and the cap still holds.
  const next = awardLevelXp(reg, run, 1);
  assert.equal(next.levelUps, 1);
  assert.equal(run.level.xp, 0);
  // A cap of 2 lets two levels through.
  const two = { level: emptyLevel() };
  const reg2 = withCap(2);
  assert.equal(awardLevelXp(reg2, two, 705).levelUps, 2);
  assert.equal(two.level.xp, xpToNext(reg2, 3) - 1);
  // An award that does not reach the cap loses nothing.
  const small = { level: emptyLevel() };
  awardLevelXp(reg, small, 5);
  assert.equal(small.level.xp, 5);
  // The run's level ceiling (balance.levelUp.maxLevels) still banks its XP, as before.
  const ceiling = createRegistries({ ...contentBundle, balance: { ...contentBundle.balance, level: oldLevel, levelUp: { ...contentBundle.balance.levelUp, maxLevels: 2 } } });
  const banked = { level: emptyLevel() };
  awardLevelXp(ceiling, banked, 215);
  assert.equal(banked.level.level, 2);
  assert.equal(banked.level.xp, 115);
  // Both caps at once (review, #1349): per-fight 2 and a run ceiling of 3 stop
  // a boss award at the same step. The per-award discard still applies, so the
  // capped award leaves xp ≤ xpToNext − 1 rather than banking 195.
  const both = createRegistries({ ...contentBundle, balance: { ...contentBundle.balance,
    level: { ...oldLevel, maxLevelsPerFight: 2 },
    levelUp: { ...contentBundle.balance.levelUp, maxLevels: 3 } } });
  const twice = { level: emptyLevel() };
  const award = awardLevelXp(both, twice, 705);
  assert.equal(twice.level.level, 3);
  assert.ok(twice.level.xp <= xpToNext(both, 3) - 1, `xp ${twice.level.xp} must not exceed the step less one`);
  assert.equal(award.discarded, 705 - xpToNext(both, 1) - xpToNext(both, 2) - twice.level.xp);
  assert.ok(award.discarded > 0);
  // The ceiling alone, short of the per-award allowance, still banks.
  const early = createRegistries({ ...contentBundle, balance: { ...contentBundle.balance,
    level: { ...oldLevel, maxLevelsPerFight: 5 },
    levelUp: { ...contentBundle.balance.levelUp, maxLevels: 3 } } });
  const bank = { level: emptyLevel() };
  assert.equal(awardLevelXp(early, bank, 345).discarded, 0);
  assert.equal(bank.level.xp, 65);
});

test('§15.2: the cap ships 0, and validation takes a whole number of at least 0', () => {
  assert.equal(contentBundle.balance.level.maxLevelsPerFight, 0);
  const check = (cap) => validateContent({ ...contentBundle, balance: { ...contentBundle.balance, level: { ...contentBundle.balance.level, maxLevelsPerFight: cap } } });
  assert.equal(check(0).ok, true);
  assert.equal(check(2).ok, true);
  for (const bad of [-1, 1.5, 'one', null]) {
    const verdict = check(bad);
    assert.equal(verdict.ok, false, JSON.stringify(bad));
    assert.ok(verdict.errors.some((e) => e.path === 'balance.level.maxLevelsPerFight'), JSON.stringify(bad));
  }
});

test('§15.2: the cap is a generated Progression row with a note', () => {
  const row = advancedConfigRows(contentBundle).find((candidate) => candidate.key === CAP);
  assert.ok(row, 'generated from the balance leaf');
  assert.equal(row.def, 0);
  assert.equal(row.advancedGroup, 'Progression');
  assert.equal(row.integer, true);
  assert.equal(row.min, 0);
  assert.equal(row.max, 20, 'the range is stated (BALANCE_DOMAINS), not read off the shipped 0');
  assert.equal(row.step, 1);
  assert.match(row.note, /0 is no cap/);
  assert.match(row.note, /Applies to a new run\.$/);
  assert.equal(configuredContentBundle(contentBundle, { [CAP]: 3 }).balance.level.maxLevelsPerFight, 3);
});

// Codex on #1349: with the cap discarding XP, the award still reported the
// full amount and the spoils receipt read "Gained: 215 xp" with no word of the
// loss. The award now returns what it discarded, the receipt carries it, and
// the door says how much the cap threw away.
test('§15.2: the spoils receipt says how much XP the level cap discarded', async () => {
  const { combatXpGains, rewardProgress } = await import('../src/model/rewardprogress.js');
  const { mountRewards } = await import('../src/ui/screens/reward.js');
  const { rewardDom } = await import('./helpers/reward-dom.mjs');
  const reg = withCap(1);
  const run = { class: 'reaver', cinders: 0, deck: [], flasks: [], relics: [], coreTags: [], loadout: { storage: [] }, level: emptyLevel(), skills: {} };
  const award = awardLevelXp(reg, run, 345);
  assert.equal(award.gained, 345, 'what the fight paid');
  assert.equal(award.discarded, 345 - xpToNext(reg, 1) - (xpToNext(reg, 2) - 1), 'what the cap threw away');
  assert.equal(award.gained - award.discarded, xpToNext(reg, 1) + run.level.xp, 'paid = spent on the level + kept + discarded');
  // Uncapped, nothing is discarded and the receipt keeps its old shape.
  assert.equal(awardLevelXp(REG, { level: emptyLevel() }, 345).discarded, 0);
  assert.deepEqual(combatXpGains({ levelGained: 345 }), { level: 345, tracks: {} });
  const gains = combatXpGains({ levelGained: award.gained, levelDiscarded: award.discarded });
  assert.deepEqual(gains, { level: 345, levelDiscarded: award.discarded, tracks: {} });
  assert.equal(rewardProgress(reg, run, gains).character.discarded, award.discarded);
  // The door.
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main');
    document.body.append(app);
    mountRewards(app, { registries: reg, run, onDone() {}, rewards: { cinders: 10, xpGains: gains } });
    const row = app.querySelector('.reward-progress-row');
    const text = (cls) => row.children.find((child) => child.className.includes(cls))?.textContent;
    assert.equal(text('rp-gain'), 'Gained: 345 xp', 'Character uses the same gained-XP receipt row as other tracks');
    assert.equal(row.querySelector('.rp-bar').getAttribute('aria-valuenow'), String(Math.min(run.level.xp, xpToNext(reg, run.level.level))));
    assert.equal(text('rp-discarded'), `${award.discarded} xp lost to the level cap`);
  } finally {
    Object.assign(globalThis, saved);
  }
});

// The receipt's discarded XP crosses the save door. No schema bump: it is an
// optional field inside the existing reward receipt (absent reads as 0), not
// new run state.
test('§15.2: the discarded XP on a pending reward survives a save and reload', async () => {
  const { combatXpGains, rewardProgress } = await import('../src/model/rewardprogress.js');
  const { createRunState, validateRunShape, serializeRun, deserializeRun } = await import('../src/model/state.js');
  const run = createRunState({ seed: 0x1349, classId: 'reaver', registries: REG });
  const gains = combatXpGains({ receipt: { 'item:blade': 6 }, levelGained: 215, levelDiscarded: 196 });
  run.pendingReward = {
    schemaVersion: 1, source: 'boss', after: 'map',
    rewards: { title: 'VICTORY', cinders: 40, xpGains: gains },
    states: {}, chosenCardId: null, chosenDraftCardIds: {}, chosenDraftNodeIds: {},
  };
  assert.deepEqual(validateRunShape(run), []);
  const back = deserializeRun(serializeRun(run));
  assert.deepEqual(back.pendingReward.rewards.xpGains, { level: 215, levelDiscarded: 196, tracks: { 'item:blade': 6 } });
  assert.equal(rewardProgress(REG, back, back.pendingReward.rewards.xpGains).character.discarded, 196);
  // A receipt saved before the field existed reads as nothing discarded.
  assert.equal(rewardProgress(REG, back, { level: 215, tracks: {} }).character.discarded, 0);
});
