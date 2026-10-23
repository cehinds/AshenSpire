import { gameContent } from './gameProfile.js';
import { isItemOwned } from './loadout.js';

const definitionsByProfile = new WeakMap();
function definitionIds(run) {
  const profile = run.gameProfile;
  if (!profile) return new Set();
  let ids = definitionsByProfile.get(profile);
  if (!ids) { ids = new Set((gameContent(run, 'cards') || []).map(card => card.id)); definitionsByProfile.set(profile, ids); }
  return ids;
}

// Knowledge belongs to this Core 2 run, independently of the active class.
export function hasCollectedCardPolicy(run) {
  return run?.gameProfile?.author?.core === 'ashen.core@2.0.0';
}

export function looseCollectedCard(card) {
  return !!card && !card.grantedBy && !isItemOwned(card) && !card.equipmentRole;
}

/** Old-save/draft fallback: only presently owned loose definitions are known. */
export function knownCollectedCardIds(run) {
  const definitions = definitionIds(run);
  return [...new Set([...(Array.isArray(run.collectedCardIds) ? run.collectedCardIds : []),
    ...[...(run.deck || []), ...(run.sideboard || [])].filter(looseCollectedCard).map(card => card.cardId)])]
    .filter(id => definitions.has(id));
}

export function collectedCardProblems(run) {
  if (run.collectedCardIds === undefined) return [];
  if (!hasCollectedCardPolicy(run)) return ['collectedCardIds requires a Core 2 run'];
  const ids = run.collectedCardIds;
  const definitions = definitionIds(run);
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !definitions.has(id))
    || new Set(ids).size !== ids.length) return ['collectedCardIds must contain unique authored card definition IDs'];
  return [];
}

/** Record at acquisition/save doors and before removing the last instance. */
export function recordCollectedCards(run) {
  if (!hasCollectedCardPolicy(run)) return false;
  const problems = collectedCardProblems(run);
  if (problems.length) throw new Error(problems.join('; '));
  const next = knownCollectedCardIds(run);
  if (JSON.stringify(run.collectedCardIds) === JSON.stringify(next)) return false;
  run.collectedCardIds = next;
  return true;
}
