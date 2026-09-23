import { wireframeUi } from '../../content/wireframeUi.js';

// The W4 bands, top to bottom.
const SCENE_BANDS = Object.freeze(['hud', 'scene', 'context', 'footer']);

// W4a bands and the WGC6 packed footer. Inputs and outputs are local
// (pre-zoom) CSS px; physical minimums are divided through the UI zoom once.

// THE W4 PARENT'S BANDS, shared by every W4 screen (W4a combat, W4c dialogue):
// HUD, scene, context and footer, top to bottom. `layout` is a W4 child's
// resolved scene config (uiConfig.scenes.<id>: sizing.bands { hud, scene,
// context, footer } as percentages summing to 100) and `parent` the W4 row
// (uiConfig.scenes.w4), whose sizing.minimums.footerPx is physical px,
// divided through the zoom here. A screen may
// add its own floors: `contextPx` (physical px, combat's hand) and `scenePx`
// (already local px, combat's readable battlefield). The context and footer
// keep their minimums and the scene absorbs any shortfall; it is never funded
// by shrinking them, and a scene below its floor is reported as unsupported
// rather than hidden. `width` and `rem` are accepted so every W4 caller passes
// one host shape; the stacked plan itself reads neither.
export function allocateSceneBands({ width, height, zoom = 1, rem = 16 } = {}, layout, parent = {}, {
  contextPx = 0, scenePx = 0, label = 'scene',
} = {}) {
  const bands = layout?.sizing?.bands || {};
  const shares = SCENE_BANDS.map((band) => bands[band] / 100);
  if (!shares.every(Number.isFinite) || Math.abs(shares.reduce((sum, value) => sum + value, 0) - 1) > 1e-9) {
    throw new Error(`${label} bands must be four shares summing to 100`);
  }
  const [hudShare, , contextShare, footerShare] = shares;
  const hud = height * hudShare;
  const context = Math.max(height * contextShare, contextPx / zoom);
  const footer = Math.max(height * footerShare, (parent?.sizing?.minimums?.footerPx ?? 0) / zoom);
  const remaining = height - hud - context - footer;
  return Object.freeze({
    hud, scene: Math.max(0, remaining), context, footer,
    minimumScene: scenePx, supported: remaining >= scenePx,
    shares: Object.freeze(shares),
  });
}

// Nominal 10/55/30/5 shares. The hand and footer keep their physical minimums
// and the battlefield absorbs the difference; it is never funded by shrinking
// the hand. A battlefield too short for one readable combatant is reported as
// unsupported geometry rather than hidden by shrinking text or targets.
//
// Short landscape (given a width): when that stacked plan fails, the footer
// row folds into rails beside the hand (packCombatRails). The hand band then
// yields height to the battlefield, but only down to one minimum-width card
// with its lift, arc and insets. Card faces, text and targets keep their
// minimums. A host that still cannot fit is reported, not squeezed.
export function allocateCombatBands({ width, height, zoom = 1, rem = 16 }, config = wireframeUi) {
  // The stacked plan is the shared W4 plan: the battlefield is the scene band
  // and the hand is the context band.
  const minimumBattlefield = config.formation.minimumSpritePx / zoom + config.formation.detailReserveRem * rem;
  // Combat's bands and footer floor arrive as wireframeUi.combat; they are
  // handed to the shared plan in the W4 scene-config shape.
  const [hudBand, sceneBand, contextBand, footerBand] = config.combat.bands;
  const plan = allocateSceneBands({ width, height, zoom, rem },
    { sizing: { bands: { hud: hudBand, scene: sceneBand, context: contextBand, footer: footerBand } } },
    { sizing: { minimums: { footerPx: config.combat.footerMinimumPx } } },
    { contextPx: config.hand.minimumHeightPx, scenePx: minimumBattlefield, label: 'combat' });
  const [, , handShare, footerShare] = plan.shares;
  const { hud, context: hand, footer } = plan;
  const stacked = Object.freeze({
    hud, battlefield: plan.scene, hand, footer, minimumBattlefield,
    arrangement: 'stacked', rails: null,
    supported: plan.supported,
  });
  if (stacked.supported || !(width > 0) || !config.combat.shortHostRails) return stacked;
  const rails = packCombatRails({ width, zoom, rem }, config);
  if (!rails.supported) return stacked;
  const preferred = Math.max(height * (handShare + footerShare), config.hand.minimumHeightPx / zoom);
  const floor = Math.max(minimumHandHeight(rem, config), rails.height);
  const railHand = Math.max(floor, Math.min(preferred, height - hud - minimumBattlefield));
  const field = height - hud - railHand;
  return Object.freeze({
    hud, battlefield: Math.max(0, field), hand: railHand, footer: 0, minimumBattlefield,
    arrangement: 'rails', rails,
    supported: field >= minimumBattlefield,
  });
}

// The shortest hand band that still shows a minimum-width card whole, with the
// selection lift, fan arc and vertical insets handLayout() reserves.
export function minimumHandHeight(rem = 16, config = wireframeUi) {
  const hand = config.hand;
  return hand.minWidthRem * rem / config.card.ratio
    + (hand.verticalInsetRem * 2 + hand.selectedLiftRem + hand.arcRem) * rem;
}

// Five tracks: (Actions) [Draw] [ End Turn ] [Discard] (Potions). Gaps come off
// first; circles share one diameter from the footer height, capped by their
// width envelope but never below the touch target. End Turn shares that height
// and takes up to its envelope of what remains. The touch target and the
// readable pile floor outrank the nominal pile envelope on narrow hosts.
export function packCombatFooter({ width, height, zoom = 1, rem = 16 }, config = wireframeUi.footer) {
  const gap = config.gapRem * rem;
  const target = config.minimumTargetPx / zoom;
  const available = Math.max(0, width - gap * 4);
  const diameter = Math.max(target, Math.min(height * config.heightFraction, available * config.circleMaxFraction));
  const pileWidth = Math.max(target, config.pileMinimumRem * rem, available * config.pileMaxFraction);
  const endRoom = available - diameter * 2 - pileWidth * 2;
  const endWidth = Math.max(0, Math.min(available * config.endMaxFraction, endRoom));
  return Object.freeze({
    gap, target, diameter, pileWidth, pileHeight: target, endWidth, endHeight: diameter,
    groupWidth: diameter * 2 + pileWidth * 2 + endWidth + gap * 4,
    supported: endWidth >= target && height >= target,
  });
}

// The same five controls as rails around the hand, for short landscape hosts:
//   (Actions)[Draw] | hand | [  End Turn  ]
//                          | [Discard](Potions)
// One grid and one gap as WGC6. The lower row keeps the footer's shared
// baseline and order. Circles take 95% of the footer minimum height, as the
// packed row does on a minimum footer. Piles keep the target and the readable
// floor. End Turn spans the trailing rail. The hand between the rails must
// still expose five minimum-width cards at the touch target.
export function packCombatRails({ width, zoom = 1, rem = 16 }, config = wireframeUi) {
  const footer = config.footer;
  const gap = footer.gapRem * rem;
  const target = footer.minimumTargetPx / zoom;
  const diameter = Math.max(target, config.combat.footerMinimumPx / zoom * footer.heightFraction);
  const pileWidth = Math.max(target, footer.pileMinimumRem * rem);
  const railWidth = diameter + gap + pileWidth;
  const handWidth = Math.max(0, width - railWidth * 2 - gap * 2);
  const hand = config.hand;
  const minimumHandWidth = hand.minWidthRem * rem + (hand.minCapacity - 1) * hand.exposedTargetPx / zoom
    + hand.verticalInsetRem * rem * 2;
  return Object.freeze({
    gap, target, diameter, pileWidth, pileHeight: target, endWidth: railWidth, endHeight: diameter,
    railWidth, height: diameter * 2 + gap, handWidth, minimumHandWidth,
    supported: handWidth >= minimumHandWidth,
  });
}
