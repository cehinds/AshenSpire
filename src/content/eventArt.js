// Project art manifest for one-off event choices. Paths are independent of the
// event text and can be replaced for the next build without changing quests.
const EVENT_ART_IDS = new Set([
  'turncoatMirror', 'goldboughAvatar', 'abandonedCart', 'weepingPilgrim',
  'bloodstainedAltar', 'wanderingPhysician', 'goldenMoth', 'feralShrine',
  'ancientRuneStone', 'sleepingSmith', 'wyrmTrial', 'discardedReliquary',
  'omensAltar', 'rotPriestOffer', 'handspiderNest', 'fadedGrace',
  'merchantsGhost', 'cinderbearDen', 'stakeOfTheMartyr', 'twoFingersRiddle',
]);

export function eventArtAsset(event) {
  const id = typeof event === 'string' ? event : event?.id;
  return EVENT_ART_IDS.has(id) ? `assets/events/${id}.webp` : null;
}
