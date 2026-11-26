// SPEC §17, Enemy levels and stat budget (owner, 2026-11-20): a Core enemy's fight level comes from its act,
// tier and floor step (characters.enemyLevelScaling); each floor step makes it tougher, with SP capped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { characterSettings, resolveGameAuthor, enemyFightLevel, enemyLevel, enemyEffectiveLevel, resolveEnemyAttributes, enemyPools, canonicalGameJSON } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, validateGameProfileSnapshot } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';

const author = JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url)));
const profile = resolveGameAuthor(author, loadGameProfileCatalog());
const settings = characterSettings(profile.modules);
const row = (tier, extra = {}) => ({ id: `probe.${tier}`, tags: ['character.enemy', `tier.${tier}`], levelProfile: { min: 1, max: 2 }, ...extra });

test('enemyFightLevel reads the act and tier row at the floor step', () => {
  const minion = row('minion'), elite = row('elite');
  const at = (r, act, floor) => enemyFightLevel(r, settings, { act, floor });
  assert.deepEqual([2, 5, 8].map(floor => at(minion, 1, floor)), [{ level: 1, step: 0 }, { level: 2, step: 1 }, { level: 3, step: 2 }]);
  assert.deepEqual([1, 3, 4, 6, 7, 9].map(floor => at(minion, 2, floor).level), [3, 3, 4, 4, 5, 5]);
  assert.deepEqual([1, 4, 7].map(floor => at(elite, 3, floor).level), [6, 7, 8]);
});

test('a boss sits at its act level and bossSteps', () => {
  const boss = row('boss');
  assert.deepEqual(enemyFightLevel(boss, settings, { act: 1, floor: 10 }), { level: 5, step: 2 });
  assert.deepEqual(enemyFightLevel(boss, settings, { act: 2, floor: 10 }), { level: 8, step: 2 });
  assert.deepEqual(enemyFightLevel(boss, settings, { act: 3, floor: 10 }), { level: 11, step: 2 });
});

test('the step stops at the last table entry and the last act holds past the table', () => {
  assert.deepEqual(enemyFightLevel(row('minion'), settings, { act: 1, floor: 30 }), { level: 3, step: 2 });
  assert.deepEqual(enemyFightLevel(row('elite'), settings, { act: 7, floor: 1 }), { level: 6, step: 0 });
  assert.deepEqual(enemyFightLevel(row('minion'), settings, { act: 1, floor: 0 }), { level: 1, step: 0 });
});

test('without enemyLevelScaling the level is the levelFrom bound at step 0', () => {
  const { enemyLevelScaling, ...old } = settings;
  assert.ok(enemyLevelScaling, 'Core carries the table');
  const minion = row('minion', { levelProfile: { min: 2, max: 3 } });
  assert.deepEqual(enemyFightLevel(minion, old, { act: 3, floor: 9 }), { level: enemyLevel(minion, old), step: 0 });
  assert.deepEqual(enemyFightLevel(row('champion'), settings, { act: 1, floor: 9 }), { level: 1, step: 0 });
});

test('elite and boss Dex and Wis stop at 4 and the held points spill to the other priorities', () => {
  for (const tier of ['elite', 'boss']) {
    const r = row(tier, { level: 11, attributePriority: ['dexterity', 'wisdom', 'strength', 'constitution', 'intelligence'] });
    const own = resolveEnemyAttributes(r, settings);
    assert.ok(own.dexterity <= 4 && own.wisdom <= 4, `${tier} ${JSON.stringify(own)}`);
    assert.equal(Object.values(own).reduce((a, b) => a + b, 0), 16, `${tier} keeps its 5 + level budget`);
  }
  const minion = resolveEnemyAttributes(row('minion', { level: 11, attributePriority: ['dexterity', 'wisdom', 'strength', 'constitution', 'intelligence'] }), settings);
  assert.ok(minion.dexterity > 4, 'minions are not capped');
});

test('when every weighted priority is capped, the rest spills to the attributes with room', () => {
  // Review, 2026-11-20: a boss whose only priorities are the capped Dex and Wis used to keep 11 of its 16 points.
  const boss = row('boss', { level: 11, attributePriority: ['dexterity', 'wisdom'] });
  const own = resolveEnemyAttributes(boss, settings);
  assert.equal(Object.values(own).reduce((a, b) => a + b, 0), 16, JSON.stringify(own));
  assert.ok(own.dexterity <= 4 && own.wisdom <= 4, JSON.stringify(own));
  // Nothing has room: the fill stops at the caps instead of looping.
  const full = Object.fromEntries(['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'].map(id => [id, 2]));
  const boxed = resolveEnemyAttributes(row('boss', { level: 11, attributeCaps: full }), settings);
  assert.deepEqual(boxed, full);
});

test('SP stops at the tier cap after gear and relics', () => {
  const rich = { sp: 5 };
  for (const [tier, cap] of Object.entries({ minion: 2, elite: 3, boss: 3 })) {
    const r = row(tier, { level: 11, attributePriority: ['dexterity', 'constitution', 'wisdom', 'intelligence', 'strength'] });
    assert.equal(enemyPools(r, settings, 11, rich).sp, cap, tier);
    const { enemyLevelScaling, ...old } = settings;
    assert.ok(enemyPools(r, old, 11, rich).sp > cap, `${tier} uncapped without the table`);
  }
});

// Headless Core fights, built the way the live game builds them (createRunCombat).
const coreRegistries = (gameProfile = resolveGameProfile('default')) =>
  bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, gameProfile)), gameProfile);
const core = coreRegistries();
function fightEnemy(registries, enemyId, act, floor, seed = 77) {
  const run = createRunState({ registries, classId: 'reaver', seed });
  run.actNumber = act;
  run.floor = floor;
  return createRunCombat({ registries, run, rng: createRng(seed), enemyIds: [enemyId] }).enemies[0];
}
const tierOf = id => profile.content.enemies.find(e => e.id === id).tier;

test('an act-1 minion on floors 2, 5 and 8 is level 1, 2 and 3 with +8% HP and +1 AR and DR a step', () => {
  assert.equal(tierOf('wanderingSoldier'), 'minion');
  const [low, mid, high] = [2, 5, 8].map(floor => fightEnemy(core, 'wanderingSoldier', 1, floor));
  assert.deepEqual([low, mid, high].map(e => [e.level, e.levelStep]), [[1, 0], [2, 1], [3, 2]]);
  // Same seed, same rolled HP: only the step factor (and rounding) separates them.
  for (const [e, ratio] of [[mid, 1.08], [high, 1.16]]) assert.ok(Math.abs(e.maxHp / low.maxHp - ratio) < 0.04, `HP ${low.maxHp} -> ${e.maxHp}`);
  // AR and DR follow STR and DEX plus the gear step: strip the attribute part to see the step alone.
  const gear = e => [e.ratings.ar - e.attributes.strength, e.ratings.dr - e.attributes.dexterity];
  assert.deepEqual([low, mid, high].map(gear), [[0, 0], [1, 1], [2, 2]]);
});

test('an act-2 boss is level 8 and an act-3 boss level 11, both at the boss gear step with no HP step', () => {
  assert.equal(tierOf('stitchedKing'), 'boss');
  const king = fightEnemy(core, 'stitchedKing', 2, 10);
  assert.deepEqual([king.level, king.levelStep], [8, 2]);
  assert.equal(king.ratings.ar - king.attributes.strength, 2);
  assert.equal(fightEnemy(core, 'ashheartDragon', 3, 10).level, 11);
});

test('no boss or elite exceeds SP 3 and no minion SP 2; elite and boss Dex and Wis stay at 4 or less before gear', () => {
  // Act 3, floor 8 is the top of the table, so the most points and the most SP any enemy can carry.
  for (const e of profile.content.enemies) {
    const enemy = fightEnemy(core, e.id, 3, 8);
    const cap = e.tier === 'minion' ? 2 : 3;
    assert.ok(enemy.maxStamina <= cap, `${e.id} SP ${enemy.maxStamina}`);
    if (e.tier !== 'minion') assert.ok(enemy.ownAttributes.dexterity <= 4 && enemy.ownAttributes.wisdom <= 4, `${e.id} ${JSON.stringify(enemy.ownAttributes)}`);
  }
});

// An older snapshot carries no enemyLevelScaling: its fights keep today's levels and never move with the floor.
const plain = value => JSON.parse(JSON.stringify(value));
function withoutScaling() {
  const old = plain(resolveGameProfile('default'));
  delete old.modules.characters.enemyLevelScaling;
  const { hash: _hash, ...payload } = old;
  old.hash = `sha256:${createHash('sha256').update(canonicalGameJSON(payload)).digest('hex')}`;
  return resolveGameProfile(old);
}

test('an older snapshot without enemyLevelScaling fights as before, whatever the floor', () => {
  const old = coreRegistries(withoutScaling());
  const oldSettings = characterSettings(old.gameProfile.modules);
  for (const [id, act] of [['wanderingSoldier', 1], ['courtDuelist', 2], ['stitchedKing', 2]]) {
    const [low, high] = [2, 8].map(floor => fightEnemy(old, id, act, floor));
    assert.ok(!('levelStep' in low), `${id} has no level step`);
    assert.deepEqual(plain(high), plain(low), `${id} does not move with the floor`);
    const row = old.gameProfile.content.enemies.find(e => e.id === id);
    assert.equal(low.level, enemyEffectiveLevel(row, oldSettings, act) ?? enemyLevel(row, oldSettings), id);
    assert.equal(low.ratings.ar, low.attributes.strength, `${id} has no gear step`);
  }
});

test('a historical saved profile fights the same on every floor', () => {
  const historical = validateGameProfileSnapshot(JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url)))));
  const registries = coreRegistries(historical);
  const [low, high] = [2, 8].map(floor => fightEnemy(registries, 'wanderingSoldier', 1, floor));
  assert.ok(!('levelStep' in low));
  assert.deepEqual(plain(high), plain(low));
});
