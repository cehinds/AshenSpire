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
