// Group offsets are percentages of the battlefield, so saved layouts resize.
export const FORMATION_GROUPS_KEY = 'gameConfig.presentation.formationGroups';
export const FORMATION_SNAP_STEP = 50;
export function formationGroups(raw) {
  try {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(list)) return [];
    return list.slice(0, 32).filter(g => g && typeof g.id === 'string').map(g => ({
      id: g.id.slice(0, 60), name: String(g.name || g.id).slice(0, 60),
      members: Array.isArray(g.members) ? [...new Set(g.members.filter(m => /^(player|enemy):[0-5]:[0-2]$/.test(m)))].slice(0, 36) : [],
      x: Number.isFinite(g.x) ? Math.max(-100, Math.min(100, g.x)) : 0,
      y: Number.isFinite(g.y) ? Math.max(-100, Math.min(100, g.y)) : 0,
      ...(Number.isFinite(g.scale) ? { scale: Math.max(.25, Math.min(3, g.scale)) } : {}),
    }));
  } catch { return []; }
}
export const formationMember = cell => `${cell.side}:${cell.row}:${cell.column}`;
export function snapFormationTranslation(cells, dx, dy, step = FORMATION_SNAP_STEP) {
  const anchor = cells[0];
  if (!anchor || !Number.isFinite(step) || step <= 0) return { dx, dy };
  return { dx: Math.round((anchor.x + dx) / step) * step - anchor.x,
    dy: Math.round((anchor.ground + dy) / step) * step - anchor.ground };
}
export function formationGroupContains(group, cell) {
  return group.id === 'all' || group.id === cell.side
    || group.id === `row-${cell.row}` || group.id === `${cell.side}-row-${cell.row}`
    || group.id === `cell-${formationMember(cell)}`
    || group.id === `${cell.side}-column-${cell.column}` || group.members.includes(formationMember(cell));
}
export function formationGroupOptions(columns, raw, rows = 3) {
  return [
    { id: 'all', name: 'Entire battlefield' },
    ...Array.from({length: rows}, (_,row) => ({id:`row-${row}`, name:`Both teams · row ${'ABCDEF'[row]}`})),
    ...['player', 'enemy'].flatMap(side => [
      { id: side, name: side === 'player' ? 'Player section' : 'Enemy section' },
      ...Array.from({ length: columns }, (_, column) => ({ id: `${side}-column-${column}`,
        name: `${side === 'player' ? 'Player' : 'Enemy'} column ${column + 1} (${column === 0 ? 'outer' : 'inner'})` })),
      ...Array.from({length: rows}, (_,row) => ({id:`${side}-row-${row}`, name:`${side} · row ${'ABCDEF'[row]}`})),
      ...Array.from({length: rows}, (_,row) => Array.from({length: columns}, (_,column) => ({
        id:`cell-${side}:${row}:${column}`, name:`${side} · position ${'ABCDEF'[row]}${side==='player'?column+1:columns*2-column}`
      }))).flat(),
    ]),
    ...formationGroups(raw).filter(g => g.id.startsWith('custom-')),
  ].map(g => ({ members: [], x: 0, y: 0, scale: 1, ...g, ...formationGroups(raw).find(saved => saved.id === g.id) }));
}
export function applyFormationGroups(cells, raw, width, height) {
  const order = g => g.id === 'all' ? 3 : ['player', 'enemy'].includes(g.id) ? 2 : g.id.includes('-column-') ? 1 : 0;
  // Apply parent translations last, so moving a section keeps column offsets intact.
  for (const group of formationGroups(raw).sort((a, b) => order(a)-order(b))) {
    const members = cells.filter(cell => formationGroupContains(group, cell));
    if (!members.length) continue;
    // Clamp the translation once for the whole group, preserving its spacing.
    const dx = Math.max(-Math.min(...members.map(c => c.x)), Math.min(width - Math.max(...members.map(c => c.x)), width * group.x / 100));
    const dy = Math.max(-Math.min(...members.map(c => c.ground)), Math.min(height - Math.max(...members.map(c => c.ground)), height * group.y / 100));
    for (const cell of members) { cell.x += dx; cell.ground += dy; cell.fitGround += dy;
      cell.characterScale = (cell.characterScale || 1) * (group.scale || 1); }
  }
  return cells;
}

export function positioningConfiguration(presentation, { plan, width, height, snapStep = FORMATION_SNAP_STEP, snapToGrid = true, spawnTest = null } = {}) {
  const values = Object.fromEntries(Object.entries(presentation).filter(([key]) => /^(formation|ground|grid|showFormation|row[A-F]|front|back|(?:player|enemy)(?:Spawn|Sprite|Grid))/.test(key)));
  values.formationGroups = formationGroups(values.formationGroups);
  return { schemaVersion: 1, kind: 'AshenSpire.positioning', units: { offsets: 'percent of battlefield', measurements: 'CSS px', characterScale: 'multiplier' },
    presentation: values, snapping: { enabled: snapToGrid, stepPx: snapStep },
    battlefield: { width, height }, spawnTest,
    anchors: (plan?.cells || []).map(c => ({ cell: c.cell, side: c.side, row: c.row, column: c.column,
      left: c.x, right: width-c.x, top: c.ground, bottom: height-c.ground, characterScale: c.characterScale || 1 })),
    settings: Object.fromEntries(Object.entries(values).map(([key,value]) => [`gameConfig.presentation.${key}`, key==='formationGroups'?JSON.stringify(value):value])),
  };
}
