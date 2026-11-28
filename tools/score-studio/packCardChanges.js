// What a Studio Save sends for the game's card file: per edited card, the authored keys it
// changed against the card the game holds, so untouched keys keep their authored form.

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

// The cards the game holds now: as loaded, then as each Save wrote them. Without it a
// revert after a Save matches the stale loaded card and never reaches the game.
class PackCardBaseline
{
  #gameCardOf;
  #savedCards = new Map();
  #savedRemovedIds = new Set();

  constructor(gameCardOf)
  {
    this.#gameCardOf = gameCardOf;
  }

  baselineOf(id)
  {
    if (this.#savedRemovedIds.has(id))
    {
      return null;
    }
    return this.#savedCards.get(id) ?? this.#gameCardOf(id);
  }

  /** The cards a Save looks at: edited ones and any a Save wrote or removed. */
  candidates(cards, isEdited)
  {
    const savedSinceLoad = (id) => this.#savedCards.has(id) || this.#savedRemovedIds.has(id);
    return cards.filter((card) => isEdited(card) || savedSinceLoad(card.id));
  }

  changes(cards, isEdited)
  {
    const candidates = this.candidates(cards, isEdited);
    return StudioCardChanges(candidates, (id) => this.baselineOf(id));
  }

  /** What a Save is about to send; hand it to markSaved once the Save succeeds. */
  snapshot(cards, isEdited, removedIds)
  {
    return {
      cards: structuredClone(this.candidates(cards, isEdited)),
      removedIds: [...removedIds],
    };
  }

  markSaved(snapshot)
  {
    for (const card of snapshot.cards)
    {
      this.#savedCards.set(card.id, card);
      this.#savedRemovedIds.delete(card.id);
    }
    for (const id of snapshot.removedIds)
    {
      this.#savedRemovedIds.add(id);
      this.#savedCards.delete(id);
    }
  }
}

/** gameCardOf(id) gives the card as the game loaded it, or null for a new card. */
export function CreatePackCardBaseline(gameCardOf)
{
  return new PackCardBaseline(gameCardOf);
}
