// src/content/events.js — the Unknown-node events and their tables are authored in
// content/source/{events,eventChoiceIds,eventChoiceHistoryRequirements,
// eventHistoryRequirements,questChains,eventSpeakers}.json (tools/content-build.mjs
// compiles each to src/content/generated/<name>.js); this shim keeps the module path
// and the freeze semantics the rest of the tree imports. Design notes that were
// comments here live in content/source/CONTENT-NOTES.md, under "## Events".
import { events } from './generated/events.js';
import { eventChoiceIds as choiceIds } from './generated/eventChoiceIds.js';
import { eventChoiceHistoryRequirements as choiceHistoryRequirements } from './generated/eventChoiceHistoryRequirements.js';
import { eventHistoryRequirements as historyRequirements } from './generated/eventHistoryRequirements.js';
import { questChains as chains } from './generated/questChains.js';
import { eventSpeakers as speakers } from './generated/eventSpeakers.js';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export { events };

// Stable history ids: labels may change; these ids are durable save facts.
export const eventChoiceIds = Object.freeze(choiceIds);

// One slot per choice. JSON `null` means "no requirement" and is exported as
// `undefined`, as the hand-written table always held it.
export const eventChoiceHistoryRequirements = Object.freeze(Object.fromEntries(
  Object.entries(choiceHistoryRequirements).map(([eventId, slots]) => [
    eventId,
    slots.map((slot) => (slot === null ? undefined : slot)),
  ]),
));

export const eventHistoryRequirements = Object.freeze(historyRequirements);
export const questChains = deepFreeze(chains);
export const eventSpeakers = deepFreeze(speakers);

/** Enrich validated event choices with their durable history contract. */
export function eventChoicesWithHistory(event) {
  const ids = eventChoiceIds[event?.id];
  if (!event || !Array.isArray(event.choices) || !Array.isArray(ids)
    || ids.length !== event.choices.length) return [];
  const requirements = eventChoiceHistoryRequirements[event.id] || [];
  return event.choices.map((choice, index) => ({
    ...choice,
    id: ids[index],
    requiresHistory: requirements[index],
  }));
}
