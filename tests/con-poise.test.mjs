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
import { gameProfileRatingReceipt } from '../src/model/gameProfileRun.js';
import { creationBrief } from '../src/model/creationBrief.js';
import { gameModule, gameContent } from '../src/model/gameProfile.js';
import { resolveGearItem } from '../engine/kernel/gameConfig.js';
import { gameProfileEffectiveAttributes } from '../src/model/gameProfileGear.js';

// Owner, 2026-11-18: "con should also increase poise by 1 point each level with HP." Each Constitution point is +5 HP (Core 2,
// owner 2026-11-17) and +1 maximum Poise. The Poise term is the derived `poise` row (base 1, Constitution 1), read once through the
// rating receipt: no second source in `stats.json` levelGains.
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const meta = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const mk = (classId) => createRunState({ registries: reg, classId, seed: 511, profileMeta: meta });
const fightPoise = (run) => createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] }).player.persistentPoise.max;

// Measured at level 1. Before the 2026-11-18 gear rule: reaver 8, starseer 5, rogue 8, herald 5 (every item floored at 1 Poise point).
// After: a non-defensive one-hander (staff, dagger) adds 0, the Greatsword still adds its 6, and the starting armour is not a catalogue item.
// 2026-11-18 (gear pass A): the four starting outfits now resolve to their gear items (Poise from their points) and every worn piece adds its type or group base (Heavy +2, Medium +1, Light 0, Shield +1; the items keep their own Poise).
const LEVEL_ONE_POISE = { reaver: 17, starseer: 8, rogue: 5, herald: 8 };
// A staff or sceptre grants 1 Ward at the start of each turn (owner, 2026-11-18), and a Ward stack is +5 maximum Poise while it lasts.
const WARD_AT_FIGHT_START = { reaver: 0, starseer: 5, rogue: 0, herald: 5 };

test('level-1 Poise per class is 1 + CON + the Poise the worn gear adds', () => {
  for (const [classId, expected] of Object.entries(LEVEL_ONE_POISE)) {
    const run = mk(classId);
    assert.equal(fightPoise(run), expected + WARD_AT_FIGHT_START[classId], `${classId} opens a fight at ${expected} Poise (+ its Ward)`);
    const receipt = gameProfileRatingReceipt(reg, run);
    const attribute = receipt.sources.filter((s) => s.kind === 'attribute').reduce((sum, s) => sum + s.poise, 0);
    assert.equal(attribute, 1 + gameProfileEffectiveAttributes(reg, run).constitution, `${classId}: the attribute term is the row's base 1 plus CON, counted once`);
    assert.equal(receipt.totals.poise, expected);
  }
});

test('one allocated CON point is +5 HP and +1 max Poise, and the preview says so before it is applied', () => {
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

test('other attributes do not move Poise (no double count)', () => {
  const run = mk('reaver');
  const base = fightPoise(run);
  run.level.unspentPoints = 3;
  for (const id of ['strength', 'dexterity', 'intelligence']) allocateAttributePoint(reg, run, id);
  assert.equal(fightPoise(run), base);
});

test('the CON attribute card names +5 HP and +1 Poise per point', () => {
  const run = mk('reaver');
  const con = creationBrief(reg, run).stats.find((s) => s.id === 'constitution');
  assert.equal(con.face.summary, '+5 HP per pt · +1 Poise per pt');
});

// Owner, 2026-11-18: max Poise = 1 + CON + other Poise bonuses. Guarding gear (armour, shields, defensive two-handers) adds its Poise;
// a one-hander that is not defensive adds 0 unless it authors some.
test('gear adds Poise only when its ratings weights name Poise', () => {
  const run = mk('reaver');
  const settings = gameModule(run, 'gear');
  const points = (id) => resolveGearItem(gameContent(run, 'gear').find((i) => i.id === id), settings, {}).points.poise;
  for (const id of ['dagger', 'shortbow', 'katana', 'twinblade', 'ashStaff', 'boneSceptre', 'lantern', 'torch', 'buckler']) assert.equal(points(id), 0, `${id} adds no Poise`);
  for (const id of ['greatsword', 'halberd', 'warhammer', 'kiteShield', 'towerShield', 'roundShield', 'armor.wayfarerPlate', 'armor.gutterLeathers']) assert.ok(points(id) >= 1, `${id} adds Poise`);
});
