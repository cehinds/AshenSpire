import assert from 'node:assert/strict';

// Shared by the rendered-layer probe and its source-side known-bad regression.
// Selected actors may rise above the other role; every actor stays below fade.
export function assertCombatLayerOrder({ scenery, sprites, fade, selectionSurfaces, selection, cards, hud, footer }) {
  assert(sprites.length > 0 && selectionSurfaces.length > 0, 'fighter and selection layers must be measured');
  assert([scenery, ...sprites, fade, ...selectionSurfaces, selection, cards, hud, footer].every(Number.isFinite),
    'combat layers must resolve to numeric z-index values');
  assert(scenery < Math.min(...sprites), 'scenery must stay below every fighter');
  assert(Math.max(...sprites) < fade, 'fade must paint above every fighter, including selected actors');
  assert(fade < Math.min(...selectionSurfaces), 'fade must stay below every selection surface');
  assert(selection < cards, 'selection controls must stay below cards');
  assert(cards < hud && cards < footer, 'HUD and footer must stay above cards');
}
