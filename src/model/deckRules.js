// src/model/deckRules.js — the deck editor's rules, without its screen (SPEC §14.1).
//
// Pure model: settings and a run in, answers and one-step edits out. The
// defaults are content/deckRules.js; a profile's stored choices override them.
//
// OWNED MEANS DECK ∪ SIDEBOARD. A limited card the editor takes out of the deck
// goes to `run.sideboard` with every field it carries and comes back the same
// instance; the editor never mints or destroys one. Basics are unlimited and
// matched by ROLE, not id: an equipped run's Strike is an attack-slot instance
// wearing the weapon's face, so removing one retires its slot (the retirement
// removeDeckCard already uses) and adding one un-retires a slot or grows the
// allocation for stampDeck to stamp — never a bare card outside the plan.

import { deckRules } from '../content/deckRules.js';
import { retiredAttackSlots } from './cardRemoval.js';
import { isItemOwned, stampDeck } from './loadout.js';

const D = deckRules.defaults;

function setting(settings, key) {
  const value = settings && settings[key];
  return value === undefined || value === null ? D[key] : value;
}

function wholeNumber(value, key, min) {
  if (!Number.isInteger(value) || value < min) throw new Error(`${key} must be a whole number of at least ${min} (got ${JSON.stringify(value)})`);
  return value;
}

function readBounds(settings) {
  const min = setting(settings, 'deckMinUnlimited') ? 0 : wholeNumber(setting(settings, 'deckMinSize'), 'deckMinSize', 0);
  const max = setting(settings, 'deckMaxUnlimited') ? Infinity : wholeNumber(setting(settings, 'deckMaxSize'), 'deckMaxSize', 1);
  return { min, max };
}

/**
 * deckSettingsProblems(settings) → [{ keys, message }] for Settings to paint:
 * a maximum below the effective minimum is refused by name (SPEC §14.1).
 */
export function deckSettingsProblems(settings) {
  let bounds;
  try { bounds = readBounds(settings); } catch (error) { return [{ keys: ['deckMinSize', 'deckMaxSize'], message: error.message }]; }
  return bounds.max < bounds.min
    ? [{ keys: ['deckMinSize', 'deckMaxSize'], message: `Maximum deck size (${bounds.max}) is below the minimum (${bounds.min}); the editor cannot confirm any deck until one of them moves.` }]
    : [];
}

/**
 * deckEditBounds(settings) → { min, max, problem }; max is Infinity when
 * unlimited, and `problem` is the Settings refusal when max sits below min.
 */
export function deckEditBounds(settings) {
  const problems = deckSettingsProblems(settings);
  if (problems.length) {
    let min = D.deckMinSize;
    try { ({ min } = readBounds(settings)); } catch { /* fall back to the default */ }
    return { min, max: min, problem: problems[0].message };
  }
  return { ...readBounds(settings), problem: '' };
}

/** deckEditRefusal(count, settings) → '' when the editor may confirm, else one sentence. */
export function deckEditRefusal(count, settings) {
  const { min, max, problem } = deckEditBounds(settings);
  if (problem) return problem;
  const cards = (n) => `${n} card${n === 1 ? '' : 's'}`;
  if (count < min) return `Your deck has ${cards(count)}; it needs at least ${min}.`;
  if (count > max) return `Your deck has ${cards(count)}; it can hold at most ${max}.`;
  return '';
}

export function deckEditingOn(settings) { return !!setting(settings, 'deckEditing'); }

/** 'free' | 'restOnly' — an unknown stored value reads as the default. */
export function deckEditingWhere(settings) {
  const where = setting(settings, 'deckEditingWhere');
  return deckRules.where.includes(where) ? where : D.deckEditingWhere;
}

export function playInDeckOrder(settings) { return !!setting(settings, 'playInDeckOrder'); }

/** True for a card the editor adds without limit: a basic, matched by role. */
export function isUnlimitedBasic(card) {
  if (!card || card.grantedBy || isItemOwned(card)) return false;
  if (card.equipmentRole === 'attack' || card.equipmentRole === 'guard') return true;
  return !card.equipmentRole && deckRules.unlimitedCardIds.includes(card.cardId);
}

/** How many copies of a card id the run owns (deck ∪ sideboard). */
export function ownedCopies(run, cardId) {
  return [...(run.deck || []), ...(run.sideboard || [])].filter((c) => c && c.cardId === cardId).length;
}

function sideboard(run) {
  if (!Array.isArray(run.sideboard)) run.sideboard = [];
  return run.sideboard;
}

function mintId(run) {
  run.editMintCounter = (Number.isInteger(run.editMintCounter) ? run.editMintCounter : 0) + 1;
  return `edit:${run.editMintCounter}`;
}

function slotCount(run) {
  if (Number.isFinite(run.equipmentAttackSlotCount)) return run.equipmentAttackSlotCount;
  // No quota written down (a run the load door has not seen): the highest slot
  // index anywhere, retired ones included, + 1 — never a count that a retired
  // slot would make collide.
  const ids = [
    ...[...(run.deck || []), ...(run.sideboard || [])].map((c) => c && c.equipmentAttackSlotId).filter(Boolean),
    ...(run.removedAttackSlotIds || []),
  ];
  return ids.reduce((top, id) => Math.max(top, Number(String(id).slice(7)) + 1), 0);
}

function restamp(registries, run) {
  if (run.loadout && run.attributes) stampDeck(registries, run);
}

/**
 * moveToSideboard(registries, run, instanceId) → true when the card left the deck.
 * An item-owned card is locked (the Armoury decides it). An attack basic's slot
 * is retired and the instance kept; a plain unlimited basic is deleted.
 */
export function moveToSideboard(registries, run, instanceId) {
  const index = run.deck.findIndex((c) => c && c.instanceId === instanceId);
  const card = run.deck[index];
  if (!card || card.grantedBy || isItemOwned(card)) return false;
  if (card.equipmentAttackSlotId) {
    const count = slotCount(run);
    const retired = retiredAttackSlots(count, run.removedAttackSlotIds || []);
    if (retired.has(card.equipmentAttackSlotId)) return false;
    retired.add(card.equipmentAttackSlotId);
    run.equipmentAttackSlotCount = count;
    run.removedAttackSlotIds = [...retired];
  }
  run.deck.splice(index, 1);
  // A pristine plain basic has nothing to keep; an upgraded or modded one is
  // kept like any owned card and comes back before a fresh one is minted.
  const pristine = !card.upgraded && !(Array.isArray(card.mods) && card.mods.length);
  if (!card.equipmentRole && deckRules.unlimitedCardIds.includes(card.cardId) && pristine) return true;
  sideboard(run).push(card);
  return true;
}

/** moveFromSideboard(registries, run, instanceId) → true when the card returned to the deck. */
export function moveFromSideboard(registries, run, instanceId) {
  const pile = sideboard(run);
  const index = pile.findIndex((c) => c && c.instanceId === instanceId);
  if (index < 0) return false;
  const [card] = pile.splice(index, 1);
  if (card.equipmentAttackSlotId) {
    run.removedAttackSlotIds = (run.removedAttackSlotIds || []).filter((id) => id !== card.equipmentAttackSlotId);
  }
  run.deck.push(card);
  if (card.equipmentRole) restamp(registries, run);
  return true;
}

/**
 * addBasicCard(registries, run, role, { plain }) → the instance added.
 * role 'attack' | 'guard' on an equipped run: a sideboarded one of that role
 * comes back first; otherwise a new one is minted (an attack grows the slot
 * allocation by one) and stampDeck gives it the current face. With `plain`,
 * `role` is a plain unlimited card id (a run with no equipment).
 */
export function addBasicCard(registries, run, role, { plain = false } = {}) {
  if (plain) {
    if (!deckRules.unlimitedCardIds.includes(role)) throw new Error(`'${role}' is not an unlimited card id (${deckRules.unlimitedCardIds.join(', ')})`);
    const kept = sideboard(run).find((c) => c && !c.equipmentRole && !c.grantedBy && c.cardId === role);
    if (kept) {
      moveFromSideboard(registries, run, kept.instanceId);
      return kept;
    }
    const card = { instanceId: mintId(run), cardId: role, upgraded: false };
    run.deck.push(card);
    return card;
  }
  if (role !== 'attack' && role !== 'guard') throw new Error(`addBasicCard: role must be 'attack' or 'guard' (got '${role}')`);
  if (!run.loadout || !run.attributes) throw new Error(`addBasicCard: an ${role} basic takes its face from the run's loadout; a run without one adds plain cards ({ plain: true })`);
  const back = sideboard(run).find((c) => c && c.equipmentRole === role && !c.grantedBy);
  if (back) {
    moveFromSideboard(registries, run, back.instanceId);
    return back;
  }
  let card;
  if (role === 'attack') {
    // A slot retired with no instance kept (the merchant's paid removal) is
    // re-used before the allocation grows, so remove-and-add never inflates it.
    const count = slotCount(run);
    const retired = [...retiredAttackSlots(count, run.removedAttackSlotIds || [])]
      .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)));
    const slotId = retired.length ? retired[0] : `attack:${count}`;
    card = { instanceId: mintId(run), cardId: 'strike', upgraded: false, equipmentRole: 'attack', equipmentAttackSlotId: slotId };
    if (retired.length) run.removedAttackSlotIds = (run.removedAttackSlotIds || []).filter((id) => id !== slotId);
    else run.equipmentAttackSlotCount = count + 1;
  } else {
    card = { instanceId: mintId(run), cardId: 'defend', upgraded: false, equipmentRole: 'guard' };
  }
  run.deck.push(card);
  restamp(registries, run);
  return card;
}

/** The opening draw pile in deck order: Innate cards first, relative order kept. */
export function orderedDrawPile(deck, isInnate) {
  const innate = [];
  const rest = [];
  for (const card of deck) (isInnate(card) ? innate : rest).push(card);
  return [...innate, ...rest];
}

/**
 * The empty-pile return in deck order: by each instance's index in `order`,
 * then cards the deck never held, in the order they were discarded.
 */
export function orderedReturn(discard, order) {
  const at = new Map(order.map((id, i) => [id, i]));
  const known = discard.filter((c) => at.has(c.instanceId)).sort((a, b) => at.get(a.instanceId) - at.get(b.instanceId));
  return [...known, ...discard.filter((c) => !at.has(c.instanceId))];
}
