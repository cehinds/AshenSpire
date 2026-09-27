import { actionControlModel, panelModel } from './HudPrimitiveModels.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';
import { t, tTip } from '../strings.js';

// WGH2 Armoury and WGH3 Menu (WGS5 is the same Menu slot). Nothing else: the
// charge flasks are not sibling controls of these two. They are entries of the
// one Potions projection (WGH8, models/PotionContentsModel.js), which the
// combat footer's Potions control lists.
//
// The Deck door (SPEC §14.1) joins them only where the host hands in its id:
// the map, under the `free` deck-editing setting, out of combat. Everywhere
// else there is no such child, so no slot is reserved for it.
export function quickAccessPanelModel(controls, layers = { armoury: true, menu: true }) {
  return panelModel(UI.quickAccessPanel, 'quick-access', [
    ...(controls.deckId ? [actionControlModel(UI.deckEditorControl, {
      id: controls.deckId,
      label: t('deckEditor.open'),
      glyph: '♠',
      hint: tTip('deckEditor.open'),
      command: 'open-deck-editor',
    })] : []),
    ...(layers.armoury ? [actionControlModel(UI.armouryControl, {
      id: controls.armouryId,
      label: 'Armoury',
      glyph: '⚒',
      hint: 'Armoury',
      command: 'open-armoury',
    })] : []),
    ...(layers.menu ? [actionControlModel(UI.quickMenuControl, {
      id: controls.menuId,
      label: 'Quick menu',
      glyph: '☰',
      hint: controls.menuHint,
      command: 'open-quick-menu',
    })] : []),
  ]);
}
