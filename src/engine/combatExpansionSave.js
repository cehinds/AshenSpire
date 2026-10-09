import { commitCombatSnapshot, serializeCombatSnapshot } from './combatSnapshot.js';
import { reconcileCombatKnowledge } from './enemyKnowledge.js';

/** Irreversible changes are saved before adoption, animation or terminal presentation. */
export function commitExpansionCandidate({ run, candidate, nodeId, encounterId, saveCandidate }) {
  // Legacy ordinary actions do not replace the entry/explicit Save Game checkpoint.
  // Knowledge reads, predictions and learning always need their exact transaction.
  // Blight receipts, choices and zero-delta converted payments are irreversible,
  // so compare the complete state rather than just its meter value. The first
  // opening checkpoint also saves the entry check and exact initial RNG state.
  const checkpoint = run.combatEntered;
  const savesKnowledge = run.enemyKnowledgeRules?.version === 1 || candidate.enemyKnowledge?.version === 1;
  if (!savesKnowledge && candidate.reactionRulesVersion !== 1 && candidate.combatExpansionVersion === 2 && !candidate.result
    && checkpoint?.nodeId === nodeId && checkpoint.encounterId === encounterId && checkpoint.snapshot
    && JSON.stringify(run.ashenBlight) === JSON.stringify(candidate.player.ashenBlight)) {
    return { ok: true, durable: false };
  }
  const next = structuredClone(run);
  reconcileCombatKnowledge(next, candidate);
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
