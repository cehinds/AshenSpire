import { recordProgress, evaluateUnlocks } from './unlocks.js';

// One profile write commits history, progress and unlocks together. A retained
// terminal slot may retry after a storage failure without recording twice.
export function completedRunMeta(registries, current, result) {
  if ((current.results || []).some(row => row.finishId === result.finishId)) return { meta: current, unlocked: [] };
  const meta = structuredClone(current);
  meta.results = [...(meta.results || []), result].slice(-20);
  meta.progress = recordProgress(meta.progress, result);
  const unlocked = evaluateUnlocks(registries.unlocks, meta);
  if (unlocked.length) meta.unlocked = [...(meta.unlocked || []), ...unlocked];
  return { meta, unlocked };
}

// Keep the terminal receipt until every write has succeeded. Checkpoint,
// banking and history are idempotent, so Retry can resume after any boundary.
export function commitRunFinish(run, { victory, finishId, checkpoint, bank, complete, clear }) {
  run.pendingFinish ||= { victory, id: finishId };
  try {
    checkpoint();
    bank();
    const earned = complete(run.pendingFinish);
    clear();
    delete run.pendingFinish;
    return { ok: true, earned };
  } catch (error) {
    return { ok: false, earned: [], error };
  }
}

export async function commitRunFinishAsync(run, { victory, finishId, checkpoint, bank, complete, clear }) {
  run.pendingFinish ||= { victory, id: finishId };
  try {
    await checkpoint();
    await bank();
    const earned = await complete(run.pendingFinish);
    await clear();
    delete run.pendingFinish;
    return { ok: true, earned };
  } catch (error) {
    return { ok: false, earned: [], error };
  }
}
