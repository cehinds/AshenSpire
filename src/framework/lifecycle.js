// src/framework/lifecycle.js — card zones and after-play destinations
// (framework contract: Card lifecycle).
//
// Every card instance occupies exactly one zone. Recall never duplicates a
// card. Cancelled and illegal plays spend nothing and go nowhere.

import { hasProperty } from './compiler.js';

export const ZONES = Object.freeze([
  'DRAW_PILE', 'HAND', 'DISCARD_PILE', 'EXHAUST_PILE', 'SEALED', 'REMOVED_FROM_PLAY',
]);

export function destinationAfterPlay(card, result, { sealConditionMet = () => false } = {}) {
  if (result.cancelled || !result.legal) return 'HAND';
  if (hasProperty(card, 'lifecycle.seal') && sealConditionMet(card)) return 'SEALED';
  if (hasProperty(card, 'lifecycle.exhaust')) return 'EXHAUST_PILE';
  if (hasProperty(card, 'lifecycle.recall.afterUse')) return 'HAND';
  // Preserved legacy rule (SPEC §4.3): a played Power leaves play entirely —
  // it is not exhausted and not discarded. Exhaust above still wins on a
  // Power that carries it, exactly as the legacy engine ordered the checks.
  if (hasProperty(card, 'classification.power')) return 'REMOVED_FROM_PLAY';
  return 'DISCARD_PILE';
}

export function endTurnCleanup(hand) {
  const keep = [];
  const discard = [];
  const exhaust = [];
  for (const card of hand) {
    if (hasProperty(card, 'lifecycle.retain')) keep.push(card);
    // Preserved legacy rule: an Ethereal card still in hand Exhausts instead
    // of discarding; Retain wins when a card carries both.
    else if (hasProperty(card, 'lifecycle.ethereal')) exhaust.push(card);
    else discard.push(card);
  }
  return { keep, discard, exhaust };
}

/** Forced discard is not use; Recall After Use does not trigger. */
export function forcedDiscardDestination() {
  return 'DISCARD_PILE';
}

/**
 * Zone ledger: one instance, one zone, enforced on every move. Instances are
 * tracked by instance id (a deck can hold several copies of one card id).
 */
export class ZoneLedger {
  constructor(instanceIds) {
    this.zoneByInstance = new Map(instanceIds.map((id) => [id, 'DRAW_PILE']));
  }

  zoneOf(instanceId) {
    const zone = this.zoneByInstance.get(instanceId);
    if (!zone) throw new Error(`zone ledger: unknown card instance ${JSON.stringify(instanceId)}`);
    return zone;
  }

  move(instanceId, zone) {
    if (!ZONES.includes(zone)) throw new Error(`zone ledger: unknown zone ${JSON.stringify(zone)}`);
    this.zoneOf(instanceId); // throws on unknown instance
    this.zoneByInstance.set(instanceId, zone);
  }

  inZone(zone) {
    return [...this.zoneByInstance.entries()].filter(([, z]) => z === zone).map(([id]) => id);
  }

  /** The single-zone invariant, checkable at any time. */
  assertExactlyOneZoneEach() {
    const counts = new Map();
    for (const [id] of this.zoneByInstance) counts.set(id, (counts.get(id) || 0) + 1);
    for (const [id, n] of counts) {
      if (n !== 1) throw new Error(`zone ledger: instance ${id} occupies ${n} zones`);
    }
    return true;
  }
}
