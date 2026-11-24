import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
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

// Historical owner ruling, 2026-11-18: CON supplied +5 HP and +1 maximum Poise.
// Preserve that exact contract using the genuine resolved Dev profile at 6727a25530,
// before the later WIS-to-Poise ruling. Its saved derived row is read once through the rating receipt.
const profile = resolveGameProfile(JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-6727a255.json.gz', import.meta.url)))));
const registriesFor = (own) => bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, own)), own);
const reg = registriesFor(profile);
const currentReg = registriesFor(resolveGameProfile('default'));
const meta = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const mk = (classId, registries = reg) => createRunState({ registries, classId, seed: 511, profileMeta: meta });
const fightPoise = (run, registries = reg) => createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] }).player.persistentPoise.max;

// Exact historical Dev 6727a255 profile controls: no current equipment type/group grants or start-of-turn Ward.
const LEVEL_ONE_POISE = { reaver: 8, starseer: 2, rogue: 2, herald: 2 };

test('historical level-1 Poise per class is 1 + CON + the Poise the worn gear adds', () => {
  for (const [classId, expected] of Object.entries(LEVEL_ONE_POISE)) {
    const run = mk(classId);
    assert.equal(fightPoise(run), expected, `${classId} opens a historical fight at ${expected} Poise`);
    const receipt = gameProfileRatingReceipt(reg, run);
    const attribute = receipt.sources.filter((s) => s.kind === 'attribute').reduce((sum, s) => sum + s.poise, 0);
    assert.equal(attribute, 1 + gameProfileEffectiveAttributes(reg, run).constitution, `${classId}: the attribute term is the row's base 1 plus CON, counted once`);
    assert.equal(receipt.totals.poise, expected);
  }
});

test('historical allocated CON is +5 HP and +1 max Poise, and the preview says so before it is applied', () => {
  for (const classId of Object.keys(LEVEL_ONE_POISE)) {
    const run = mk(classId);
    const before = { hp: run.maxHp, poise: fightPoise(run) };
    run.level.unspentPoints = 2;
    const preview = attributePointGains(reg, run, 'constitution');
    assert.equal(attributeGainSummary(preview), '+5 HP, +1 Poise');
    allocateAttributePoint(reg, run, 'constitution');
    assert.equal(run.maxHp - before.hp, preview.find((g) => g.statId === 'hp').delta, `${classId} HP: preview == applied`);
    assert.equal(run.maxHp - before.hp, 5);
    assert.equal(fightPoise(run) - before.poise, preview.find((g) => g.statId === 'poise').delta, `${classId} Poise: preview == applied`);
    assert.equal(fightPoise(run) - before.poise, 1);
    allocateAttributePoint(reg, run, 'constitution');
    assert.equal(fightPoise(run) - before.poise, 2, 'two points are +2 Poise');
  }
});

test('historical other attributes do not move Poise (no double count)', () => {
  const run = mk('reaver');
  const base = fightPoise(run);
  run.level.unspentPoints = 3;
  for (const id of ['strength', 'dexterity', 'intelligence']) allocateAttributePoint(reg, run, id);
  assert.equal(fightPoise(run), base);
});

test('the historical CON attribute card names +5 HP and +1 Poise per point', () => {
  const run = mk('reaver');
  const con = creationBrief(reg, run).stats.find((s) => s.id === 'constitution');
  assert.equal(con.face.summary, '+5 HP per pt · +1 Poise per pt');
});

// Historical owner ruling, 2026-11-18: max Poise = 1 + CON + other Poise bonuses. Guarding gear (armour, shields, defensive two-handers) adds its Poise;
// a one-hander that is not defensive adds 0 unless it authors some.
test('historical gear adds Poise only when its ratings weights name Poise', () => {
  const run = mk('reaver');
  const settings = gameModule(run, 'gear');
  const points = (id) => resolveGearItem(gameContent(run, 'gear').find((i) => i.id === id), settings, {}).points.poise;
  for (const id of ['dagger', 'shortbow', 'katana', 'twinblade', 'ashStaff', 'boneSceptre', 'lantern', 'torch', 'buckler']) assert.equal(points(id), 0, `${id} adds no Poise`);
  for (const id of ['greatsword', 'halberd', 'warhammer', 'kiteShield', 'towerShield', 'roundShield', 'armor.wayfarerPlate', 'armor.gutterLeathers']) assert.ok(points(id) >= 1, `${id} adds Poise`);
});

test('current Core previews and allocations give CON only Health and WIS only the attribute Poise term, for every class', () => {
  for (const classId of Object.keys(LEVEL_ONE_POISE)) {
    const run = mk(classId, currentReg);
    const before = { hp: run.maxHp, poise: fightPoise(run, currentReg) };
    const receipt = gameProfileRatingReceipt(currentReg, run);
    const attribute = receipt.sources.filter((source) => source.kind === 'attribute').reduce((sum, source) => sum + source.poise, 0);
    assert.equal(attribute, 1 + gameProfileEffectiveAttributes(currentReg, run).wisdom, `${classId}: base plus effective WIS, counted once`);
    run.level.unspentPoints = 5;
    const con = attributePointGains(currentReg, run, 'constitution');
    assert.equal(attributeGainSummary(con), '+5 HP');
    assert.equal(con.find((gain) => gain.statId === 'poise')?.delta || 0, 0);
    allocateAttributePoint(currentReg, run, 'constitution');
    assert.equal(run.maxHp - before.hp, con.find((gain) => gain.statId === 'hp').delta, `${classId} CON preview matches applied HP`);
    assert.equal(run.maxHp - before.hp, 5);
    assert.equal(fightPoise(run, currentReg), before.poise, `${classId} CON does not buy Poise`);
    const wisdom = attributePointGains(currentReg, run, 'wisdom');
    assert.equal(wisdom.find((gain) => gain.statId === 'poise').delta, 1);
    assert.equal(wisdom.find((gain) => gain.statId === 'hp')?.delta || 0, 0);
    allocateAttributePoint(currentReg, run, 'wisdom');
    assert.equal(fightPoise(run, currentReg) - before.poise, 1, `${classId} WIS preview matches applied Poise`);
    assert.equal(run.maxHp, before.hp + 5, `${classId} WIS does not buy Health`);
    for (const id of ['strength', 'dexterity', 'intelligence']) {
      const preview = attributePointGains(currentReg, run, id);
      assert.equal(preview.find((gain) => gain.statId === 'poise')?.delta || 0, 0, `${classId} ${id} preview has no Poise`);
      allocateAttributePoint(currentReg, run, id);
      assert.equal(fightPoise(run, currentReg), before.poise + 1, `${classId} ${id} does not double-count Poise`);
    }
  }
});

test('current Core attribute cards name Constitution Health and Wisdom Poise for every class', () => {
  for (const classId of Object.keys(LEVEL_ONE_POISE)) {
    const rows = creationBrief(currentReg, mk(classId, currentReg)).stats;
    const con = rows.find((row) => row.id === 'constitution');
    const wisdom = rows.find((row) => row.id === 'wisdom');
    assert.equal(con.face.mainSummary, 'Health');
    assert.equal(con.face.summary, '+5 HP per pt');
    assert.equal(wisdom.face.mainSummary, 'Poise · Divine magic');
    assert.match(wisdom.face.summary, /\+1 Poise per pt/);
  }
});
