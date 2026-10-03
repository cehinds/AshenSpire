import { wireframeUi } from '../../content/wireframeUi.js';
import { uiConfig } from '../../config/generated/ui.js';
import { thaw } from '../../config/authored.js';
import { FORMATION_ROWS, formationDimensions, formationLayoutConfig, formationSpawn } from '../../model/formationLayout.js';

const SIZING = uiConfig.presentation.combatFormationModel.sizing;
const PLACE = uiConfig.presentation.combatFormationModel.positioning;
const GRID = SIZING.grid;

// Presentation only. Encounter order and domain row/range facts are untouched.
export const COMBAT_LAYOUT = Object.freeze(thaw(SIZING.layout));
export const FIGURE_REFERENCE = SIZING.figureReference;
export function figureCeiling({ width, height }) {
  return Math.max(wireframeUi.formation.minimumSpritePx, Math.min(height * SIZING.ceiling.heightFraction, width * SIZING.ceiling.widthFraction));
}

function legacyCombatFormation({ width, height, friends, enemies, rem = 16, presentation = {}, footerClearance = 0 }) {
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

export function combatFormation(input) {
  // Keep the original geometry for callers that have not opted into grid controls.
  if (!Object.keys(input.presentation || {}).some(key => key.startsWith('formation') || key.startsWith('ground'))) {
    return legacyCombatFormation(input);
  }
  const { width, height, friends = [], enemies = [], footerClearance = 0, preview = false } = input;
  const config = formationLayoutConfig(input.presentation);
  const dimensions = formationDimensions(config, Math.max(friends.length, enemies.length));
  const { columns, rows } = dimensions;
  const footprint = width * config.formationWidth / 100;
  const gap = footprint * config.formationGap / 100;
  const span = (footprint - gap) / 2;
  const inset = (width - footprint) / 2;
  const slant = config.formationPreset === 'straight' || rows === 1 ? 0 : span * GRID.slantFraction;
  const pitch = (span - slant) / columns;
  const cellWidth = pitch * GRID.cellFraction;
  const depth = height * (preview ? GRID.previewDepthFraction : GRID.fieldDepthFraction) * config.formationDepth / 100;
  const lastFoot = preview ? height / 2 + depth / 2 : height - Math.max(footerClearance, height * GRID.bottomClearanceFraction);
  const firstFoot = lastFoot - depth;
  const rowSpacing = depth / Math.max(1, rows - 1);
  const tileHeight = Math.min(pitch * GRID.tileWidthFraction, (rows === 1 ? depth : rowSpacing) * GRID.tileRowFraction);
  const cells = [];
  for (let row = 0; row < rows; row++) {
    const progress = rows === 1 ? .5 : row / (rows - 1);
    for (const enemy of [false, true]) for (let column = 0; column < columns; column++) {
      const front = column === columns - 1;
      const band = front ? 'front' : 'back';
      let shift = 0;
      if (config.formationPreset === 'classic-v') shift = progress * slant;
      if (config.formationPreset === 'forward-slant') shift = (enemy ? progress : 1 - progress) * slant;
      if (config.formationPreset === 'back-slant') shift = (enemy ? 1 - progress : progress) * slant;
      const distance = Math.max(cellWidth / 2, Math.min(width / 2 - cellWidth / 2,
        inset + pitch * (column + .5) + shift + (config[`${band}OffsetX`] || 0)));
      const ground = Math.max(tileHeight / 2, Math.min(height - tileHeight / 2,
        (rows === 1 ? lastFoot - depth / 2 : firstFoot + progress * depth) + (config[`${band}OffsetY`] || 0)));
      const cell = `${FORMATION_ROWS[row]}${enemy ? columns * 2 - column : column + 1}`;
      cells.push({ id: `grid-${enemy ? 'enemy' : 'player'}-${cell}`, cell, row, column,
        side: enemy ? 'enemy' : 'player', formationRow: front ? 'front-row' : 'back-row',
        layer: (config[`${band}Layer`] ?? (front ? wireframeUi.formation.frontLayer : wireframeUi.formation.backLayer)) + (config[`row${FORMATION_ROWS[row]}Layer`] || 0),
        x: enemy ? width - distance : distance, ground, fitGround: ground,
        width: cellWidth, artWidth: pitch, tileHeight, depth: wireframeUi.formation.depth[Math.min(2, Math.round(progress * 2))] });
    }
  }
  const group = (ids, side) => {
    const spawn = formationSpawn(config, side, dimensions);
    const row = FORMATION_ROWS.indexOf(spawn[0]);
    const column = side === 'player' ? Number(spawn[1]) - 1 : columns * 2 - Number(spawn[1]);
    return ids.map((id, index) => {
      const targetRow = (row - Math.floor(index / columns) % rows + rows) % rows;
      const targetColumn = (column + index) % columns;
      const anchor = cells.find(cell => cell.side === side && cell.row === targetRow && cell.column === targetColumn);
      return { ...anchor, id };
    });
  };
  return { columns, rows, ground: lastFoot, rowSpacing, friendlyWidth: span, enemyWidth: span,
    cells, slots: [...group(friends, 'player'), ...group(enemies, 'enemy')] };
}
