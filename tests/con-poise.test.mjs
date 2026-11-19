import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { allocateAttributePoint } from '../src/model/levelup.js';
import { attributePointGains, attributeGainSummary } from '../src/model/attributePointPreview.js';
import { gameProfileRatingReceipt, gameProfileEffectiveAttributes } from '../src/model/gameProfileRun.js';
import { creationBrief } from '../src/model/creationBrief.js';
import { gameModule, gameContent } from '../src/model/gameProfile.js';
import { resolveGearItem } from '../engine/kernel/gameConfig.js';

// Latest owner rule: Wisdom governs Poise and Divine magic; Constitution gives
// +5 HP. The Poise row is base 1 + Wisdom, including effective gear attributes.
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const meta = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const mk = (classId) => createRunState({ registries: reg, classId, seed: 511, profileMeta: meta });
const fightPoise = (run) => createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] }).player.persistentPoise.max;

// Measured at level 1. Before the 2026-11-18 gear rule: reaver 8, starseer 5, rogue 8, herald 5 (every item floored at 1 Poise point).
// After: a non-defensive one-hander (staff, dagger) adds 0, the Greatsword still adds its 6, and the starting armour is not a catalogue item.
const LEVEL_ONE_POISE = { reaver: 8, starseer: 3, rogue: 2, herald: 4 };

test('level-1 Poise per class is 1 + effective WIS + the Poise the worn gear adds', () => {
  for (const [classId, expected] of Object.entries(LEVEL_ONE_POISE)) {
    const run = mk(classId);
    assert.equal(fightPoise(run), expected, `${classId} opens a fight at ${expected} Poise`);
    const receipt = gameProfileRatingReceipt(reg, run);
    const attribute = receipt.sources.filter((s) => s.kind === 'attribute').reduce((sum, s) => sum + s.poise, 0);
    assert.equal(attribute, 1 + gameProfileEffectiveAttributes(reg, run).wisdom, `${classId}: base 1 plus effective WIS, counted once`);
    assert.equal(receipt.totals.poise, expected);
  }
});

test('allocated CON gives +5 HP while WIS gives +1 Poise, and previews match the applied gains', () => {
  for (const classId of Object.keys(LEVEL_ONE_POISE)) {
    const run = mk(classId);
    const before = { hp: run.maxHp, poise: fightPoise(run) };
    run.level.unspentPoints = 3;
    const preview = attributePointGains(reg, run, 'constitution');
    assert.equal(attributeGainSummary(preview), '+5 HP');
    assert.equal(preview.some(gain => gain.statId === 'poise'), false);
    allocateAttributePoint(reg, run, 'constitution');
    assert.equal(run.maxHp - before.hp, preview.find((g) => g.statId === 'hp').delta, `${classId} HP: preview == applied`);
    assert.equal(run.maxHp - before.hp, 5);
    assert.equal(fightPoise(run), before.poise, `${classId}: CON adds no Poise`);
    const wisdom = attributePointGains(reg, run, 'wisdom');
    assert.equal(wisdom.find(gain => gain.statId === 'poise').delta, 1);
    allocateAttributePoint(reg, run, 'wisdom');
    assert.equal(fightPoise(run) - before.poise, 1, `${classId}: WIS preview == applied`);
    assert.equal(run.maxHp - before.hp, 5, 'WIS adds no Health');
    allocateAttributePoint(reg, run, 'wisdom');
    assert.equal(fightPoise(run) - before.poise, 2, 'two WIS points are +2 Poise');
  }
});

test('other attributes do not move Poise (no double count)', () => {
  const run = mk('reaver');
  const base = fightPoise(run);
  run.level.unspentPoints = 3;
  for (const id of ['strength', 'dexterity', 'intelligence']) allocateAttributePoint(reg, run, id);
  assert.equal(fightPoise(run), base);
});

test('attribute cards name Health for CON and Poise and Divine magic for WIS', () => {
  const run = mk('reaver');
  const con = creationBrief(reg, run).stats.find((s) => s.id === 'constitution');
  assert.equal(con.face.summary, '+5 HP per pt');
  assert.equal(con.face.mainSummary, 'Health');
  const wisdom = creationBrief(reg, run).stats.find(s => s.id === 'wisdom');
  assert.equal(wisdom.face.mainSummary, 'Poise · Divine magic');
});

// Owner, 2026-11-18: max Poise = 1 + WIS + other Poise bonuses. Guarding gear (armour, shields, defensive two-handers) adds its Poise;
// a one-hander that is not defensive adds 0 unless it authors some.
test('gear adds Poise only when its ratings weights name Poise', () => {
  const run = mk('reaver');
  const settings = gameModule(run, 'gear');
  const points = (id) => resolveGearItem(gameContent(run, 'gear').find((i) => i.id === id), settings, {}).points.poise;
  for (const id of ['dagger', 'shortbow', 'katana', 'twinblade', 'ashStaff', 'boneSceptre', 'lantern', 'torch', 'buckler']) assert.equal(points(id), 0, `${id} adds no Poise`);
  for (const id of ['greatsword', 'halberd', 'warhammer', 'kiteShield', 'towerShield', 'roundShield', 'armor.wayfarerPlate', 'armor.gutterLeathers']) assert.ok(points(id) >= 1, `${id} adds Poise`);
});
