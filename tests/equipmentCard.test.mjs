import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { equipmentCardModel } from '../src/model/equipmentCard.js';
import { armourMenuAsset } from '../src/model/paintedOutfitArt.js';
const r = createRegistries(contentBundle);
test('every canonical equipment item has complete card facts, bonuses and available painted identity', () => {
  for (const p of [...r.equipment.armaments, ...r.equipment.armour]) {
    const m = equipmentCardModel(r, p);
    assert.equal(m.name, p.name);
    assert.equal(m.bonuses.length, p.mods.length);
    assert.equal(m.tags.length, p.tags.length);
    assert.ok(m.facts.every(f => Number.isFinite(f.value) && f.explanation));
    assert.ok(m.bonuses.every(b => b.explanation && !b.label.includes('undefined')));
    assert.ok(existsSync(p.kind === 'armor' ? armourMenuAsset(p.classId,p.id) : `assets/equipment/icon_${p.id}.webp`), p.id);
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
