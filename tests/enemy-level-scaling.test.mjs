// SPEC §17, Enemy levels and stat budget (owner, 2026-11-20): a Core enemy's fight level comes from its act,
// tier and floor step (characters.enemyLevelScaling); each floor step makes it tougher, with SP capped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { characterSettings, resolveGameAuthor, enemyFightLevel, enemyLevel, enemyEffectiveLevel, enemyScalingHpFactor, resolveEnemyAttributes, enemyPools, enemyItemBonuses, canonicalGameJSON } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, validateGameProfileSnapshot } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';

const author = JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url)));
const profile = resolveGameAuthor(author, loadGameProfileCatalog());
const liveSettings = characterSettings(profile.modules);
// Precise boundary, allocation and cap regressions own their small numerical
// scenario. They do not take their inputs from today's authored balance tables.
const settings = {
  levelFrom: 'levelProfile.min', rounding: 'down', attributePointsPerLevel: 1,
  attributeFill: { floor: 1, defaultPriority: ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'],
    priorityWeights: [4, 3, 2, 1, 0], caps: {} },
  tagRules: { 'character.player': { attributeBudget: [6, 6] }, 'character.enemy': {},
    'tier.minion': { pools: { sp: 2 } }, 'tier.elite': { pools: { sp: 3 } }, 'tier.boss': { pools: { sp: 3 } } },
  statRules: { hp: { constitution: 5, perLevel: 5 }, sp: { dexterity: 1 }, mp: { wisdom: 1 } },
  enemyLevelScaling: {
    floorsPerStep: 3, bossSteps: 2, hpPerStep: 0.08, gearPerStep: { ar: 1, dr: 1 },
    levels: { act1: { minion: [1, 2, 3], elite: [2, 3, 4], boss: 5 },
      act2: { minion: [3, 4, 5], elite: [4, 5, 6], boss: 8 },
      act3: { minion: [5, 6, 7], elite: [6, 7, 8], boss: 11 } },
    attributeCaps: { elite: { dexterity: 4, wisdom: 4 }, boss: { dexterity: 4, wisdom: 4 } },
    spCap: { minion: 2, elite: 3, boss: 3 },
  },
};
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

test('only stepped tier rows gain their configured HP factor', () => {
  assert.deepEqual([0, 1, 2].map(step => enemyScalingHpFactor(row('minion'), settings, step)), [1, 1.08, 1.16]);
  assert.equal(enemyScalingHpFactor(row('boss'), settings, 2), 1);
  assert.equal(enemyScalingHpFactor(row('minion'), { ...settings, enemyLevelScaling: null }, 2), 1);
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

test('current authored act/floor levels, gear steps and HP settings reach live fights', () => {
  assert.deepEqual(core.gameProfile.modules.characters, profile.modules.characters, 'generated settings equal independently compiled source');
  assert.deepEqual(core.gameProfile.content.enemies, profile.content.enemies, 'generated enemies equal independently compiled source');
  const scaling = liveSettings.enemyLevelScaling;
  for (const [actId, tiers] of Object.entries(scaling.levels)) {
    const act = Number(actId.slice(3));
    for (const [tier, levels] of Object.entries(tiers)) {
      const definition = profile.content.enemies.find(enemy => enemy.tier === tier);
      if (!definition) continue; // A configured tier may have no current authored members.
      const steps = Array.isArray(levels) ? levels.map((_, step) => step) : [scaling.bossSteps || 0];
      for (const step of steps) {
        const floor = 1 + step * scaling.floorsPerStep;
        const enemy = fightEnemy(core, definition.id, act, floor);
        assert.deepEqual([enemy.level, enemy.levelStep], [Array.isArray(levels) ? levels[step] : levels, step]);
        assert.equal(enemy.ratings.ar - enemy.attributes.strength, (scaling.gearPerStep.ar || 0) * step);
        assert.equal(enemy.ratings.dr - enemy.attributes.dexterity, (scaling.gearPerStep.dr || 0) * step);
        const scale = liveSettings.hpScaleByTier?.[tier] ?? 1;
        if (liveSettings.effectiveLevelHp && enemyEffectiveLevel(definition, liveSettings, 1) !== null) {
          const pools = enemyPools({ ...definition, resolvedAttributes: enemy.ownAttributes }, liveSettings, enemy.level,
            enemyItemBonuses(definition, profile.content, profile.modules.gear));
          assert.equal(enemy.maxHp, Math.max(1, Math.round(pools.hp * scale)));
        } else {
          const factor = Array.isArray(levels) ? 1 + scaling.hpPerStep * step : 1;
          const [low, high] = core.enemies.get(definition.id).hp;
          const possible = Array.from({ length: high - low + 1 }, (_, index) =>
            Math.max(1, Math.round(Math.max(1, Math.round((low + index) * factor)) * scale)));
          assert.ok(possible.includes(enemy.maxHp), `${definition.id} HP follows its source range, step and tier scale`);
        }
      }
    }
  }
});

test('current enemies follow their source SP caps and attribute caps', () => {
  const scaling = liveSettings.enemyLevelScaling;
  const act = Object.keys(scaling.levels).length;
  const floor = 1 + scaling.floorsPerStep * Math.max(...Object.values(scaling.levels).flatMap(tiers =>
    Object.values(tiers).filter(Array.isArray).map(levels => levels.length - 1)));
  for (const definition of profile.content.enemies) {
    const enemy = fightEnemy(core, definition.id, act, floor);
    const cap = scaling.spCap?.[definition.tier];
    if (Number.isSafeInteger(cap)) assert.ok(enemy.maxStamina <= cap, `${definition.id} SP ${enemy.maxStamina} <= ${cap}`);
    const caps = { ...liveSettings.attributeFill.caps, ...scaling.attributeCaps?.[definition.tier], ...definition.attributeCaps };
    for (const [attribute, max] of Object.entries(caps)) assert.ok(enemy.ownAttributes[attribute] <= max, `${definition.id} ${attribute} <= ${max}`);
  }
});

// A controlled snapshot without enemyLevelScaling keeps its configured levels on every floor.
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
  for (const row of old.gameProfile.content.enemies.filter((enemy, index, all) => all.findIndex(other => other.tier === enemy.tier) === index)) {
    const id = row.id, act = 2;
    const [low, high] = [2, 8].map(floor => fightEnemy(old, id, act, floor));
    assert.ok(!('levelStep' in low), `${id} has no level step`);
    assert.deepEqual(plain(high), plain(low), `${id} does not move with the floor`);
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
