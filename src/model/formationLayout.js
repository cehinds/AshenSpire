// Shared grid limits and position addresses for presentation and movement.
export const FORMATION_ROWS = 'ABCDEF';
export const FORMATION_PRESETS = Object.freeze([
  { value: 'straight', label: 'Straight ranks', short: 'Straight' },
  { value: 'forward-slant', label: 'Forward slant', short: 'Forward' },
  { value: 'back-slant', label: 'Back slant', short: 'Back' },
  { value: 'classic-v', label: 'Classic V', short: 'V' },
]);
export const FORMATION_FIELDS = Object.freeze([
  { key: 'formationColumns', label: 'Columns per side', min: 1, max: 3, def: 2, step: 1, integer: true },
  { key: 'formationRows', label: 'Rows per side', min: 1, max: 6, def: 2, step: 1, integer: true },
  { key: 'formationWidth', label: 'Width', min: 40, max: 100, def: 80, step: 1, integer: true, suffix: '%' },
  { key: 'formationDepth', label: 'Depth', min: 30, max: 100, def: 60, step: 1, integer: true, suffix: '%' },
  { key: 'formationGap', label: 'Team gap', min: 4, max: 30, def: 12, step: 1, integer: true, suffix: '%' },
  { key: 'groundTilt', label: 'Tilt', min: 0, max: 65, def: 35, step: 1, integer: true, suffix: '°' },
  { key: 'groundSkew', label: 'Skew', min: -35, max: 35, def: 15, step: 1, integer: true, suffix: '°' },
]);
export const FORMATION_DEFAULTS = Object.freeze({ formationPreset: 'straight',
  ...Object.fromEntries(FORMATION_FIELDS.map(field => [field.key, field.def])) });

export function formationLayoutConfig(values = {}) {
  const config = { ...values };
  config.formationPreset = FORMATION_PRESETS.some(p => p.value === values.formationPreset) ? values.formationPreset : FORMATION_DEFAULTS.formationPreset;
  for (const field of FORMATION_FIELDS) {
    const number = Number(values[field.key] ?? field.def);
    config[field.key] = Number.isFinite(number) ? Math.round(Math.min(field.max, Math.max(field.min, number))) : field.def;
  }
  return config;
}

// The default (alternative) perspective draws one uniform grid: enemies in a
// back and a front rank across three lanes, the player's party in one rank of
// the same lanes. Gameplay columns are depth (outer = back), rows are lanes.
export const PERSPECTIVE_LANES = 3;

// `partySize` matters only to the perspective: its party shares one rank, so
// a four-player party needs four lanes.
export function formationDimensions(values = {}, actorsPerSide = 0, partySize = 0) {
  if (values.perspectiveGrid) {
    const extra = values.formationPolicy?.extraRow;
    const enabled = extra?.enabled === true && extra.sides?.includes('enemy');
    const rows = Math.min(6, Math.max(PERSPECTIVE_LANES, Math.ceil(actorsPerSide / (enabled ? 3 : 2)), partySize));
    const extraCells = enabled ? Array.from({ length: rows }, (_, row) => ({ cell: `${FORMATION_ROWS[row]}5`, row, lane: row, column: 2, side: 'enemy', visualBand: 'C', formationRole: 'extra' })) : [];
    return { columns: 2, rows, perspective: true, ...(enabled ? { extraCells } : {}) };
  }
  const config = formationLayoutConfig(values);
  let columns = config.formationColumns, rows = config.formationRows;
  // A small saved layout must never stack or hide existing encounter actors.
  rows = Math.min(6, Math.max(rows, Math.ceil(actorsPerSide / columns)));
  columns = Math.min(3, Math.max(columns, Math.ceil(actorsPerSide / rows)));
  return { columns, rows };
}

// Stable gameplay addresses, ordered by the approved visual spawn priority.
// Extra capacity extends the same ordering; saved occupants are never reassigned.
export function perspectiveEnemyCellOrder({ rows, extraCells = [] }) {
  const lanes = Array.from({ length: rows }, (_, i) => i);
  const back = [rows - 1, 0, ...lanes.slice(1, -1)];
  const front = [...lanes].reverse();
  return [...back.map(lane => `${FORMATION_ROWS[lane]}4`),
    ...front.map(lane => `${FORMATION_ROWS[lane]}3`), ...extraCells.map(cell => cell.cell)];
}

export function isFormationCell(cell, { columns, rows, perspective = false, extraCells = [] }, side = 'player') {
  if (typeof cell !== 'string' || !/^[A-F][1-6]$/.test(cell)) return false;
  if (perspective && side === 'enemy' && extraCells.some(extra => extra.cell === cell)) return true;
  const column = Number(cell[1]);
  // The perspective's player rank is the outer column only.
  const playerColumns = perspective ? 1 : columns;
  return FORMATION_ROWS.indexOf(cell[0]) < rows && (side === 'player'
    ? column >= 1 && column <= playerColumns : column > columns && column <= columns * 2);
}

// A saved player cell read on the given grid. The perspective keeps only the
// outer column, so a cell saved in a front column (the Classic grid, or an
// older save) stands in the same lane of the one player rank.
export function playerFormationCell(cell, dimensions) {
  if (isFormationCell(cell, dimensions)) return cell;
  // Classic allows up to three player columns; each collapses into column 1.
  if (dimensions.perspective && isFormationCell(cell, { columns: 3, rows: dimensions.rows }, 'player')) return `${cell[0]}1`;
  // Back on Classic, a perspective lane past Classic's rows stands in its last row.
  if (!dimensions.perspective && isFormationCell(cell, { columns: dimensions.columns, rows: 6 }, 'player')) {
    return `${FORMATION_ROWS[Math.min(FORMATION_ROWS.indexOf(cell[0]), dimensions.rows - 1)]}${cell[1]}`;
  }
  return null;
}

export function formationSpawn(values, side, dimensions = formationDimensions(values)) {
  const { columns, rows } = dimensions;
  const row = Math.min(rows - 1, Math.max(0, FORMATION_ROWS.indexOf(values[`${side}SpawnRow`] || 'F')));
  const low = side === 'player' ? 1 : columns + 1;
  const high = side === 'player' ? columns : columns * 2;
  const raw = Number(values[`${side}SpawnColumn`] ?? (side === 'player' ? low : high));
  // The perspective's player rank is the outer column only.
  const column = dimensions.perspective && side === 'player' ? low
    : Math.min(high, Math.max(low, Number.isFinite(raw) ? raw : low));
  return `${FORMATION_ROWS[row]}${column}`;
}
