// tests/character-progression.test.mjs — the Armoury's two climbs, read as
// models: the character level bar and the skill-track rows.
//
// THE HEADLINE TEST COMPARES AGAINST THE SHRINE'S OWN CALL, not against the
// curve function both reach through. "The bar reads the same step the shrine
// spends" is a claim about levelUpPlan, which is what rest.js renders; an
// assertion against xpToNext would have passed for a bar that read a
// different plan field entirely.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { levelProgress, skillProgressRows, skillProgressSummary, staleSkillTracks } from '../src/model/progression.js';
import { awardLevelXp, levelUpPlan, xpToNext as levelXpToNext } from '../src/model/levelup.js';
import { awardSkillXp, classSkillId, skillTracks, xpToNext as skillXpToNext } from '../src/model/skills.js';

const registries = createRegistries(contentBundle);
const fresh = () => ({ class: 'reaver', level: { xp: 0, level: 1, unspentPoints: 0 }, skills: {} });
const cappedAt = (level) => ({
  ...registries,
  balance: { ...registries.balance, levelUp: { ...registries.balance.levelUp, maxLevels: level } },
});

test('the level bar reads the same step the shrine spends', () => {
  const run = fresh();
  const plan = levelUpPlan(registries, run);
  const start = levelProgress(registries, run);
  assert.equal(start.level, plan.level);
  assert.equal(start.xp, plan.xp);
  assert.equal(start.xpToNext, plan.xpToNext, 'the bar quotes the plan, not a curve of its own');
  assert.equal(start.value, `${plan.xp} / ${plan.xpToNext} XP`);
  assert.equal(start.xpToNext, levelXpToNext(registries, 1), 'and level 1 costs the curve base');
  assert.equal(start.pct, 0);
  assert.equal(start.points, 0);
  assert.equal(start.pointsLabel, '');
  assert.equal(start.remaining, start.xpToNext);

  // A 100 XP first step, set here, so a quarter is whole numbers; the stock
  // first step is far shorter.
  const hundred = {
    ...registries,
    balance: { ...registries.balance, level: { ...registries.balance.level, xp: { ...registries.balance.level.xp, base: 100 } } },
  };
  assert.equal(levelXpToNext(hundred, 1), 100);
  assert.equal(levelUpPlan(hundred, run).xpToNext, 100, 'the shrine spends the same step the bar reads');
  run.level.xp = 25;
  const quarter = levelProgress(hundred, run);
  assert.equal(quarter.pct, 25, '25 of a 100 XP step is a quarter of a bar');
  assert.equal(quarter.remaining, 75);
  assert.equal(quarter.value, '25 / 100 XP');
});

test('a level climbed moves the bar to the next step and names the waiting point', () => {
  const run = fresh();
  awardLevelXp(registries, run, levelXpToNext(registries, 1));
  const after = levelProgress(registries, run);
  assert.equal(after.level, 2);
  assert.equal(after.xp, 0);
  assert.equal(after.xpToNext, levelXpToNext(registries, 2));
  assert.equal(after.points, 1);
  assert.equal(after.pointsLabel, '1 point to assign', 'the phrase is the model\'s, so the badge and the tooltip cannot disagree');
  assert.match(after.sense, /1 point waiting/);

  run.level.unspentPoints = 3;
  assert.equal(levelProgress(registries, run).pointsLabel, '3 points to assign', 'and it pluralises');
});

test('a capped run reads full, and offers no step for an instrument to read', () => {
  const run = fresh();
  // XP keeps arriving at the ceiling, and levelUpPlan keeps quoting a step
  // that can never be taken — the case that put a stale cur/max on the track.
  run.level = { xp: 999, level: 3, unspentPoints: 0 };
  const capped = levelProgress(cappedAt(3), run);
  assert.equal(capped.capped, true);
  assert.equal(capped.pct, 100);
  assert.equal(capped.value, 'Level cap');
  assert.equal(capped.remaining, 0);
  assert.equal(capped.xpToNext, 0, 'there is no next step, so no step is quoted');
  assert.equal(capped.xp, 0, 'and no progress into one');
  assert.doesNotMatch(capped.sense, /XP to level/);
});

test('a legacy save with neither ledger reads as a fresh climb rather than throwing', () => {
  const bare = { class: 'reaver' };
  const level = levelProgress(registries, bare);
  assert.equal(level.level, 1);
  assert.equal(level.xp, 0);
  assert.equal(level.xpToNext, levelXpToNext(registries, 1));
  const rows = skillProgressRows(registries, bare);
  assert.deepEqual(rows.map((row) => row.id), [classSkillId('reaver')]);
  assert.equal(rows[0].level, 0);
  assert.equal(rows[0].pendingDrafts, 0);
});

test('a corrupt level row still prints one guarded level, not a concatenated one', () => {
  // levelup.js keeps characterLevel as the guarded home for the DISPLAYED
  // level; reading the raw row gave "XP to level x1" from `level + 1`.
  const bent = { class: 'reaver', level: { xp: 10, level: 'x', unspentPoints: 0 } };
  const progress = levelProgress(registries, bent);
  assert.equal(progress.level, 1);
  assert.equal(progress.label, 'Level 1');
  assert.match(progress.sense, /XP to level 2\./);
});

test('the skill rows list the run\'s own class track and every track it has touched', () => {
  const run = fresh();
  const own = classSkillId('reaver');
  const bare = skillProgressRows(registries, run);
  assert.deepEqual(bare.map((r) => r.id), [own], 'an untrained run shows its class ladder and nothing it has not touched');
  assert.equal(bare[0].level, 0);
  assert.equal(bare[0].xpToNext, skillXpToNext(registries, 'class', 0));
  assert.equal(bare[0].draftsLabel, '');

  const sword = skillTracks(registries).find((t) => t.kind === 'weapon');
  awardSkillXp(registries, run, sword.id, skillXpToNext(registries, 'weapon', 0));
  const rows = skillProgressRows(registries, run);
  assert.deepEqual(rows.map((r) => r.id), [own, sword.id], 'the class track leads, the trained track follows');
  const trained = rows[1];
  assert.equal(trained.level, 1);
  assert.equal(trained.pendingDrafts, 1);
  assert.equal(trained.draftsLabel, '1 draft');
  assert.equal(trained.xpToNext, skillXpToNext(registries, 'weapon', 1));
  assert.match(trained.sense, /1 draft waiting/);
  assert.equal(rows.every((r) => r.pct >= 0 && r.pct <= 100), true);
});

test('the order is the class track, then the deepest climb, then the authored order', () => {
  const run = fresh();
  const own = classSkillId('reaver');
  // Three tracks that are not the class ladder, in the order the tree
  // authors them — the tiebreak of last resort.
  const others = skillTracks(registries).filter((t) => t.kind !== 'class').slice(0, 3);
  // Deliberately out of authored order and off the class track, so every
  // rung of the sort is exercised: level, then xp, then authored order.
  run.skills = {
    [own]: { xp: 0, level: 0, pendingDrafts: 0 },
    [others[0].id]: { xp: 1, level: 2, pendingDrafts: 0 },
    [others[1].id]: { xp: 9, level: 4, pendingDrafts: 0 },
    [others[2].id]: { xp: 5, level: 2, pendingDrafts: 0 },
  };
  assert.deepEqual(
    skillProgressRows(registries, run).map((row) => row.id),
    [own, others[1].id, others[2].id, others[0].id],
    'own first though it is level 0; then 4; then the two level 2s by xp',
  );
});

test('a track the content no longer declares is reported, not silently dropped', () => {
  const run = fresh();
  run.skills = { 'item:flamethrower': { xp: 3, level: 2, pendingDrafts: 1 } };
  assert.deepEqual(staleSkillTracks(registries, run), ['item:flamethrower']);
  assert.deepEqual(skillProgressRows(registries, run).map((row) => row.id), [classSkillId('reaver')],
    'it has no label, so it cannot become a bar');
  assert.deepEqual(staleSkillTracks(registries, fresh()), [], 'and a clean ledger reports none');
});

test('a class the registry does not declare fails by name', () => {
  assert.throws(() => skillProgressRows(registries, { class: 'nope', skills: {} }),
    /'nope' is not a class the registry declares/);
});

test('includeUntouched opens the whole ledger, and the summary names the levels', () => {
  const run = fresh();
  const all = skillProgressRows(registries, run, { includeUntouched: true });
  assert.equal(all.length, skillTracks(registries).length);
  assert.equal(skillProgressSummary([]), 'No track trained yet');
  assert.match(skillProgressSummary(skillProgressRows(registries, run)), /Reaver 0/);
  const summary = skillProgressSummary(all);
  assert.match(summary, /\+\d+ more$/, 'past three tracks it counts the rest rather than listing them');
  assert.equal(summary.split(' · ').length, 4, 'three names and the count');
});
