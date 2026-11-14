// Turns a combat timeline (model/combatTimelinePolicy.js) into start times for one beat. Pure: no DOM, no timers.
// An event starts 'previous' (the previous event's start plus its natural duration, then its offset; only the swing has a
// natural duration, its clip's impact time) or 'with' an earlier event (that start plus the offset). Starts are never
// negative. While the swing's impact is unknown (null) every start that depends on it is null.
export const SEGMENT_IDS = Object.freeze(['result', 'reaction', 'numbers', 'bars']); // repeated for each reaction group
export const SWING_SCALE = Object.freeze({ min: 0.25, max: 4 });

/**
 * computeBeatSchedule(timeline, { impactMs = null, groups = 1 }) returns
 *   starts      { eventId: ms | null } for the first group (events in `skip` are absent),
 *   entries     [{ id, group, at }] resolved events in firing order (time, group, list order),
 *   swingScale  the factor that makes the swing's impact frame land on contact (1 when it already does or cannot).
 * With several reaction groups the result, reaction, numbers and bars repeat per group in the same relative layout; a
 * group starts one segment length plus the result's own spacing after the previous one, and events listed after the
 * segment move out by the groups' total.
 */
export function computeBeatSchedule(fullTimeline, { impactMs = null, groups = 1, skip = null } = {}) {
  // An event that does not apply to the beat (no card played, no stance change) takes no time: it is left out of the chain.
  // The wait that followed a left-out event goes with it: the next event starts where the left-out one would have.
  const timeline = [];
  let zeroNext = false;
  for (const row of fullTimeline) {
    if (skip?.has(row.id)) { zeroNext = true; continue; }
    timeline.push((zeroNext && row.with === 'previous') || skip?.has(row.with) ? { ...row, with: 'previous', offsetMs: 0 } : row);
    zeroNext = false;
  }
  const starts = {};
  let previous = null; // { start, duration }
  for (const row of timeline) {
    const offset = Number(row.offsetMs) || 0;
    let start;
    if (row.with !== 'previous' && Object.hasOwn(starts, row.with)) start = starts[row.with] === null ? null : starts[row.with] + offset;
    else if (!previous) start = offset;
    else start = previous.start === null || previous.duration === null ? null : previous.start + previous.duration + offset;
    if (start !== null) start = Math.max(0, start);
    starts[row.id] = start;
    previous = { start, duration: row.id === 'swing' ? (Number.isFinite(impactMs) ? Math.max(0, impactMs) : null) : 0 };
  }
  const segment = timeline.filter(row => SEGMENT_IDS.includes(row.id));
  const segStarts = segment.map(row => starts[row.id]);
  const resolvedSegment = segStarts.every(value => value !== null);
  const first = resolvedSegment && segStarts.length ? Math.min(...segStarts) : 0;
  const span = resolvedSegment && segStarts.length ? Math.max(...segStarts) - first : 0;
  const spacing = Math.max(0, Number(timeline.find(row => row.id === 'result')?.offsetMs) || 0);
  const stride = span + spacing, count = Math.max(1, Math.floor(groups) || 1);
  const lastSegmentIndex = Math.max(-1, ...timeline.map((row, index) => SEGMENT_IDS.includes(row.id) ? index : -1));
  const entries = [];
  timeline.forEach((row, index) => {
    const start = starts[row.id];
    if (start === null) return;
    if (SEGMENT_IDS.includes(row.id)) for (let group = 0; group < count; group++) entries.push({ id: row.id, group, at: start + group * stride, index });
    else entries.push({ id: row.id, group: 0, at: start + (index > lastSegmentIndex ? (count - 1) * stride : 0), index });
  });
  entries.sort((a, b) => a.at - b.at || a.group - b.group || a.index - b.index);
  return { starts, entries: entries.map(({ id, group, at }) => ({ id, group, at })), swingScale: swingScaleFor(starts, impactMs) };
}

/** swingScaleFor(starts, impactMs): (T - S) / impactMs for contact at T and swing at S; 1 outside [0.25, 4] or when T <= S. */
export function swingScaleFor(starts, impactMs) {
  const swing = starts.swing, contact = starts.contact;
  if (!(Number.isFinite(swing) && Number.isFinite(contact) && Number.isFinite(impactMs) && impactMs > 0 && contact > swing)) return 1;
  const factor = (contact - swing) / impactMs;
  return factor >= SWING_SCALE.min && factor <= SWING_SCALE.max && Math.abs(factor - 1) > 1e-9 ? factor : 1;
}

/** Every offset zero, the order kept: Instant and Reduced motion. */
export const flattenTimeline = timeline => timeline.map(row => ({ ...row, offsetMs: 0 }));
