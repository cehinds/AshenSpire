// tests/character-progression.test.mjs — the Armoury's two climbs, read as
// models: the character level bar and the skill-track rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { levelProgress, skillProgressRows, skillProgressSummary } from '../src/model/progression.js';
import { awardLevelXp, xpToNext as levelXpToNext } from '../src/model/levelup.js';
import { awardSkillXp, classSkillId, skillTracks, xpToNext as skillXpToNext } from '../src/model/skills.js';

const registries = createRegistries(contentBundle);
const fresh = () => ({ class: 'reaver', level: { xp: 0, level: 1, unspentPoints: 0 }, skills: {} });

test('the level bar reads the same step the shrine spends', () => {
  const run = fresh();
  const start = levelProgress(registries, run);
  assert.equal(start.level, 1);
  assert.equal(start.xp, 0);
  assert.equal(start.xpToNext, levelXpToNext(registries, 1));
  assert.equal(start.pct, 0);
  assert.equal(start.points, 0);
  assert.equal(start.value, `0 / ${start.xpToNext} XP`);
  assert.equal(start.remaining, start.xpToNext);

  run.level.xp = Math.floor(start.xpToNext / 2);
  const half = levelProgress(registries, run);
  assert.ok(half.pct > 45 && half.pct < 55, `half a step reads about half a bar, got ${half.pct}`);
  assert.equal(half.remaining, half.xpToNext - half.xp);
});

test('a level climbed moves the bar to the next step and names the waiting point', () => {
  const run = fresh();
  awardLevelXp(registries, run, levelXpToNext(registries, 1));
  const after = levelProgress(registries, run);
  assert.equal(after.level, 2);
  assert.equal(after.xp, 0);
  assert.equal(after.xpToNext, levelXpToNext(registries, 2));
  assert.equal(after.points, 1);
  assert.match(after.sense, /1 point waiting/);
});

test('a capped run reads full rather than empty', () => {
  const run = fresh();
  const capped = levelProgress({ ...registries, balance: { ...registries.balance, levelUp: { ...registries.balance.levelUp, maxLevels: 1 } } }, run);
  assert.equal(capped.capped, true);
  assert.equal(capped.pct, 100);
  assert.equal(capped.value, 'Level cap');
  assert.equal(capped.remaining, 0);
});

test('the skill rows list the run\'s own class track and every track it has touched', () => {
  const run = fresh();
  const own = classSkillId('reaver');
  const bare = skillProgressRows(registries, run);
  assert.deepEqual(bare.map((r) => r.id), [own], 'an untrained run shows its class ladder and nothing it has not touched');
  assert.equal(bare[0].level, 0);
  assert.equal(bare[0].xpToNext, skillXpToNext(registries, 'class', 0));

  const sword = skillTracks(registries).find((t) => t.kind === 'weapon');
  awardSkillXp(registries, run, sword.id, skillXpToNext(registries, 'weapon', 0));
  const rows = skillProgressRows(registries, run);
  assert.deepEqual(rows.map((r) => r.id), [own, sword.id], 'the class track leads, the trained track follows');
  const trained = rows[1];
  assert.equal(trained.level, 1);
  assert.equal(trained.pendingDrafts, 1);
  assert.equal(trained.xpToNext, skillXpToNext(registries, 'weapon', 1));
  assert.match(trained.sense, /draft waiting/);
  assert.equal(rows.every((r) => r.pct >= 0 && r.pct <= 100), true);
});

test('includeUntouched opens the whole ledger, and the summary names the levels', () => {
  const run = fresh();
  const all = skillProgressRows(registries, run, { includeUntouched: true });
  assert.equal(all.length, skillTracks(registries).length);
  assert.equal(skillProgressSummary([]), 'No track trained yet');
  const summary = skillProgressSummary(skillProgressRows(registries, run));
  assert.match(summary, /Reaver 0/);
});
