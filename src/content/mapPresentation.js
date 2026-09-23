// Presentation policy only. Node IDs, routes and discovery remain engine-owned.
//
// The numbers live in content/config/ui/presentation/mapPresentation.json and
// are compiled into src/config/generated/ui.js; this file is the shim that
// names them for the readers that already import it.
import { uiConfig } from '../config/generated/ui.js';
import { shallowFrozen } from '../config/authored.js';

export const MAP_PRESENTATION = shallowFrozen(uiConfig.presentation.mapPresentation.behavior.presentation);

export const MAP_CLOSE_NODE_SCALE = uiConfig.presentation.mapPresentation.sizing.closeNodeScale;
