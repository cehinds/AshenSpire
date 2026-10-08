import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { applyCombatExpansionMartial } from '../src/content/combatExpansionMartial.js';
import { combatExpansionEquipment } from '../src/content/combatExpansionEquipment.js';
import { combatStatusRules } from '../src/content/combatStatusRules.js';
import { expandedEquipmentProjection, expandedEnemyProjection, expansionCarrierTraits } from '../src/engine/combatExpansionEquipment.js';
import { ensureExpandedStarterCoverage } from '../src/model/combatExpansionStarter.js';
import { expandedEnemyMove, enemyMoveCarrier } from '../src/engine/combatCardTactics.js';

const r = createRegistries(contentBundle);
const maneuvers = run => run.deck.map(ref => combatProfileFor(applyCombatExpansionMartial(resolveCard(r, ref))))
  .filter(profile => profile.camp === 'physical').map(profile => profile.maneuver);

test('all four composed starter classes keep Attack, Smash and Counter without losing bound grants', () => {
  for (const cls of r.classes.all()) {
    const run = createRunState({ seed: 7, classId: cls.id, registries: r });
    const grants = run.deck.filter(card => card.grantSource).map(card => card.instanceId);
    ensureExpandedStarterCoverage(r, run);
    for (const maneuver of ['attack', 'smash', 'counter']) assert.ok(maneuvers(run).includes(maneuver), `${cls.id}/${maneuver}`);
    assert.ok(grants.every(id => run.deck.some(card => card.instanceId === id)));
    assert.ok(run.deck.length <= Math.max(r.balance.startingDeckSize, run.deck.filter(card => card.grantSource).length));
    const stable = JSON.stringify(run.deck);
    assert.deepEqual(ensureExpandedStarterCoverage(r, run), []);
    assert.equal(JSON.stringify(run.deck), stable);
  }
});

test('old runs stay unchanged; explicit unmounted grants repair a spell-only composed deck', () => {
  const run = createRunState({ seed: 7, classId: 'starseer', registries: r });
  run.combatExpansionVersion = 1;
  const original = JSON.stringify(run);
  assert.deepEqual(ensureExpandedStarterCoverage(r, run), []);
  assert.equal(JSON.stringify(run), original);
  run.combatExpansionVersion = 2;
  const spell = r.cards.all().find(card => combatProfileFor(card).camp === 'spell');
  run.deck = [{ instanceId: 'bound-spell', cardId: spell.id, upgraded: false, grantSource: 'from:global' }];
  run.equipmentAttackSlotCount = 0;
  ensureExpandedStarterCoverage(r, run);
  for (const role of ['attack', 'smash', 'counter']) assert.ok(maneuvers(run).includes(role));
  assert.ok(run.deck.some(card => card.instanceId === 'bound-spell'));
  for (const card of run.deck.filter(card => card.instanceId.startsWith('expansionStarter:'))) {
    assert.equal(card.grantSource, r.balance.equipment.startingDeck.sources.global);
    assert.equal(card.equipmentRole, undefined); assert.equal(card.profileId, undefined);
  }
});

test('authored equipment catalog covers every real armor, armament and enemy identity', () => {
  for (const piece of r.equipment.armour) assert.ok(combatExpansionEquipment.armour[`${piece.classId}:${piece.id}`]
    || combatExpansionEquipment.sharedArmour[piece.id], `${piece.classId}:${piece.id}`);
  for (const piece of r.equipment.armaments) assert.ok(combatExpansionEquipment.armaments[piece.id], piece.id);
  for (const enemy of r.enemies.all()) assert.ok(combatExpansionEquipment.enemies[enemy.id], enemy.id);
});

test('equipment reads active slots and class scoped armor, with no storage or stale swapped traits', () => {
  const run = createRunState({ seed: 7, classId: 'reaver', registries: r });
  const before = JSON.stringify(run.loadout);
  const metal = expandedEquipmentProjection(r, run.loadout, 'reaver');
  assert.equal(metal.armorClass, 'medium'); assert.equal(metal.damageResistanceFlat.slashing, 1);
  assert.equal(metal.damageResistanceFlat.piercing, 1); assert.equal(metal.combatTraits.conductive, true);
  assert.equal(JSON.stringify(run.loadout), before);
  run.loadout.sets.armor[0] = 'vigil';
  run.loadout.sets.rightHand = ['shortbow', 'greatsword', null];
  run.loadout.sets.leftHand = [null, 'towerShield', null];
  run.loadout.storage = ['towerShield'];
  const bow = expandedEquipmentProjection(r, run.loadout, 'reaver');
  assert.equal(bow.combatTraits.conductive, undefined); assert.deepEqual(bow.damageResistanceFlat, { frost: 1 });
  run.loadout.active.rightHand = 1; run.loadout.active.leftHand = 1;
  assert.equal(expandedEquipmentProjection(r, run.loadout, 'reaver').combatTraits.conductive, true);
  assert.deepEqual(expandedEquipmentProjection(r, null, 'reaver').damageResistanceFlat, {});
});

test('enemy typed weaknesses and caster traits are explicit and inherited by incoming profiles', () => {
  const knight = expandedEnemyProjection('gildedKnight');
  assert.equal(knight.armorClass, 'heavy'); assert.deepEqual(knight.damageWeaknessPercent, { blunt: 25, decay: 25 });
  const caster = expandedEnemyProjection('graveWisp'); assert.equal(caster.combatTraits.caster, true);
  const carrier = expansionCarrierTraits({ combatProfile: { traits: ['projectile'] } }, caster);
  assert.deepEqual(carrier.combatProfile.traits, ['projectile', 'caster']);
});

test('all tagged enemy moves project camp, delivery, gauged pressure and spell Barrier without mutation', () => {
  const ctx = { combatExpansionVersion: 2 };
  const harmful = new Set(['frail', 'weak', 'bleed', 'crimsonBlight', 'frost', 'insanity']);
  let count = 0, pressure = 0, spellGuards = 0;
  for (const def of r.enemies.all()) for (const [id, move] of Object.entries(def.moves)) {
    const enemy = { enemyId: def.id, ...expandedEnemyProjection(def.id) }, original = JSON.stringify(move);
    const projected = expandedEnemyMove(enemy, move, id, ctx), profile = enemyMoveCarrier(enemy, move, id, ctx).combatProfile;
    assert.ok(['physical', 'spell'].includes(profile.camp), `${def.id}/${id}`);
    assert.ok(['contact', 'near', 'far'].includes(profile.reach)); assert.ok(['single', 'area'].includes(profile.targeting));
    assert.equal(JSON.stringify(move), original);
    assert.equal(expandedEnemyMove(enemy, move, id, { combatExpansionVersion: 1 }), move);
    for (const effect of projected.effects) {
      assert.ok(!(effect.op === 'applyStatus' && effect.target === 'player' && harmful.has(effect.status)), `${def.id}/${id}`);
      if (effect.op === 'buildup') { assert.ok(combatStatusRules.statuses[effect.status]); assert.equal(effect.camp, profile.camp); pressure++; }
    }
    if (profile.camp === 'spell' && move.block != null) {
      assert.equal(projected.block, undefined); assert.equal(projected.barrier, move.block + (move.barrier || 0)); spellGuards++;
    }
    count++;
  }
  assert.ok(count >= 100); assert.ok(pressure > 10); assert.ok(spellGuards > 0);
});
