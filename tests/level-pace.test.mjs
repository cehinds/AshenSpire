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
import { awardLevelXp, combatLevelXp, emptyLevel, levelPace, xpToNext } from '../src/model/levelup.js';
import { levelPacePreview } from '../src/ui/models/LevelPacePreviewModel.js';

const XP_MULT = 'gameConfig.progression.xpMultiplier';
const CAP = 'gameConfig.balance.level.maxLevelsPerFight';

const REG = createRegistries(contentBundle);
const configured = (settings) => createRegistries(configuredContentBundle(contentBundle, settings));
const withCap = (cap) => configured({ [CAP]: cap });
const fight = (pace, pool) => pace.fights.find((row) => row.pool === pool);
const from = (line, level) => line.from.find((row) => row.level === level);
// What play pays: the configured registries a new run is born from, a fresh
// ledger, and the award main.js makes at the end of a won fight.
function playAward(settings, pool, kills, startLevel = 1) {
  const reg = configured(settings);
  const run = { level: { ...emptyLevel(), level: startLevel } };
  const gain = combatLevelXp(reg, { victory: true, pool, kills });
  return { gain, award: awardLevelXp(reg, run, gain), run, reg };
}

test('§15.2 falsify: the preview\'s normal-fight XP is combatLevelXp on the configured registries, xpMultiplier counted once', () => {
  assert.equal(combatLevelXp(REG, { victory: true, pool: 'normal', kills: 3 }), 30, 'the shipped awards: 15 a win and 5 a normal kill');
  const reg = configured({ [XP_MULT]: 2 });
  const doubled = combatLevelXp(reg, { victory: true, pool: 'normal', kills: 3 });
  assert.equal(doubled, 60, 'the multiplier is in the configured awards');
  const normal = fight(levelPacePreview({ [XP_MULT]: 2 }), 'normal');
  assert.equal(normal.kills, 3);
  assert.equal(normal.xp, doubled, 'counted once, not twice (120)');
  assert.match(normal.text, /^A normal fight \(3 kills\) gives 60 XP/);
  assert.equal(fight(levelPace(reg), 'normal').xp, doubled);
});

test('§15.2 falsify: the levels-gained figure is what awardLevelXp actually awards from level 1 (and from level 10)', () => {
  for (const mult of [1, 0.5, 2, 3.7]) {
    const settings = { [XP_MULT]: mult };
    const pace = levelPacePreview(settings);
    for (const line of pace.fights) {
      for (const start of [1, 10]) {
        const { gain, award } = playAward(settings, line.pool, line.kills, start);
        assert.equal(line.xp, gain, `×${mult} ${line.pool}: XP`);
        assert.equal(from(line, start).levelsGained, award.levelUps, `×${mult} ${line.pool} from level ${start}`);
        assert.equal(from(line, start).points, award.points, `×${mult} ${line.pool} from level ${start}: points`);
      }
    }
  }
  // The shipped figures from level 1 (review of #1348).
  const shipped = levelPacePreview({});
  const figures = shipped.fights.map((line) => [line.pool, line.kills, line.xp, from(line, 1).levelsGained]);
  assert.deepEqual(figures, [['normal', 3, 30, 3], ['elite', 1, 90, 8], ['boss', 1, 215, 13]]);
  assert.match(fight(shipped, 'elite').text, /^An elite fight \(1 kill\) gives 90 XP: 8 levels from level 1/);
  assert.match(fight(shipped, 'boss').text, /^A boss fight \(1 kill\) gives 215 XP: 13 levels from level 1/);
});

test('§15.2 falsify: with maxLevelsPerFight 1, a boss kill from level 1 gains exactly one level and leaves xp < xpToNext', () => {
  const { award, run, reg } = playAward({ [CAP]: 1 }, 'boss', 1);
  assert.equal(award.levelUps, 1);
  assert.equal(run.level.level, 2);
  assert.ok(run.level.xp < xpToNext(reg, 2), `xp ${run.level.xp} must stay under the step ${xpToNext(reg, 2)}`);
  // With 0 — the shipped value — no cap: 13 levels.
  assert.equal(playAward({ [CAP]: 0 }, 'boss', 1).award.levelUps, 13);
  assert.equal(playAward({}, 'boss', 1).award.levelUps, 13);
  // The preview agrees.
  const line = fight(levelPacePreview({ [CAP]: 1 }), 'boss');
  assert.equal(from(line, 1).levelsGained, 1);
  assert.equal(from(line, 1).capped, true);
});

test('§15.2: the XP past the cap is discarded, one short of the next step at most', () => {
  const reg = withCap(1);
  const run = { level: emptyLevel() };
  awardLevelXp(reg, run, combatLevelXp(reg, { victory: true, pool: 'boss', kills: 1 }));
  assert.equal(run.level.xp, xpToNext(reg, 2) - 1, 'the ledger keeps one XP short of the next level');
  // So the next award climbs on at most that, and the cap still holds.
  const next = awardLevelXp(reg, run, 1);
  assert.equal(next.levelUps, 1);
  assert.equal(run.level.xp, 0);
  // A cap of 2 lets two levels through.
  const two = { level: emptyLevel() };
  const reg2 = withCap(2);
  assert.equal(awardLevelXp(reg2, two, 215).levelUps, 2);
  assert.equal(two.level.xp, xpToNext(reg2, 3) - 1);
  // An award that does not reach the cap loses nothing.
  const small = { level: emptyLevel() };
  awardLevelXp(reg, small, 5);
  assert.equal(small.level.xp, 5);
  // The run's level ceiling (balance.levelUp.maxLevels) still banks its XP, as before.
  const ceiling = createRegistries({ ...contentBundle, balance: { ...contentBundle.balance, levelUp: { ...contentBundle.balance.levelUp, maxLevels: 2 } } });
  const banked = { level: emptyLevel() };
  awardLevelXp(ceiling, banked, 215);
  assert.equal(banked.level.level, 2);
  assert.equal(banked.level.xp, 205);
});

test('§15.2: the preview lists the XP to reach each of levels 2–20, from the live curve', () => {
  const pace = levelPacePreview({});
  assert.deepEqual(pace.curve.map((row) => row.level), Array.from({ length: 19 }, (_, i) => i + 2));
  let total = 0;
  for (const row of pace.curve) {
    assert.equal(row.step, xpToNext(REG, row.level - 1), `the step into level ${row.level}`);
    total += row.step;
    assert.equal(row.total, total, `the running total to level ${row.level}`);
  }
  // The shipped curve: 10 a level until level 9 (SPEC §15.2).
  assert.deepEqual(pace.curve.slice(0, 8).map((row) => row.step), [10, 10, 10, 10, 10, 10, 10, 10]);
  // A curve setting moves it.
  const steeper = levelPacePreview({ 'gameConfig.balance.level.xp.base': 50 });
  assert.equal(steeper.curve[0].step, 50);
});

test('§15.2: Level-up value replaces the authored points per level, never multiplies them', () => {
  const pace = levelPacePreview({ levelUpValue: 3 }, { pointsPerLevel: 3 });
  assert.equal(pace.pointsPerLevel, 3);
  for (const line of pace.fights) for (const row of line.from) assert.equal(row.points, row.levelsGained * 3);
  // Read from the setting itself when the screen hands nothing in.
  assert.equal(levelPacePreview({ levelUpValue: 4 }).pointsPerLevel, 4);
  // With authored 2 and the dial at 3, a level grants 3, not 6.
  const authoredTwo = createRegistries({ ...contentBundle, balance: { ...contentBundle.balance, levelUp: { ...contentBundle.balance.levelUp, pointsPerLevel: 2 } } });
  assert.equal(levelPace(authoredTwo, { pointsPerLevel: 3 }).pointsPerLevel, 3);
  assert.equal(levelPace(authoredTwo).pointsPerLevel, 2);
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
  assert.match(row.note, /0 is no cap/);
  assert.match(row.note, /Applies to a new run\.$/);
  assert.equal(configuredContentBundle(contentBundle, { [CAP]: 3 }).balance.level.maxLevelsPerFight, 3);
});

test('§15.2: Settings → Progression → Experience draws the Levelling preview', async () => {
  const { categoryHtml } = await import('../src/ui/screens/settings.js');
  const settings = { settingsAdvancedCategory: 'Progression', 'settingsAdvancedSubgroup.Progression': 'Experience', [XP_MULT]: 2 };
  const html = categoryHtml('Advanced', settings, null);
  assert.match(html, /data-level-pace-preview/);
  assert.match(html, /Levelling preview/);
  assert.match(html, /A normal fight \(3 kills\) gives 60 XP/);
  assert.match(html, /from level 10/);
  // Not on another Advanced tab.
  assert.doesNotMatch(categoryHtml('Advanced', { settingsAdvancedCategory: 'Rewards' }, null), /data-level-pace-preview/);
});
