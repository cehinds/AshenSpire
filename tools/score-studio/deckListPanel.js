// Compact deck membership rows for the dockable customization pane.
import { createCustomDeck } from './customDecks.js';
import { addSelectedCardsToDeck, removeSelectedCardsFromDeck, selectedCards } from './cardSelection.js';
import { deckCatalogOptions, resolveStudioDeck } from './deckCatalog.js';

const label = text => String(text || 'other').replace(/[_-]/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
const unique = ids => [...new Set(ids || [])];
export const isSubclassTemplate = deck => !!deck?.id?.startsWith('subclass-list.');

/** Membership and search are independent of the gallery's current filter. */
export function groupedDeckCards(state, deckId, query = '') {
  const deck = resolveStudioDeck(state, deckId);
  if (!deck) return { deck: null, total: 0, shown: 0, groups: [], missingIds: [] };
  const byId = new Map((state.cards || []).map(card => [card.id, card]));
  const ids = unique(deck.cardIds), search = String(query).trim().toLowerCase();
  const groups = new Map(), missingIds = [];
  for (const id of ids) {
    const card = byId.get(id);
    if (!card) { missingIds.push(id); continue; }
    const classId = card.class || 'colorless', type = card.type || 'card', key = `${classId}:${type}`;
    if (!groups.has(key)) groups.set(key, { key, classId, type, cards: [], total: 0 });
    const group = groups.get(key); group.total++;
    if (!search || `${card.name} ${card.id} ${classId} ${type} ${card.rarity || ''}`.toLowerCase().includes(search)) group.cards.push(card);
  }
  const visible = [...groups.values()].filter(group => group.cards.length).sort((a, b) => a.classId.localeCompare(b.classId) || a.type.localeCompare(b.type));
  for (const group of visible) group.cards.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return { deck, total: ids.length, shown: visible.reduce((sum, group) => sum + group.cards.length, 0), groups: visible, missingIds };
}

/** A subclass template is copied to a regular deck before membership can change. */
export function createDeckFromSelection(state, name, ids) {
  const cardIds = selectedCards(state.cards, ids).map(card => card.id);
  const deck = createCustomDeck({ name: String(name || '').trim() || 'New deck', cardIds }, new Set((state.customDecks || []).map(row => row.id)));
  return { deck, customDecks: [...(state.customDecks || []), deck] };
}

export function groupedDeckItems(state, deckId, query = '') {
  const deck = resolveStudioDeck(state, deckId);
  if (!deck) return { deck: null, total: 0, shown: 0, groups: [], missingKeys: [] };
  const byKey = new Map((state.items || []).map(item => [item.key, item]));
  const keys = unique(deck.itemKeys), search = String(query).trim().toLowerCase();
  const groups = new Map(), missingKeys = [];
  for (const key of keys) {
    const item = byKey.get(key);
    if (!item) { missingKeys.push(key); continue; }
    const kind = item.kind || 'item';
    if (!groups.has(kind)) groups.set(kind, { key: kind, kind, items: [], total: 0 });
    const group = groups.get(kind); group.total++;
    if (!search || `${item.name} ${item.key} ${kind} ${item.rarity || ''}`.toLowerCase().includes(search)) group.items.push(item);
  }
  const visible = [...groups.values()].filter(group => group.items.length).sort((a, b) => a.kind.localeCompare(b.kind));
  for (const group of visible) group.items.sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
  return { deck, total: keys.length, shown: visible.reduce((sum, group) => sum + group.items.length, 0), groups: visible, missingKeys };
}

export function addSelectedItemsToDeck(decks, deckId, keys) {
  if (!(decks || []).some(deck => deck.id === deckId)) throw new Error('Choose a deck first.');
  if (deckId.startsWith('subclass-list.')) throw new Error('Subclass lists are templates. Copy the template to a custom deck first.');
  return decks.map(deck => deck.id === deckId ? { ...deck, itemKeys: unique([...(deck.itemKeys || []), ...keys]) } : deck);
}

export function removeSelectedItemsFromDeck(decks, deckId, keys) {
  if (!(decks || []).some(deck => deck.id === deckId)) throw new Error('Choose a deck first.');
  if (deckId.startsWith('subclass-list.')) throw new Error('Choose a custom deck rather than a subclass template.');
  const wanted = new Set(keys || []);
  return decks.map(deck => deck.id === deckId ? { ...deck, itemKeys: (deck.itemKeys || []).filter(key => !wanted.has(key)) } : deck);
}

export function createDeckFromItems(state, name, keys) {
  const available = new Set((state.items || []).map(item => item.key));
  const deck = createCustomDeck({ name: String(name || '').trim() || 'New deck', itemKeys: unique(keys).filter(key => available.has(key)) }, new Set((state.customDecks || []).map(row => row.id)));
  return { deck, customDecks: [...(state.customDecks || []), deck] };
}

export function copyDeckList(state, deckId, name) {
  const source = resolveStudioDeck(state, deckId);
  if (!source) throw new Error('Choose a deck to copy.');
  const deck = createCustomDeck({ name: String(name || '').trim() || `${source.name} deck`, cardIds: source.cardIds || [], itemKeys: source.itemKeys || [], assignedClassId: source.assignedClassId || null }, new Set((state.customDecks || []).map(row => row.id)));
  return { deck, customDecks: [...(state.customDecks || []), deck] };
}

export function initDeckListPanel(ctx) {
  const { state } = ctx;
  const document = ctx.document || globalThis.document;
  const element = document.createElement('section'); element.className = 'deck-list-panel';
  element.setAttribute('aria-label', 'Deck lists');
  element.innerHTML = `<div class="deck-list-heading"><h3>Deck lists</h3><button type="button" class="s-btn s-btn-sm" data-deck-manage>Manage decks…</button></div>
    <label class="deck-list-field">Deck <select data-deck-select aria-label="Deck list"></select></label>
    <div class="deck-list-create"><label class="deck-list-field">New deck name <input data-deck-name placeholder="New deck name" maxlength="80" /></label><button type="button" class="s-btn" data-deck-create>Create deck</button></div>
    <div class="deck-list-actions"><button type="button" class="s-btn" data-deck-add>Add selected cards</button><button type="button" class="s-btn" data-deck-remove-selected>Remove selected cards</button><button type="button" class="s-btn" data-deck-copy>Copy template to a deck</button><button type="button" class="s-btn s-btn-sm" data-deck-select-shown>Select shown cards</button></div>
    <p class="studio-muted deck-list-note" data-deck-note></p>
    <label class="deck-list-field">Find in this deck <input type="search" data-deck-search placeholder="Name, class, type, rarity…" /></label>
    <output class="deck-list-count" data-deck-count aria-live="polite"></output><div class="deck-list-groups" data-deck-groups></div>`;
  const el = selector => element.querySelector(selector);
  const select = el('[data-deck-select]'), search = el('[data-deck-search]'), groups = el('[data-deck-groups]');
  let activeDeckId = null, previousContext = null;
  const context = () => ctx.getContext?.() === 'items' ? 'items' : 'cards';
  const selectionIds = () => {
    if (context() !== 'items') return selectedCards(state.cards, ctx.selectionIds?.() || ctx.getSelectedCardIds?.() || []).map(card => card.id);
    const available = new Set((state.items || []).map(item => item.key));
    return unique(ctx.selectedItemKeys?.()).filter(key => available.has(key));
  };
  function changed() { ctx.saveDraft?.({ autoName: false }); ctx.syncAllViews?.(); refresh(); }
  function commitCreated(result) {
    ctx.pushHistory(); state.customDecks = result.customDecks; activeDeckId = result.deck.id;
    el('[data-deck-name]').value = ''; changed(); ctx.toast?.(`Created ${result.deck.name} with ${result.deck.cardIds.length} card(s) and ${result.deck.itemKeys.length} item(s).`);
  }
  function create(name, ids) { commitCreated(context() === 'items' ? createDeckFromItems(state, name, ids) : createDeckFromSelection(state, name, ids)); }
  function renderRow(card, deck, readonly, mode) {
    const isItem = mode === 'items', id = isItem ? card.key : card.id;
    const row = document.createElement('div'); row.className = 'deck-list-row';
    if (isItem) row.dataset.deckItemKey = id; else row.dataset.deckCardId = id;
    const main = document.createElement('button'); main.type = 'button'; main.className = 'deck-list-card-main';
    const name = document.createElement('span'); name.className = 'deck-list-card-name'; name.textContent = card.name;
    const details = document.createElement('span'); details.className = 'deck-list-card-details';
    details.textContent = isItem ? `${label(card.kind)} · ${label(card.rarity || 'common')}` : `${card.staminaCost ?? card.cost ?? 0} SP · ${card.manaCost ?? 0} MP · ${label(card.rarity || 'common')}`;
    main.append(name, details); main.title = `Inspect ${card.name}`;
    if (id === (isItem ? state.selectedItemKey : state.selectedCardId)) { row.classList.add('is-current'); main.setAttribute('aria-current', 'true'); }
    // A row opens the properties it promises, not just a selection.
    main.addEventListener('click', () => { if (isItem) ctx.selectItem?.(id); else ctx.selectCard?.(id); ctx.onRowSelect?.(id, isItem); refresh(); }); row.append(main);
    if (!readonly) {
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 's-btn s-btn-sm deck-list-remove';
      remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${card.name} from ${deck.name}`);
      remove.addEventListener('click', () => {
        try { const decks = isItem ? removeSelectedItemsFromDeck(state.customDecks, deck.id, [id]) : removeSelectedCardsFromDeck(state.customDecks, deck.id, [id]); ctx.pushHistory(); state.customDecks = decks; changed(); ctx.toast?.(`Removed ${card.name} from ${deck.name}.`); }
        catch (error) { ctx.toast?.(error.message); }
      }); row.append(remove);
    }
    return row;
  }
  function refresh() {
    const mode = context(), isItem = mode === 'items', noun = isItem ? 'item' : 'card';
    if (mode !== previousContext) { search.value = ''; previousContext = mode; }
    const options = deckCatalogOptions(state);
    if (!resolveStudioDeck(state, activeDeckId)) activeDeckId = options.find(row => row.kind === 'custom')?.value || 'class:colorless';
    select.replaceChildren();
    const optgroups = new Map();
    for (const row of options) {
      const option = document.createElement('option'); option.value = row.value; option.textContent = `${row.label} (${isItem ? row.itemCount : row.cardCount} ${noun}s)`;
      if (!row.group) select.append(option);
      else {
        if (!optgroups.has(row.group)) { const group = document.createElement('optgroup'); group.label = row.group; optgroups.set(row.group, group); select.append(group); }
        optgroups.get(row.group).append(option);
      }
    }
    select.value = activeDeckId || '';
    const view = isItem ? groupedDeckItems(state, activeDeckId, search.value) : groupedDeckCards(state, activeDeckId, search.value), readonly = !!view.deck?.readOnly, selected = selectionIds();
    const missing = isItem ? view.missingKeys : view.missingIds;
    el('[data-deck-count]').textContent = view.deck ? `${view.total} ${noun}${view.total === 1 ? '' : 's'}${search.value ? ` · ${view.shown} shown` : ''}${missing.length ? ` · ${missing.length} unavailable` : ''}` : 'Create a deck or open a subclass template.';
    el('[data-deck-note]').textContent = readonly ? 'Class view · read only. Copy it to a custom deck to edit membership; the copy keeps both cards and items.' : `Rows open ${noun} properties. Removing a row changes only this deck; the ${noun} stays in the gallery.`;
    search.placeholder = isItem ? 'Name, kind, rarity…' : 'Name, class, type, rarity…';
    const add = el('[data-deck-add]'); add.disabled = !view.deck || readonly || !selected.length; add.hidden = !selected.length; add.textContent = selected.length ? `Add ${selected.length} selected ${noun}(s)` : `Add selected ${noun}s`;
    const removeSelected = el('[data-deck-remove-selected]'); removeSelected.disabled = !view.deck || readonly || !selected.length; removeSelected.hidden = !selected.length; removeSelected.textContent = `Remove selected ${noun}s`;
    el('[data-deck-copy]').hidden = !readonly;
    el('[data-deck-copy]').textContent = 'Copy to custom deck';
    el('[data-deck-select-shown]').disabled = !view.shown || !(ctx.selectCards || ctx.setSelectedCardIds);
    el('[data-deck-select-shown]').hidden = isItem;
    el('[data-deck-create]').textContent = selected.length ? (isItem ? 'Create with item' : 'Create with selection') : 'Create deck';
    groups.replaceChildren();
    for (const group of view.groups) {
      const section = document.createElement('section'); section.className = 'deck-list-group';
      const members = isItem ? group.items : group.cards;
      const heading = document.createElement('h4'); heading.textContent = `${isItem ? label(group.kind) : `${label(group.classId)} · ${label(group.type)}`} (${members.length}${members.length !== group.total ? `/${group.total}` : ''})`; section.append(heading);
      for (const card of members) section.append(renderRow(card, view.deck, readonly, mode)); groups.append(section);
    }
    if (!view.groups.length) { const empty = document.createElement('p'); empty.className = 'studio-muted'; empty.textContent = !view.deck ? `Select gallery ${noun}s and create a deck here.` : view.total ? `No matching ${noun}s in this deck.` : `This deck has no ${noun}s. Select gallery ${noun}s, then Add selected ${noun}s.`; groups.append(empty); }
    if (missing.length) {
      const note = document.createElement('p'); note.className = 'studio-muted'; note.textContent = `Unavailable ${isItem ? 'item keys' : 'card IDs'}: ${missing.join(', ')}`; groups.append(note);
    }
  }
  select.addEventListener('change', () => { activeDeckId = select.value; search.value = ''; refresh(); });
  search.addEventListener('input', refresh);
  el('[data-deck-create]').addEventListener('click', () => { try { create(el('[data-deck-name]').value, selectionIds()); } catch (error) { ctx.toast?.(error.message); } });
  el('[data-deck-copy]').addEventListener('click', () => { try { commitCreated(copyDeckList(state, activeDeckId, el('[data-deck-name]').value)); } catch (error) { ctx.toast?.(error.message); } });
  el('[data-deck-add]').addEventListener('click', () => {
    try { const ids = selectionIds(); if (!ids.length) return; const isItem = context() === 'items'; const decks = isItem ? addSelectedItemsToDeck(state.customDecks, activeDeckId, ids) : addSelectedCardsToDeck(state.customDecks, activeDeckId, ids); ctx.pushHistory(); state.customDecks = decks; changed(); ctx.toast?.(`Added ${ids.length} selected ${isItem ? 'item' : 'card'}(s) to the deck.`); }
    catch (error) { ctx.toast?.(error.message); }
  });
  el('[data-deck-remove-selected]').addEventListener('click', () => {
    try { const ids = selectionIds(); if (!ids.length) return; const isItem = context() === 'items'; const decks = isItem ? removeSelectedItemsFromDeck(state.customDecks, activeDeckId, ids) : removeSelectedCardsFromDeck(state.customDecks, activeDeckId, ids); ctx.pushHistory(); state.customDecks = decks; changed(); ctx.toast?.(`Removed selected ${isItem ? 'items' : 'cards'} from this deck.`); }
    catch (error) { ctx.toast?.(error.message); }
  });
  el('[data-deck-select-shown]').addEventListener('click', () => {
    const ids = groupedDeckCards(state, activeDeckId, search.value).groups.flatMap(group => group.cards.map(card => card.id));
    (ctx.selectCards || ctx.setSelectedCardIds)?.(ids, { replace: true }); refresh();
  });
  el('[data-deck-manage]').addEventListener('click', () => (ctx.openDeckManager || ctx.openDecksModal)?.());
  refresh();
  return { element, refresh, open: deckId => { if (deckId) activeDeckId = deckId; refresh(); ctx.onOpen?.(); return element; } };
}

export const initDeckListsPanel = initDeckListPanel;
