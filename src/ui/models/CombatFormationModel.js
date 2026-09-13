import { wireframeUi } from '../../content/wireframeUi.js';

// Presentation only. Encounter order and domain row/range facts are untouched.
export const COMBAT_LAYOUT = Object.freeze({ hud: 10, field: 55, hand: 30, controls: 5 });
export const FIGURE_REFERENCE = 150;
export function figureCeiling({ width, height }) {
  return Math.max(wireframeUi.formation.minimumSpritePx, Math.min(height * .52, width * .16));
}

export function combatFormation({ width, height, friends, enemies, rem = 16 }) {
  const config = wireframeUi.formation;
  const inset = Math.min(config.insetRem * rem, width / 10);
  const progress = Math.max(0, Math.min(1, (width - 375) / (1200 - 375)));
  const gap = width * (config.gapNarrowFraction + progress * (config.gapWideFraction - config.gapNarrowFraction));
  const span = Math.max(1, (width - inset * 2 - gap) / 2);
  const stepX = Math.min(span / 6, Math.max(config.minimumStepPx, width * config.horizontalStepFraction));
  const cell = Math.max(1, (span - stepX * 2) / 2);
  const retreat = Math.min(width * config.innerRetreatFraction, cell * config.maxRetreatSpacingFraction);
  const lastFoot = Math.max(1, height - Math.min(config.detailReserveRem * rem, height * .22));
  const firstFoot = Math.min(lastFoot, Math.max(config.minimumSpritePx, height * .45));
  const step = (lastFoot - firstFoot) / 2;
  const feet = [firstFoot + .25 * step, firstFoot + 1.125 * step, lastFoot];
  const group = (ids, enemy) => ids.map((id, index) => {
    const row = Math.min(2, Math.floor(index / 2));
    const column = index % 2;
    const distance = inset + cell * (column + .5) + row * stepX - (column ? retreat : 0);
    return {
      id, row, column, formationRow: column ? 'front-row' : 'back-row',
      layer: column ? config.frontLayer : config.backLayer,
      x: enemy ? width - distance : distance,
      ground: feet[row], fitGround: firstFoot + row * step,
      width: cell, artWidth: cell, depth: config.depth[row],
    };
  });
  return { ground: lastFoot, friendlyWidth: span, enemyWidth: span,
    slots: [...group(friends, false), ...group(enemies, true)] };
}
