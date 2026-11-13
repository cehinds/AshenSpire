// The combat action timeline as data (owner, 2026-11-13): an ordered list of events, each used once. An event starts
// "after previous" (the previous event's start plus its natural duration, then its offset) or "with" an EARLIER event
// (that event's start plus its offset). Pure and headless: this file validates and edits the list; the scheduler
// (ui/combatTimeline.js) turns it into start times. The defaults are content/config/ui/presentation/actionPacing.json.
import { uiConfig } from '../config/generated/ui.js';
const ACTION_PACING = uiConfig.presentation.actionPacing.motion;
const AUTOMATION_DEFAULTS = uiConfig.presentation.actionPacing.behavior;

export const TIMELINE_EVENT_IDS = Object.freeze(ACTION_PACING.timeline.map(row => row.id));
export const TIMELINE_OFFSET = Object.freeze({
  min: AUTOMATION_DEFAULTS.timelineOffsetMinimumMs, max: AUTOMATION_DEFAULTS.timelineOffsetMaximumMs, step: AUTOMATION_DEFAULTS.timelineOffsetStepMs,
});
const clampOffset = value => Math.min(TIMELINE_OFFSET.max, Math.max(TIMELINE_OFFSET.min, Math.round(value)));
const defaultRow = id => ACTION_PACING.timeline.find(row => row.id === id);

/** defaultTimeline() → a fresh copy of the shipped timeline. */
export function defaultTimeline() { return ACTION_PACING.timeline.map(row => ({ id: row.id, with: row.with, offsetMs: row.offsetMs })); }

/**
 * sanitizeTimeline(raw) → a valid list: every event id exactly once. Unknown and repeated ids are dropped, missing ids are
 * put back from the defaults (after the event that precedes them by default), an offset outside the range is clamped
 * (a non-number takes the default), and a `with` that is not an earlier event becomes 'previous' (which rules out cycles).
 */
export function sanitizeTimeline(raw) {
  const seen = new Set();
  const list = [];
  for (const row of Array.isArray(raw) ? raw : []) {
    if (!row || typeof row !== 'object' || !TIMELINE_EVENT_IDS.includes(row.id) || seen.has(row.id)) continue;
    seen.add(row.id);
    const offset = typeof row.offsetMs === 'number' && Number.isFinite(row.offsetMs) ? clampOffset(row.offsetMs) : defaultRow(row.id).offsetMs;
    list.push({ id: row.id, with: typeof row.with === 'string' ? row.with : 'previous', offsetMs: offset });
  }
  for (const [at, id] of TIMELINE_EVENT_IDS.entries()) {
    if (seen.has(id)) continue;
    const before = TIMELINE_EVENT_IDS.slice(0, at).reverse().find(other => seen.has(other));
    list.splice(before ? list.findIndex(row => row.id === before) + 1 : 0, 0, { ...defaultRow(id) });
    seen.add(id);
  }
  list.forEach((row, index) => {
    if (row.with !== 'previous' && !list.slice(0, index).some(other => other.id === row.with)) row.with = 'previous';
  });
  return list;
}

/** resolveTimelineSetting(raw) → { shared, reaction }: reaction is null (use shared) unless a valid override list is saved. */
export function resolveTimelineSetting(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return { shared: sanitizeTimeline(source.shared), reaction: Array.isArray(source.reaction) ? sanitizeTimeline(source.reaction) : null };
}

/** moveTimelineEvent(list, id, -1 | 1) → the list with that event one place earlier or later, repaired. */
export function moveTimelineEvent(list, id, step) {
  const rows = sanitizeTimeline(list), from = rows.findIndex(row => row.id === id), to = from + step;
  if (from < 0 || to < 0 || to >= rows.length) return rows;
  rows.splice(to, 0, ...rows.splice(from, 1));
  return sanitizeTimeline(rows);
}
/** setTimelineEvent(list, id, { with, offsetMs }) → the list with that event's timing changed, repaired. */
export function setTimelineEvent(list, id, change) {
  return sanitizeTimeline(sanitizeTimeline(list).map(row => row.id === id ? { ...row, ...change } : row));
}
