// The upgrade offer key (owner, 2026-11-20): upgrade options are rolled once per upgrade source. Entering a Blacksmith
// or shop, a rest site or Shrine, or receiving an upgrade or rank-up reward takes the next number of the run's
// `upgradeOfferSerial` and stores it as `offerKey` on that visit's record (the shop stock, the rest visit, the pending
// reward). Every upgrade roll folds the key into its seed, so the options stay the same for the whole stay and change
// at the next source. A preview and its commit read the same record, so they read the same key. A save from before
// the key (or a record without one) rolls as it always did.

const serialOf = (run) => (Number.isSafeInteger(run?.upgradeOfferSerial) && run.upgradeOfferSerial > 0 ? run.upgradeOfferSerial : 0);
const keyOf = (record) => (record && Number.isSafeInteger(record.offerKey) && record.offerKey > 0 ? record.offerKey : 0);

/** Takes the run's next offer number (1, 2, 3...) and returns it. */
export function TakeOfferKey(run) {
  const next = serialOf(run) + 1;
  run.upgradeOfferSerial = next;
  return next;
}

/** Gives `record` an offer key when it has none yet (a reload or a re-entry keeps the one it has); returns the key. */
export function StampOfferKey(run, record) {
  if (!run || !record || typeof record !== 'object') return 0;
  if (!keyOf(record)) record.offerKey = TakeOfferKey(run);
  return record.offerKey;
}

/**
 * The offer key of the upgrade source the player is at now, 0 when none carries one. An open shop wins (its stock is
 * the visit), then a pending reward, then the rest visit of the node the player stands on.
 */
export function UpgradeOfferKey(run) {
  if (!run) return 0;
  if (run.gameProfileOpenShop) {
    // A Blacksmith's stock, else the trader's own offer record (its rank-up shelf).
    const shop = keyOf(run.shopStock) || keyOf(run.gameProfileRewardOffers?.[`shop:${run.gameProfileOpenShop}`]);
    if (shop) return shop;
  }
  if (keyOf(run.gameProfilePendingReward)) return keyOf(run.gameProfilePendingReward);
  const visitId = run.gameProfileRestVisitId;
  if (visitId && visitId === `${run.actNumber}:${run.mapNodeId}`) return keyOf(run.gameProfileRestVisits?.[visitId]);
  return 0;
}

/** A seed label with the current offer key folded in; the bare label when there is no key (old saves roll as before). */
export function OfferSalted(run, label) {
  const key = UpgradeOfferKey(run);
  return key ? `${label}@offer${key}` : label;
}

/** Problems with a saved offer key or serial, by path ('' when the value is absent or sound). */
export function OfferKeyProblems(value, path) {
  if (value === undefined) return [];
  return Number.isSafeInteger(value) && value > 0 ? [] : [`${path} must be a positive integer`];
}
