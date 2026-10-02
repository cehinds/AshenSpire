// src/ui/models/BootArtStatusModel.js — the web edition's one boot status line
// (docs/EXTERNAL-ASSETS-PLAN.md step 5).
//
// NOT PART OF THE STARTUP GATE. SPEC §7.1 says the gate contains only the
// wordmark, the ash, the prompt and the build stamp, and the gate is one
// role="button" (inside which a live region would be presentational). So the
// line is its own component, a sibling the composition root mounts beside the
// gate in #app; the gate's model, children and markup are unchanged.
// Its record is src/ui/bootArt.js bootArtLine(): { state, text }.

import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

export function bootArtStatusModel(line) {
  const state = line && typeof line === 'object' ? String(line.state || 'loading') : 'off';
  return componentModel(UI.bootArtStatus, {
    variant: state,
    properties: { text: line && typeof line === 'object' ? String(line.text || '') : '' },
    accessibility: { role: 'status', live: 'polite', busy: state === 'loading' },
  });
}
