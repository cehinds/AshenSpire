// Four edge-to-edge combat paintings per atlas. The original concept boards
// remain in art/environments; floorStart is measured on the combat-fields art.
//
// The regions, their scenes and the atlas geometry live in
// content/config/ui/presentation/environments.json. Each scene's box is written
// out there rather than computed from its index by a `region()` helper: the
// pane grid is a layout fact, and `$paneWidth`/`$paneHeight` say it once.
import { uiConfig } from '../config/generated/ui.js';

const { components, sizing } = uiConfig.presentation.environments;

export const ENVIRONMENTS = components.regions;

export const ENVIRONMENT_ATLAS_SIZE = sizing.atlasSize;
// SVG-space distance, independent of text zoom and viewport pixels.
export const MAP_TERRAIN_REVEAL_RADIUS = sizing.mapTerrainRevealRadius;

// Each world painting contains all five biomes. These are visual layouts;
// biome junctions and enemy selection remain future gameplay work.
export const MEGA_MAPS = components.megaMaps;
