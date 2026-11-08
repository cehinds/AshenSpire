// The combat-engine functions src/model/attributePointPreview.js prices a point with. The model layer sits below
// src/engine, so it takes them as a parameter; every caller (ui, tests) passes this bundle.
import { effectiveEvasion, precisionStatMix } from './stanceHit.js';
import { configuredCombat, profileHandSize } from './gameProfileCombat.js';

export const ATTRIBUTE_PREVIEW_ENGINE = Object.freeze({ effectiveEvasion, precisionStatMix, configuredCombat, profileHandSize });
