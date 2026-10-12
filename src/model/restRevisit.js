// Classic-map rest re-entry (owner, 2026-10-12).
//
// THE RULE. After the player leaves a rest site on the classic map, the node
// they stood on stays clickable and reopens the rest screen, for as long as
// the player has not chosen a new node. Choices already consumed there stay
// consumed: a Rest taken is not taken again, and a smith, extract or install
// that was spent stays spent. Once the player travels to a different node, the
// record is dropped and that site is no longer re-enterable.
//
// THE RECORD. `run.restRevisit` is `{ act, nodeId, rested, spent, left,
// refilled }`, kept on the run so it saves and resumes with it. `act` and
// `nodeId` name the place it belongs to; a record for another place is stale
// and is replaced. `rested` is set by a Rest, `spent` by any consumed choice
// (rest, smith, extract, install), `left` once the player has walked out of
// the visit. `refilled` marks that the arrival refill has already run, so a
// re-entry does not refill again.
//
// SCOPE. Classic map only (`run.mapGraph`). The atlas (`run.journey`) and the
// legacy dungeon (`run.legacyDungeon`) keep their own rest state, so every
// function here answers null or does nothing for them.
//
// Headless: no DOM, no imports. The caller persists the run.

function matchesPlace(run, record) {
  return !!record && record.act === run.actNumber && record.nodeId === run.mapNodeId;
}

// The record for the place the run stands on, created when none matches it.
export function openRestRecord(run) {
  if (matchesPlace(run, run.restRevisit)) return run.restRevisit;
  run.restRevisit = { act: run.actNumber, nodeId: run.mapNodeId, rested: false, spent: false, left: false, refilled: false };
  return run.restRevisit;
}

// A consumed choice at this place. `rested` only for a Rest; `spent` for all.
export function recordRestConsumed(run, kind) {
  if (!matchesPlace(run, run.restRevisit)) return;
  if (kind === 'rest') run.restRevisit.rested = true;
  if (['rest', 'smith', 'extract', 'install'].includes(kind)) run.restRevisit.spent = true;
}

// The player has walked out of the visit.
export function markRestLeft(run) {
  if (matchesPlace(run, run.restRevisit)) run.restRevisit.left = true;
}

// The node the map keeps enterable for re-entry, or null. Classic map only.
export function restRevisitNodeId(run) {
  if (run.journey || run.legacyDungeon) return null;
  return matchesPlace(run, run.restRevisit) ? run.mapNodeId : null;
}

// Travelling to a node other than the rest site ends the re-entry.
export function clearRestRevisitOnTravel(run, nodeId) {
  if (run.restRevisit && nodeId !== run.restRevisit.nodeId) delete run.restRevisit;
}
