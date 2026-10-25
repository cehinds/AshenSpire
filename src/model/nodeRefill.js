// Start-node refill (owner, 2026-10-25). A map node carrying `refill: true` (the branched map's start node while
// routes.startNodeRefills is on) restores HP to max and refills both flask pools when the player first enters it.
// Graphs saved before the flag existed carry no `refill`, so they do nothing new.
import { refillFlaskCharges } from './gracerefill.js';

// healMult scales the HP restored, matching the between-acts heal: Scarce Embers (lessHealing) passes its
// balance multiplier so the start node does not undo the halved heal. Flasks always refill.
export function applyNodeRefill(run, node, { healMult = 1 } = {}) {
  if (!run || !node || node.refill !== true) return false;
  if (Number.isFinite(run.maxHp) && Number.isFinite(run.hp)) {
    run.hp = Math.min(run.maxHp, run.hp + Math.floor((run.maxHp - run.hp) * healMult));
  }
  refillFlaskCharges(run.flaskCharges);
  return true;
}
