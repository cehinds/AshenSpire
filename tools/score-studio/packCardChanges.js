// What a Studio Save sends for the game's card file: per edited card, the authored keys it
// changed against the card the game loaded, so untouched keys keep their authored form.

import { StableJson } from './studioSaveFiles.js';
import { cleanSubclassCard } from './subclassCatalog.js';

const idKey = 'id';

function changedKeys(card, baseline)
{
  const keys = new Set([
    ...Object.keys(card),
    ...Object.keys(baseline),
  ]);
  keys.delete(idKey);
  return [...keys].filter((key) => StableJson(card[key]) !== StableJson(baseline[key]));
}

function newCardChange(card)
{
  const {
    id,
    ...set
  } = card;
  return {
    id,
    set,
    unset: [],
  };
}

function editedCardChange(card, baseline)
{
  const set = {};
  const unset = [];
  for (const key of changedKeys(card, baseline))
  {
    if (key in card)
    {
      set[key] = card[key];
    }
    else
    {
      unset.push(key);
    }
  }
  return {
    id: card.id,
    set,
    unset,
  };
}

function isEmptyChange(change)
{
  return !Object.keys(change.set).length && !change.unset.length;
}

/** One card's change: { id, set, unset }, set holding every key when baseline is null. */
export function StudioCardChange(card, baseline)
{
  const cleanCard = cleanSubclassCard(card);
  if (!baseline)
  {
    return newCardChange(cleanCard);
  }
  return editedCardChange(cleanCard, cleanSubclassCard(baseline));
}

// baselineOf(id) gives the card as the game loaded it, normalised as the Studio normalises,
// or null for a card the game does not have yet. Cards with no change are left out.
export function StudioCardChanges(cards, baselineOf)
{
  return cards
    .map((card) => StudioCardChange(card, baselineOf(card.id)))
    .filter((change) => !isEmptyChange(change));
}
