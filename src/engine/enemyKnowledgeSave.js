import { bankEnemyKnowledgeProfile, mergeEnemyKnowledge, emptyEnemyKnowledge, enemyKnowledgeProblems } from '../model/enemyKnowledgeProfile.js';
import { acknowledgeKnowledgeBank } from '../model/enemyKnowledgeRun.js';

// The same owner must serialize every writer of this profile, including
// ordinary settings and result writes. Capture pending receipts before waiting
// for ownership; acknowledge only that captured, verified successful bank.
export async function bankRunEnemyKnowledge(saves, owner, run) {
  const state = run.enemyKnowledgeState;
  if (!state?.bankable) return { ok: true, changed: false, meta: null };
  const captured = structuredClone(state.pending);
  const problems = enemyKnowledgeProblems(captured);
  if (problems.length) return { ok: false, changed: false, meta: null, reason: problems.join('; ') };
  if (!Object.keys(captured.enemies).length) return { ok: true, changed: false, meta: null };
  try {
    if (typeof owner?.mutate !== 'function') throw new Error('Enemy knowledge banking requires the shared profile storage owner');
    return await owner.mutate(() => {
      const current = saves.loadMeta();
      if (saves.profileStatus?.().quarantined) return { ok: false, changed: false, meta: current, reason: 'Profile is quarantined; enemy knowledge remains pending.' };
      // Recovery is explicitly marked after a failed bank; ordinary stale
      // incoming tuning still respects the durable target. A retained trusted
      // ledger repairs a target corrupted by the failed write itself.
      const foundation = emptyEnemyKnowledge();
      for (const [id, target] of Object.entries(state.recoveryTargets || {})) {
        const row = state.pending.enemies[id];
        if (!row || row.target !== target) throw new Error('Enemy knowledge recovery ledger is missing');
        foundation.enemies[id] = structuredClone(row);
      }
      const recovered = Object.keys(foundation.enemies).length
        ? { ...current, enemyKnowledge: mergeEnemyKnowledge(current.enemyKnowledge || emptyEnemyKnowledge(), foundation) } : current;
      const bank = bankEnemyKnowledgeProfile(recovered, captured);
      bank.changed ||= JSON.stringify(current.enemyKnowledge) !== JSON.stringify(recovered.enemyKnowledge);
      const failed = (reason, meta = current) => {
        // A partial/incorrect storage write may have lost earlier durable
        // facts too. Keep the complete expected union, plus any later live
        // bonus, in the bounded pending ledger so retry can repair that loss.
        state.pending = mergeEnemyKnowledge(state.pending, bank.meta.enemyKnowledge);
        state.recoveryTargets = Object.fromEntries(Object.entries(bank.meta.enemyKnowledge.enemies).map(([id, row]) => [id, row.target]));
        return { ok: false, changed: false, meta, reason };
      };
      try {
        if (bank.changed) {
          const result = saves.saveMeta(bank.meta);
          if (!result?.ok) return failed(result?.reason || 'Enemy knowledge write failed; learning remains pending.');
        }
        const verified = saves.loadMeta();
        if (saves.profileStatus?.().quarantined) return failed('Profile verification failed; enemy knowledge remains pending.');
        const durable = verified.enemyKnowledge || emptyEnemyKnowledge();
        // Verify every expected old and new receipt. A mastered read-back must
        // still retain its original IDs, and a saved bonus cannot be downgraded.
        const retained = !enemyKnowledgeProblems(durable).length && Object.entries(bank.meta.enemyKnowledge.enemies).every(([id, expected]) => {
          const saved = durable.enemies[id];
          return saved?.target === expected.target && Object.entries(expected.receipts).every(([receiptId, receipt]) =>
            Object.hasOwn(saved.receipts, receiptId) && (!receipt.bonus || saved.receipts[receiptId].bonus));
        });
        if (!retained) {
          return failed('Enemy knowledge read-back did not retain the complete ledger; receipts remain pending.', verified);
        }
        acknowledgeKnowledgeBank(run, captured);
        state.recoveryTargets = {};
        return { ok: true, changed: bank.changed, meta: verified };
      } catch (error) {
        return failed(error.message || 'Enemy knowledge storage verification failed; receipts remain pending.');
      }
    });
  } catch (error) {
    return { ok: false, changed: false, meta: null, reason: error.message || 'Enemy knowledge banking failed; receipts remain pending.' };
  }
}
