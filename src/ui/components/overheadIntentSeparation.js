// Two actors' overhead intents can stand on the same spot when the formation is
// squeezed (a short landscape phone puts a back-row enemy's head behind the
// player's). Each rack is placed over its own figure, so nothing in the rack
// knows about its neighbour. This is the neighbour rule: when two painted intents
// overlap, one slides sideways, by the smaller distance that clears the other and
// stays inside the field. The player's glyph moves in preference to an enemy's
// intent, which carries the number the player is deciding on.
//
// Pure: boxes in, horizontal offsets out (same unit as the boxes). `items` are
// { id, left, right, top, bottom, movable } in the field's coordinates; `bounds`
// is { left, right }. Returns a Map id -> dx (0 for those that stay).
export function separateOverheadIntents(items, bounds, gap = 4) {
  const shifts = new Map(items.map(item => [item.id, 0]));
  const box = item => ({ left: item.left + shifts.get(item.id), right: item.right + shifts.get(item.id), top: item.top, bottom: item.bottom });
  const hits = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const clashes = (item, at) => items.some(other => other !== item && hits({ ...box(item), left: item.left + at, right: item.right + at }, box(other)));
  // The player's glyph first, then by id: the same board always packs the same way.
  const order = [...items].sort((a, b) => Number(!!b.movable) - Number(!!a.movable) || String(a.id).localeCompare(String(b.id)));
  for (const item of order) {
    if (!clashes(item, 0)) continue;
    const width = item.right - item.left;
    const candidates = items.filter(other => other !== item).flatMap(other => {
      const o = box(other);
      return [o.left - gap - item.right, o.right + gap - item.left];
    }).filter(dx => item.left + dx >= bounds.left && item.left + dx + width <= bounds.right && !clashes(item, dx))
      .sort((a, b) => Math.abs(a) - Math.abs(b));
    if (candidates.length) shifts.set(item.id, candidates[0]);
  }
  return shifts;
}
