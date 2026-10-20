import { uiConfig } from '../../config/generated/ui.js';

// The preview and battlefield use exactly the same projected outline dimensions.
export function formationTileGeometry(cell, plan, presentation) {
  const compact = ['square', 'rhombus', 'circle'].includes(presentation.gridShape);
  const height = cell.tileHeight ?? Math.max(1, plan.rowSpacing * uiConfig.presentation.combatFormationModel.sizing.grid.legacyTileRowFraction);
  const width = compact ? Math.min(cell.width, height) : cell.width;
  const tilt = Number(presentation.groundTilt) || 0;
  const skew = Number(presentation.groundSkew) || 0;
  return { width, height: compact ? width : height,
    transform: `skewX(${-skew}deg) scaleY(${Math.cos(tilt * Math.PI / 180)})` };
}

// Top and left edges own shared seams. Only the final lane/band closes the
// outside boundary, keeping translucent strokes from being painted twice.
export function perspectiveCellOutlinePath(cell, lanes) {
  return `M0,100V0H100${cell.lane === lanes - 1 ? 'V100' : ''}${cell.visualBand === 'D' ? 'M100,100H0' : ''}`;
}
