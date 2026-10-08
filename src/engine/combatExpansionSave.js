import { commitCombatSnapshot, serializeCombatSnapshot } from './combatSnapshot.js';

/** One durable write precedes adoption, animation and terminal presentation. */
export function commitExpansionCandidate({ run, candidate, nodeId, encounterId, saveCandidate }) {
  const next = structuredClone(run);
  if (candidate.result) {
    next.ashenBlight = structuredClone(candidate.player.ashenBlight);
    next.ashenBlightBasePools = structuredClone(candidate.player.baseResourceMaxima);
    for (const field of ['hp', 'mana', 'stamina', 'maxHp', 'maxMana', 'maxStamina', 'energyMax', 'drawPerTurn']) next[field] = candidate.player[field];
    next.stamina = Math.min(next.stamina, next.maxStamina);
    next.combatPendingOutcome = { nodeId, encounterId, result: candidate.result, snapshot: serializeCombatSnapshot(candidate) };
    next.combatEntered = null;
  } else commitCombatSnapshot({ run: next, combat: candidate, nodeId, encounterId });
  const receipt = saveCandidate(next, candidate.rng);
  if (receipt?.ok === false) throw new Error(receipt.error || 'The combat could not be saved');
  const loadout = run.loadout;
  Object.assign(run, next);
  run.loadout = loadout;
  return { ok: true };
}
