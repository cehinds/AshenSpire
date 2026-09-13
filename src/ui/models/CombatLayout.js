import { wireframeUi } from '../../content/wireframeUi.js';

// W4a bands and the WGC6 packed footer. Inputs and outputs are local
// (pre-zoom) CSS px; physical minimums are divided through the UI zoom once.

// Nominal 10/55/30/5 shares. The hand and footer keep their physical minimums
// and the battlefield absorbs the difference; it is never funded by shrinking
// the hand. A battlefield too short for one readable combatant is reported as
// unsupported geometry rather than hidden by shrinking text or targets.
export function allocateCombatBands({ height, zoom = 1, rem = 16 }, config = wireframeUi) {
  const shares = config.combat.bands.map((value) => value / 100);
  if (shares.length !== 4 || Math.abs(shares.reduce((sum, value) => sum + value, 0) - 1) > 1e-9) {
    throw new Error('combat bands must be four shares summing to 100');
  }
  const [hudShare, , handShare, footerShare] = shares;
  const hud = height * hudShare;
  const hand = Math.max(height * handShare, config.hand.minimumHeightPx / zoom);
  const footer = Math.max(height * footerShare, config.combat.footerMinimumPx / zoom);
  const remaining = height - hud - hand - footer;
  const minimumBattlefield = config.formation.minimumSpritePx / zoom + config.formation.detailReserveRem * rem;
  return Object.freeze({
    hud, battlefield: Math.max(0, remaining), hand, footer, minimumBattlefield,
    supported: remaining >= minimumBattlefield,
  });
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
