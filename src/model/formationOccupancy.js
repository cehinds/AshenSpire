import { FORMATION_ROWS, formationDimensions, isFormationCell } from './formationLayout.js';

// Physical addresses are independent of the renderer's four visual bands.
export function formationPolicyFor(subject) {
  const profile = subject?.gameProfile || subject?.registries?.gameProfile;
  const module = profile?.modules?.formation;
  return module ? structuredClone(module) : null;
}
function participants(combat) {
  const friends = combat.players instanceof Map
    ? [...combat.players].map(([id, seat]) => ({ id, entity: seat.entity, side: 'player' }))
    : combat.player ? [{ id: combat.player.id, entity: combat.player, side: 'player' }] : [];
  return [...friends, ...(combat.enemies || []).map(entity => ({ id: entity.id, entity, side: 'enemy' }))];
}
export function formationOccupancy(combat) {
  return participants(combat).filter(row => row.entity.formationCell).map(({ id, entity, side }) => ({ id, cell: entity.formationCell, side }));
}
export function initializeFormationOccupancy(combat) {
  const policy = combat.formationPolicy || formationPolicyFor(combat);
  if (!policy) return; // Older/headless fights keep their original positioning contract.
  combat.formationPolicy = policy;
  const actors = participants(combat);
  const friends = actors.filter(row => row.side === 'player');
  const enemies = actors.filter(row => row.side === 'enemy');
  const savedLanes = actors.reduce((n, row) => Math.max(n, FORMATION_ROWS.indexOf(row.entity.formationCell?.[0]) + 1), 0);
  const dimensions = formationDimensions({ perspectiveGrid: true, formationPolicy: policy }, enemies.length, Math.max(friends.length, savedLanes));
  const occupied = new Set();
  // Reserve every valid saved position before allocating newly joined actors.
  for (const row of actors) {
    const cell = row.entity.formationCell;
    if (!cell) continue;
    const valid = isFormationCell(cell, dimensions, row.side) || (row.side === 'player' && isFormationCell(cell, { columns: 3, rows: dimensions.rows }, 'player'));
    if (!valid || occupied.has(`${row.side}:${cell}`)) throw new Error('Invalid or occupied saved formation cell');
    occupied.add(`${row.side}:${cell}`);
  }
  for (const { entity, side } of actors) {
    if (entity.formationCell) continue;
    const columns = side === 'enemy' ? [4, 3, ...(dimensions.extraCells?.length ? [5] : [])] : [1];
    const lanes = Array.from({ length: dimensions.rows }, (_, i) => side === 'player' ? dimensions.rows - i - 1 : i);
    const available = columns.flatMap(column => lanes.map(lane => `${FORMATION_ROWS[lane]}${column}`));
    const cell = available.find(cell => !occupied.has(`${side}:${cell}`));
    if (!cell) throw new Error('Formation capacity exceeded');
    entity.formationCell = cell;
    occupied.add(`${side}:${cell}`);
  }
}
export function formationOccupancyProblems(combat) {
  if (!combat.formationPolicy) return [];
  const expected = formationPolicyFor(combat);
  if (!expected || JSON.stringify(expected) !== JSON.stringify(combat.formationPolicy)) return ['formationPolicy does not match the saved game profile'];
  if (participants(combat).some(row => !row.entity.formationCell)) return ['Missing saved formation cell'];
  try { initializeFormationOccupancy(structuredClone({ formationPolicy: combat.formationPolicy, player: combat.player, players: combat.players, enemies: combat.enemies })); }
  catch (error) { return [error.message]; }
  return [];
}
