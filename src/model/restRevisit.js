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
// re-entry does not refill again. `multiUse` is the Multi-use setting as the
// visit opened, frozen per visit.
//
// TRADERS AND BLACKSMITHS (owner, 2026-11-18). The same rule holds for a shop node: leave the trader or the
// Blacksmith and the node you still stand on re-opens it; travelling elsewhere ends that. They use this one
// record (a `kind` of 'shop' or 'blacksmith', and for a Blacksmith the `stock` it was left with). A record with no
// `kind`, which is every record saved before this, is a rest site, so an old save with only `restRevisit` loads and
// behaves as it did.
//
// SCOPE. Classic map only (`run.mapGraph`).
//
// Headless: no DOM, no imports. The caller persists the run.

function matchesPlace(run, record) {
  return !!record && record.act === run.actNumber && record.nodeId === run.mapNodeId;
}

// The record for the place the run stands on, created when none matches it.
// `multiUse` is frozen on the record at creation (the setting as it stood on
// arrival), so changing the setting mid-visit does not reshape a visit in progress.
export function openRestRecord(run, { multiUse = false } = {}) {
  if (matchesPlace(run, run.restRevisit)) return run.restRevisit;
  run.restRevisit = { act: run.actNumber, nodeId: run.mapNodeId, rested: false, spent: false, left: false, refilled: false, multiUse: !!multiUse };
  return run.restRevisit;
}

// The record for a trader or Blacksmith the run stands on, created when none matches the place. `kind` is
// 'shop' or 'blacksmith'.
export function openSiteRecord(run, kind) {
  if (kind === 'rest') return openRestRecord(run);
  if (matchesPlace(run, run.restRevisit)) {
    if (run.restRevisit.kind !== kind) run.restRevisit.kind = kind;
    return run.restRevisit;
  }
  run.restRevisit = { act: run.actNumber, nodeId: run.mapNodeId, kind, left: false };
  return run.restRevisit;
}

// A Blacksmith's stock, kept on the place's record under `slot` ('stock' for a Blacksmith node, 'smithStock' for the workshop a
// trader keeps), so leaving and re-entering shows the same stock, minus what was bought, and never rolls a new one.
// `roll` makes a fresh stock and is called only when the record holds none.
export function visitSiteStock(run, slot, roll) {
  const record = matchesPlace(run, run.restRevisit) ? run.restRevisit : null;
  if (record && record[slot]) return record[slot];
  const stock = roll();
  if (record) record[slot] = stock;
  return stock;
}

// Leaving the workshop: the stock as it now stands (purchases taken out) goes back on the record under `slot`.
export function stashSiteStock(run, slot, stock) {
  if (matchesPlace(run, run.restRevisit) && stock) run.restRevisit[slot] = stock;
}

// What kind of site a record is: records saved before traders could be re-entered have no `kind` and are rest sites.
export function siteRevisitKind(record) {
  return record ? record.kind || 'rest' : null;
}

// A consumed choice at this place. `rested` only for a Rest; `spent` for all.
export function recordRestConsumed(run, kind) {
  if (!matchesPlace(run, run.restRevisit)) return;
  if (kind === 'rest') run.restRevisit.rested = true;
  if (['rest', 'smith', 'extract', 'install', 'upgradeCard'].includes(kind)) run.restRevisit.spent = true;
}

// The player has walked out of the visit.
export function markRestLeft(run) {
  if (matchesPlace(run, run.restRevisit)) run.restRevisit.left = true;
}

// The node the map keeps enterable for re-entry, or null. Classic map only.
export function restRevisitNodeId(run) {
  return matchesPlace(run, run.restRevisit) ? run.mapNodeId : null;
}

// Travelling to a node other than the rest site ends the re-entry.
export function clearRestRevisitOnTravel(run, nodeId) {
  if (run.restRevisit && nodeId !== run.restRevisit.nodeId) delete run.restRevisit;
}
