import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { equipmentCardModel } from '../src/model/equipmentCard.js';
import { wireframeUi } from '../src/content/wireframeUi.js';
import {
  possessionVariant, equipmentKind, relicEffectModes, consumablePurposes,
} from '../src/ui/models/PossessionVariantModel.js';

const r = createRegistries(contentBundle);
const armament = (id) => r.equipment.armaments.find((p) => p.id === id);
const equipment = (piece) => {
  const model = equipmentCardModel(r, piece);
  return possessionVariant(r, piece, { kind: 'equipment', bonuses: model.bonuses,
    attributeRequirement: model.requirement.startsWith('Requires ') ? model.requirement : null });
};
const text = (variant) => variant.lines.map((row) => row.text);
const ids = (variant) => variant.lines.map((row) => row.id);

test('weapon and armour are told apart by their own fields, never by id', () => {
  assert.ok(r.equipment.armaments.every((p) => equipmentKind(p) === 'weapon'));
  assert.ok(r.equipment.armour.every((p) => equipmentKind(p) === 'armor'));
  // A renamed row is still what its data says it is.
  assert.equal(equipmentKind({ ...armament('greatsword'), id: 'renamed' }), 'weapon');
  assert.equal(equipmentKind({ ...r.equipment.armour[0], id: 'renamed' }), 'armor');
  assert.equal(equipmentKind({ id: 'greatsword' }), null);
});

test('WC2a1 weapon: hand / requirements, then the granted card package with its modifiers', () => {
  const sword = equipment(armament('straightSword'));
  assert.deepEqual([...sword.families], ['WC2', 'WC2a', 'WC2a1']);
  assert.equal(sword.requirement, 'Requires STR 10', 'the authored requirement holds row one');
  assert.ok(sword.omitted.some((o) => o.id === 'WC2a1.body.detail2' && o.part === 'hand'));
  const free = possessionVariant(r, { ...armament('straightSword'), requirements: undefined }, { kind: 'equipment' });
  assert.equal(free.requirement, 'Either hand', 'with no requirement the authored hand is the row');
  const oddHand = possessionVariant(r, { ...armament('straightSword'), hand: 'tail' }, { kind: 'equipment' });
  assert.equal(oddHand.requirement, null, 'an unlabelled hand is left off, not guessed');
  assert.equal(sword.heading, 'Granted card package');
  assert.deepEqual(sword.entries.map((e) => e.label), ['Weapon art: Guard Counter']);
  assert.deepEqual([...sword.regions.facts], ['WC2a1.body.detail1']);
  const greatsword = equipment(armament('greatsword'));
  assert.equal(greatsword.entries[0].label, 'Weapon art: Sundering Hew');
  assert.equal(greatsword.entries.length, 1 + armament('greatsword').mods.length);
  // Scaling and the equipped comparison are not authored; they are noted, not drawn.
  assert.ok(sword.omitted.some((o) => o.id === 'WC2a1.body.detail1' && o.part === 'scaling'));
  assert.ok(sword.omitted.some((o) => o.id === 'WC2a.body.detail2'));
  for (const piece of r.equipment.armaments) {
    const variant = equipment(piece);
    assert.ok(variant.entries.every((e) => e.label && e.explanation), piece.id);
    assert.ok(!variant.omitted.some((o) => o.part === 'weapon art'), `${piece.id} weapon art resolves`);
  }
});

test('WC2a2 armour: authored Poise stays the defense row; weight and resistance are noted absent', () => {
  const outfit = r.equipment.armour.find((p) => p.mods.length);
  const variant = equipment(outfit);
  assert.deepEqual([...variant.families], ['WC2', 'WC2a', 'WC2a2']);
  assert.equal(variant.heading, 'Granted modifiers');
  assert.equal(variant.entries.length, outfit.mods.length);
  assert.equal(variant.requirement, null, 'the class-outfit requirement is kept from the card model');
  assert.deepEqual(variant.omitted.filter((o) => o.id.startsWith('WC2a2')).map((o) => o.part).sort(), ['resistance', 'weight']);
  const plain = equipment(r.equipment.armour.find((p) => !p.mods.length));
  assert.equal(plain.entries.length, 0);
  assert.equal(plain.empty, 'No granted modifiers');
});

test('WC2b1 / WC2b2: relic modes come from passives and triggers, and may coexist', () => {
  const relics = r.relics.all();
  assert.ok(relics.every((relic) => relicEffectModes(relic).length > 0), 'every shipped relic has an authored mode');
  const medallion = possessionVariant(r, r.relics.get('forsakenMedallion'), { kind: 'relic' });
  assert.deepEqual([...medallion.families], ['WC2', 'WC2b', 'WC2b1', 'WC2b2']);
  assert.equal(medallion.usage, 'Passive · Triggered');
  // Detail one of each family first, so the face leads with what the relic does.
  assert.deepEqual(ids(medallion), ['WC2b1.body.detail1', 'WC2b2.body.detail1', 'WC2b1.body.detail2', 'WC2b2.body.detail2']);
  assert.deepEqual(text(medallion), ['Passive: Max HP +10', 'Trigger: Damage dealt', 'Affects: HP', 'Limit: Once per combat']);
  const pouch = possessionVariant(r, r.relics.get('cinderPouch'), { kind: 'relic' });
  assert.deepEqual([...pouch.families], ['WC2', 'WC2b', 'WC2b1']);
  assert.deepEqual(text(pouch), ['Passive: Cinder gain ×1.25', 'Affects: Cinder gain']);
  const eye = possessionVariant(r, r.relics.get('feralEye'), { kind: 'relic' });
  assert.deepEqual(text(eye), ['Affects: Elite card choices'], 'a flag has no number to state');
  const coin = possessionVariant(r, r.relics.get('cutpursesCoin'), { kind: 'relic' });
  assert.deepEqual([...coin.families], ['WC2', 'WC2b', 'WC2b2']);
  assert.equal(coin.lines.at(-1).text, 'Limit: Combat start: No limit · Damage dealt: Once per combat', 'differing gates are paired with their events');
  assert.ok(coin.omitted.some((o) => o.part === 'cooldown'));
  // The declared attribute-tier tag (no shipped relic carries one yet).
  const tiered = possessionVariant(r, { id: 'probe', passives: { modifiers: [
    { tag: 'resource.attributeTier', resource: 'hp', sourceStat: 'strength', pointsPerTier: 5, amountPerTier: 2 },
    { tag: 'resource.attributeTier', resource: 'mana', sourceStat: 'strength', amountPerTier: 1 },
  ] } }, { kind: 'relic' });
  assert.deepEqual(text(tiered), ['Passive: Max HP +2 per 5 STR', 'Affects: HP · MP']);
  assert.ok(tiered.omitted.some((o) => o.part === 'resource.attributeTier'), 'an inherited tier size is noted, not guessed');
  for (const relic of relics) {
    const variant = possessionVariant(r, relic, { kind: 'relic' });
    assert.ok(!variant.omitted.some((o) => /No label/.test(o.reason)), `${relic.id}: ${JSON.stringify(variant.omitted)}`);
  }
});

test('WC2c1–WC2c3: consumable purpose comes from the effect opcode', () => {
  const flask = (id) => r.flasks.get(id);
  assert.deepEqual([...consumablePurposes(flask('crimsonFlask'), r)], ['healing']);
  assert.deepEqual([...consumablePurposes(flask('azureFlask'), r)], ['resource']);
  assert.deepEqual([...consumablePurposes(flask('wondrousDraught'), r)], [], 'a script states no purpose');
  const healing = possessionVariant(r, flask('crimsonFlask'), { kind: 'potion' });
  assert.deepEqual([...healing.families], ['WC2', 'WC2c', 'WC2c1']);
  assert.equal(healing.usage, 'Healing');
  assert.deepEqual(text(healing), ['Heals 25% of max HP']);
  const mana = possessionVariant(r, flask('azureFlask'), { kind: 'potion' });
  assert.deepEqual(text(mana), ['Restores 1 MP']);
  assert.equal(mana.lines[0].tint, r.resources.all().find((row) => row.id === 'mana').tint, 'WC2c2 wears the registered resource tint');
  assert.deepEqual(text(possessionVariant(r, flask('flaskOfFerocity'), { kind: 'potion' })), ['Strength 2 · Self']);
  assert.deepEqual(text(possessionVariant(r, flask('blightCoating'), { kind: 'potion' })), ['Crimson Blight 4 · Enemy']);
  assert.deepEqual(text(possessionVariant(r, flask('flaskOfStone'), { kind: 'potion' })), ['Block 15 · Self']);
  const draught = possessionVariant(r, flask('wondrousDraught'), { kind: 'potion' });
  assert.deepEqual([...draught.families], ['WC2', 'WC2c']);
  assert.equal(draught.lines.length, 0);
  // Charges show only when the host states them.
  assert.ok(healing.omitted.some((o) => o.id === 'WC2c1.body.detail2'));
  const counted = possessionVariant(r, flask('crimsonFlask'), { kind: 'potion', charges: 2 });
  assert.deepEqual(text(counted), ['Heals 25% of max HP', 'Charges: 2']);
  assert.equal(counted.lines[1].id, 'WC2c1.body.detail2');
  // A host with no registries (the flask door) still names resources and statuses.
  assert.deepEqual(text(possessionVariant(null, flask('azureFlask'), { kind: 'potion' })), ['Restores 1 MP']);
  assert.deepEqual(text(possessionVariant(null, flask('flaskOfFerocity'), { kind: 'potion' })), ['Strength 2 · Self']);
});

test('every number a row states is one the item authors', () => {
  const numbers = (s) => (s.match(/\d+(?:\.\d+)?/g) || []);
  const check = (item, variant) => {
    const source = JSON.stringify(item);
    for (const row of variant.lines || []) {
      for (const n of numbers(row.text)) assert.ok(source.includes(n), `${item.id}: '${row.text}' states ${n}`);
    }
  };
  for (const relic of r.relics.all()) check(relic, possessionVariant(r, relic, { kind: 'relic' }));
  for (const flask of r.flasks.all()) check(flask, possessionVariant(r, flask, { kind: 'potion' }));
});

test('the face budget comes from wireframeUi.possession and refuses a bad value', () => {
  const variant = possessionVariant(r, r.relics.get('forsakenMedallion'), { kind: 'relic' });
  assert.deepEqual({ ...variant.face }, { lines: wireframeUi.possession.faceLines, effects: wireframeUi.possession.faceEffects });
  assert.ok(Object.isFrozen(variant) && Object.isFrozen(variant.lines[0]));
  assert.throws(() => possessionVariant(r, r.relics.get('feralEye'), { kind: 'relic' }, { faceLines: 0, faceEffects: 2 }), /faceLines/);
  assert.throws(() => possessionVariant(r, {}, { kind: 'card' }), /unknown kind/);
});
