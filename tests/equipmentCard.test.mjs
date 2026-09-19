import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { equipmentCardModel, equipmentCardTokens } from '../src/model/equipmentCard.js';
import { armourMenuAsset } from '../src/model/paintedOutfitArt.js';
import { armamentIconAsset } from '../src/model/equipmentArt.js';
const r = createRegistries(contentBundle);
test('every canonical equipment item has complete card facts, bonuses and available painted identity', () => {
  for (const p of [...r.equipment.armaments, ...r.equipment.armour]) {
    const m = equipmentCardModel(r, p);
    assert.equal(m.name, p.name);
    assert.equal(m.bonuses.length, p.mods.length);
    assert.equal(m.tags.length, p.tags.length);
    assert.ok(m.facts.every(f => Number.isFinite(f.value) && f.explanation));
    assert.ok(m.bonuses.every(b => b.explanation && !b.label.includes('undefined')));
    assert.ok(existsSync(p.kind === 'armor' ? armourMenuAsset(p.classId,p.id) : armamentIconAsset(p)), p.id);
  }
});
test('modifier copy preserves assignment versus signed changes and authored mechanics', () => {
  const p = r.equipment.armaments[0];
  const m = equipmentCardModel(r, {...p, mods:['strike.hits=3','strike.damage=-2','self.strength=+1','power.potency=+2']});
  assert.match(m.bonuses[0].label,/Set to 3 Hits/);
  assert.match(m.bonuses[1].label,/-2 Damage/);
  assert.match(m.bonuses[2].label,/\+1 starting Strength/);
  assert.match(m.bonuses[3].explanation,/Every number on the card/);
  assert.match(equipmentCardModel(r,r.equipment.armour[0]).facts[0].explanation,/displayed only/);
});
test('requirements and hybrid item types retain authored identity', () => {
  const m=equipmentCardModel(r,r.equipment.armaments.find(p=>p.id==='greatsword'));
  assert.match(m.requirement,/STR 12/);
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
