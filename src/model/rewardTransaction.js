// Keep a mounted offer reference coherent when a claim replaces nested run data.
export function persistRewardChange(run, offerId, change, persist) {
  const before = structuredClone(run);
  const offer = run.gameProfileRewardOffers[offerId];
  const offerBefore = structuredClone(offer);
  try {
    change();
    persist();
    return run.gameProfileRewardOffers[offerId];
  } catch (error) {
    for (const key of Object.keys(run)) delete run[key];
    Object.assign(run, before);
    for (const key of Object.keys(offer)) delete offer[key];
    Object.assign(offer, offerBefore);
    run.gameProfileRewardOffers[offerId] = offer;
    throw error;
  }
}
