import { GearVocabularyEnabled } from '../src/model/gearEffects.js';
import { parseMod } from '../src/model/loadout.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { manifestIds } from '../tools/art-source.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { equipmentCardModel, equipmentCardTokens } from '../src/model/equipmentCard.js';
import { armourMenuAsset } from '../src/model/paintedOutfitArt.js';
import { armamentIconAsset } from '../src/model/equipmentArt.js';
import { core2Registries } from './helpers/core2.mjs';
import { legacyGearRegistries } from './helpers/legacy-gear.mjs';
const r = createRegistries(contentBundle);

test('current Staff inspector shows Ward, Prepared Focus and its signature beside configured stats', () => {
  const current = core2Registries(), piece = current.equipment.armaments.find(p => p.id === 'ashStaff');
  const m = equipmentCardModel(current, piece), labels = m.bonuses.map(b => b.label);
  assert.ok(labels.includes('Start of turn: +1 Ward'));
  assert.ok(labels.includes('Spells in Prepared stance: -1 MP cost'));
  assert.ok(labels.includes('Power: +2 Potency'));
  assert.ok(m.facts.some(f => f.label === 'intelligence' && f.value === 1), 'configured attribute receipt remains');
  assert.ok(!m.typeExplanation.includes('every spell'), 'classification copy must not claim unconditional Focus');
  assert.ok(m.bonuses.every(b => !b.value.includes('=') && !b.label.includes('@')), 'no raw modifier strings');
});

test('current Hammer inspector shows on-hit Vulnerable and Poise-break Retreat with its signature', () => {
  const current = core2Registries(), piece = current.equipment.armaments.find(p => p.id === 'warhammer');
  const labels = equipmentCardModel(current, piece).bonuses.map(b => b.label);
  assert.ok(labels.includes('Physical attacks: +1 Poise damage'));
  assert.ok(labels.includes('Smashes: apply 1 Vulnerable'));
  assert.ok(labels.includes('Smashes that break Poise: +1 Retreat on hit'));
  assert.ok(labels.includes('Strike: +6 Poise'));
});

test('current Heavy inspector keeps configured stats and adds group Poise, Thorns and signature rules once', () => {
  const current = core2Registries(), piece = current.equipment.armour.find(p => p.id === 'wayfarerPlate' && p.classId === 'reaver');
  const m = equipmentCardModel(current, piece), labels = m.bonuses.map(b => b.label);
  assert.ok(labels.includes('6 Poise. Gain 1 Constitution.'));
  assert.equal(labels.filter(label => label === '+2 Poise').length, 1);
  assert.equal(labels.filter(label => label === '+1 Thorns').length, 1);
  assert.ok(labels.includes('Defend cards: +2 Block'));
  assert.ok(labels.includes('+4 Max HP'), 'signature pool remains when configured item supplies none');
  assert.equal(m.facts.find(f => f.label === 'Poise').value, 6, 'group bonus is additional to the configured item receipt');
});

test('Light and Medium inspector conditions name the held status', () => {
  const current = core2Registries();
  for (const [id, stance, status] of [['gutterLeathers', 'Defend', 'Evade'], ['vigil', 'Counter', 'Counter']]) {
    const piece = current.equipment.armour.find(p => p.id === id);
    assert.ok(equipmentCardModel(current, piece).bonuses.some(b => b.label === `End of turn in ${stance} stance, while holding ${status}: +1 ${status}`));
  }
});

test('an absent-version inspector preserves its legacy configured output without type or signature leakage', () => {
  const old = legacyGearRegistries(core2Registries());
  const staff = equipmentCardModel(old, old.equipment.armaments.find(p => p.id === 'ashStaff'));
  assert.deepEqual(staff.bonuses, []);
  assert.match(staff.typeExplanation, /every spell by 1/);
  const plate = equipmentCardModel(old, old.equipment.armour.find(p => p.id === 'wayfarerPlate' && p.classId === 'reaver'));
  assert.deepEqual(plate.bonuses.map(b => b.label), ['6 Poise. Gain 1 Constitution.']);
  assert.ok(!JSON.stringify(plate.bonuses).includes('Thorns'));
});
test('every canonical equipment item has complete card facts, bonuses and available painted identity', () => {
  for (const p of [...r.equipment.armaments, ...r.equipment.armour]) {
    const m = equipmentCardModel(r, p);
    assert.equal(m.name, p.name);
    assert.equal(m.bonuses.length, p.mods.filter(raw => GearVocabularyEnabled(r, r.equipment.modFields[parseMod(raw).field]) && !(p.kind === 'armor' && /^defend\.block=[+-]/.test(raw))).length);
    assert.equal(m.tags.length, p.tags.length);
    assert.ok(m.facts.every(f => Number.isFinite(f.value) && f.explanation));
    assert.ok(m.bonuses.every(b => b.explanation && !b.label.includes('undefined')));
    assert.ok(manifestIds().has(p.kind === 'armor' ? armourMenuAsset(p.classId,p.id) : armamentIconAsset(p)), p.id);
  }
});
test('modifier copy preserves assignment versus signed changes and authored mechanics', () => {
  const p = r.equipment.armaments[0];
  const m = equipmentCardModel(r, {...p, mods:['strike.hits=3','strike.damage=-2','self.strength=+1','power.potency=+2']});
  assert.match(m.bonuses[0].label,/Set to 3 Hits/);
  assert.match(m.bonuses[1].label,/-2 Damage/);
  assert.match(m.bonuses[2].label,/\+1 starting Strength/);
  assert.match(m.bonuses[3].explanation,/Every number on the card/);
  assert.match(equipmentCardModel(r,r.equipment.armour[0]).facts.find(f => f.label === 'Poise').explanation,/displayed only/);
});
test('requirements and hybrid item types retain authored identity', () => {
  const m=equipmentCardModel(r,r.equipment.armaments.find(p=>p.id==='greatsword'));
  assert.match(m.requirement,/STR 3/);
  const hybrid=equipmentCardModel(r,r.equipment.armaments.find(p=>p.id==='parryDagger'));
  assert.match(hybrid.type,/Blade \/ Shield/);
  assert.match(hybrid.typeExplanation,/Blade/);
});

test("default card layout preserves artwork and keeps all regions within the frame", () => {
  const tokens = equipmentCardTokens();
  assert.equal(tokens.heights.art, 270);
  assert.ok(tokens.heights.effects >= 54);
  assert.ok(Object.values(tokens.heights).every(height => height > 0));
  assert.ok(Object.values(tokens.heights).reduce((sum, height) => sum + height, 0) <= tokens.budget);
});

test('a card with no tag badges gives the tag row to the effect row, never to the artwork', () => {
  const full = equipmentCardTokens();
  const bare = equipmentCardTokens(undefined, { collapse: ['tags'] });
  assert.equal(bare.heights.tags, 0);
  assert.equal(bare.heights.art, full.heights.art);
  assert.ok(bare.heights.effects > full.heights.effects);
  assert.ok(Object.values(bare.heights).reduce((sum, height) => sum + height, 0) <= bare.budget + 1e-9);
});

// THE READING DOOR'S LEVEL IS NOT THE CALLER'S TO SET (Copilot review, #1127).
// `renderEquipmentInspection` spread `options` AFTER its own `level: 'inspect'`,
// so a caller handing a level down overrode it — and `collectibleCard.js`
// forwards `{ ...options }` verbatim, which is a live path for it. The result
// was a card inspected at browsing size with its text cut: the exact defect the
// sizing work closes. Asserted on the source rather than through a DOM, because
// the fault was the ORDER of two keys in one object literal and that is what has
// to stay put.
test('the inspect door pins its own level, whatever a caller forwards through options', () => {
  const source = readFileSync(new URL('../src/ui/components/equipmentCard.js', import.meta.url), 'utf8');
  const call = source.match(/export function renderEquipmentInspection[\s\S]*?renderEquipmentCard\([^;]*?\);/);
  assert.ok(call, 'renderEquipmentInspection still calls renderEquipmentCard');
  const spreadAt = call[0].indexOf('...options');
  const levelAt = call[0].indexOf("level: 'inspect'");
  assert.ok(spreadAt >= 0 && levelAt >= 0, 'the door still spreads options and sets its own level');
  assert.ok(levelAt > spreadAt,
    "level: 'inspect' must come AFTER ...options so a forwarded level cannot override the reading door");
});

test('armor defend.block shows additive defense bonuses once and preserves other effects', () => {
 const m = equipmentCardModel(r, {...r.equipment.armour[0], mods:['defend.block=+2','self.maxHp=+4']});
 // Owner 2026-11-18 (§8): DR is gone, so the additive defend.block bonus reads as Block.
 assert.equal(m.facts[0].label, 'Block');
 assert.equal(m.facts[0].value, 2);
 assert.equal(m.bonuses.length, 1);
 assert.match(m.bonuses[0].label, /4/);
});

test('an armament card shows the weight it adds to equip load, itemWeightScale applied', async () => {
  const { pieceWeight } = await import('../src/model/statProjection.js');
  const piece = r.equipment.armaments.find(p => p.id === 'straightSword');
  const weight = equipmentCardModel(r, piece).facts.find(f => f.label === 'Weight');
  assert.equal(weight.value, pieceWeight(piece));
  assert.notEqual(weight.value, piece.weight, 'the authored weight is on the pre-lean scale; the card shows the load');
});
