// src/model/levelUpPreview.js — WHAT A POINT BUYS, shown before it is spent
// (SPEC §13.4o, game-feel rework).
//
// The shrine's Level-up modal used to say what a point is worth in the
// abstract ("+4 HP per pt") and nothing about THIS character: the Strike in
// the deck, the pools on the bar. A point felt invisible because the screen
// that spends it never showed its consequence.
//
// NOTHING HERE IS A SECOND FORMULA. The preview clones the run, spends the
// pending points through `applyLevelUp` — the real door, pools re-derived
// from the run's own snapshot with the deficit carried — and reads both runs
// through the projections the game itself uses: `statProjection` for the
// derived rows, and `stampDeck` (on the clone, never the run) for every
// equipment-bound card, whose `profileReceipt.value` is the number the next
// fight stamps. The run handed in is never written.

import { applyLevelUp } from './levelup.js';
import { statProjection } from './statProjection.js';
import { deckCardReceipt, stampDeck } from './loadout.js';
import { orderedAttributes } from './attributes.js';

/** Every card the equipment prices, keyed by its role, profile and source piece. */
function cardValues(registries, run) {
  const probe = structuredClone(run);
  // The full-deck restamp, without the pool reconcile: the pools are read off
  // the projection below, and a restamp must not move them on the probe.
  stampDeck(registries, probe, null, { reconcileEquipmentPools: false });
  const profiles = new Map(((registries.equipment || {}).basicCardProfiles || []).map((profile) => [profile.id, profile]));
  const rows = new Map();
  for (const inst of probe.deck || []) {
    if (!inst || !inst.profileReceipt || !Number.isFinite(inst.profileReceipt.value)) continue;
    const role = inst.kitRole || inst.equipmentRole;
    const pieceId = inst.sourceArmamentId || null;
    const id = `card:${role}:${inst.profileId}:${pieceId || '-'}`;
    if (rows.has(id)) continue;
    const profile = profiles.get(inst.profileId);
    const piece = pieceId ? (registries.equipment.armaments || []).find((row) => row.id === pieceId) : null;
    rows.set(id, {
      id, kind: 'card', role, pieceId,
      label: (profile && profile.displayName) || (registries.cards.has(inst.cardId) ? registries.cards.get(inst.cardId).name : inst.cardId),
      pieceName: piece ? piece.name : null,
      value: inst.profileReceipt.value,
    });
  }
  // Two cards of one name from two pieces are told apart by their piece.
  const byLabel = new Map();
  for (const row of rows.values()) byLabel.set(row.label, (byLabel.get(row.label) || 0) + 1);
  for (const row of rows.values()) if (byLabel.get(row.label) > 1 && row.pieceName) row.label = `${row.label} (${row.pieceName})`;
  return [...rows.values()];
}

/**
 * levelUpValues(registries, run) → [{ id, kind: 'stat'|'card', label, value }]
 * The derived rows first (the projection's own order), then every
 * equipment-priced card in deck order.
 */
export function levelUpValues(registries, run) {
  const stats = statProjection(registries, run).derived.map((row) => ({
    id: `stat:${row.id}`, kind: 'stat', label: row.faceLabel || row.label, value: row.value,
  }));
  return [...stats, ...cardValues(registries, run)];
}

/**
 * levelUpPreview(registries, run, pending) → { rows, changed, after }
 *
 * `pending` is `{ <attributeId>: points }`. `rows` is every value with its
 * `before` and `after`; `changed` the ones that move; `after` the clone the
 * points were spent on (so a caller can read anything else off it). Throws
 * by name exactly where `applyLevelUp` would: more points than wait, or an
 * unknown attribute.
 */
export function levelUpPreview(registries, run, pending = {}) {
  const attributes = orderedAttributes(registries);
  const unknown = Object.keys(pending).filter((id) => !attributes.some((attr) => attr.id === id));
  if (unknown.length) throw new Error(`levelUpPreview: '${unknown[0]}' is not an attribute id`);
  const after = structuredClone(run);
  for (const attr of attributes) {
    const n = Number.isInteger(pending[attr.id]) && pending[attr.id] > 0 ? pending[attr.id] : 0;
    for (let i = 0; i < n; i++) applyLevelUp(registries, after, attr.id);
  }
  const beforeRows = new Map(levelUpValues(registries, run).map((row) => [row.id, row]));
  const rows = levelUpValues(registries, after).map((row) => ({
    ...row,
    before: beforeRows.has(row.id) ? beforeRows.get(row.id).value : row.value,
    after: row.value,
  })).map(({ value, ...row }) => row);
  return { rows, changed: rows.filter((row) => row.before !== row.after), after };
}

/**
 * weaponScalingFacts(registries, run, attributes) → { <attributeId>: [{
 *   pieceId, pieceName, grade, perPoint, label }] } — for every graded weapon
 * whose attack card is in the deck, what the NEXT point of each graded
 * attribute adds to that card at `attributes` (the in-progress allocation):
 * the card's own receipt at v + 1 minus at v, through `deckCardReceipt`.
 * `label` is the row's line: "STR A — +2 dmg next point on Greatsword".
 */
export function weaponScalingFacts(registries, run, attributes = run.attributes) {
  const out = {};
  const seen = new Set();
  const armaments = (registries.equipment || {}).armaments || [];
  for (const inst of run.deck || []) {
    if (!inst || inst.equipmentRole !== 'attack' || inst.kitRole) continue;
    const piece = armaments.find((row) => row.id === inst.weaponId);
    if (!piece || seen.has(piece.id)) continue;
    seen.add(piece.id);
    const base = deckCardReceipt(registries, run, inst, attributes);
    if (!base || !base.rating.scaling) continue; // ungraded, or a run born before the grades: flat
    // The letters the run prices by (its snapshot's), never the live piece's.
    for (const [attributeId, grade] of Object.entries(base.rating.scaling.grades)) {
      const next = deckCardReceipt(registries, run, inst, { ...attributes, [attributeId]: (attributes[attributeId] || 0) + 1 });
      const perPoint = next.value - base.value;
      const short = registries.attributes.get(attributeId)?.shortLabel || attributeId;
      // A point at or under the anchor is paid at the flat weight, which may
      // be nothing — the line says where the grade starts rather than
      // promising a number the next point does not pay.
      const anchor = base.rating.scaling.anchor;
      (out[attributeId] ||= []).push({
        pieceId: piece.id, pieceName: piece.name, grade, perPoint, anchor,
        label: perPoint <= 0 && (attributes[attributeId] || 0) < anchor
          ? `${short} ${grade} on ${piece.name} — the grade pays above ${anchor}`
          : `${short} ${grade} — +${perPoint} dmg next point on ${piece.name}`,
      });
    }
  }
  return out;
}
