import { actorRangeKey, engagementBand } from '../../model/combatEngagement.js';

// Presentation only (owner, 2026-11-05: "use the front and back rows to indicate melee and reach").
// An actor stands in the FRONT strip of its side while it is at melee (band 0) with an opposing living actor,
// and in the BACK strip otherwise. Returns a Map of range actor key ('player:<seat>' / 'enemy:<id>') -> 'front' | 'back',
// or null when the fight has no range state (the layout then stays as it was).
export function combatRangeRanks(combat) {
  const state = combat?.rangeState;
  if (!state?.policy?.enabled) return null;
  const seats = combat.players instanceof Map ? [...combat.players.values()].map(seat => seat.entity)
    : combat.player ? [combat.player] : [];
  const players = seats.filter(entity => entity && entity.alive !== false)
    .map(entity => actorRangeKey(combat, entity)).filter(Boolean);
  const enemies = (combat.enemies || []).filter(entity => entity.alive)
    .map(entity => actorRangeKey(combat, entity)).filter(Boolean);
  const melee = (a, b) => { try { return engagementBand(state, a, b) === 0; } catch { return false; } };
  const ranks = new Map();
  for (const p of players) ranks.set(p, enemies.some(e => melee(p, e)) ? 'front' : 'back');
  for (const e of enemies) ranks.set(e, players.some(p => melee(p, e)) ? 'front' : 'back');
  return ranks;
}
