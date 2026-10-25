// src/content/seats.js — THE SEATS (SPEC §13.1). A seat is a region with its
// content: enemies, encounters, boss pool and combat scenery. An act is a seat
// at a tier: `run.actNumber` is the tier, `run.seatOrder[tier - 1]` the seat.
// The seat table and the causeway region are authored in
// content/source/seats.json (what `baseTier` means and why the causeway is data
// are in content/source/CONTENT-NOTES.md, "Seats"); content-build compiles it
// to src/content/generated/seats.js. Edit the JSON; this file freezes the table
// and keeps the region checks.
//
// The region id is a foreign key into content/environments.js; the check is
// here, at module load, so a mistyped region fails the boot rather than
// painting the wrong sky (Law 1 clause 5).
import { ENVIRONMENTS } from './environments.js';
import { seats } from './generated/seats.js';

export const SEATS = Object.freeze(seats.seats);

export const CAUSEWAY_REGION_ID = seats.causewayRegionId;
if (!ENVIRONMENTS.some((region) => region.id === CAUSEWAY_REGION_ID)) {
  throw new Error(`seats: CAUSEWAY_REGION_ID '${CAUSEWAY_REGION_ID}' is not an environment region`);
}

for (const seat of SEATS) {
  if (!ENVIRONMENTS.some((region) => region.id === seat.regionId)) {
    throw new Error(`seats.${seat.id}: regionId '${seat.regionId}' is not an environment region`);
  }
}
