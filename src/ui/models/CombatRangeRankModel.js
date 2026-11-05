import { actorRangeKey, rangePairKey, bandCap } from '../../model/combatEngagement.js';

// Presentation only (owner, 2026-11-05: "use the front and back rows to indicate melee and reach").
// An actor stands in the FRONT strip of its side while it is at melee (band 0) with an opposing living actor,
// and in the BACK strip otherwise.

// The state the ranks are read from: engagement bands plus who is alive. A paced playback keeps its own copy,
// advanced beat by beat from the receipts, so a strip changes on the beat of its own move, not when the engine finished.
// Returns null when the fight has no range state (the layout then stays as it was).
export function rangeRankSnapshot(combat) {
  const state = combat?.rangeState;
  if (!state?.policy?.enabled) return null;
  const seats = combat.players instanceof Map ? [...combat.players.values()].map(seat => seat.entity)
    : combat.player ? [combat.player] : [];
  const actor = entity => ({ id: entity.id, key: actorRangeKey(combat, entity), alive: entity.alive !== false });
  return { cap: bandCap(state.policy), engagements: { ...state.engagements },
    players: seats.filter(Boolean).map(actor).filter(a => a.key),
    enemies: (combat.enemies || []).map(actor).filter(a => a.key) };
}

// Moves a snapshot by one playback receipt (combatEngagementMoved, enemyDied). Returns the same snapshot.
export function applyRangeRankEvent(snap, event) {
  if (!snap || !event) return snap;
  if (event.type === 'enemyDied') {
    const row = snap.enemies.find(a => a.id === (event.targetId ?? event.id));
    if (row) row.alive = false;
  } else if (event.type === 'combatEngagementMoved') {
    const keyOf = id => [...snap.players, ...snap.enemies].find(a => a.id === id)?.key;
    const a = keyOf(event.sourceId), b = keyOf(event.targetId);
    const key = a && b ? rangePairKey(a, b) : null;
    if (key && Object.hasOwn(snap.engagements, key)) snap.engagements[key] = Math.max(0, Math.min(snap.cap, snap.engagements[key] + event.bands));
  }
  return snap;
}

export function rangeRanksFromSnapshot(snap) {
  if (!snap) return null;
  const players = snap.players.filter(a => a.alive), enemies = snap.enemies.filter(a => a.alive);
  const melee = (p, e) => snap.engagements[rangePairKey(p, e)] === 0;
  const ranks = new Map();
  for (const p of players) ranks.set(p.key, enemies.some(e => melee(p.key, e.key)) ? 'front' : 'back');
  for (const e of enemies) ranks.set(e.key, players.some(p => melee(p.key, e.key)) ? 'front' : 'back');
  return ranks;
}

export const combatRangeRanks = combat => rangeRanksFromSnapshot(rangeRankSnapshot(combat));
