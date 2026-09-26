// tests/property-mount.test.mjs — plan phase 1b acceptance: the property mount path.
//
// docs/plan-progression-and-property-system.md, Phase 1 acceptance and the
// "a property mounts twice on re-equip" risk row. Every fight here is the real
// engine (createCombat / dispatch), headless. A break is caused by a real
// card: the herald's own arcane attack, whose buildup does not come from the
// weapon, so "the same break" exists before and after the weapon changes.

import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, passiveMult, passiveSum, passiveFlag } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { mountProperties, unmountProperties } from '../src/engine/properties.js';

const REG = createRegistries(contentBundle);
const EXPOSURE = contentBundle.balance.exposure;
const SCEPTRE_KEY = 'armament:armament/boneSceptre';

// The first shipped attack of this class whose damage school builds Arcane
// Exposure on its own (content/source/cardExposure.csv), aimed at one enemy.
function exposureCard(registries, classId) {
  const card = registries.cards.all().find((c) => c.class === classId && c.type === 'attack'
    && c.exposureBuildupPerHit > 0 && ['arcane', 'magic'].includes(c.damageSchool)
    && (c.effects || []).some((e) => e.op === 'damage' && e.target === 'enemy'));
  assert.ok(card, `${classId} has an exposure-building attack`);
  return card;
}

function fight({ registries = REG, classId = 'herald', rightHandSets = null, storage = [], enemyIds = ['wanderingSoldier'], attributes = null } = {}) {
  const run = createRunState({ seed: 4242, classId, registries, ...(attributes ? { attributes } : {}) });
  if (rightHandSets) run.loadout.sets.rightHand = [...rightHandSets];
  run.loadout.storage = [...storage];
  const combat = createCombat({
    registries,
    rng: createRng(99),
    player: {
      classId, attributes: run.attributes, maxHp: run.maxHp, hp: run.hp, maxMana: run.maxMana, mana: 0,
      energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, deck: run.deck, relicIds: [], loadout: run.loadout,
    },
    enemyIds,
  });
  return { run, combat, card: exposureCard(registries, classId) };
}

let played = 0;
// Play one real exposure-building card into an enemy one point short of its
// threshold (lock cleared, health restored), from `startMana` (0 unless the
// card itself costs Mana), and report what the play caused. A refund is read
// from the manaRestored receipts, not the pool, so a Mana cost cannot hide one.
function playIntoBreak(combat, card, { value = null, extra = {}, startMana = 0 } = {}) {
  const p = combat.player;
  const enemy = combat.enemies[0];
  const cfg = enemy.arcaneExposure;
  delete enemy.statuses[cfg.onBreak.status];
  enemy.hp = enemy.maxHp;
  enemy.block = 0;
  cfg.value = value == null ? cfg.threshold - 1 : value;
  // startMana is the intended pool after payment, before any siphon refund.
  p.mana = startMana + (card.manaCost || 0);
  p.stamina = card.staminaCost || 0;
  p.maxStamina = Math.max(p.maxStamina || 0, p.stamina);
  p.energy = 99;
  const inst = { instanceId: `tProperty${++played}`, cardId: card.id, upgraded: false, ...extra };
  combat.piles.hand.push(inst);
  const from = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: inst.instanceId, targetId: enemy.id });
  const events = combat.eventLog.slice(from);
  return {
    breaks: events.filter((e) => e.type === 'arcaneBreak').length,
    restored: events.filter((e) => e.type === 'manaRestored' && e.targetId === p.id).reduce((s, e) => s + e.amount, 0),
    buildup: events.filter((e) => e.type === 'arcaneExposureChanged').map((e) => e.amount),
    mana: p.mana,
  };
}

// The EQUIPMENT mounts: the class card mounts too since plan phase 5a
// (`class:<id>`, its `favored` leaning), and these tests ask about the hands.
const mountedKeys = (combat) => Object.keys((combat.propertyMounts || {}).player || {}).filter((k) => !k.startsWith('class:'));
const propertyGateKeys = (combat) => [...combat.triggerState.keys()].filter((k) => k.startsWith('property:'));

test('a scepter-wielding player\'s own arcane break restores balance.exposure.siphonRefund Mana', () => {
  const { combat, card } = fight();
  assert.ok(combat.player.maxMana >= EXPOSURE.siphonRefund, 'the herald has room for the refund');
  assert.deepEqual(mountedKeys(combat), [SCEPTRE_KEY], 'createCombat mounts the equipped sceptre, keyed by its item ref');
  assert.deepEqual(combat.propertyMounts.player[SCEPTRE_KEY].rules.map((r) => r.tag), ['siphon'], 'the sceptre confers siphon');
  const r = playIntoBreak(combat, card);
  assert.equal(r.breaks, 1, 'the hit breaks the enemy\'s Arcane Exposure');
  assert.equal(r.restored, EXPOSURE.siphonRefund, 'siphon restores the balance row, and only the unmastered branch fires');
  assert.equal(r.mana, EXPOSURE.siphonRefund, 'the Mana is really in the pool');
  assert.deepEqual(propertyGateKeys(combat).sort(), [`property:player:${SCEPTRE_KEY}:0`, `property:player:${SCEPTRE_KEY}:1`],
    'the fourth trigger scan keys each siphon trigger property:<owner>:<sourceKey>:<i>');
});

test('after changeEquipment to a sword the same break restores 0; re-equipping mounts once, never twice', () => {
  // A HERALD WHO CAN ACTUALLY HOLD A SWORD. On the lean span the Herald's own
  // preset leaves Strength at the baseline of 1 and the straight sword asks 2,
  // so the changeEquipment below would be refused for a reason that has nothing
  // to do with property mounting. Still 8 points, still inside 1–4.
  const { combat, card } = fight({ storage: ['straightSword'],
    attributes: { strength: 2, dexterity: 1, constitution: 1, wisdom: 3, intelligence: 1 } });
  const slot = combat.loadout.active.rightHand;
  combat.player.energy = 99;
  dispatch(combat, { type: 'changeEquipment', slotId: 'rightHand', setIndex: slot, pieceId: 'straightSword' });
  assert.equal(combat.loadout.sets.rightHand[slot], 'straightSword', 'the sword is in hand');
  assert.deepEqual(mountedKeys(combat), [], 'the outgoing sceptre\'s siphon left with it');
  const withSword = playIntoBreak(combat, card);
  assert.equal(withSword.breaks, 1, 'the same card still breaks the enemy');
  assert.equal(withSword.restored, 0, 'with a sword in hand the break restores nothing');

  combat.player.energy = 99;
  dispatch(combat, { type: 'changeEquipment', slotId: 'rightHand', setIndex: slot, pieceId: 'boneSceptre' });
  assert.deepEqual(mountedKeys(combat), [SCEPTRE_KEY], 're-equipping the sceptre mounts it again, once');
  const again = playIntoBreak(combat, card);
  assert.equal(again.restored, EXPOSURE.siphonRefund, 'the re-equipped sceptre refunds exactly once, not twice');
  assert.equal(propertyGateKeys(combat).length, 2, 'one source, two triggers — no second copy of the source was scanned');

  const carrier = { kind: 'armament', id: 'boneSceptre', instanceId: 'armament/boneSceptre', ownerKey: 'player', tagIds: ['siphon'] };
  assert.throws(() => mountProperties(combat, carrier), /already mounted for 'player'/, 'mounting a mounted source is refused by name');
  assert.equal(unmountProperties(combat, carrier), true, 'unmount removes it');
  assert.equal(unmountProperties(combat, carrier), false, 'a second unmount finds nothing');
  assert.ok(mountProperties(combat, carrier), 'after an unmount the source mounts again');
  assert.deepEqual(mountedKeys(combat), [SCEPTRE_KEY], 'and it is one mount');
  // A card may CARRY a property tag (every family may, since the tag tree) —
  // what it lacks is a hold window for the mount, which is the engine's list.
  assert.throws(() => mountProperties(combat, { ...carrier, kind: 'card' }), /'card' has no hold span to mount on/, 'a kind with no hold window is refused by name');
});

test('swapArmament to another set drops siphon, and swapping back mounts it once', () => {
  const { combat, card } = fight({ rightHandSets: ['boneSceptre', 'straightSword', null] });
  combat.player.energy = 99;
  dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
  assert.deepEqual(mountedKeys(combat), [], 'the sceptre in an inactive set confers nothing');
  assert.equal(playIntoBreak(combat, card).restored, 0, 'a break with the sword set active restores nothing');
  combat.player.energy = 99;
  dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 0 });
  assert.deepEqual(mountedKeys(combat), [SCEPTRE_KEY], 'swapping back mounts the sceptre once');
  assert.equal(playIntoBreak(combat, card).restored, EXPOSURE.siphonRefund, 'and the refund is back');
});

test('a wand\'s overcharge multiplies buildup per hit by balance.exposure.overchargeBuildupMult', () => {
  // No shipped armament is a wand, so the fixture tags the herald's sceptre as
  // one — a tagging row, the only thing the first real wand will need.
  const wandReg = createRegistries({
    ...contentBundle,
    tagging: [...contentBundle.tagging, { family: 'armament', scope: '', objectId: 'boneSceptre', tagId: 'overcharge' }],
  });
  const perHit = 2;
  const extra = { exposureBuildupPerHit: perHit };
  const plain = fight();
  const wand = fight({ registries: wandReg });
  assert.deepEqual(wand.combat.propertyMounts.player[SCEPTRE_KEY].rules.map((r) => r.tag), ['siphon', 'overcharge'], 'the fixture wand mounts both rules');
  const base = playIntoBreak(plain.combat, plain.card, { value: 0, extra }).buildup;
  const boosted = playIntoBreak(wand.combat, wand.card, { value: 0, extra }).buildup;
  assert.deepEqual(base, [perHit], 'without overcharge a hit builds its authored buildup');
  assert.deepEqual(boosted, [Math.floor(perHit * EXPOSURE.overchargeBuildupMult)], 'overcharge multiplies it by the balance row');
  assert.notEqual(boosted[0], base[0], 'and the multiplier is visible at this buildup');
});

test('a staff\'s staggerBreak batters the broken foe\'s Poise by balance.exposure.staggerBreakPoise, and refunds nothing (plan phase 8)', () => {
  const { combat, card } = fight({ classId: 'starseer' });
  const STAFF_KEY = 'armament:armament/ashStaff';
  assert.deepEqual(mountedKeys(combat), [STAFF_KEY], 'the Ash Staff is the starseer\'s focus');
  assert.deepEqual(combat.propertyMounts.player[STAFF_KEY].rules.map((r) => r.tag), ['staggerBreak'], 'and it carries staggerBreak, not siphon');
  const enemy = combat.enemies[0];
  const poiseBefore = enemy.poiseMeter.value;
  // The starseer's spell costs Mana, so it is cast from a full pool.
  const r = playIntoBreak(combat, card, { startMana: combat.player.maxMana });
  assert.equal(r.breaks, 1, 'the starseer breaks the enemy');
  assert.equal(r.restored, 0, 'and nothing is refunded');
  const poiseEvents = combat.eventLog.filter((e) => e.type === 'meterFilled' && e.meter === 'poise' && e.targetId === enemy.id);
  assert.ok(enemy.poiseMeter.value >= poiseBefore + EXPOSURE.staggerBreakPoise || poiseEvents.length > 0,
    `the break dealt ${EXPOSURE.staggerBreakPoise} Poise damage to the broken foe (meter ${poiseBefore} → ${enemy.poiseMeter.value}, fills ${poiseEvents.length})`);
});

test('an orb\'s resonance pours balance.exposure.resonanceSpreadPct of the broken foe\'s threshold into every OTHER foe (plan phase 8)', () => {
  const { combat, card } = fight({ rightHandSets: ['goldboughBranch'], enemyIds: ['wanderingSoldier', 'wanderingSoldier'] });
  const BRANCH_KEY = 'armament:armament/goldboughBranch';
  assert.deepEqual(mountedKeys(combat), [BRANCH_KEY], 'the Goldbough Branch is in hand');
  assert.deepEqual(combat.propertyMounts.player[BRANCH_KEY].rules.map((r) => r.tag), ['resonance'], 'and it carries resonance');
  const [first, second] = combat.enemies;
  second.arcaneExposure.value = 0;
  // THE OTHER FOE'S OWN METER IS DELIBERATELY WIDER. The spread is a share of
  // the meter that BROKE, so reading the recipient's threshold instead would
  // pour more than the break was worth (Codex, #1203); two identical foes
  // cannot tell the two readings apart.
  second.arcaneExposure.threshold = first.arcaneExposure.threshold * 3;
  const r = playIntoBreak(combat, card, { startMana: combat.player.maxMana });
  assert.equal(r.breaks, 1, 'the hit breaks the first foe');
  const spread = Math.floor((first.arcaneExposure.threshold * EXPOSURE.resonanceSpreadPct) / 100);
  assert.equal(second.arcaneExposure.value, spread, 'the other foe took the spread as buildup');
  assert.equal(first.arcaneExposure.value, 0, 'the broken foe itself took none (its own meter reset and locked)');
  const poured = combat.eventLog.filter((e) => e.type === 'arcaneExposureChanged' && e.targetId === second.id);
  assert.deepEqual(poured.map((e) => e.amount), [spread], 'one receipt names the pour');
});

test('a saved fight restores with siphon mounted from its loadout, never from the save', () => {
  const { combat, card } = fight();
  const snapshot = serializeCombatSnapshot(combat);
  assert.ok(!JSON.stringify(snapshot).includes('propertyMounts'), 'mounts are not persisted');
  const restored = restoreCombatSnapshot({ registries: REG, rng: createRng(99), snapshot });
  assert.deepEqual(mountedKeys(restored), [SCEPTRE_KEY], 'restore re-derives the sceptre mount');
  assert.equal(playIntoBreak(restored, card).restored, EXPOSURE.siphonRefund, 'and the restored fight refunds');
});

test('the passive readers read a mounted rule the way they read a relic, and nothing without one', () => {
  const mounts = { 'armament:armament/x': { rules: [{ passives: { exposureBuildupMult: 1.5, swapCostDelta: -1, revealUnknown: true } }] } };
  assert.equal(passiveMult(REG, [], 'exposureBuildupMult'), 1, 'no relic, no mount: the default');
  assert.equal(passiveMult(REG, [], 'exposureBuildupMult', mounts), 1.5, 'a mounted multiplier multiplies');
  assert.equal(passiveSum(REG, [], 'swapCostDelta', {}, mounts), -1, 'a mounted addend sums');
  assert.equal(passiveFlag(REG, [], 'revealUnknown', mounts), true, 'a mounted flag is read');
  assert.equal(passiveFlag(REG, [], 'revealUnknown'), false, 'and run-level callers, which pass no mounts, are unchanged');
});
