// src/model/receivedItems.js — what an event just handed the player (playtest 2026-11-17 item 41).
//
// Event rewards use the shop's receive modal: a card may go to the deck or the library, an armament may be equipped,
// and a relic is announced. This reads the before snapshot (runChangeReceipt.js snapshotRunForDiff) against the run
// as it is now and lists the new possessions, in deck, library, armament, relic order. Curse and status cards are not
// rewards: they stay where the event put them and are not offered. Nothing here mutates the run.
import { BINDING_CARD_TYPES } from './consequence.js';

const freeze = Object.freeze;
const flatIds = (value, out = []) => {
  if (Array.isArray(value)) value.forEach((entry) => flatIds(entry, out));
  else if (typeof value === 'string' && value) out.push(value);
  else if (value && typeof value === 'object' && typeof value.id === 'string') out.push(value.id);
  return out;
};
const armamentIds = (run) => {
  const loadout = run?.loadout || {};
  return [...new Set([...flatIds(Object.values(loadout.sets || {})), ...flatIds(loadout.storage || [])])];
};
const nameOf = (row, id) => row?.name || id;

/**
 * ReceivedItems(registries, before, run) → [{ kind: 'card', instanceId, cardId, name, zone } |
 *   { kind: 'armament', id, name } | { kind: 'relic', id, name }].
 * `before` is snapshotRunForDiff(run) taken before the choice committed.
 */
export function ReceivedItems(registries, before, run) {
  const items = [];
  const knownCards = new Set((before?.deck || []).map((card) => card.instanceId));
  for (const [zone, cards] of [['deck', run?.deck || []], ['sideboard', run?.sideboard || []]]) {
    for (const card of cards) {
      if (!card?.instanceId || knownCards.has(card.instanceId)) continue;
      const def = registries.cards?.get?.(card.cardId);
      if (!def || BINDING_CARD_TYPES.includes(def.type)) continue;
      items.push(freeze({ kind: 'card', instanceId: card.instanceId, cardId: card.cardId, name: nameOf(def, card.cardId), zone }));
    }
  }
  const knownArmaments = new Set(before?.armaments || []);
  for (const id of armamentIds(run)) {
    if (knownArmaments.has(id)) continue;
    const def = (registries.equipment?.armaments || []).find((row) => row.id === id)
      || (registries.equipment?.armour || []).find((row) => row.id === id);
    items.push(freeze({ kind: 'armament', id, name: nameOf(def, id) }));
  }
  const knownRelics = new Set(before?.relics || []);
  for (const id of run?.relics || []) {
    if (knownRelics.has(id)) continue;
    items.push(freeze({ kind: 'relic', id, name: nameOf(registries.relics?.get?.(id), id) }));
  }
  return freeze(items);
}
