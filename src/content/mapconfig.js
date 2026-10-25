// src/content/mapconfig.js — per-act map-generation knobs (SPEC §6)
// Consumed by engine/mapgen.js through model/floorplan.js. The data tables are
// authored in content/source/mapActShape.json, mapShapeLimits.json and
// legacyActBosses.json (the anchor rules, the debug-run limits and what each
// number does are in content/source/CONTENT-NOTES.md, "Map config"); content-build
// compiles them to src/content/generated/. Edit the JSON; this file only builds
// the per-act table from the shared shape and freezes the two lookups.
import { mapActShape } from './generated/mapActShape.js';
import { mapShapeLimits } from './generated/mapShapeLimits.js';
import { legacyActBosses } from './generated/legacyActBosses.js';

export const MAP_SHAPE_LIMITS = Object.freeze(mapShapeLimits);

// All three acts share the SPEC §6 shape; per-act difficulty lives in the
// encounter pools, not the map geometry. Distinct objects so future acts can
// diverge without surprises.
export const mapConfigs = {
  1: { ...mapActShape },
  2: { ...mapActShape },
  3: { ...mapActShape },
};

// Saves written before terminal encounter IDs existed must keep their original
// act boss even after the live pool grows. This migration lookup never rolls.
export const LEGACY_ACT_BOSSES = Object.freeze(legacyActBosses);
