// SPEC §13.4o — weapon scaling grades price the points above the anchor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import {
  attributeRatingReceipt, defaultRatingFormula, effectiveEquipmentRating, gradedAttributeRatingReceipt,
  weaponScalingProblems,
} from '../src/model/ratingFormula.js';
import { createEquipmentProfileRuleSnapshot, deckCardReceipt, restoreEquipmentProfileRuleSnapshot, validateEquipment } from '../src/model/loadout.js';
import { validateContent } from '../src/model/validate.js';
import { equipmentCardModel } from '../src/model/equipmentCard.js';

const registries = createRegistries(contentBundle);
const scaling = registries.balance.weaponScaling;
const armament = (id) => registries.equipment.armaments.find((piece) => piece.id === id);
const stats = (overrides = {}) => ({ strength: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 1, ...overrides });
const ar = (piece, attributes, table = scaling) => effectiveEquipmentRating(defaultRatingFormula, attributes, piece, { ratingId: 'ar' }, 'ar', table);

test('the grade table and the anchor are the authored ones', () => {
  assert.equal(scaling.anchor, 3);
  assert.deepEqual(Object.fromEntries(Object.entries(scaling.grades)), { S: 2, A: 1.5, B: 1, C: 0.75, D: 0.5 });
  assert.deepEqual(weaponScalingProblems(scaling), []);
});

test('an S weapon pays +2 a point above the anchor and the flat rating at or below it', () => {
  const greatsword = armament('greatsword');
  assert.equal(greatsword.scaling.strength, 'S');
  // At STR 3 (the anchor) the graded rating IS the flat one: floor(0.5 × 3) = 1.
  assert.equal(ar(greatsword, stats({ strength: 3 })).attributeValue, 1);
  assert.equal(ar(greatsword, stats({ strength: 3 })).value, 1 + greatsword.attackRating);
  assert.equal(ar(greatsword, stats({ strength: 4 })).attributeValue, 3);
  assert.equal(ar(greatsword, stats({ strength: 5 })).attributeValue, 5);
  // Below the anchor: the flat weight, never less.
  assert.equal(ar(greatsword, stats({ strength: 2 })).attributeValue, 1);
});

test('an A weapon pays +1, +2 across two points; B +1 a point; every step is at least +1 on S and A', () => {
  const battleaxe = armament('battleaxe');
  assert.equal(battleaxe.scaling.strength, 'A');
  assert.equal(ar(battleaxe, stats({ strength: 4 })).attributeValue, 2);
  assert.equal(ar(battleaxe, stats({ strength: 5 })).attributeValue, 4);
  const sword = armament('straightSword');
  assert.equal(sword.scaling.strength, 'B');
  assert.equal(ar(sword, stats({ strength: 4 })).attributeValue, 2);
  assert.equal(ar(sword, stats({ strength: 5 })).attributeValue, 3);
  for (const piece of registries.equipment.armaments.filter((row) => row.scaling)) {
    for (const [attributeId, grade] of Object.entries(piece.scaling)) {
      if (!['S', 'A'].includes(grade)) continue;
      const ratingId = registries.equipment.basicCardProfiles.find((p) => p.id === piece.attackProfile).ratingId;
      for (let v = 3; v < 10; v++) {
        const at = (n) => effectiveEquipmentRating(defaultRatingFormula, stats({ [attributeId]: n }), piece, { ratingId }, ratingId, scaling).value;
        assert.ok(at(v + 1) - at(v) >= 1, `${piece.id} ${attributeId} ${grade}: ${v} → ${v + 1} pays at least +1`);
      }
    }
  }
});

test('the graded receipt carries its grades, anchor and coefficients', () => {
  const receipt = gradedAttributeRatingReceipt(defaultRatingFormula, stats({ intelligence: 5, wisdom: 4 }), 'pr', { intelligence: 'A' }, scaling);
  // INT: floor(0.5 × 3) + floor(1.5 × 2) = 1 + 3; WIS (ungraded, keeps 0.5): floor(1.5) + floor(0.5) = 1 + 0.
  assert.equal(receipt.terms.intelligence, 4);
  assert.equal(receipt.terms.wisdom, 1);
  assert.equal(receipt.value, 5);
  assert.equal(receipt.coefficients.intelligence, 1.5);
  assert.equal(receipt.coefficients.wisdom, 0.5);
});

test('no-grade weapons, the dr rating and a missing grade table keep the flat formula byte for byte', () => {
  const ungraded = registries.equipment.armaments.filter((piece) => !piece.scaling);
  assert.ok(ungraded.some((piece) => piece.id === 'roundShield'));
  assert.ok(ungraded.some((piece) => piece.id === 'torch'));
  for (const piece of registries.equipment.armaments) {
    for (let v = 1; v <= 12; v++) {
      const attributes = stats({ strength: v, dexterity: v, wisdom: v, intelligence: v, constitution: v });
      for (const id of ['ar', 'pr', 'dr']) {
        const flat = effectiveEquipmentRating(defaultRatingFormula, attributes, piece, { ratingId: id }, id);
        assert.equal(flat.attributeValue, attributeRatingReceipt(defaultRatingFormula, attributes, id).value);
        assert.equal(flat.scaling, undefined);
        if (!piece.scaling || id === 'dr') {
          assert.deepEqual(effectiveEquipmentRating(defaultRatingFormula, attributes, piece, { ratingId: id }, id, scaling), flat,
            `${piece.id} ${id} at ${v}: an ungraded rating is the flat receipt, byte for byte`);
        }
      }
    }
  }
});

test('the run snapshots the grade table; a snapshot without it prices a graded weapon flat', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries });
  assert.deepEqual(run.equipmentProfileRuleSnapshot.weaponScaling, { anchor: 3, grades: { S: 2, A: 1.5, B: 1, C: 0.75, D: 0.5 } });
  const strike = run.deck.find((card) => card.equipmentRole === 'attack');
  const high = { ...run.attributes, strength: 6 };
  const graded = deckCardReceipt(registries, run, strike, high);
  const legacy = structuredClone(run);
  delete legacy.equipmentProfileRuleSnapshot.weaponScaling;
  const flat = deckCardReceipt(registries, legacy, strike, high);
  // Straight Sword STR B at 6: 1 + 3 graded, floor(3) flat.
  assert.equal(graded.rating.attributeValue, 4);
  assert.equal(flat.rating.attributeValue, 3);
  assert.equal(flat.rating.scaling, undefined);
  // At the preset's own STR 3 the two agree: creation damage did not move.
  assert.equal(deckCardReceipt(registries, run, strike).value, deckCardReceipt(registries, legacy, strike).value);
});

test('the snapshot door and the content door refuse a bad grade table or row by name', () => {
  const snapshot = createEquipmentProfileRuleSnapshot(registries);
  assert.throws(() => restoreEquipmentProfileRuleSnapshot({ ...snapshot, weaponScaling: { anchor: -1, grades: {} } }, registries), /weaponScaling\.anchor/);
  assert.throws(() => restoreEquipmentProfileRuleSnapshot({ ...snapshot, weaponScaling: { anchor: 3, grades: { S: 'x' } } }, registries), /grades\.S/);
  const rows = (extra) => {
    const bundle = { ...contentBundle, equipment: { ...contentBundle.equipment, weaponScaling: [...contentBundle.equipment.weaponScaling, extra] } };
    return validateEquipment(createRegistries(bundle)).join('\n');
  };
  assert.match(rows({ itemId: 'greatsword', attributeId: 'strength', grade: 'S' }), /duplicate 'greatsword:strength'/);
  assert.match(rows({ itemId: 'greatsword', attributeId: 'dexterity', grade: 'E' }), /grade 'E' is not in balance\.weaponScaling\.grades/);
  assert.match(rows({ itemId: 'greatsword', attributeId: 'luck', grade: 'A' }), /unknown attribute 'luck'/);
  assert.match(rows({ itemId: 'noSuchBlade', attributeId: 'strength', grade: 'A' }), /unknown item 'noSuchBlade'/);
  const armourId = registries.equipment.armour[0].id;
  assert.match(rows({ itemId: armourId, attributeId: 'strength', grade: 'A' }), /is armour/);
  const bad = { ...contentBundle, balance: { ...contentBundle.balance, weaponScaling: { anchor: 3, grades: { S: -1 } } } };
  assert.ok(validateContent(bad).errors.some((problem) => /weaponScaling\.grades\.S/.test(String(problem.path || problem))),
    'a negative coefficient is refused at the content door');
});

test('the equipment card names a graded weapon\'s grades and nothing for an ungraded one', () => {
  const model = equipmentCardModel(registries, armament('straightSword'));
  assert.equal(model.scaling, 'Scales STR B · DEX C');
  assert.equal(equipmentCardModel(registries, armament('roundShield')).scaling, null);
});
