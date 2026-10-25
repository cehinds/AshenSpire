// Start-node refill (owner, 2026-10-25). A map node carrying `refill: true` (the branched map's start node while
// routes.startNodeRefills is on) restores HP to max and refills both flask pools when the player first enters it.
// Graphs saved before the flag existed carry no `refill`, so they do nothing new.
import { refillFlaskCharges } from './gracerefill.js';

export function applyNodeRefill(run, node) {
  if (!run || !node || node.refill !== true) return false;
  if (Number.isFinite(run.maxHp)) run.hp = run.maxHp;
  refillFlaskCharges(run.flaskCharges);
  return true;
}
