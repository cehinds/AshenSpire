// src/engine/artCharge.js — the Weapon Art charge meter's bus listener and
// its spend (SPEC §12.2.1). ONE LISTENER, no per-weapon code: which weapon a
// hit belongs to, how big its meter is and what its unleashed form does are
// all read through model/artCharge.js from balance and content data.
//
//   damageDealt by the player on an enemy, amount > 0, by the card being
//   resolved, lent by an equipped armament W, not W's Art → +gainPerHit to W
//   enemyStaggered while W's hit is the last one      → +gainOnStagger to W
//   procBurst / status meterFilled on an enemy, same  → +gainOnBurst to W
//
// The "last hit" weapon lives only for the current card's resolution: a
// `cardPlayed` announcement, the end of that card's resolution
// (endArtChargeResolution), `playerTurnEnd`, `flaskUsed`, `armamentSwapped`
// and any player hit on an enemy that no equipped weapon lent clear it, and an
// Art's own hit clears it, so an Art never charges its own meter. Headless; no RNG.
//
// Co-op (item 10) runs the same listener: coopCombat's setActive points
// `combat.artCharge` at the acting seat's own map, and only that seat's hits
// (`sourcePlayerId === playerKey`) count.

import { artChargeRules, artChargeMax, artChargeValue, artUnleashFor, isWeaponEquipped, lendingWeaponOf } from '../model/artCharge.js';

function charge(combat, weaponId, amount, reason) {
  if (!weaponId || !(amount > 0)) return;
  const max = artChargeMax(combat.registries, weaponId);
  if (!max || !isWeaponEquipped(combat, weaponId)) return;
  const before = artChargeValue(combat, weaponId);
  const value = Math.min(max, before + amount);
  if (value === before) return;
  combat.artCharge = combat.artCharge || {};
  combat.artCharge[weaponId] = value;
  combat.emit('artChargeChanged', { ...seatOf(combat), weaponId, value, max, amount: value - before, reason });
}

// Co-op (SPEC §12.2.1 item 10): the seat whose meters these are rides the
// receipt. Solo sets no playerKey, so solo events are unchanged.
function seatOf(combat) {
  return combat.players && combat.playerKey ? { playerId: combat.playerKey } : {};
}

function isEnemy(combat, id) {
  return (combat.enemies || []).some((enemy) => enemy.id === id);
}

/** recordArtCharge(combat, event) — called by the bus after every event. */
export function recordArtCharge(combat, event) {
  const rules = artChargeRules(combat.registries);
  if (!rules || !combat.player) return;
  switch (event.type) {
    case 'cardPlayed':
      combat._artChargeLastHit = null;
      combat._artChargeCard = event.cardInstanceId ?? null;
      return;
    case 'playerTurnEnd':
    case 'flaskUsed':
    case 'armamentSwapped':
      combat._artChargeLastHit = null;
      combat._artChargeCard = null;
      return;
    case 'damageDealt': {
      if (event.sourceId !== combat.player.id || !isEnemy(combat, event.targetId) || !(event.amount > 0)) return;
      // Co-op: every seat's entity is `player`; only the ACTIVE seat's own hit
      // fills the active seat's meters (C.artCharge is that seat's map).
      if (combat.players && event.sourcePlayerId !== combat.playerKey) { combat._artChargeLastHit = null; return; }
      // Only the card being resolved lands the weapon's hits. A status or
      // trigger that remembers a card (a Combat Ratings `ratingCard`) and
      // fires later — on the enemy's turn, say — is not that card's hit.
      if (!event.cardInstanceId || event.cardInstanceId !== combat._artChargeCard) { combat._artChargeLastHit = null; return; }
      if (event.equipmentRole === 'weaponArt') { combat._artChargeLastHit = null; return; }
      const weaponId = lendingWeaponOf(combat.registries, event);
      // A hit no equipped weapon lent (a relic, a flask, a status tick, a
      // loose card) is not the weapon's: what it staggers credits nobody.
      if (!weaponId || !isWeaponEquipped(combat, weaponId)) { combat._artChargeLastHit = null; return; }
      combat._artChargeLastHit = weaponId;
      charge(combat, weaponId, rules.gainPerHit, 'hit');
      return;
    }
    case 'enemyStaggered':
      if (combat._artChargeLastHit) charge(combat, combat._artChargeLastHit, rules.gainOnStagger, 'stagger');
      return;
    case 'procBurst':
    case 'meterFilled':
      // A status build-up burst only; the Poise meter's own fill is counted
      // by the enemyStaggered it causes, never twice.
      if (!event.status || !isEnemy(combat, event.targetId)) return;
      if (combat._artChargeLastHit) charge(combat, combat._artChargeLastHit, rules.gainOnBurst, 'burst');
      return;
    default:
  }
}

/** The played card's own resolution is over: its hits credit nothing after. */
export function endArtChargeResolution(combat) {
  combat._artChargeLastHit = null;
  combat._artChargeCard = null;
}

/** Hook the bus: every emitted event is recorded after its triggers fired. */
export function attachArtCharge(combat) {
  const inner = combat.emit;
  combat.artCharge = combat.artCharge || {};
  combat._artChargeLastHit = null;
  combat._artChargeCard = null;
  combat.emit = (type, payload) => {
    const event = inner(type, payload);
    recordArtCharge(combat, event);
    return event;
  };
  return combat;
}

/**
 * takeArtUnleash(combat, inst) → `{ effects, announce }` when this play
 * unleashes (the meter is emptied at once), else null. Called by the play door
 * AFTER payment and BEFORE the play is announced; the door calls `announce()`
 * right AFTER `cardPlayed`, so the spend receipts (`artChargeChanged` reason
 * `unleash`, then `artUnleashed`) follow the play they belong to — paced
 * playback groups a beat from `cardPlayed` on, and receipts emitted before it
 * would land in the payment beat, emptying the meter and the card's unleashed
 * face while the card is still in hand (SPEC §12.2.1 item 5).
 */
export function takeArtUnleash(combat, inst) {
  const unleash = artUnleashFor(combat, inst);
  if (!unleash || !unleash.ready) return null;
  combat.artCharge = combat.artCharge || {};
  combat.artCharge[unleash.weaponId] = 0;
  const seat = seatOf(combat);
  const announce = () => {
    combat.emit('artChargeChanged', { ...seat, weaponId: unleash.weaponId, value: 0, max: unleash.max, amount: -unleash.value, reason: 'unleash' });
    combat.emit('artUnleashed', { ...seat, weaponId: unleash.weaponId, cardId: inst.cardId, cardInstanceId: inst.instanceId });
  };
  return { effects: unleash.form.effects, announce };
}
