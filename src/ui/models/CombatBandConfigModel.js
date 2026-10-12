import { wireframeUi } from '../../content/wireframeUi.js';
import { uiConfig } from '../../config/generated/ui.js';

// The wide (desktop and widescreen) band config: the same wireframe config with
// the wide shares (content/config sizing.wideBands) in place of the default
// shares. The footer share matches the base footer share, so a wide footer is
// never taller than the base one at any height.
export function combatBandConfig(wide) {
  if (!wide) return wireframeUi;
  const { hud, scene, context, footer } = uiConfig.scenes.w4a.sizing.wideBands;
  return { ...wireframeUi, combat: { ...wireframeUi.combat, bands: [hud, scene, context, footer] } };
}
