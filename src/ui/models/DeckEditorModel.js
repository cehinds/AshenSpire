// src/ui/models/DeckEditorModel.js — the deck editor (SPEC §14.1), decided
// without a DOM.
//
// Two halves. `deckEditorModel` is a PROJECTION: a run, the profile settings
// and the view's filters and sort in, one frozen tree out — the live
// "N / min–max" counter and its refusal, the cost curve, the deck rows and the
// collection tiles, each already carrying whether it may be added or removed
// and why not. `openDeckEdit` is the SESSION: it takes the snapshot
// (`beginDeckEdit`) when the editor opens, applies each add, remove and move
// through the one set of rules in model/deckRules.js, and either confirms
// (only inside the bounds) or cancels (`cancelDeckEdit`, which restores both
// piles, the attack-slot allocation and the mint counter exactly).
//
// Nothing here decides a rule. Which card is a basic, which is locked, how many
// copies a card may have and what the bounds are all come from
// model/deckRules.js; this file only says them in the editor's shape.

import {
  addBasicCard, beginDeckEdit, cancelDeckEdit, deckCopyLimit, deckEditBounds, deckEditRefusal,
  deckEditingOn, deckEditingWhere, isEquippedRun, isSetAsideBasic, isUnlimitedBasic, moveFromSideboard, moveToSideboard, playInDeckOrder,
} from '../../model/deckRules.js';
import { isItemOwned } from '../../model/loadout.js';
import { itemRefIdentity } from '../../model/itemUpgrades.js';
import { resolveCard } from '../../model/registries.js';
import { deckRules } from '../../content/deckRules.js';
import { has, t } from '../strings.js';

/** The cost buckets the curve and the cost filter share. */
export const DECK_COST_BUCKETS = Object.freeze(['0', '1', '2', '3', '4', '5+', 'X']);
/** Where a card came from, for the source filter and sort (SPEC §14.1 UX). */
export const DECK_SOURCES = Object.freeze(['basic', 'art', 'technique', 'reward', 'item']);
export const DECK_SORTS = Object.freeze(['cost', 'name', 'type', 'source']);
/** The two panes, in the order LB/RB and `[`/`]` cycle them. */
export const DECK_PANES = Object.freeze(['collection', 'deck']);

// The tag model/cardExtraction.js reads as "this card is a weapon art".
const ART_TAG = 'extractable';
// The tag family that marks a technique (`technique:flourish`, `technique:cleave`…).
const TECHNIQUE_TAG_PREFIX = 'technique:';

/**
 * deckVariantKey(card) → the collection key of a card's variant: its id, its
 * upgrade and its mods. Two copies that differ in any of them are two tiles,
 * and a tile's tap moves a copy of exactly that variant.
 */
export function deckVariantKey(card) {
  const mods = Array.isArray(card.mods) ? card.mods.join(',') : '';
  return `${card.cardId}~${card.upgraded ? 'u' : ''}~${mods}`;
}

function costBucket(cost) {
  if (!Number.isFinite(cost) || cost < 0) return 'X';
  return cost >= 5 ? '5+' : String(cost);
}

function isLocked(card) { return !!(card && (card.grantedBy || isItemOwned(card))); }

function sourceOf(card, def) {
  if (isLocked(card)) return 'item';
  if (isUnlimitedBasic(card)) return 'basic';
  const tags = def.tags || [];
  if (tags.includes(ART_TAG)) return 'art';
  // A technique (a skill-draft card, SPEC §13.4e) carries a `technique:*` tag.
  if (tags.some((tag) => String(tag).startsWith(TECHNIQUE_TAG_PREFIX))) return 'technique';
  return 'reward';
}

function pieceName(registries, grantedBy) {
  // `grantedBy` is a bare armament id (a weapon's package) or a namespaced
  // item ref (`armament/<id>`, `armor/<class>/<id>`, from the item's mounts);
  // itemRefIdentity is the one parser of the second spelling.
  const ref = itemRefIdentity(String(grantedBy || ''));
  const id = ref ? ref.itemId : String(grantedBy || '');
  const eq = registries.equipment || {};
  const pools = ref
    ? (ref.itemKind === 'armor' ? [eq.armour] : [eq.armaments])
    : [eq.armaments, eq.armour];
  for (const pool of pools.filter(Array.isArray)) {
    const piece = pool.find((p) => p && p.id === id && (!ref || !ref.classId || p.classId === ref.classId));
    if (piece && piece.name) return piece.name;
  }
  return t('deckEditor.lock.equipment');
}

function typeLabel(type) {
  const id = `deckEditor.type.${type}`;
  // Every card type has a row (tests/deck-editor.test.mjs holds it); a type
  // added to the content without one reads as the generic word, never an id.
  return has(id) ? t(id) : t('deckEditor.type.other');
}

function describe(registries, card) {
  const def = resolveCard(registries, card);
  return {
    cardId: card.cardId,
    name: def.name,
    cost: def.cost,
    costBucket: costBucket(def.cost),
    type: def.type,
    source: sourceOf(card, def),
    upgraded: !!card.upgraded,
  };
}

/**
 * The view's filter and sort state. Every group is a list of active chip ids;
 * an empty group filters nothing. Groups combine with AND, chips inside a
 * group with OR.
 */
export function deckEditorView(view = {}) {
  const filters = view.filters || {};
  return Object.freeze({
    filters: Object.freeze({
      type: Object.freeze([...(filters.type || [])]),
      cost: Object.freeze([...(filters.cost || [])]),
      source: Object.freeze([...(filters.source || [])]),
      upgraded: !!filters.upgraded,
    }),
    sort: DECK_SORTS.includes(view.sort) ? view.sort : 'cost',
  });
}

function passes(row, filters) {
  if (filters.type.length && !filters.type.includes(row.type)) return false;
  if (filters.cost.length && !filters.cost.includes(row.costBucket)) return false;
  if (filters.source.length && !filters.source.includes(row.source)) return false;
  if (filters.upgraded && !row.upgraded) return false;
  return true;
}

function sorter(sort) {
  const bucket = (row) => DECK_COST_BUCKETS.indexOf(row.costBucket);
  const keys = {
    cost: (a, b) => bucket(a) - bucket(b) || (a.cost - b.cost) || a.name.localeCompare(b.name),
    name: (a, b) => a.name.localeCompare(b.name) || bucket(a) - bucket(b),
    type: (a, b) => String(a.type).localeCompare(String(b.type)) || a.name.localeCompare(b.name),
    source: (a, b) => DECK_SOURCES.indexOf(a.source) - DECK_SOURCES.indexOf(b.source) || a.name.localeCompare(b.name),
  };
  return keys[sort] || keys.cost;
}

/**
 * The collection's basics. One MINT tile per role (equipped) or id (plain):
 * ∞, and its tap brings back a fresh set-aside copy or mints one, never an
 * upgraded one. Then one tile per SET-ASIDE variant (isSetAsideBasic: an
 * upgraded or modded basic kept in the sideboard), whose tap restores exactly
 * that variant, so a kept Strike+ is shown as itself and chosen on purpose.
 */
function basicTiles(registries, run) {
  const deck = run.deck || [];
  const sideboard = run.sideboard || [];
  const fresh = (c) => c && !c.grantedBy && !isSetAsideBasic(c);
  const mints = isEquippedRun(run)
    ? ['attack', 'guard'].map((role) => {
      const ofRole = (c) => c && c.equipmentRole === role && !c.grantedBy;
      const sample = deck.find((c) => ofRole(c) && fresh(c)) || sideboard.find((c) => ofRole(c) && fresh(c))
        || { cardId: role === 'attack' ? deckRules.unlimitedCardIds[0] : deckRules.unlimitedCardIds[1], equipmentRole: role };
      return { key: `basic:${role}`, card: sample, inDeck: deck.filter(ofRole).length, mint: true };
    })
    : deckRules.unlimitedCardIds.map((cardId) => ({
      key: `basic:${cardId}`,
      card: { cardId },
      inDeck: deck.filter((c) => c && !c.equipmentRole && !c.grantedBy && c.cardId === cardId).length,
      mint: true,
    }));
  const kept = new Map();
  for (const card of sideboard) {
    if (!isSetAsideBasic(card)) continue;
    const variant = deckVariantKey(card);
    const entry = kept.get(variant) || { key: `kept:${variant}`, card, count: 0, mint: false };
    entry.count += 1;
    kept.set(variant, entry);
  }
  return [...mints, ...kept.values()];
}

/**
 * deckEditorModel({ registries, run, settings, view }) → the editor's frozen
 * projection:
 *
 *   { counter: { count, min, max, text, outOfBounds, refusal },
 *     done: { disabled, refusal },
 *     curve: [{ bucket, count, share }],
 *     ordered,                        // playInDeckOrder: rows keep run.deck order
 *     deck: [{ instanceId, name, cost, type, source, upgraded, locked, lockText, removable, canUp, canDown }],
 *     collection: [{ key, name, cost, type, source, unlimited, owned, inDeck, countText, addable, refusal }],
 *     filters: { type: [{ id, label, on }], cost: [...], source: [...], upgraded: { label, on } },
 *     sorts: [{ id, label, on }] }
 */
export function deckEditorModel({ registries, run, settings = {}, view = {} }) {
  const state = deckEditorView(view);
  const deck = run.deck || [];
  const sideboard = run.sideboard || [];
  const count = deck.length;
  const bounds = deckEditBounds(settings);
  const refusal = deckEditRefusal(count, settings);
  const maxText = bounds.max === Infinity ? t('deckEditor.unlimited') : String(bounds.max);
  const ordered = playInDeckOrder(settings);

  // The curve counts the whole deck, never the filtered rows: it describes the
  // deck the player would confirm.
  const tally = Object.fromEntries(DECK_COST_BUCKETS.map((b) => [b, 0]));
  const described = deck.map((card) => ({ card, row: describe(registries, card) }));
  for (const { row } of described) tally[row.costBucket] += 1;
  const peak = Math.max(1, ...Object.values(tally));
  const curve = DECK_COST_BUCKETS
    .filter((bucket) => bucket !== 'X' || tally.X > 0)
    .map((bucket) => Object.freeze({ bucket, count: tally[bucket], share: tally[bucket] / peak }));

  let deckRows = described.map(({ card, row }, index) => {
    const locked = isLocked(card);
    const piece = locked ? pieceName(registries, card.grantedBy) : '';
    return {
      ...row,
      instanceId: card.instanceId,
      index,
      locked,
      lockText: locked ? t('deckEditor.locked', { piece }) : '',
      lockSentence: locked ? t('deckEditor.locked.sentence', { piece, name: row.name }) : '',
      removable: !locked,
    };
  }).filter((row) => passes(row, state.filters));
  // SPEC §14.7: unordered, the deck list is ONE ROW PER VARIANT with a ×N
  // count (the key the collection tiles use, plus the owner for a locked
  // card, so two pieces' grants never merge); its － takes the last copy. In
  // Play in deck order each copy is its own row so it can be placed.
  if (!ordered) {
    const groups = new Map();
    for (const row of deckRows) {
      const card = deck[row.index];
      const key = `${deckVariantKey(card)}~${row.locked ? String(card.grantedBy || card.equipmentRole) : ''}~${card.equipmentRole || ''}`;
      const group = groups.get(key);
      if (group) { group.instanceIds.push(row.instanceId); group.instanceId = row.instanceId; group.index = row.index; }
      else groups.set(key, { ...row, groupKey: key, instanceIds: [row.instanceId] });
    }
    deckRows = [...groups.values()].sort(sorter(state.sort));
  } else deckRows = deckRows.map((row) => ({ ...row, groupKey: row.instanceId, instanceIds: [row.instanceId] }));
  deckRows = deckRows.map((row) => Object.freeze({
    ...row,
    instanceIds: Object.freeze(row.instanceIds),
    count: row.instanceIds.length,
    countText: row.instanceIds.length > 1 ? t('deckEditor.count', { count: row.instanceIds.length }) : '',
    canUp: ordered && row.index > 0,
    canDown: ordered && row.index < deck.length - 1,
  }));

  // The collection: the unlimited basics, then every limited card the run
  // owns (deck ∪ sideboard), one tile per card id.
  const tiles = [];
  for (const basic of basicTiles(registries, run)) {
    const row = describe(registries, basic.card);
    tiles.push(basic.mint
      ? { ...row, source: 'basic', key: basic.key, unlimited: true, owned: Infinity, inDeck: basic.inDeck,
        countText: t('deckEditor.tile.basic', { inDeck: basic.inDeck }), addable: true, refusal: '' }
      : { ...row, source: 'basic', key: basic.key, unlimited: false, owned: basic.count, inDeck: 0,
        countText: t(basic.card.upgraded ? 'deckEditor.tile.keptUpgraded' : 'deckEditor.tile.kept', { count: basic.count }), addable: true, refusal: '' });
  }
  // One tile per VARIANT (card id + upgraded + mods), so the copy a tile shows
  // is the copy its tap moves: an upgraded card and a plain one are two tiles,
  // and neither can be stranded behind the other under a copy limit. The copy
  // limit still counts the card id across every variant in the deck.
  const limited = new Map();
  const inDeckById = new Map();
  for (const card of deck) if (card) inDeckById.set(card.cardId, (inDeckById.get(card.cardId) || 0) + 1);
  for (const card of [...deck, ...sideboard]) {
    if (!card || isLocked(card) || isUnlimitedBasic(card)) continue;
    const variant = deckVariantKey(card);
    const entry = limited.get(variant) || { card, owned: 0, inDeck: 0, loose: 0 };
    entry.owned += 1;
    if (deck.includes(card)) entry.inDeck += 1; else entry.loose += 1;
    limited.set(variant, entry);
  }
  for (const [variant, entry] of limited) {
    const row = describe(registries, entry.card);
    const limit = deckCopyLimit(registries, entry.card.cardId, settings, run.class);
    let tileRefusal = '';
    if (!entry.loose) tileRefusal = t('deckEditor.refuse.allInDeck', { name: row.name });
    else if ((inDeckById.get(entry.card.cardId) || 0) >= limit) tileRefusal = t('deckEditor.refuse.copyLimit', { name: row.name, limit });
    tiles.push({
      ...row, key: `card:${variant}`, unlimited: false, owned: entry.owned, inDeck: entry.inDeck,
      countText: t('deckEditor.tile.owned', { owned: entry.owned, inDeck: entry.inDeck }),
      addable: !tileRefusal, refusal: tileRefusal,
    });
  }
  const basics = tiles.filter((tile) => tile.unlimited);
  const rest = tiles.filter((tile) => !tile.unlimited && passes(tile, state.filters)).sort(sorter(state.sort));
  const collection = [...basics.filter((tile) => passes(tile, state.filters)), ...rest].map((tile) => Object.freeze(tile));

  const typesPresent = [...new Set([...described.map(({ row }) => row.type), ...tiles.map((tile) => tile.type)])].sort();
  const chips = (ids, active, label) => Object.freeze(ids.map((id) => Object.freeze({ id, label: label(id), on: active.includes(id) })));
  const bucketsPresent = DECK_COST_BUCKETS.filter((bucket) => bucket !== 'X'
    || described.some(({ row }) => row.costBucket === 'X') || tiles.some((tile) => tile.costBucket === 'X'));

  return Object.freeze({
    counter: Object.freeze({
      count, min: bounds.min, max: bounds.max,
      text: t('deckEditor.counter', { count, min: bounds.min, max: maxText }),
      outOfBounds: !!refusal, refusal,
    }),
    done: Object.freeze({ disabled: !!refusal, refusal }),
    curve: Object.freeze(curve),
    ordered,
    deck: Object.freeze(deckRows),
    collection: Object.freeze(collection),
    filters: Object.freeze({
      type: chips(typesPresent, state.filters.type, typeLabel),
      cost: chips(bucketsPresent, state.filters.cost, (bucket) => t('deckEditor.filter.cost', { cost: bucket })),
      source: chips(DECK_SOURCES, state.filters.source, (source) => t(`deckEditor.source.${source}`)),
      upgraded: Object.freeze({ label: t('deckEditor.filter.upgraded'), on: state.filters.upgraded }),
    }),
    sorts: Object.freeze(DECK_SORTS.map((id) => Object.freeze({ id, label: t(`deckEditor.sort.${id}`), on: state.sort === id }))),
    view: state,
  });
}

/**
 * The filter presets Y (and the keyboard's filter key) cycles: no filter, then
 * each card type present, then each source. One step per press, wrapping.
 */
export function nextFilterPreset(model, view) {
  const presets = [
    { type: [], source: [] },
    ...model.filters.type.map((chip) => ({ type: [chip.id], source: [] })),
    ...DECK_SOURCES.map((source) => ({ type: [], source: [source] })),
  ];
  const state = deckEditorView(view);
  const at = presets.findIndex((p) => p.type.join() === state.filters.type.join() && p.source.join() === state.filters.source.join());
  const next = presets[(at + 1) % presets.length];
  return { ...view, filters: { ...state.filters, type: next.type, source: next.source, cost: [], upgraded: false } };
}

/**
 * openDeckEdit(registries, run, settings) → the editor session. The snapshot
 * is taken here, when the editor opens; every edit writes the run in place
 * through model/deckRules.js; `cancel()` puts back everything an editor
 * session can change, and `confirm()` succeeds only inside the bounds.
 *
 *   add(key)            → { ok, refusal }   key from a collection tile
 *   remove(instanceId)  → { ok, refusal }
 *   move(instanceId, ±1) → { ok }           only under playInDeckOrder
 *   moveTo(instanceId, index) → { ok }
 *   confirm()           → { ok, refusal }
 *   cancel()
 */
export function openDeckEdit(registries, run, settings = {}) {
  const snapshot = beginDeckEdit(run);
  let closed = false;
  const live = () => { if (closed) throw new Error('openDeckEdit: this editor session is already closed'); };
  const nameOf = (card) => resolveCard(registries, card).name;
  return Object.freeze({
    snapshot,
    add(key) {
      live();
      const [kind, id] = String(key || '').split(':');
      if (kind === 'basic') {
        // The mint tile: a fresh copy back, or a new one, never a set-aside
        // (upgraded) copy, which has its own tile.
        const card = addBasicCard(registries, run, id, { plain: !isEquippedRun(run), freshOnly: true });
        return { ok: !!card, refusal: '' };
      }
      if (kind === 'kept') {
        const variant = String(key).slice('kept:'.length);
        const card = (run.sideboard || []).find((c) => isSetAsideBasic(c) && deckVariantKey(c) === variant);
        if (!card) return { ok: false, refusal: '' };
        return { ok: moveFromSideboard(registries, run, card.instanceId, settings), refusal: '' };
      }
      if (kind !== 'card') throw new Error(`openDeckEdit.add: unknown collection key '${key}'`);
      // `card:<variant>` (a tile's key) moves a copy of exactly that variant;
      // a bare `card:<cardId>` takes any loose copy of the card.
      const variant = String(key).slice('card:'.length);
      const matches = variant.includes('~') ? (c) => deckVariantKey(c) === variant : (c) => c.cardId === variant;
      const cardId = variant.split('~')[0];
      const loose = (run.sideboard || []).find((c) => c && matches(c) && !isLocked(c) && !isUnlimitedBasic(c));
      if (!loose) {
        const any = (run.deck || []).find((c) => c && matches(c));
        return { ok: false, refusal: t('deckEditor.refuse.allInDeck', { name: any ? nameOf(any) : cardId }) };
      }
      if (moveFromSideboard(registries, run, loose.instanceId, settings)) return { ok: true, refusal: '' };
      const limit = deckCopyLimit(registries, cardId, settings, run.class);
      return { ok: false, refusal: t('deckEditor.refuse.copyLimit', { name: nameOf(loose), limit }) };
    },
    remove(instanceId) {
      live();
      const card = (run.deck || []).find((c) => c && c.instanceId === instanceId);
      if (!card) return { ok: false, refusal: '' };
      if (isLocked(card)) return { ok: false, refusal: t('deckEditor.locked.sentence', { name: nameOf(card), piece: pieceName(registries, card.grantedBy) }) };
      return { ok: moveToSideboard(registries, run, instanceId), refusal: '' };
    },
    moveTo(instanceId, index) {
      live();
      if (!playInDeckOrder(settings)) return { ok: false };
      const from = run.deck.findIndex((c) => c && c.instanceId === instanceId);
      const to = Math.max(0, Math.min(run.deck.length - 1, index));
      if (from < 0 || from === to) return { ok: false };
      const [card] = run.deck.splice(from, 1);
      run.deck.splice(to, 0, card);
      return { ok: true };
    },
    move(instanceId, delta) {
      const from = run.deck.findIndex((c) => c && c.instanceId === instanceId);
      return this.moveTo(instanceId, from + delta);
    },
    confirm() {
      live();
      const refusal = deckEditRefusal(run.deck.length, settings);
      if (refusal) return { ok: false, refusal };
      closed = true;
      return { ok: true, refusal: '' };
    },
    cancel() {
      live();
      cancelDeckEdit(run, snapshot);
      closed = true;
    },
    get closed() { return closed; },
  });
}


/**
 * deckEditorDoors({ settings, inCombat, services }) → which doors open the
 * editor (SPEC §14.1 Settings): under `free` the map's Quick Access and the
 * Armoury, out of combat only; under `restOnly` only the Rest screen of a
 * place whose tags carry `deckEdit` (`services.deckEdit`); with deck editing
 * off, none.
 */
export function deckEditorDoors({ settings = {}, inCombat = false, services = null } = {}) {
  const editing = deckEditingOn(settings) && !inCombat;
  const where = deckEditingWhere(settings);
  return Object.freeze({
    quickAccess: editing && where === 'free',
    armoury: editing && where === 'free',
    rest: editing && where === 'restOnly' && !!(services && services.deckEdit),
  });
}
