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

export function formationDimensions(values = {}, actorsPerSide = 0) {
  const config = formationLayoutConfig(values);
  let columns = config.formationColumns, rows = config.formationRows;
  // A small saved layout must never stack or hide existing encounter actors.
  rows = Math.min(6, Math.max(rows, Math.ceil(actorsPerSide / columns)));
  columns = Math.min(3, Math.max(columns, Math.ceil(actorsPerSide / rows)));
  return { columns, rows };
}

export function isFormationCell(cell, { columns, rows }, side = 'player') {
  if (typeof cell !== 'string' || !/^[A-F][1-6]$/.test(cell)) return false;
  const column = Number(cell[1]);
  return FORMATION_ROWS.indexOf(cell[0]) < rows && (side === 'player'
    ? column >= 1 && column <= columns : column > columns && column <= columns * 2);
}

export function formationSpawn(values, side, dimensions = formationDimensions(values)) {
  const { columns, rows } = dimensions;
  const row = Math.min(rows - 1, Math.max(0, FORMATION_ROWS.indexOf(values[`${side}SpawnRow`] || 'C')));
  const low = side === 'player' ? 1 : columns + 1;
  const high = side === 'player' ? columns : columns * 2;
  const raw = Number(values[`${side}SpawnColumn`] ?? (side === 'player' ? columns : low));
  const column = Math.min(high, Math.max(low, Number.isFinite(raw) ? raw : low));
  return `${FORMATION_ROWS[row]}${column}`;
}
