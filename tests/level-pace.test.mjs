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
  assert.equal(combatLevelXp(REG, { victory: true, pool: 'normal', kills: 3 }), 51, 'three power-3, level-1 kills follow the two-part formula');
  const reg = configured({ [XP_MULT]: 2 });
  const doubled = combatLevelXp(reg, { victory: true, pool: 'normal', kills: 3 });
  assert.equal(doubled, 102, 'the multiplier is in the configured awards');
  const normal = fight(levelPacePreview({ [XP_MULT]: 2 }), 'normal');
  assert.equal(normal.kills, 3);
  assert.equal(normal.xp, doubled, 'counted once, not twice');
  assert.match(normal.text, /^A normal fight \(3 level-1 kills at power 3 each\) gives 102 XP/);
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
  assert.deepEqual(figures, [['normal', 3, 51, 0], ['elite', 1, 17, 0], ['boss', 1, 17, 0]]);
  assert.match(fight(shipped, 'elite').text, /^An elite fight \(1 level-1 kill at power 3 each\) gives 17 XP: 0 levels from level 1/);
  assert.match(fight(shipped, 'boss').text, /^A boss fight \(1 level-1 kill at power 3 each\) gives 17 XP: 0 levels from level 1/);
  assert.match(shipped.killText, /power × 0\.2 × 25.*10 × 0\.2 × total enemy levels.*power 3 each give 50 XP/);
});

test('§15.2 falsify: with maxLevelsPerFight 1, a large boss award gains exactly one level and leaves xp < xpToNext', () => {
  const settings = { [CAP]: 1, 'gameConfig.balance.xp.kill.boss': 1000, 'gameConfig.balance.xp.killLevelMultiplier': 0.4 };
  const { award, run, reg } = playAward(settings, 'boss', 1);
  assert.equal(award.levelUps, 1);
  assert.equal(run.level.level, 2);
  assert.ok(run.level.xp < xpToNext(reg, 2), `xp ${run.level.xp} must stay under the step ${xpToNext(reg, 2)}`);
  // With 0 — the shipped cap — a large award can cross two levels.
  assert.equal(playAward({ ...settings, [CAP]: 0 }, 'boss', 1).award.levelUps, 2);
  assert.equal(playAward({}, 'boss', 1).award.levelUps, 0);
  // The preview agrees.
  const line = fight(levelPacePreview(settings), 'boss');
  assert.equal(from(line, 1).levelsGained, 1);
  assert.equal(from(line, 1).capped, true);
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
  const ceiling = createRegistries({ ...contentBundle, balance: { ...contentBundle.balance, levelUp: { ...contentBundle.balance.levelUp, maxLevels: 2 } } });
  const banked = { level: emptyLevel() };
  awardLevelXp(ceiling, banked, 215);
  assert.equal(banked.level.level, 2);
  assert.equal(banked.level.xp, 115);
  // Both caps at once (review, #1349): per-fight 2 and a run ceiling of 3 stop
  // a boss award at the same step. The per-award discard still applies, so the
  // capped award leaves xp ≤ xpToNext − 1 rather than banking 195.
  const both = createRegistries({ ...contentBundle, balance: { ...contentBundle.balance,
    level: { ...contentBundle.balance.level, maxLevelsPerFight: 2 },
    levelUp: { ...contentBundle.balance.levelUp, maxLevels: 3 } } });
  const twice = { level: emptyLevel() };
  const award = awardLevelXp(both, twice, 705);
  assert.equal(twice.level.level, 3);
  assert.ok(twice.level.xp <= xpToNext(both, 3) - 1, `xp ${twice.level.xp} must not exceed the step less one`);
  assert.equal(award.discarded, 705 - xpToNext(both, 1) - xpToNext(both, 2) - twice.level.xp);
  assert.ok(award.discarded > 0);
  // The ceiling alone, short of the per-award allowance, still banks.
  const early = createRegistries({ ...contentBundle, balance: { ...contentBundle.balance,
    level: { ...contentBundle.balance.level, maxLevelsPerFight: 5 },
    levelUp: { ...contentBundle.balance.levelUp, maxLevels: 3 } } });
  const bank = { level: emptyLevel() };
  assert.equal(awardLevelXp(early, bank, 345).discarded, 0);
  assert.equal(bank.level.xp, 65);
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
  // The shipped curve (owner, 2026-10-02): base 100, ×1.75 a step, to the nearest 10.
  assert.deepEqual(pace.curve.slice(0, 8).map((row) => row.step), [100, 180, 310, 540, 940, 1640, 2870, 5030]);
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
  assert.equal(row.max, 20, 'the range is stated (BALANCE_DOMAINS), not read off the shipped 0');
  assert.equal(row.step, 1);
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
  assert.match(html, /A normal fight \(3 level-1 kills at power 3 each\) gives 102 XP/);
  assert.match(html, /from level 10/);
  // Not on another Advanced tab.
  assert.doesNotMatch(categoryHtml('Advanced', { settingsAdvancedCategory: 'Rewards' }, null), /data-level-pace-preview/);
});

// Codex on #1349: editing Level-up value (a profile key, not gameConfig.*) ran
// only refreshGates, so the preview kept its old stat points until another
// edit. Every profile row the preview reads must be listed, and the number
// commit must redraw the preview for the listed keys.
test('§15.2: a profile setting the preview reads redraws it when edited', async () => {
  const { levelPacePreviewHtml, settingsRows, LEVEL_PACE_PROFILE_KEYS } = await import('../src/ui/screens/settings.js');
  const { readFileSync } = await import('node:fs');
  assert.notEqual(levelPacePreviewHtml({ levelUpValue: 3 }), levelPacePreviewHtml({ levelUpValue: 1 }));
  assert.match(levelPacePreviewHtml({ levelUpValue: 3 }), /3 stat points a level/);
  // Which profile rows move the preview: every non-gameConfig number row, nudged.
  const readers = settingsRows()
    .filter((row) => row.type === 'number' && !String(row.key).startsWith('gameConfig.'))
    .filter((row) => {
      const def = Number(row.def);
      const nudged = Number.isFinite(row.max) && def + 1 > row.max ? def - 1 : def + 1;
      return levelPacePreviewHtml({ [row.key]: nudged }) !== levelPacePreviewHtml({ [row.key]: def });
    })
    .map((row) => row.key);
  assert.deepEqual(readers, ['levelUpValue']);
  assert.deepEqual([...LEVEL_PACE_PROFILE_KEYS].sort(), [...readers].sort());
  // The number commit's profile branch asks for the redraw.
  const source = readFileSync(new URL('../src/ui/screens/settings.js', import.meta.url), 'utf8');
  const commit = source.slice(source.indexOf('const commit = (raw) => {'), source.indexOf('// change/blur, NEVER per keystroke'));
  assert.match(commit, /if \(LEVEL_PACE_PROFILE_KEYS\.includes\(key\)\) refreshStatsPreviews\(\);/);
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
    assert.equal(text('rp-gain'), undefined, 'the character level bar remains a single line');
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

test('§15.2: the preview\'s words are uiStrings rows, and "XP ×N" names the multiplier play applies', async () => {
  const { t } = await import('../src/ui/strings.js');
  const { appliedXpMultiplier } = await import('../src/model/advancedConfig.js');
  const pace = levelPacePreview({ [XP_MULT]: 2.5 });
  assert.equal(pace.title, t('settings.levelPace.title'));
  assert.equal(pace.curveTitle, t('settings.levelPace.curveTitle'));
  assert.equal(pace.xpMultiplier, appliedXpMultiplier({ [XP_MULT]: 2.5 }));
  assert.ok(pace.terms.startsWith(t('settings.levelPace.multiplier', { multiplier: '2.5' })));
  assert.equal(levelPacePreview({}).xpMultiplier, 1, 'none stored: the authored awards, ×1');
  assert.ok(levelPacePreview({ [CAP]: 2 }).terms.endsWith(t('settings.levelPace.cap', { count: 2, plural: 's' })));
  assert.equal(fight(pace, 'boss').text.split(' (')[0], t('settings.levelPace.fight.boss'));
  // The model holds no English of its own.
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/ui/models/LevelPacePreviewModel.js', import.meta.url), 'utf8')
    .split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*')).join('\n');
  const literals = [...source.matchAll(/'([^']*)'|`([^`]*)`/g)].map((m) => m[1] ?? m[2]);
  const english = literals.filter((text) => /[a-z]{2,}/i.test(text)
    && !/^settings\.levelPace\./.test(text) && !text.startsWith('../') && !text.startsWith('./') && !text.startsWith('${'));
  assert.deepEqual(english, [], 'every word the preview says is a settings.levelPace.* row of uiStrings.csv');

});

// Codex on #1349: the preview priced the configured bundle unvalidated, but a
// configuration main.js rebuildRegistries refuses is not played — the authored
// defaults are. The preview runs the same checks, prices that fallback and
// says why.
test('§15.2: a refused configuration shows the refusal and prices the authored defaults play falls back to', async () => {
  const { categoryHtml } = await import('../src/ui/screens/settings.js');
  const bad = { 'gameConfig.balance.level.xp.linear': false, 'gameConfig.balance.level.xp.growth': 0.5, [XP_MULT]: 2 };
  const verdict = validateContent(configuredContentBundle(contentBundle, bad));
  assert.equal(verdict.ok, false, 'growth 0.5 is refused, so play keeps the authored content');
  const pace = levelPacePreview(bad);
  assert.match(pace.refused, /balance\.level\.xp\.growth/);
  const authored = levelPacePreview({});
  assert.deepEqual(pace.curve.map((row) => row.step), authored.curve.map((row) => row.step), 'the authored curve, not growth 0.5');
  assert.deepEqual(pace.fights.map((row) => row.xp), [51, 17, 17], 'the fallback applies no multiplier either');
  assert.equal(pace.xpMultiplier, 1);
  assert.equal(authored.refused, null);
  const html = categoryHtml('Advanced', { settingsAdvancedCategory: 'Progression', 'settingsAdvancedSubgroup.Progression': 'Experience', ...bad }, null);
  assert.match(html, /data-level-pace-refused/);
  assert.match(html, /A normal fight \(3 level-1 kills at power 3 each\) gives 51 XP/);
});
