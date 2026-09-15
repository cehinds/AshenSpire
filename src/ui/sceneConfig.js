// src/ui/sceneConfig.js — the one seam the W4 screens read their scene
// configs through: w4Parent() is uiConfig.scenes.w4, w4cLayout() is
// uiConfig.scenes.w4c (content/config/ui/scenes/*.json, compiled by
// tools/config-build.mjs into src/config/generated/ui.js).
//
// INTERIM, until feature/ui-config-folder lands under this branch: the
// resolved objects are mirrored here in uiConfig's exact shape so the screen
// runs. On that rebase this file becomes
//   import { uiConfig } from '../config/generated/ui.js';
//   export const w4Parent = () => uiConfig.scenes.w4;
//   export const w4cLayout = () => uiConfig.scenes.w4c;
// and no model, adapter or stylesheet changes: they take these objects as
// parameters.
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

const scenes = freeze({
  w4: {
    sizing: { minimums: { footerPx: 56, targetPx: 44 }, compactBelowPx: 768 },
    layering: { plate: { bleedFraction: 0.02 } },
  },
  w4c: {
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
  },
});

export const w4Parent = () => scenes.w4;
export const w4cLayout = () => scenes.w4c;
