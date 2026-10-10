import { commitCombatSnapshot, serializeCombatSnapshot } from './combatSnapshot.js';
import { reconcileCombatKnowledge } from './enemyKnowledge.js';

/** Irreversible changes are saved before adoption, animation or terminal presentation. */
export function commitExpansionCandidate({ run, candidate, nodeId, encounterId, saveCandidate }) {
  // SPEC §3.12/§9: nothing automatic replaces the entry/explicit Save Game
  // checkpoint, in any run, so abandoning mid-combat restarts that combat
  // (owner ruling 2026-10-10). That includes a reaction pause: its exact
  // save/restore (combat-reaction-contract) is the player's explicit Save Game
  // or Save and Quit at the pause, never an automatic write here. Exact writes
  // remain only for Blight receipts, choices and zero-delta converted payments
  // (irreversible, so compare the complete state rather than just its meter
  // value) and terminal results. The first opening checkpoint also saves the
  // entry check and exact initial RNG state.
  const checkpoint = run.combatEntered;
  if (candidate.combatExpansionVersion === 2 && !candidate.result
    && checkpoint?.nodeId === nodeId && checkpoint.encounterId === encounterId && checkpoint.snapshot
    && JSON.stringify(run.ashenBlight) === JSON.stringify(candidate.player.ashenBlight)) {
    return bankKnowledgeOnly({ run, candidate, saveCandidate });
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

// Enemy-knowledge receipts reconcile to the run exactly once (enemy-knowledge
// contract): Perception is paid by a per-encounter high-water mark and bestiary
// receipts merge by receipt union, so banking them now and re-earning them in a
// restarted fight never pays twice. Only the knowledge ledger moves: the
// checkpoint snapshot and its saved RNG counters (no rng is passed) stay put.
function bankKnowledgeOnly({ run, candidate, saveCandidate }) {
  if (!run.enemyKnowledgeState || !candidate.enemyKnowledge) return { ok: true, durable: false };
  const next = structuredClone(run);
  reconcileCombatKnowledge(next, candidate);
  if (JSON.stringify(next.enemyKnowledgeState) === JSON.stringify(run.enemyKnowledgeState)
    && JSON.stringify(next.skills) === JSON.stringify(run.skills)) return { ok: true, durable: false };
  const receipt = saveCandidate(next, null);
  if (receipt?.ok === false) throw new Error(receipt.error || 'Enemy learning could not be saved');
  run.enemyKnowledgeState = next.enemyKnowledgeState;
  run.skills = next.skills;
  if (next.savedAt !== undefined) run.savedAt = next.savedAt;
  return { ok: true, durable: false, knowledge: true };
}
