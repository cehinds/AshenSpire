import { wireframeUi } from '../../content/wireframeUi.js';
import { uiConfig } from '../../config/generated/ui.js';
import { thaw } from '../../config/authored.js';

const SIZING = uiConfig.presentation.combatFormationModel.sizing;
const PLACE = uiConfig.presentation.combatFormationModel.positioning;

// Presentation only. Encounter order and domain row/range facts are untouched.
export const COMBAT_LAYOUT = Object.freeze(thaw(SIZING.layout));
export const FIGURE_REFERENCE = SIZING.figureReference;
export function figureCeiling({ width, height }) {
  return Math.max(wireframeUi.formation.minimumSpritePx, Math.min(height * SIZING.ceiling.heightFraction, width * SIZING.ceiling.widthFraction));
}

export function combatFormation({ width, height, friends, enemies, rem = 16, presentation = {}, footerClearance = 0 }) {
  const config = wireframeUi.formation;
  const inset = Math.min(config.insetRem * rem, width / SIZING.insetCapDivisor);
  const progress = Math.max(0, Math.min(1, (width - SIZING.gapRamp.narrowPx) / (SIZING.gapRamp.widePx - SIZING.gapRamp.narrowPx)));
  const gap = width * (config.gapNarrowFraction + progress * (config.gapWideFraction - config.gapNarrowFraction));
  const span = Math.max(1, (width - inset * 2 - gap) / 2);
  const stepX = Math.min(span / SIZING.stepCapDivisor, Math.max(config.minimumStepPx, width * config.horizontalStepFraction));
  const cell = Math.max(1, (span - stepX * 2) / 2);
  const retreat = Math.min(width * config.innerRetreatFraction, cell * config.maxRetreatSpacingFraction);
  const lastFoot = Math.max(1, height - Math.max(footerClearance, Math.min(config.detailReserveRem * rem, height * PLACE.detailReserveFraction)));
  const firstFoot = Math.min(lastFoot, Math.max(config.minimumSpritePx, height * PLACE.firstFootFraction));
  const step = (lastFoot - firstFoot) / 2;
  const feet = [firstFoot + PLACE.footSteps[0] * step, firstFoot + PLACE.footSteps[1] * step, lastFoot];
  const group = (ids, enemy, preferred = false) => ids.map((id, index) => {
    const side = enemy ? 'enemy' : 'player';
    const selectedRow = 'ABC'.indexOf(presentation[`${side}SpawnRow`]);
    const selectedColumn = Number(presentation[`${side}SpawnColumn`]);
    const usePreference = preferred && selectedRow >= 0 && (enemy ? [3, 4] : [1, 2]).includes(selectedColumn);
    const row = usePreference ? (selectedRow - Math.floor(index / 2) % 3 + 3) % 3 : Math.min(2, Math.floor(index / 2));
    const column = usePreference ? ((enemy ? 4 - selectedColumn : selectedColumn - 1) + index) % 2 : index % 2;
    const band = column ? 'front' : 'back';
    const offsetX = presentation[`${band}OffsetX`] || 0;
    const offsetY = presentation[`${band}OffsetY`] || 0;
    const distance = Math.max(cell / 2, Math.min(width / 2 - cell / 2,
      inset + cell * (column + .5) + row * stepX - (column ? retreat : 0) + offsetX));
    return {
      id, row, column, formationRow: column ? 'front-row' : 'back-row',
      // Battlefield cell: row A/B/C upper to lower, column 1-4 ally back, ally front, enemy front, enemy back.
      cell: 'ABC'[row] + (enemy ? 4 - column : 1 + column),
      layer: (presentation[`${band}Layer`] ?? (column ? config.frontLayer : config.backLayer)) + (presentation[`row${'ABC'[row]}Layer`] || 0),
      x: enemy ? width - distance : distance,
      ground: Math.max(1, Math.min(height - 1, feet[row] + offsetY)), fitGround: Math.max(1, Math.min(height - 1, firstFoot + row * step + offsetY)),
      width: cell, artWidth: cell, depth: config.depth[row],
    };
  });
  return { ground: lastFoot, rowSpacing: Math.min(feet[1] - feet[0], feet[2] - feet[1]), friendlyWidth: span, enemyWidth: span,
    cells: [...group(Array.from({ length: 6 }, (_, i) => `grid-player-${i}`), false),
      ...group(Array.from({ length: 6 }, (_, i) => `grid-enemy-${i}`), true)],
    slots: [...group(friends, false, true), ...group(enemies, true, true)] };
}
