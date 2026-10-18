// Standalone rear sprite contract: no browser, engine, registry, or gameplay dependencies.
export const STANCES = Object.freeze(['neutral','smash','attack','sweep','counter','defend','evade','spell','preparing']);
export const REACTIONS = Object.freeze(['hurt','defeated']);
const finitePair = v => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);
const unavailable = reason => ({ available: false, reason });
export function selectProposal(catalog, actorId, versionId) {
  const actor = catalog?.actors?.find(a => a.id === actorId);
  if (!actor) return unavailable('unknown-actor');
  // Version selection is explicit; provisional defaults are authoring metadata only.
  const proposal = actor.proposals?.find(p => p.id === versionId);
  if (!proposal) return unavailable('unknown-version');
  if (proposal.status === 'missing' || proposal.perspective !== 'rear') return unavailable('proposal-unavailable');
  return { available: true, actor, proposal };
}
export function sequenceFor(selection, kind, state) {
  if (!selection?.available) return unavailable(selection?.reason || 'no-selection');
  const allowed = kind === 'reactions' ? REACTIONS : ['stances','animations'].includes(kind) ? STANCES : [];
  if (!allowed.includes(state)) return unavailable('unknown-state');
  const frames = selection.proposal[kind]?.[state]?.frames;
  if (!frames?.length) return unavailable('state-unavailable');
  return { available: true, kind, state, frames, durationMs: frames.reduce((n, f) => n + f.durationMs, 0) };
}
export function sampleSequence(sequence, elapsedMs, { loop = false } = {}) {
  if (!sequence?.available) return unavailable(sequence?.reason || 'no-sequence');
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new RangeError('elapsedMs must be finite and nonnegative');
  const duration = sequence.durationMs;
  if (!(duration > 0) || !Number.isFinite(duration)) throw new RangeError('Invalid sequence duration');
  const complete = !loop && elapsedMs >= duration;
  let time = loop ? elapsedMs % duration : Math.min(elapsedMs, duration);
  for (let index = 0; index < sequence.frames.length; index++) {
    const frame = sequence.frames[index];
    if (time < frame.durationMs || index === sequence.frames.length - 1) return { available: true, frame, index, complete };
    time -= frame.durationMs;
  }
}
// Coordinates are top-left image position in the caller's coordinate system.
// Scale acts on the full canvas; use the recorded feet anchor, never opaque bounds.
export function positionFrame(frame, target, { scale = 1, anchor = 'feet', flipX = false } = {}) {
  const xy = frame?.anchors?.[anchor];
  if (!xy) return unavailable('anchor-unavailable');
  if (!finitePair(target) || !finitePair(frame.canvas) || frame.canvas.some(v => v <= 0) || !finitePair(xy) || xy.some(v => v < 0 || v > 1) || !Number.isFinite(scale) || scale <= 0) throw new RangeError('Invalid position, canvas, anchor, or scale');
  const width = frame.canvas[0] * scale, height = frame.canvas[1] * scale;
  return { available: true, x: target[0] - (flipX ? 1 - xy[0] : xy[0]) * width, y: target[1] - xy[1] * height, width, height, flipX };
}
