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
    context: { widthVw: 95, captionLines: 3, captionLineHeight: 1.45 },
    footer: { heightVh: 6 },
  },
  positioning: {
    portraitSlot: { insetVw: 2.5, topOffsetVh: 2 },
    portraits: { visibleFraction: { numerator: 1, denominator: 3 }, mirrorNpc: true },
    context: { insetVw: 2.5, insetVh: 2 },
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
});

/** edited(layout, mutate) → a deep copy of `layout` with `mutate` applied. */
export function edited(layout, mutate) {
  const copy = JSON.parse(JSON.stringify(layout));
  mutate(copy);
  return copy;
}
