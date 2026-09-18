// tests/fixtures/w4-scene-layouts.mjs — fixture W4 scene configs in the
// resolved uiConfig.scenes shape (content/config/ui/scenes/*.json after
// tools/config-build.mjs). The models take these as parameters, so the tests
// pin their behaviour to these objects, not to whatever the config ships.
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const W4_PARENT = freeze({
  id: 'W4',
  sizing: { minimums: { footerPx: 56, targetPx: 44 }, compactBelowPx: 768 },
  layering: { plate: { bleedFraction: 0.02 } },
});

export const W4C_LAYOUT = freeze({
  sizing: {
    bands: { hud: 10, scene: 40, context: 35, footer: 15 },
    floorPercent: 60,
    portraitSlot: { widthVw: 20, compactWidthVw: 30 },
    context: {
      widthVw: 95, captionLines: 3, captionLineHeight: 1.35,
      titleRem: 0.95, titleLineHeight: 1.2, textRem: 0.9, paddingRem: 0.35, gapRem: 0.25,
    },
    responses: { fontRem: 0.85, lineHeight: 1.2, paddingBlockRem: 0.2, paddingInlineRem: 0.5, gapRem: 0.25, maxLines: 2 },
    hud: { compactBelowHeightPx: 500 },
    footer: { heightVh: 6 },
  },
  positioning: {
    portraitSlot: { insetVw: 2.5, topOffsetVh: 2 },
    portraits: {
      visibleFraction: 1 / 3, mirrorNpc: true, minGapVw: 1.5, fit: 'shrinkToLane', anchor: 'revealLine',
      listener: { minOpacity: 0.62, brightness: 0.8, saturation: 0.55 },
    },
    context: { insetVw: 2.5, insetVh: 1 },
    footer: { sideInsetVw: 2.5, gapVw: 1.5 },
  },
  layering: {
    layers: [
      { id: 'skybox', z: 2, enabled: true },
      { id: 'floor', z: 3, enabled: true },
      { id: 'playerPortrait', z: 4, enabled: true },
      { id: 'npcPortrait', z: 4, enabled: true },
      { id: 'context', z: 5, enabled: true, occludes: true },
      { id: 'hud', z: 6, enabled: true },
      { id: 'footer', z: 6, enabled: true },
    ],
    speakerAbove: true,
  },
  motion: {
    entrance: [
      { layers: ['skybox', 'floor', 'hud', 'footer'], atMs: 0, fadeMs: 0 },
      { layers: ['playerPortrait', 'npcPortrait'], atMs: 0, fadeMs: 400 },
      { layers: ['context'], atMs: 400, fadeMs: 300, riseVh: 2 },
    ],
  },
  components: { footer: { actions: ['back', 'skipSpeech', 'continue'] } },
  behavior: {
    maxVisibleResponses: 4,
    responseHints: 'tooltip',
    responseLayouts: [
      { columns: 1, placement: 'below' },
      { columns: 2, placement: 'below' },
      { columns: 2, placement: 'beside', textShare: 0.45 },
    ],
  },
});

/** edited(layout, mutate) → a deep copy of `layout` with `mutate` applied. */
export function edited(layout, mutate) {
  const copy = JSON.parse(JSON.stringify(layout));
  mutate(copy);
  return copy;
}
