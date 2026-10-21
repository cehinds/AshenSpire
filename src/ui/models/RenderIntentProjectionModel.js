// One synchronous board render asks for each enemy's live intent in several
// places (overhead, inspector context and target HUD). Reuse that pure result
// only inside this call, never across paints or combat mutations.
export function createRenderIntentProjection({ combat, project }) {
  const frames = new Set();
  let current = null, mutating = 0, revision = 0;
  const invalidate = () => { revision++; for (const frame of frames) frame.clear(); };
  return Object.freeze({
    project(target, enemyId) {
      if (target !== combat || !current || mutating) return project(target, enemyId);
      if (current.has(enemyId)) return current.get(enemyId);
      const frame = current, before = revision;
      const shown = project(target, enemyId); // A throwing projection is not kept.
      if (current === frame && revision === before) frame.set(enemyId, shown);
      return shown;
    },
    render(draw) {
      const previous = current, frame = new Map();
      frames.add(frame); current = frame;
      try { return draw(); }
      finally { frame.clear(); frames.delete(frame); current = previous; }
    },
    mutate(change) {
      // A nested or refused dispatch can still alter state. Clear suspended
      // outer renders too, and do not memoize reads made during the mutation.
      invalidate(); mutating++;
      try { return change(); }
      finally { mutating--; invalidate(); }
    },
  });
}
