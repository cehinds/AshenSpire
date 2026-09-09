import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { startingDeckRefs, stampDeck, WeaponCardPackageModel, reconcileGrantedCardsInCombat } from '../src/model/loadout.js';
import { startingEquipmentPreview } from '../src/model/startingEquipmentPreview.js';
import { removeDeckCard, canRemoveDeckCard } from '../src/model/cardRemoval.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

const r = createRegistries(contentBundle);
let cases = 0;
function fixture(right, left = null, classId = 'reaver', reg = r) {
  const run = createRunState({ seed: 896, classId, registries: reg });
  for (const [slot, id] of [['rightHand', right], ['leftHand', left]]) {
    run.loadout.active[slot] = 0;
    run.loadout.sets[slot][0] = id;
  }
  run.deck = startingDeckRefs(reg, run.loadout, classId).map((ref, i) => ({ ...ref, instanceId: `kit-test:${i}`, upgraded: false }));
  run.equipmentAttackSlotCount = run.deck.filter(c => c.equipmentRole === 'attack').length;
  stampDeck(reg, run);
  return run;
}
function combatFor(run, reg = r) {
  return createCombat({ registries: reg, rng: createRng(896), enemyIds: [contentBundle.enemies[0].id], player: {
    ...structuredClone(run), classId: run.class, relicIds: run.relics,
  } });
}
function play(combat, id) {
  const ref = Object.values(combat.piles).flat().find(c => c.cardId === id);
  assert.ok(ref, id);
  for (const pile of Object.values(combat.piles)) {
    const i = pile.indexOf(ref); if (i >= 0) pile.splice(i, 1);
  }
  combat.piles.hand.push(ref);
  combat.player.energy = 20;
  combat.player.stamina = combat.player.maxStamina;
  combat.player.mana = combat.player.maxMana;
  dispatch(combat, { type: 'playCard', cardInstanceId: ref.instanceId, targetId: combat.enemies[0].id });
  return ref;
}

for (const cls of r.classes.all()) for (const item of r.equipment.armaments) {
  const run = fixture(item.id, null, cls.id);
  const own = run.deck.filter(c => c.grantedBy === item.id);
  assert.equal(own.length, 3, `${cls.id}/${item.id}: three guaranteed contributions`);
  assert.deepEqual(own.filter(c => c.kitRole).map(c => c.kitRole).sort(), ['attack', 'guard']);
  assert.equal(own.filter(c => c.equipmentRole === 'weaponArt').length, 1);
  assert.ok(own.every(c => !canRemoveDeckCard(c)), 'item cards cannot be permanently removed');
  assert.equal(run.deck.length, Math.max(contentBundle.balance.startingDeckSize, own.length + 2));
  for (const ref of own) {
    assert.ok(resolveCard(r, ref).name);
    const combat = combatFor(run);
    const dealt = Object.values(combat.piles).flat().find(c => c.instanceId === ref.instanceId);
    assert.equal(dealt.grantedBy, ref.grantedBy);
    assert.equal(dealt.kitRole, ref.kitRole);
    assert.deepEqual(resolveCard(r, dealt), resolveCard(r, ref), 'combat keeps source scaling and smithing');
    play(combat, ref.cardId); // actual engine play, including off-class equipment Arts
  }
  cases++;
}
for (const a of r.equipment.armaments) for (const b of r.equipment.armaments) {
  if (a.id === b.id) continue;
  const run = fixture(a.id, b.id);
  assert.equal(new Set(run.deck.map(c => c.instanceId)).size, run.deck.length);
  for (const [slot, id] of [['rightHand', a.id], ['leftHand', b.id]]) {
    assert.equal(run.deck.filter(c => c.grantedBy === id).length, 3);
    const preview = startingEquipmentPreview(r, run, { rightHand: a.id, leftHand: b.id }, slot);
    assert.ok(preview.cards.some(c => c.ref.kitRole === 'attack'));
    assert.ok(preview.cards.some(c => c.ref.kitRole === 'guard'));
    assert.ok(preview.cards.some(c => c.ref.equipmentRole === 'weaponArt'));
    for (const { ref } of preview.cards) assert.ok(run.deck.some(c => JSON.stringify(resolveCard(r, c)) === JSON.stringify(resolveCard(r, ref))));
  }
  const before = JSON.stringify(run.deck); stampDeck(r, run); assert.equal(JSON.stringify(run.deck), before);
  cases++;
}
const tiny = createRegistries({ ...contentBundle, balance: { ...contentBundle.balance, startingDeckSize: 1 } });
const noFiller = fixture('straightSword', 'roundShield', 'reaver', tiny);
assert.equal(noFiller.equipmentAttackSlotCount, 0);
assert.equal(noFiller.deck.filter(c => c.kitRole === 'attack').length, 2);
const run = fixture('straightSword', 'kiteShield');
const removed = run.deck.find(c => c.equipmentAttackSlotId);
assert.ok(removeDeckCard(run, removed.instanceId));
const quota = run.equipmentAttackSlotCount;
const saves = createSaveManager(createMemoryStorage()); saves.saveRun(run, createRng(896));
const restored = saves.loadRun(r); assert.ok(restored); stampDeck(r, restored);
assert.equal(restored.equipmentAttackSlotCount, quota);
assert.ok(!restored.deck.some(c => c.instanceId === removed.instanceId));
assert.equal(restored.deck.filter(c => c.kitRole).length, 4);
const legacy = structuredClone(restored); legacy.deck = legacy.deck.filter(c => !c.kitRole);
stampDeck(r, legacy); assert.equal(legacy.deck.filter(c => c.kitRole).length, 4);
assert.ok(!legacy.deck.some(c => c.instanceId === removed.instanceId));
for (const cls of r.classes.all()) {
  const guardianRun = fixture('kiteShield', null, cls.id);
  let combat = combatFor(guardianRun);
  const guardian = play(combat, 'shieldGuardian');
  assert.ok(combat.piles.exhaust.some(c => c.instanceId === guardian.instanceId));
  assert.equal(combat.piles.hand.filter(c => c.cardId === 'guardianBulwark').length, 1);
  const generated = play(combat, 'guardianBulwark');
  assert.equal(combat.player.stanceId, 'bulwark');
  assert.ok(combat.piles.exhaust.some(c => c.instanceId === generated.instanceId));
  assert.ok(!guardianRun.deck.some(c => c.cardId === 'guardianBulwark'));
  combat = restoreCombatSnapshot({ registries: r, rng: createRng(896), snapshot: serializeCombatSnapshot(combat) });
  reconcileGrantedCardsInCombat(r, { ...guardianRun, loadout: combat.loadout }, combat.piles);
  assert.equal(Object.values(combat.piles).flat().filter(c => c.cardId === 'shieldGuardian').length, 1);
  assert.ok(combat.piles.exhaust.some(c => c.cardId === 'shieldGuardian'));
  cases++;
}
const shield = r.equipment.armaments.find(p => p.id === 'roundShield');
// A full hand uses the engine's normal overflow-to-discard rule.
const fullRun = fixture('kiteShield');
const full = combatFor(fullRun);
full.piles.hand = [{ instanceId: 'full-guardian', cardId: 'shieldGuardian' }, ...Array.from({ length: full.handMax }, (_, i) => ({ instanceId: `full:${i}`, cardId: 'defend' }))];
full.player.energy = 10;
dispatch(full, { type: 'playCard', cardInstanceId: 'full-guardian' });
assert.ok(full.piles.discard.some(c => c.cardId === 'guardianBulwark'));
assert.ok(!fullRun.deck.some(c => c.cardId === 'guardianBulwark'));
// Stable owner identity survives unequip/re-equip without replacing removed filler.
const swap = fixture('straightSword', 'roundShield');
const original = swap.deck.filter(c => c.grantedBy === 'roundShield').map(c => c.instanceId).sort();
swap.loadout.sets.leftHand[0] = null; stampDeck(r, swap);
assert.ok(!swap.deck.some(c => c.grantedBy === 'roundShield'));
swap.loadout.sets.leftHand[0] = 'roundShield'; stampDeck(r, swap);
assert.deepEqual(swap.deck.filter(c => c.grantedBy === 'roundShield').map(c => c.instanceId).sort(), original);
const upgraded = swap.deck.find(c => c.grantedBy === 'straightSword' && c.kitRole === 'attack');
const beforeUpgrade = resolveCard(r, upgraded);
swap.itemUpgradeLevels['armament/straightSword'] = 1; stampDeck(r, swap);
assert.equal(upgraded.smithingLevel, 1);
assert.notDeepEqual(resolveCard(r, upgraded), beforeUpgrade);
// Explicit two-handed packages install once and reject a conflicting off hand.
const two = createRegistries({ ...contentBundle, equipment: { ...contentBundle.equipment, armaments: contentBundle.equipment.armaments.map(p => p.id === 'greatsword' ? { ...p, weaponCardPackage: { ...p.weaponCardPackage, handsRequired: 2 } } : p) } });
assert.equal(fixture('greatsword', null, 'reaver', two).deck.filter(c => c.grantedBy === 'greatsword').length, 3);
assert.throws(() => fixture('greatsword', 'roundShield', 'reaver', two), /two.hand|both hands|off.hand|conflict/i);
assert.throws(() => WeaponCardPackageModel.fromPiece(r, { ...shield, weaponCardPackage: { ...shield.weaponCardPackage, combatKit: { ...shield.weaponCardPackage.combatKit, guardProfileId: 'bladeAttack' } } }), /roundShield.*guardProfileId/);
console.log(`PASS armament combat kits: ${cases} class/loadout cases, real card execution, zero filler, removals, save adoption, Guardian Exhaust and combat restoration`);
