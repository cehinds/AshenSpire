// Pure classification and ordering of the Smith's "Upgrade an Item" list
// (owner, 2026-11-01). DOM-free; the model and its tests share it.
//
//   upgradeable     can be upgraded at this site (Stone shortfalls included:
//                   being short is a blocker on the pane, not a reason to move
//                   or hide the row).
//   needsBlacksmith could be upgraded, but its next tier is above what this
//                   site allows (`candidate.capped`, set only for a rest
//                   site's Smith; a Blacksmith's plan never carries it).
//   hidden          cannot be upgraded at all (no next tier, nothing to change).
export const SMITH_CLASS = Object.freeze({ upgradeable: 'upgradeable', needsBlacksmith: 'needsBlacksmith', hidden: 'hidden' });

export function classifySmithCandidate(candidate) {
  if (!candidate || !candidate.itemRef && !candidate.armamentId && !candidate.itemId) return SMITH_CLASS.hidden;
  if (!Number.isInteger(candidate.nextLevel) || !(candidate.nextLevel > (candidate.currentLevel ?? 0))) return SMITH_CLASS.hidden;
  return candidate.capped === true ? SMITH_CLASS.needsBlacksmith : SMITH_CLASS.upgradeable;
}

/** Hidden items dropped; upgradeable first, then needsBlacksmith, each in plan order. */
export function orderSmithCandidates(candidates = []) {
  const rows = candidates.map((candidate) => ({ candidate, kind: classifySmithCandidate(candidate) }));
  const of = (kind) => rows.filter((row) => row.kind === kind).map((row) => row.candidate);
  return Object.freeze([...of(SMITH_CLASS.upgradeable), ...of(SMITH_CLASS.needsBlacksmith)]);
}

/** The item ref chosen when nothing is: the first upgradeable item, or null. */
export function defaultSmithSelection(candidates = []) {
  const first = candidates.find((candidate) => classifySmithCandidate(candidate) === SMITH_CLASS.upgradeable);
  return first ? (first.itemRef || `armament/${first.itemId || first.armamentId}`) : null;
}
