// src/content/seats.js — THE SEATS (SPEC §13.1). A seat is a region with its
// content: enemies, encounters, boss pool and combat scenery. An act is a seat
// at a tier: `run.actNumber` is the tier, `run.seatOrder[tier - 1]` the seat.
//
// `baseTier` is the tier the seat's numbers were authored at — the act it used
// to be — so climbing it at another tier scales by a RATIO against this
// baseline (balance.seatTiers, SPEC §13.3), and a seat at its own baseline
// scales by exactly 1. That ratio is the whole of the byte-identity claim in
// §13.6: an existing seed climbing the default order fights the fights it
// always did.
//
// The region id is a foreign key into content/environments.js; the check is
// here, at module load, so a mistyped region fails the boot rather than
// painting the wrong sky (Law 1 clause 5).
import { ENVIRONMENTS } from './environments.js';

export const SEATS = Object.freeze([
  { id: 'weald', regionId: 'hollow-weald', name: 'The Hollow Weald', baseTier: 1 },
  { id: 'marches', regionId: 'pale-marches', name: 'The Pale Marches', baseTier: 2 },
  { id: 'reach', regionId: 'cinder-reach', name: 'The Cinder Reach', baseTier: 3 },
]);

// The scenery of the final tier's boss node — the causeway to the Ashen Spire
// (SPEC §13.2, LORE §1): a region that is no seat's, painted where the last
// climb ends whichever seat holds it. Data, so the model never spells it.
export const CAUSEWAY_REGION_ID = 'ashen-crown';
if (!ENVIRONMENTS.some((region) => region.id === CAUSEWAY_REGION_ID)) {
  throw new Error(`seats: CAUSEWAY_REGION_ID '${CAUSEWAY_REGION_ID}' is not an environment region`);
}

for (const seat of SEATS) {
  if (!ENVIRONMENTS.some((region) => region.id === seat.regionId)) {
    throw new Error(`seats.${seat.id}: regionId '${seat.regionId}' is not an environment region`);
  }
}
