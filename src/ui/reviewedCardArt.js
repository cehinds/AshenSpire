import {reviewedCardArtCatalog} from '../content/reviewedCardArt.generated.js';

/** Approved tag-formula results for cards without their own illustration.
 * These IDs select reviewed art only; they never select or change mechanics.
 * The caller excludes dedicated card/profile art and honors Legacy mode.
 */
export function reviewedCardArt(ref, definition) {
  // Equipment can change the weapon identity; use the live formula for it.
  if (ref?.profileId || definition?.equipmentProfileId || definition?.profileId) return null;
  const id = definition?.id || ref?.cardId;
  const art = Object.hasOwn(reviewedCardArtCatalog.records,id) && reviewedCardArtCatalog.records[id];
  if (!art) return null;
  return {kind:'simple',path:art.path,fit:'cover',position:'50% 50%',componentArt:art,layers:[],statuses:[],filter:''};
}
