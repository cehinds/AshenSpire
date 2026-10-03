// Shared defaults; optional map-ID overrides contain presentation only.
// Content relationships remain in the normalized worldAtlas source tables.
//
// Both tables live in content/config/ui/presentation/localMapPresentation.json.
import { uiConfig } from '../config/generated/ui.js';

const { sizing, behavior } = uiConfig.presentation.localMapPresentation;
const LOCAL_MAP_PRESENTATION = sizing.defaults;
const LOCAL_MAP_OVERRIDES = behavior.overrides;
export const localMapPolicy = mapId => ({ ...LOCAL_MAP_PRESENTATION, ...LOCAL_MAP_OVERRIDES[mapId] });
