// Gallery selection is independent of the inspector and survives filtering.
import { createCustomDeck } from './customDecks.js';

const unique = ids => [...new Set(ids || [])];
/** Selection mode never leaves an invisible actionable selection behind. */
export function createCardSelectionMode() {
  let enabled = false;
  const selected = new Set();
  return { selected, get enabled() { return enabled; },
    setEnabled(value) { enabled = value === true; if (!enabled) selected.clear(); },
    toggle(id, checked) { if (!enabled) return; if (checked ?? !selected.has(id)) selected.add(id); else selected.delete(id); },
  };
}

export const selectedCards = (cards, ids) => {
  const wanted = new Set(ids || []);
  return (cards || []).filter(card => wanted.has(card.id));
};

export function addSelectedCardsToDeck(decks, deckId, ids) {
  if (!(decks || []).some(deck => deck.id === deckId)) throw new Error('Choose a deck first.');
  if (deckId.startsWith('subclass-list.')) throw new Error('Subclass lists are templates. Create a custom deck from your selection.');
  return decks.map(deck => deck.id === deckId ? { ...deck, cardIds: unique([...(deck.cardIds || []), ...ids]) } : deck);
}

export function removeSelectedCardsFromDeck(decks, deckId, ids) {
  if (!(decks || []).some(deck => deck.id === deckId)) throw new Error('Choose a deck first.');
  if (deckId.startsWith('subclass-list.')) throw new Error('Choose a custom deck rather than a subclass template.');
  const wanted = new Set(ids || []);
  return decks.map(deck => deck.id === deckId ? { ...deck, cardIds: (deck.cardIds || []).filter(id => !wanted.has(id)) } : deck);
}

/** Pattern accepts {name} and {n}; numbering follows gallery order, never hidden filter state. */
export function renameSelectedCards(cards, ids, { prefix = '', suffix = '', pattern = '', start = 1 } = {}) {
  if (!Number.isInteger(Number(start)) || Number(start) < 0) throw new Error('Starting number must be a non-negative integer.');
  const wanted = new Set(ids || []);
  let number = Number(start);
  return (cards || []).map(card => {
    if (!wanted.has(card.id)) return card;
    const stem = pattern ? String(pattern).replaceAll('{name}', () => card.name).replaceAll('{n}', String(number)) : card.name;
    const name = `${prefix}${stem}${suffix}`.trim(); number++;
    if (!name || name.length > 120) throw new Error('Names must contain 1–120 characters.');
    return { ...card, name, _autoName: false, _edited: true };
  });
}

export function isAddedCard(card) {
  // The shipped Core fixtures stay protected even if an earlier operation marked one generated.
  return !!card && !card.id?.startsWith('core.') && !!(card._custom || card._generated || card.id?.startsWith('custom.') || card.id?.startsWith('subclass.'));
}

/** Exact, already-authorized removal plan, including every deck/catalog reference.
 * Ordinary Delete actions must use removeAddedCardsFromState for Core protection. */
export function removeCardsAndReferences(state, ids) {
  const removedIds = selectedCards(state.cards, ids).map(card => card.id);
  const removed = new Set(removedIds);
  if (!removed.size) return { nextState: state, removedIds };
  const cards = state.cards.filter(card => !removed.has(card.id));
  const cleanMetadata = rows => (rows || []).filter(row => !removed.has(row.cardId));
  const customDecks = (state.customDecks || []).map(deck => ({ ...deck,
    cardIds: (deck.cardIds || []).filter(id => !removed.has(id)),
    ...(Array.isArray(deck.subclassMetadata) ? { subclassMetadata: cleanMetadata(deck.subclassMetadata) } : {}),
  })).filter(deck => !deck.id?.startsWith('subclass-list.') || deck.cardIds.length);
  const deckIds = new Set(customDecks.map(deck => deck.id));
  const removedDeckIds = new Set((state.customDecks || []).filter(deck => !deckIds.has(deck.id)).map(deck => deck.id));
  let subclassCatalog = state.subclassCatalog;
  if (subclassCatalog) {
    const lists = (subclassCatalog.lists || []).map(list => ({ ...list, cardIds: list.cardIds.filter(id => !removed.has(id)) })).filter(list => list.cardIds.length);
    subclassCatalog = lists.length ? { ...subclassCatalog, lists,
      ...(Array.isArray(subclassCatalog.cards) ? { cards: subclassCatalog.cards.filter(card => !removed.has(card.id)) } : {}),
      ...(Array.isArray(subclassCatalog.metadata) ? { metadata: cleanMetadata(subclassCatalog.metadata) } : {}),
    } : null;
  }
  const withoutIds = map => Object.fromEntries(Object.entries(map || {}).filter(([id]) => !removed.has(id)));
  const nextState = { ...state, cards, customDecks, subclassCatalog,
    customClasses: (state.customClasses || []).map(row => removedDeckIds.has(row.deckId) ? { ...row, deckId: null } : row),
    selectedCardId: removed.has(state.selectedCardId) ? cards[0]?.id || null : state.selectedCardId,
    ...(state.baselineRanks ? { baselineRanks: withoutIds(state.baselineRanks) } : {}),
    ...(state.scoring?.overrides ? { scoring: { ...state.scoring, overrides: withoutIds(state.scoring.overrides) } } : {}),
    ...(state.sandbox?.customCardId && removed.has(state.sandbox.customCardId) ? { sandbox: { ...state.sandbox, customCardId: null } } : {}),
  };
  return { nextState, removedIds };
}

/** Normal deletion protects authored cards; explicit Advanced trims authorize
 * their exact removedIds separately, then share the same reference cleanup. */
export function removeAddedCardsFromState(state, ids) {
  const chosen = selectedCards(state.cards, ids);
  const protectedIds = chosen.filter(card => !isAddedCard(card)).map(card => card.id);
  return { ...removeCardsAndReferences(state, chosen.filter(isAddedCard).map(card => card.id)), protectedIds };
}

/** ctx callbacks own selected auto-naming and balancing; local edits get one undo point. */
export function initCardSelectionUi(ctx) {
  const { state, pushHistory, saveDraft, syncAllViews, toast, getFilteredCards } = ctx;
  const document = ctx.document || globalThis.document;
  const mode = createCardSelectionMode(), selected = mode.selected;
  const grid = document.getElementById('cards-grid');
  if (!grid) throw new Error('Card selection requires #cards-grid.');
  const toolbar = document.createElement('section');
  toolbar.id = 'card-selection-toolbar'; toolbar.className = 'card-selection-toolbar';
  toolbar.setAttribute('aria-label', 'Select cards and apply bulk actions');
  toolbar.innerHTML = `<div class="filter-row"><label class="card-selection-mode-control"><input type="checkbox" id="card-selection-mode" aria-label="Select" /> <span>Select</span></label>
    <button type="button" class="s-btn s-btn-sm" data-selection-action="visible" data-selection-mode-only>Select visible</button>
    <button type="button" class="s-btn s-btn-sm" data-selection-action="clear" data-selection-mode-only>Clear selection</button>
    <output id="card-selection-count" aria-live="polite" data-selection-mode-only>0 selected</output></div>
    <p id="card-selection-scope" class="studio-muted">Use the Select checkbox on each card. Actions affect all selected cards.</p>
    <div class="filter-row" data-selection-options><label for="card-selection-deck">Deck</label><select id="card-selection-deck" aria-label="Deck for selected cards"></select>
    <button type="button" class="s-btn" data-selection-action="add" data-needs-selection>Add to deck</button>
    <button type="button" class="s-btn" data-selection-action="remove-deck" data-needs-selection>Remove from deck</button>
    <button type="button" class="s-btn" data-selection-action="new-deck">New deck…</button></div>
    <div class="filter-row" data-selection-options><button type="button" class="s-btn" data-selection-action="rename" data-needs-selection>Rename selected…</button>
    <button type="button" class="s-btn" data-selection-action="balance" data-needs-selection>Rebalance power…</button>
    <button type="button" class="s-btn s-btn-warn" data-selection-action="delete" data-needs-selection>Remove added cards…</button></div>`;
  grid.before(toolbar);
  const el = selector => toolbar.querySelector(selector);
  const modeInput = el('#card-selection-mode');
  const countOutput = el('#card-selection-count');
  const countSlot = document.createElement('span'); countSlot.className = 'card-selection-count-slot';
  countSlot.append(countOutput); modeInput.closest('label').append(countSlot);
  const searchRow = document.getElementById('card-search')?.closest('.filter-row');
  if (searchRow) searchRow.prepend(modeInput.closest('label'));
  const deckSelect = el('#card-selection-deck');
  let dialogNumber = 0;
  const selectedIds = () => selectedCards(state.cards, selected).map(card => card.id);
  const scopeText = ids => {
    const visible = new Set((getFilteredCards?.() || state.cards).map(card => card.id));
    const hidden = ids.filter(id => !visible.has(id)).length;
    return `${ids.length} selected card${ids.length === 1 ? '' : 's'}${hidden ? `, including ${hidden} outside the current filter` : ''}.`;
  };
  const changed = () => { saveDraft?.({ autoName: false }); syncAllViews?.(); refresh(); };
  const selectionChanged = () => { refresh(); ctx.onSelectionChange?.(selectedIds()); };
  function refresh() {
    const existing = new Set(state.cards.map(card => card.id));
    for (const id of selected) if (!existing.has(id)) selected.delete(id);
    const ids = selectedIds();
    modeInput.checked = mode.enabled;
    toolbar.hidden = true;
    grid.classList.toggle('is-card-selection-mode', mode.enabled);
    for (const control of toolbar.querySelectorAll('[data-selection-mode-only]')) control.hidden = !mode.enabled;
    countOutput.textContent = String(ids.length);
    countOutput.setAttribute('aria-label', `${ids.length} selected cards`);
    countOutput.title = scopeText(ids);
    countOutput.hidden = !ids.length;
    el('#card-selection-scope').hidden = !ids.length;
    for (const row of toolbar.querySelectorAll('[data-selection-options]')) row.hidden = !ids.length;
    el('#card-selection-scope').textContent = ids.length ? `${scopeText(ids)} Actions affect all of them.` : 'Use the Select checkbox on each card. Actions affect all selected cards.';
    for (const button of toolbar.querySelectorAll('[data-needs-selection]')) button.disabled = !ids.length;
    const removeButton = el('[data-selection-action="delete"]');
    const removable = selectedCards(state.cards, ids).filter(isAddedCard).length;
    removeButton.disabled = !removable;
    removeButton.title = ids.length && !removable ? 'Original authored cards are protected. Select added cards to remove them.' : 'Remove selected added cards from this Studio draft and its decks. Undo restores them.';
    const previousDeck = deckSelect.value;
    deckSelect.replaceChildren();
    for (const deck of (state.customDecks || []).filter(row => !row.id?.startsWith('subclass-list.'))) { const option = document.createElement('option'); option.value = deck.id; option.textContent = deck.name; deckSelect.append(option); }
    if (!deckSelect.options.length) { const option = document.createElement('option'); option.value = ''; option.textContent = 'Create a deck first'; deckSelect.append(option); }
    if ([...deckSelect.options].some(option => option.value === previousDeck)) deckSelect.value = previousDeck;
    el('[data-selection-action="remove-deck"]').disabled = !ids.length || !deckSelect.value;
    for (const box of grid.querySelectorAll('input[data-card-selection]')) {
      box.checked = mode.enabled && selected.has(box.dataset.cardSelection);
      const control = box.closest('.card-select-control');
      control.hidden = !mode.enabled; control.classList.toggle('is-checked', box.checked);
      const tile = box.closest('.studio-card-tile');
      tile?.classList.toggle('is-bulk-selected', box.checked);
    }
  }
  function makeDialog(title, body, buttonText, apply, ids = []) {
    const dialog = document.createElement('dialog'); dialog.className = 'studio-modal card-selection-dialog';
    const titleId = `card-selection-dialog-title-${++dialogNumber}`;
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.innerHTML = `<form><h3 id="${titleId}"></h3><p class="studio-muted" data-dialog-scope></p><div data-dialog-body></div><div class="filter-row"><button type="button" class="s-btn" data-dialog-cancel>Cancel</button><button type="submit" class="s-btn s-btn-primary" data-dialog-apply></button></div></form>`;
    dialog.querySelector('h3').textContent = title;
    dialog.querySelector('[data-dialog-scope]').textContent = ids.length ? scopeText(ids) : '';
    dialog.querySelector('[data-dialog-body]').innerHTML = body;
    dialog.querySelector('[data-dialog-apply]').textContent = buttonText;
    dialog.querySelector('[data-dialog-cancel]').addEventListener('click', () => dialog.close());
    dialog.querySelector('form').addEventListener('submit', event => { event.preventDefault(); try { apply(dialog); dialog.close(); } catch (error) { toast?.(error.message); } });
    dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal();
    return dialog;
  }
  function newDeck(ids = selectedIds()) {
    makeDialog('Create a deck', '<label>Deck name <input name="deck-name" required maxlength="80" value="New deck" /></label>', ids.length ? 'Create and add selected' : 'Create deck', dialog => {
      const name = dialog.querySelector('[name="deck-name"]').value.trim();
      if (!name) throw new Error('Enter a deck name.');
      const available = new Set(state.cards.map(card => card.id));
      const deck = createCustomDeck({ name, cardIds: ids.filter(id => available.has(id)) }, new Set((state.customDecks || []).map(row => row.id)));
      pushHistory(); state.customDecks = [...(state.customDecks || []), deck]; changed(); deckSelect.value = deck.id;
      toast?.(`Created ${deck.name} with ${deck.cardIds.length} card(s).`);
    }, ids);
  }
  function rename(ids) {
    const dialog = makeDialog('Rename selected cards', `<div class="gen-grid"><label>Prefix <input name="prefix" maxlength="80" /></label><label>Suffix <input name="suffix" maxlength="80" /></label><label>Numbered pattern <input name="pattern" placeholder="Card {n}: {name}" maxlength="120" /></label><label>Start number <input name="start" type="number" min="0" value="1" /></label></div><p class="studio-muted">Leave the pattern blank to keep each original name. Use {name} and {n} in a pattern.</p><button type="button" class="s-btn" data-generated-names>Generate names</button>`, 'Apply names', modal => {
      const options = Object.fromEntries(['prefix', 'suffix', 'pattern', 'start'].map(key => [key, modal.querySelector(`[name="${key}"]`).value]));
      const cards = renameSelectedCards(state.cards, ids, options);
      if (!cards.some((card, i) => card.name !== state.cards[i].name)) throw new Error('Enter a prefix, suffix, or pattern to change the selected names.');
      pushHistory(); state.cards = cards;
      for (const card of selectedCards(state.cards, ids)) ctx.prepareSubclassEdit?.(card);
      changed(); toast?.(`Renamed ${ids.length} selected card(s).`);
    }, ids);
    const auto = dialog.querySelector('[data-generated-names]'); auto.disabled = !ctx.applyAutoNames;
    auto.addEventListener('click', () => { dialog.close(); ctx.applyAutoNames?.([...ids]); });
  }
  function removeAdded(ids) {
    const plan = removeAddedCardsFromState(state, ids);
    if (!plan.removedIds.length) return toast?.('Original authored cards are protected.');
    const body = `<p data-remove-summary></p><p class="studio-muted">This removes cards from the Studio draft and its decks. Undo restores them. Game files are unchanged.</p>`;
    const dialog = makeDialog('Remove added cards?', body, `Remove ${plan.removedIds.length} added card(s)`, () => {
      const current = removeAddedCardsFromState(state, ids);
      if (!current.removedIds.length) return;
      const changes = Object.fromEntries(Object.entries(current.nextState).filter(([key, value]) => value !== state[key]));
      pushHistory(); Object.assign(state, changes);
      for (const id of current.removedIds) selected.delete(id);
      ctx.onCardsRemoved?.(current.removedIds); changed(); toast?.(`Removed ${current.removedIds.length} added card(s). Undo can restore them.`);
    }, ids);
    dialog.querySelector('[data-remove-summary]').textContent = `Remove ${plan.removedIds.length} added card(s)${plan.protectedIds.length ? `; keep ${plan.protectedIds.length} protected original card(s)` : ''}?`;
  }
  function selectVisible() {
    mode.setEnabled(true);
    const available = new Set(state.cards.map(card => card.id));
    for (const card of getFilteredCards?.() || state.cards) if (available.has(card.id)) mode.toggle(card.id, true);
    selectionChanged();
  }
  function withSelection(action) {
    const ids = selectedIds();
    if (!ids.length) return toast?.('Select at least one card.');
    return action(ids);
  }
  toolbar.addEventListener('click', event => {
    const action = event.target.closest('[data-selection-action]')?.dataset.selectionAction;
    if (!action) return;
    const ids = selectedIds();
    try {
      if (action === 'visible') selectVisible();
      else if (action === 'clear') { selected.clear(); selectionChanged(); }
      else if (action === 'new-deck') newDeck(ids);
      else if (action === 'rename') rename(ids);
      else if (action === 'balance') ctx.openBalanceSelection?.([...ids]);
      else if (action === 'delete') removeAdded(ids);
      else if (action === 'add' || action === 'remove-deck') {
        if (!ids.length) return;
        if (!deckSelect.value) return newDeck(ids);
        const deck = state.customDecks.find(row => row.id === deckSelect.value);
        const decks = action === 'add' ? addSelectedCardsToDeck(state.customDecks, deckSelect.value, ids) : removeSelectedCardsFromDeck(state.customDecks, deckSelect.value, ids);
        pushHistory(); state.customDecks = decks; changed(); toast?.(`${action === 'add' ? 'Added selected cards to' : 'Removed selected cards from'} ${deck.name}.`);
      }
    } catch (error) { toast?.(error.message); }
  });
  modeInput.addEventListener('change', event => { mode.setEnabled(event.target.checked); selectionChanged(); });
  function decorateTile(tile, def) {
    if (!def?.id || !tile.classList.contains('studio-card-tile') || !state.cards.some(card => card.id === def.id)) return;
    if (tile.querySelector('[data-card-selection]')) return;
    const stage = tile.querySelector('.studio-card-stage');
    if (!stage) return;
    const label = document.createElement('label'); label.className = 'card-select-control';
    label.hidden = !mode.enabled; label.title = `Select ${def.name}`;
    const box = document.createElement('input'); box.type = 'checkbox'; box.dataset.cardSelection = def.id;
    box.checked = mode.enabled && selected.has(def.id); box.setAttribute('aria-label', `Select ${def.name}`);
    const text = document.createElement('span'); text.textContent = 'Select'; label.append(box, text);
    label.addEventListener('click', event => event.stopPropagation());
    label.addEventListener('keydown', event => event.stopPropagation());
    box.addEventListener('change', () => { mode.toggle(def.id, box.checked); selectionChanged(); });
    tile.append(label); label.classList.toggle('is-checked', box.checked); tile.classList.toggle('is-bulk-selected', box.checked);
  }
  refresh();
  return { decorateTile, refresh, selectedIds, clear: () => { selected.clear(); selectionChanged(); },
    selectVisible, renameSelected: () => withSelection(rename), balanceSelected: () => withSelection(ids => ctx.openBalanceSelection?.([...ids])),
    removeAdded: () => withSelection(removeAdded), createDeckFromSelection: () => withSelection(newDeck),
    select: (ids, { replace = false } = {}) => { if (replace) selected.clear(); const available = new Set(state.cards.map(card => card.id)); const chosen = [...ids].filter(id => available.has(id)); if (chosen.length) mode.setEnabled(true); for (const id of chosen) mode.toggle(id, true); selectionChanged(); },
    setMode: enabled => { mode.setEnabled(enabled); selectionChanged(); }, isEnabled: () => mode.enabled,
    toolbar,
  };
}
