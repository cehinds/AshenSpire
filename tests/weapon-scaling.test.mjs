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
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { levelUpPreview, weaponScalingFacts } from '../src/model/levelUpPreview.js';

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
  assert.equal(ar(battleaxe, stats({ strength: 4 })).attributeValue, 3);
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

test('a graded weapon never reads below the flat rating, and equals it at or below the anchor', () => {
  // Regression: the anchor share and the graded share were floored apart, so
  // the anchor's leftover half-point was lost (dagger DEX at STR 4 read 1 graded
  // against 2 flat; an ungraded-but-weighted WIS read one below flat forever).
  const graded = registries.equipment.armaments.filter((piece) => piece.scaling);
  assert.ok(graded.length > 0);
  for (const piece of graded) {
    const ratingId = registries.equipment.basicCardProfiles.find((p) => p.id === piece.attackProfile).ratingId;
    for (const attributeId of ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence']) {
      for (let v = 1; v <= 20; v++) {
        const attributes = stats({ [attributeId]: v });
        const flat = effectiveEquipmentRating(defaultRatingFormula, attributes, piece, { ratingId }, ratingId).value;
        const withGrades = effectiveEquipmentRating(defaultRatingFormula, attributes, piece, { ratingId }, ratingId, scaling).value;
        assert.ok(withGrades >= flat, `${piece.id} ${attributeId} ${v}: graded ${withGrades} >= flat ${flat}`);
        if (v <= scaling.anchor) assert.equal(withGrades, flat, `${piece.id} ${attributeId} ${v}: at or below the anchor graded is flat`);
      }
    }
  }
  // Every attribute at once, too (the ungraded-but-weighted terms).
  for (const piece of graded) {
    const ratingId = registries.equipment.basicCardProfiles.find((p) => p.id === piece.attackProfile).ratingId;
    for (let v = 1; v <= 20; v++) {
      const attributes = stats({ strength: v, dexterity: v, constitution: v, wisdom: v, intelligence: v });
      const flat = effectiveEquipmentRating(defaultRatingFormula, attributes, piece, { ratingId }, ratingId).value;
      const withGrades = effectiveEquipmentRating(defaultRatingFormula, attributes, piece, { ratingId }, ratingId, scaling).value;
      assert.ok(withGrades >= flat, `${piece.id} all at ${v}: graded ${withGrades} >= flat ${flat}`);
    }
  }
});

test('the graded receipt carries its grades, anchor and coefficients', () => {
  const receipt = gradedAttributeRatingReceipt(defaultRatingFormula, stats({ intelligence: 5, wisdom: 4 }), 'pr', { intelligence: 'A' }, scaling);
  // INT: floor(0.5 × 3 + 1.5 × 2) = floor(4.5) = 4; WIS (ungraded): the flat floor(0.5 × 4) = 2.
  assert.equal(receipt.terms.intelligence, 4);
  assert.equal(receipt.terms.wisdom, 2);
  assert.equal(receipt.value, 6);
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
  const { pieces: _pieces, ...table } = run.equipmentProfileRuleSnapshot.weaponScaling;
  assert.deepEqual(table, { anchor: 3, grades: { S: 2, A: 1.5, B: 1, C: 0.75, D: 0.5 } });
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

// PR review: the run snapshotted the anchor and the coefficients but read the
// weapon's grade letters off the live registry piece, so a content update that
// regrades a weapon (Straight Sword STR B -> S) re-priced a climb in progress.
test('the run snapshots each weapon\'s grades: a regrade in a content update does not re-price a saved run', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries });
  const pieces = run.equipmentProfileRuleSnapshot.weaponScaling.pieces;
  assert.deepEqual(pieces.straightSword, { ...armament('straightSword').scaling });
  for (const piece of registries.equipment.armaments) {
    assert.deepEqual(pieces[piece.id], piece.scaling ? { ...piece.scaling } : undefined, `${piece.id}: every graded piece and no other`);
  }
  // The update: Straight Sword STR B -> S.
  assert.equal(armament('straightSword').scaling.strength, 'B');
  const regradedRows = contentBundle.equipment.weaponScaling.map((r) => (r.itemId === 'straightSword' && r.attributeId === 'strength' ? { ...r, grade: 'S' } : r));
  const regradedArmaments = contentBundle.equipment.armaments.map((piece) => (piece.id === 'straightSword' ? { ...piece, scaling: { ...piece.scaling, strength: 'S' } } : piece));
  const regradedBundle = { ...contentBundle, equipment: { ...contentBundle.equipment, weaponScaling: regradedRows, armaments: regradedArmaments } };
  const updated = createRegistries(regradedBundle);
  assert.equal(updated.equipment.armaments.find((piece) => piece.id === 'straightSword').scaling.strength, 'S');

  const saved = restoreEquipmentProfileRuleSnapshot(JSON.parse(JSON.stringify(run.equipmentProfileRuleSnapshot)), updated);
  const reloaded = { ...structuredClone(run), equipmentProfileRuleSnapshot: saved };
  const strike = run.deck.find((card) => card.equipmentRole === 'attack' && card.weaponId === 'straightSword');
  assert.ok(strike, 'the reaver swings the Straight Sword');
  const high = { ...run.attributes, strength: 6 };
  const before = deckCardReceipt(registries, run, strike, high);
  const after = deckCardReceipt(updated, reloaded, strike, high);
  assert.equal(after.rating.attributeValue, before.rating.attributeValue, 'priced at the grade the run was born under (B), not the update\'s S');
  assert.equal(after.value, before.value);
  assert.equal(after.rating.scaling.grades.strength, 'B');
  // A new run on the updated content prices the new grade.
  const fresh = createRunState({ seed: 5, classId: 'reaver', registries: updated });
  assert.ok(deckCardReceipt(updated, fresh, strike, high).value > before.value, 'a new run reads the S');

  // A save from before the per-weapon grades (table, no pieces) keeps its
  // current behaviour: the live piece's letters under its own table.
  const older = structuredClone(reloaded);
  delete older.equipmentProfileRuleSnapshot.weaponScaling.pieces;
  assert.equal(deckCardReceipt(updated, older, strike, high).rating.scaling.grades.strength, 'S');
  // A save without any table still prices flat.
  const oldest = structuredClone(reloaded);
  delete oldest.equipmentProfileRuleSnapshot.weaponScaling;
  assert.equal(deckCardReceipt(updated, oldest, strike, high).rating.scaling, undefined);
  // The shrine's grade fact reads the run's letter too.
  const facts = weaponScalingFacts(updated, { ...reloaded, attributes: high });
  assert.equal(facts.strength.find((f) => f.pieceId === 'straightSword').grade, 'B');

  // The save door refuses a malformed per-weapon map by name.
  const bad = (piecesValue) => ({ ...saved, weaponScaling: { ...saved.weaponScaling, pieces: piecesValue } });
  assert.throws(() => restoreEquipmentProfileRuleSnapshot(bad([]), updated), /weaponScaling\.pieces: must be an object/);
  assert.throws(() => restoreEquipmentProfileRuleSnapshot(bad({ straightSword: 'B' }), updated), /weaponScaling\.pieces\.straightSword: must be an object/);
  assert.throws(() => restoreEquipmentProfileRuleSnapshot(bad({ straightSword: { strength: 'Z' } }), updated), /pieces\.straightSword\.strength: grade 'Z' is not in the table/);
  assert.throws(() => restoreEquipmentProfileRuleSnapshot(bad({ straightSword: { luck: 'B' } }), updated), /pieces\.straightSword\.luck: unknown attribute/);
  // Balance never carries the per-weapon map: that lives in weaponScaling.csv.
  assert.match(weaponScalingProblems({ ...scaling, pieces: {} }).join('\n'), /balance\.weaponScaling\.pieces: unknown field/);
});

test('under the combat-ratings module the stamp and the preview read flat, as the fight does', () => {
  // Regression: the fight prices a strike off the player's own ratings there
  // (engine/combatRatings.js), which the grades never touch, yet the stamp,
  // the Level-up preview and the shrine fact priced the grade: "Strike 8 ->
  // 14" for a hit that landed 10.
  const on = createRegistries(configuredContentBundle(contentBundle, { 'gameConfig.combatRatings.enabled': true }));
  assert.equal(on.balance.combatRatings.enabled, true);
  const run = createRunState({ seed: 5, classId: 'reaver', registries: on });
  run.level.unspentPoints = 3;
  const strike = run.deck.find((card) => card.equipmentRole === 'attack');
  const high = { ...run.attributes, strength: 6 };
  const receipt = deckCardReceipt(on, run, strike, high);
  assert.equal(receipt.rating.scaling, undefined, 'no grade priced under the ratings module');
  assert.equal(receipt.rating.attributeValue, attributeRatingReceipt(on.balance.combatRatings, high, 'ar').value);
  const row = levelUpPreview(on, run, { strength: 3 }).rows.find((r) => r.role === 'attack' && r.pieceId === 'straightSword');
  const flatGain = attributeRatingReceipt(on.balance.combatRatings, high, 'ar').value - attributeRatingReceipt(on.balance.combatRatings, run.attributes, 'ar').value;
  assert.equal(row.after - row.before, flatGain, 'the preview moves by the flat rating only');
  assert.deepEqual(weaponScalingFacts(on, run), {}, 'no "+N dmg next point" fact the fight would not pay');
  // Off (the default), the same run prices the grade: 1 + 3 at STR 6.
  const offRun = createRunState({ seed: 5, classId: 'reaver', registries });
  assert.equal(deckCardReceipt(registries, offRun, offRun.deck.find((card) => card.equipmentRole === 'attack'), { ...offRun.attributes, strength: 6 }).rating.attributeValue, 4);
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
  assert.deepEqual(model.facts.filter((fact) => fact.grade).map((fact) => `${fact.label} ${fact.value}`), ['STR B', 'DEX C']);
  const shield = equipmentCardModel(registries, armament('roundShield'));
  assert.equal(shield.scaling, null);
  assert.equal(shield.facts.some((fact) => fact.grade), false);
});
