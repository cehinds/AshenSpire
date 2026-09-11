// Presentation only: never changes combat order, range, or target legality.
export const COMBAT_LAYOUT = Object.freeze({ hud: 10, field: 45, hand: 30, controls: 15,
  friendly: .3, flex: .1, enemy: .6, rearScale: .8, rearClearance: 50 });

// THE FIGURE CEILING — the tallest a standard-stature figure may stand, in
// stage px. It was the constant 150, tuned on a phone, and on a 1920-wide
// desktop it left the fighters at phone size inside a field three times
// taller than they were (owner, 2026-09-11: "characters ... are way too
// small"). It now follows the stage: half the field's height, capped by the
// width so a tall narrow phone keeps its old 150 and never grows past what the
// row can hold. Every cap below that was tuned against 150 — the minimum cell,
// the cluster spacing, the name width — scales with it, so bigger figures get
// proportionally bigger cells rather than overlapping in the old ones.
export const FIGURE_REFERENCE = 150;
export function figureCeiling({ width, height }) {
  return Math.max(FIGURE_REFERENCE, Math.min(height * .52, width * .16));
}

export function combatFormation({ width, height, friends, enemies, footerClearance }) {
  const k = figureCeiling({ width, height }) / FIGURE_REFERENCE;
  const minimum = Math.max(72, Math.min(130, height * .38));
  const friendlyNeed = Math.max(0, friends.length * minimum - width * COMBAT_LAYOUT.friendly);
  const enemyNeed = Math.max(0, enemies.length * minimum - width * COMBAT_LAYOUT.enemy);
  const demand = friendlyNeed + enemyNeed;
  const friendlyFlex = demand ? COMBAT_LAYOUT.flex * friendlyNeed / demand : 0;
  const enemyFlex = demand ? COMBAT_LAYOUT.flex * enemyNeed / demand : 0;
  const friendlyWidth = width * (COMBAT_LAYOUT.friendly + friendlyFlex);
  const enemyWidth = width * (COMBAT_LAYOUT.enemy + enemyFlex);
  const ground = height - (footerClearance ?? Math.min(102, height * .44));
  const group = (ids, left, span, right) => {
    const columns = Math.max(1, Math.ceil(ids.length / 2), Math.min(ids.length, Math.floor(span / minimum)));
    const cell = span / columns;
    const rows = Math.ceil(ids.length / columns);
    // IDs retain their encounter order, including defeated actors.
    return ids.map((id, index) => {
      const row = Math.floor(index / columns), column = index % columns;
      const count = Math.min(columns, ids.length - row * columns);
      const used = Math.min(span, count * Math.min(180 * k, cell));
      const start = row || !right ? left + (span - used) / 2 : left + span - used;
      return { id, row, x: start + (column + .5) * used / count,
        ground: ground - row * Math.min(COMBAT_LAYOUT.rearClearance, Math.max(0, ground - height * .45) / Math.max(1, rows - 1)),
        width: Math.min(124 * k, cell - 6), artWidth: cell * 1.12,
        depth: row ? COMBAT_LAYOUT.rearScale : 1 };
    });
  };
  return { ground, friendlyWidth, enemyWidth,
    slots: [...group(friends, 0, friendlyWidth, false), ...group(enemies, width - enemyWidth, enemyWidth, true)] };
}
