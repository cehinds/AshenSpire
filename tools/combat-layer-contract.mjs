import assert from 'node:assert/strict';

// Shared by the rendered-layer probe and its source-side known-bad regression.
// Selected actors may rise above the other role; every actor stays below fade.
export function assertCombatLayerOrder({ scenery, sprites, fade, selectionSurfaces, hudSurfaces, selectionCategories, cards, hud, footer }) {
  assert(sprites.length > 0 && selectionSurfaces.length > 0 && hudSurfaces.length > 0, 'fighter, selection and player HUD layers must be measured');
  for (const category of ['enemy-leading', 'enemy-reading', 'target-proxy']) {
    assert(selectionCategories.includes(category), `required painted selection category missing: ${category}`);
  }
  assert([scenery, ...sprites, fade, ...selectionSurfaces, ...hudSurfaces, cards, hud, footer].every(Number.isFinite),
    'combat layers must resolve to numeric z-index values');
  assert(scenery < Math.min(...sprites), 'scenery must stay below every fighter');
  assert(Math.max(...sprites) < fade, 'fade must paint above every fighter, including selected actors');
  assert(fade < Math.min(...selectionSurfaces), 'fade must stay below every selection surface');
  assert(Math.max(...selectionSurfaces) < cards, 'every ordinary selection surface must stay below cards');
  assert(cards < Math.min(...hudSurfaces), 'every HUD-owned surface must stay above cards');
  assert(cards < hud && cards < footer, 'HUD and footer must stay above cards');
}
