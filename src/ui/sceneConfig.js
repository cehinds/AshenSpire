// src/ui/sceneConfig.js — the one seam the W4 screens read their scene
// configs through: w4Parent() is uiConfig.scenes.w4 and w4cLayout() is
// uiConfig.scenes.w4c (content/config/ui/scenes/*.json, compiled by
// tools/config-build.mjs into src/config/generated/ui.js). The models take
// these objects as parameters and read no config of their own.
//
// INTERIM, until feature/ui-config-folder is on dev: that compiler and its
// generated module are not here yet, so the resolved objects are mirrored in
// uiConfig's exact shape, with the config's own values (visibleFraction as the
// resolved number, as uiConfig gives it). When the config lands this file
// becomes
//   import { uiConfig } from '../config/generated/ui.js';
//   export const w4Parent = () => uiConfig.scenes.w4;
//   export const w4cLayout = () => uiConfig.scenes.w4c;
// plus the PENDING keys below until w4c-dialogue.json carries them; no model,
// adapter or stylesheet changes.
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
      context: {
        widthVw: 95, captionLines: 3, captionLineHeight: 1.45,
        // PENDING relay to w4c-dialogue.json (owner, 2026-09-15: smaller type
        // and gaps in the context band).
        titleRem: 0.95, titleLineHeight: 1.2, textRem: 0.9, paddingRem: 0.35, gapRem: 0.25,
      },
      // PENDING relay to w4c-dialogue.json.
      responses: { fontRem: 0.85, lineHeight: 1.2, paddingBlockRem: 0.2, paddingInlineRem: 0.5, gapRem: 0.25, maxLines: 2 },
      footer: { heightVh: 6 },
    },
    positioning: {
      portraitSlot: { insetVw: 2.5, topOffsetVh: 2 },
      portraits: { visibleFraction: 1 / 3, mirrorNpc: true },
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
    // PENDING relay to w4c-dialogue.json (owner, 2026-09-15): up to
    // maxVisibleResponses responses show without scrolling; the first of
    // responseLayouts that holds them is used.
    behavior: {
      maxVisibleResponses: 4,
      responseLayouts: [
        { columns: 1, placement: 'below' },
        { columns: 2, placement: 'below' },
        { columns: 2, placement: 'beside', textShare: 0.45 },
      ],
    },
  },
});

export const w4Parent = () => scenes.w4;
export const w4cLayout = () => scenes.w4c;
