// src/model/quests.js — deterministic run-history facts for quest/event chains.
//
// This module is intentionally headless and content-agnostic. It records only
// stable ids and derives later availability from those records. Narrative
// content, effects, and UI remain in their existing homes.

export const EVENT_CHOICE_HISTORY_KIND = 'eventChoice';

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,79}$/;

function validId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

function historyArray(subject) {
  if (Array.isArray(subject)) return subject;
  if (subject && Array.isArray(subject.history)) return subject.history;
  return null;
}

function choiceRefProblems(ref, at) {
  const out = [];
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return [`${at}: must be an object`];
  if (!validId(ref.eventId)) out.push(`${at}.eventId: stable id required`);
  if (!validId(ref.choiceId)) out.push(`${at}.choiceId: stable id required`);
  return out;
}

/** Validate only event-choice rows; older run-history row kinds remain valid. */
export function eventChoiceHistoryProblems(subject) {
  const history = historyArray(subject);
  if (!history) return ['history: array required'];
  const out = [];
  history.forEach((row, index) => {
    if (!row || row.kind !== EVENT_CHOICE_HISTORY_KIND) return;
    out.push(...choiceRefProblems(row, `history[${index}]`));
    if (!Number.isInteger(row.actNumber) || row.actNumber < 1) {
      out.push(`history[${index}].actNumber: positive integer required`);
    }
    if (!Number.isInteger(row.floor) || row.floor < 0) {
      out.push(`history[${index}].floor: non-negative integer required`);
    }
    if (row.mapNodeId !== null && row.mapNodeId !== undefined && !validId(row.mapNodeId)) {
      out.push(`history[${index}].mapNodeId: stable id or null required`);
    }
  });
  return out;
}

/**
 * Append one committed event choice to the run's existing history.
 *
 * No wall-clock value is recorded: the receipt must replay byte-for-byte from
 * the same run state and player choice. Repeated events are allowed because a
 * route may legitimately encounter the same event more than once.
 */
export function recordEventChoice(run, { eventId, choiceId } = {}) {
  if (!run || typeof run !== 'object' || !Array.isArray(run.history)) {
    throw new Error('recordEventChoice requires run.history');
  }
  const refProblems = choiceRefProblems({ eventId, choiceId }, 'choice');
  if (refProblems.length) throw new Error(refProblems.join('; '));
  if (!Number.isInteger(run.actNumber) || run.actNumber < 1) {
    throw new Error('recordEventChoice requires a positive integer run.actNumber');
  }
  if (!Number.isInteger(run.floor) || run.floor < 0) {
    throw new Error('recordEventChoice requires a non-negative integer run.floor');
  }
  if (run.mapNodeId !== null && run.mapNodeId !== undefined && !validId(run.mapNodeId)) {
    throw new Error('recordEventChoice requires a stable run.mapNodeId or null');
  }
  const record = {
    kind: EVENT_CHOICE_HISTORY_KIND,
    eventId,
    choiceId,
    actNumber: run.actNumber,
    floor: run.floor,
    mapNodeId: run.mapNodeId ?? null,
  };
  run.history.push(record);
  return record;
}

/** Exact fact lookup. Malformed event-choice history fails closed. */
export function hasEventChoice(subject, ref) {
  const history = historyArray(subject);
  if (!history || choiceRefProblems(ref, 'choice').length || eventChoiceHistoryProblems(history).length) return false;
  return history.some((row) => row?.kind === EVENT_CHOICE_HISTORY_KIND
    && row.eventId === ref.eventId
    && row.choiceId === ref.choiceId);
}

/**
 * Requirement shape:
 *   { all?: [{eventId, choiceId}], any?: [...], none?: [...] }
 *
 * Omitted groups are neutral. An explicitly empty `any` is invalid because it
 * can never describe a satisfiable authored branch.
 */
export function eventChoiceRequirementProblems(requirement) {
  if (requirement === undefined || requirement === null) return [];
  if (typeof requirement !== 'object' || Array.isArray(requirement)) {
    return ['requirement: object required'];
  }
  const allowed = new Set(['all', 'any', 'none']);
  const out = [];
  for (const key of Object.keys(requirement)) {
    if (!allowed.has(key)) out.push(`requirement.${key}: unknown group`);
  }
  for (const group of allowed) {
    if (!(group in requirement)) continue;
    const refs = requirement[group];
    if (!Array.isArray(refs)) {
      out.push(`requirement.${group}: array required`);
      continue;
    }
    if (group === 'any' && refs.length === 0) out.push('requirement.any: at least one choice required');
    refs.forEach((ref, index) => out.push(...choiceRefProblems(ref, `requirement.${group}[${index}]`)));
  }
  return out;
}

/** Derive later-step availability from exact earlier-choice facts. */
export function eventChoiceRequirementMet(requirement, subject) {
  if (eventChoiceRequirementProblems(requirement).length) return false;
  const history = historyArray(subject);
  if (!history || eventChoiceHistoryProblems(history).length) return false;
  const groups = requirement || {};
  const matches = (ref) => hasEventChoice(history, ref);
  if ((groups.all || []).some((ref) => !matches(ref))) return false;
  if (groups.any && !groups.any.some(matches)) return false;
  if ((groups.none || []).some(matches)) return false;
  return true;
}

/** Filter authored steps without mutating or reordering them. */
export function availableQuestSteps(steps, subject) {
  if (!Array.isArray(steps)) throw new Error('availableQuestSteps requires an array');
  return steps.filter((step) => step && typeof step === 'object'
    && validId(step.id)
    && eventChoiceRequirementMet(step.requiresHistory, subject));
}
