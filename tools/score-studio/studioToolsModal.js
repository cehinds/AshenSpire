// tools/score-studio/studioToolsModal.js — UI controllers for Auto-Balance, Batch Generator,
// and Custom Decks & Classes modals in Score Studio.
import {
  DEFAULT_CARD_BALANCE_PRESET,
  DEFAULT_ITEM_BALANCE_PRESET,
  ResolveQuotaCounts,
  BuildTargetSlots,
  AutoBalanceCards,
  AutoBalanceItems,
} from '../../src/model/autoBalance.js';
import { GenerateCardBatch } from '../../src/model/cardGenerator.js';
import { GenerateItemBatch } from '../../src/model/itemGenerator.js';
import { GEAR_TYPES } from '../../src/content/gearTypes.js';
import {
  DEFAULT_CUSTOM_DECKS_PATH,
  createCustomClass,
  createCustomDeck,
  buildStudioBundle,
  parseStudioBundle,
  setActiveDeckList,
  assignDeckToClass,
} from './customDecks.js';
import { deckCatalogOptions, resolveStudioDeck } from './deckCatalog.js';
import { initFocusedRebalanceUi } from './focusedRebalanceUi.js';
import { removeCardsAndReferences } from './cardSelection.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BUILTIN_CLASSES = Object.freeze(['reaver', 'starseer', 'rogue', 'herald', 'colorless']);

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Initialize and wire the Auto-Balance, Batch Generator, and Custom Decks & Classes modals.
 */
export function initStudioToolsModals(ctx) {
  const {
    state,
    isLocalServer,
    pushHistory,
    saveDraft,
    syncAllViews,
    toast,
    normalizeStudioCard,
    deriveFaceFromDef,
    getFilteredCards,
    getFilteredItems,
    studioCardOverrides,
  } = ctx;

  let rebalTarget = 'cards'; // 'cards' | 'items'
  let genTarget = 'cards';   // 'cards' | 'items'
  let balanceSelection = new Set();
  let balanceItemSelection = new Set();
  let focusedRebalanceUi = null;
  const READ_ONLY_DECK_MESSAGE = 'Class lists are read only. Copy the list to a custom deck before adding members or changing its assignment.';
  const writableDeck = id => {
    const view = resolveStudioDeck(state, id);
    if (!view) { toast('This deck no longer exists. Choose a current custom deck.'); return null; }
    if (view.readOnly) { toast(READ_ONLY_DECK_MESSAGE); return null; }
    return state.customDecks.find(deck => deck.id === id) || null;
  };

  const allClassOptions = () => {
    const out = BUILTIN_CLASSES.map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1), custom: false }));
    for (const c of state.customClasses || []) {
      if (!out.some((x) => x.id === c.id)) out.push({ id: c.id, name: c.name, custom: true });
    }
    return out;
  };

  function populateWeaponTypeOptions() {
    const sel = document.getElementById('gen-item-weapon-type');
    if (!sel || sel.options.length > 1) return;
    for (const [key, row] of Object.entries(GEAR_TYPES.weaponTypes || {})) {
      sel.append(new Option(row.label || key, key));
    }
  }

  function populateDeckAndClassDropdowns() {
    const classes = allClassOptions();
    const fillClass = (id, includeAuto, autoLabel = 'Auto') => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const prev = sel.value;
      sel.innerHTML = '';
      if (includeAuto) sel.append(new Option(autoLabel, includeAuto === 'empty' ? '' : 'auto'));
      for (const c of classes) sel.append(new Option(c.custom ? `${c.name} (Custom)` : c.name, c.id));
      if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
    };
    fillClass('gen-card-class', true, 'Auto');
    fillClass('new-deck-class', 'empty', '(Unassigned)');

    const fillDecks = (id, noneLabel) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const prev = sel.value;
      sel.innerHTML = '';
      sel.append(new Option(noneLabel, id === 'filter-deck' ? 'all' : ''));
      for (const d of state.customDecks || []) {
        if (resolveStudioDeck(state, d.id)?.readOnly) continue;
        const tag = d.isActiveDeckList ? ' ★ Active' : (d.assignedClassId ? ` · ${d.assignedClassId}` : '');
        sel.append(new Option(`${d.name} (${d.cardIds.length}c/${d.itemKeys.length}i)${tag}`, d.id));
      }
      if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
    };
    fillDecks('gen-deck', '(None — studio pool only)');
    for (const id of ['filter-deck', 'filter-item-deck']) {
      const select = document.getElementById(id);
      if (!select) continue;
      const previous = select.value;
      select.replaceChildren();
      const groups = new Map();
      for (const row of deckCatalogOptions(state)) {
        const option = new Option(row.value === 'all' ? (id === 'filter-item-deck' ? 'All items' : 'All cards') : row.label, row.value);
        if (!row.group) select.append(option);
        else {
          if (!groups.has(row.group)) { const group = document.createElement('optgroup'); group.label = row.group; groups.set(row.group, group); select.append(group); }
          groups.get(row.group).append(option);
        }
      }
      const actions = document.createElement('optgroup'); actions.label = 'Actions';
      actions.append(new Option('Manage decks…', '__manage__')); select.append(actions);
      select.value = [...select.options].some(option => option.value === previous) ? previous : 'all';
      if (select.value === '__manage__') select.value = 'all';
      select.dataset.previousDeckValue = select.value;
    }
  }

  // -------------------------------------------------------------------------
  // Save / Export / Load JSON Bundle helpers
  // -------------------------------------------------------------------------
  function currentBundle(name = 'Score Studio Bundle') {
    return buildStudioBundle({
      name,
      cards: state.cards,
      items: state.items,
      customClasses: state.customClasses || [],
      customDecks: state.customDecks || [],
    });
  }

  async function saveBundleToRepo(bundle, path = DEFAULT_CUSTOM_DECKS_PATH) {
    if (!isLocalServer) {
      toast('Save to Repo requires running locally via npm run studio.');
      return false;
    }
    try {
      const r = await fetch('/__studio/custom-decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, bundle }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`);
      toast(`Saved to ${data.path} (${data.cardCount} cards, ${data.itemCount} items, ${data.deckCount} decks)`);
      return true;
    } catch (err) {
      toast(`Save failed: ${err.message}`);
      return false;
    }
  }

  function applyImportedBundle(rawText) {
    const bundle = parseStudioBundle(rawText);
    pushHistory();
    let cardCount = 0;
    let itemCount = 0;
    if (Array.isArray(bundle.cards)) {
      for (const rawCard of bundle.cards) {
        if (!rawCard || typeof rawCard !== 'object' || !rawCard.id) continue;
        const normalized = normalizeStudioCard({ ...rawCard, _edited: true });
        const idx = state.cards.findIndex((c) => c.id === normalized.id);
        if (idx >= 0) state.cards[idx] = normalized;
        else state.cards.unshift(normalized);
        cardCount++;
      }
      studioCardOverrides.clear();
    }
    if (Array.isArray(bundle.items)) {
      for (const rawItem of bundle.items) {
        if (!rawItem || typeof rawItem !== 'object' || !rawItem.key) continue;
        const copy = structuredClone(rawItem);
        copy._edited = true;
        const idx = state.items.findIndex((it) => it.key === copy.key);
        if (idx >= 0) state.items[idx] = copy;
        else state.items.unshift(copy);
        itemCount++;
      }
    }
    if (bundle.customClasses.length) {
      const seen = new Set((state.customClasses || []).map((c) => c.id));
      for (const cls of bundle.customClasses) {
        if (!cls?.id) continue;
        if (seen.has(cls.id)) {
          const i = state.customClasses.findIndex((c) => c.id === cls.id);
          if (i >= 0) state.customClasses[i] = cls;
        } else {
          state.customClasses.push(cls);
          seen.add(cls.id);
        }
      }
    }
    if (bundle.customDecks.length) {
      const seen = new Set((state.customDecks || []).map((d) => d.id));
      for (const deck of bundle.customDecks) {
        if (!deck?.id) continue;
        if (seen.has(deck.id)) {
          const i = state.customDecks.findIndex((d) => d.id === deck.id);
          if (i >= 0) state.customDecks[i] = deck;
        } else {
          state.customDecks.push(deck);
          seen.add(deck.id);
        }
      }
    }
    syncAllViews();
    populateDeckAndClassDropdowns();
    renderDecksModal();
    saveDraft({ autoName: false });
    toast(`Loaded JSON: ${cardCount} cards, ${itemCount} items, ${bundle.customDecks.length} decks, ${bundle.customClasses.length} classes`);
  }

  function wireFileLoadInput(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      el.value = '';
      if (!file) return;
      try {
        applyImportedBundle(await file.text());
      } catch (err) {
        toast(`Invalid JSON: ${err.message}`);
      }
    });
  }

  // -------------------------------------------------------------------------
  // 1. AUTO-BALANCE MODAL
  // -------------------------------------------------------------------------
  function populateRebalanceScopes() {
    const sel = document.getElementById('rebal-scope');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    if (rebalTarget === 'cards') {
      const current = state.cards.find(card => card.id === state.selectedCardId);
      if (current) sel.append(new Option(`Current card: ${current.name}`, 'current'));
      if (balanceSelection.size) sel.append(new Option(`Selected cards (${balanceSelection.size})`, 'selected'));
      sel.append(new Option(`All Cards (${state.cards.length})`, 'all'));
      sel.append(new Option(`Current Filtered View (${getFilteredCards().length})`, 'filtered'));
      const activeDeck = (state.customDecks || []).find((d) => d.isActiveDeckList);
      if (activeDeck) sel.append(new Option(`Active Deck List: ${activeDeck.name} (${activeDeck.cardIds.length})`, `deck:${activeDeck.id}`));
      for (const c of allClassOptions()) {
        const cnt = state.cards.filter((card) => (card.class || 'colorless') === c.id).length;
        sel.append(new Option(`Class: ${c.name} (${cnt})`, `class:${c.id}`));
      }
      for (const d of state.customDecks || []) {
        if (d.isActiveDeckList) continue;
        sel.append(new Option(`Custom Deck: ${d.name} (${d.cardIds.length})`, `deck:${d.id}`));
      }
    } else {
      const current = state.items.find(item => item.key === state.selectedItemKey);
      if (current) sel.append(new Option(`Current item: ${current.name}`, 'current'));
      sel.append(new Option(`All Items (${state.items.length})`, 'all'));
      if (balanceItemSelection.size) sel.append(new Option(`Selected items (${balanceItemSelection.size})`, 'selected'));
      sel.append(new Option(`Current Filtered View (${getFilteredItems().length})`, 'filtered'));
      sel.append(new Option(`Weapons (${state.items.filter((i) => i.kind === 'weapon').length})`, 'kind:weapon'));
      sel.append(new Option(`Armours (${state.items.filter((i) => i.kind === 'armour').length})`, 'kind:armour'));
      sel.append(new Option(`Relics (${state.items.filter((i) => i.kind === 'relic').length})`, 'kind:relic'));
      for (const d of state.customDecks || []) {
        sel.append(new Option(`Custom Deck: ${d.name} (${d.itemKeys.length})`, `deck:${d.id}`));
      }
    }
    if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
  }

  function scopedEntriesForRebalance() {
    const scope = document.getElementById('rebal-scope')?.value || 'all';
    if (rebalTarget === 'cards') {
      if (scope === 'current') return state.cards.filter(card => card.id === state.selectedCardId);
      if (scope === 'selected') return state.cards.filter(card => balanceSelection.has(card.id));
      if (scope === 'filtered') return getFilteredCards();
      if (scope.startsWith('class:')) {
        const cls = scope.slice(6);
        return state.cards.filter((c) => (c.class || 'colorless') === cls);
      }
      if (scope.startsWith('deck:')) {
        const deck = (state.customDecks || []).find((d) => d.id === scope.slice(5));
        const set = new Set(deck?.cardIds || []);
        return state.cards.filter((c) => set.has(c.id));
      }
      return [...state.cards];
    }
    if (scope === 'current') return state.items.filter(item => item.key === state.selectedItemKey);
    if (scope === 'selected') return state.items.filter(item => balanceItemSelection.has(item.key));
    if (scope === 'filtered') return getFilteredItems();
    if (scope.startsWith('kind:')) {
      const kind = scope.slice(5);
      return state.items.filter((i) => i.kind === kind);
    }
    if (scope.startsWith('deck:')) {
      const deck = (state.customDecks || []).find((d) => d.id === scope.slice(5));
      const set = new Set(deck?.itemKeys || []);
      return state.items.filter((i) => set.has(i.key));
    }
    return [...state.items];
  }

  function loadRebalanceDefaults() {
    const preset = rebalTarget === 'cards' ? DEFAULT_CARD_BALANCE_PRESET : DEFAULT_ITEM_BALANCE_PRESET;
    document.getElementById('rebal-mode').value = preset.mode;
    for (let r = 0; r <= 5; r++) document.getElementById(`rebal-rank-${r}`).value = String(preset.ranks[r] ?? 0);
    document.getElementById('rebal-rar-common').value = String(preset.rarities.common ?? 0);
    document.getElementById('rebal-rar-uncommon').value = String(preset.rarities.uncommon ?? 0);
    document.getElementById('rebal-rar-rare').value = String(preset.rarities.rare ?? 0);
    document.getElementById('rebal-rar-boss').value = String(preset.rarities.boss ?? 0);
    document.getElementById('rebal-aim-max').checked = preset.aimMaxCp;
    document.getElementById('rebal-naming').checked = preset.applyNaming;
    document.getElementById('rebal-gen-shortage').checked = preset.generateShortage;
    document.getElementById('rebal-trim-surplus').checked = preset.trimSurplus;
    document.getElementById('rebal-seed').value = String(preset.seed);
    const scoped = scopedEntriesForRebalance();
    document.getElementById('rebal-count').value = String(Math.max(1, scoped.length));
    updateRebalancePreview();
  }

  function readRebalanceForm() {
    const mode = document.getElementById('rebal-mode').value === 'flat' ? 'flat' : 'percent';
    const targetCount = Math.max(1, Math.round(Number(document.getElementById('rebal-count').value) || 1));
    const rankQuotas = {};
    for (let r = 0; r <= 5; r++) rankQuotas[r] = Math.max(0, Number(document.getElementById(`rebal-rank-${r}`).value) || 0);
    const rarityQuotas = {
      common: Math.max(0, Number(document.getElementById('rebal-rar-common').value) || 0),
      uncommon: Math.max(0, Number(document.getElementById('rebal-rar-uncommon').value) || 0),
      rare: Math.max(0, Number(document.getElementById('rebal-rar-rare').value) || 0),
      ...(rebalTarget === 'items' ? { boss: Math.max(0, Number(document.getElementById('rebal-rar-boss').value) || 0) } : {}),
    };
    return {
      mode,
      targetCount,
      rankQuotas,
      rarityQuotas,
      aimMaxCp: document.getElementById('rebal-aim-max').checked,
      applyNaming: document.getElementById('rebal-naming').checked,
      generateShortage: document.getElementById('rebal-gen-shortage').checked,
      trimSurplus: document.getElementById('rebal-trim-surplus').checked,
      seed: document.getElementById('rebal-seed').value.trim() || '42',
    };
  }

  function updateRebalancePreview() {
    const selectedScope = ['selected', 'current'].includes(document.getElementById('rebal-scope').value);
    document.getElementById('rebal-count').disabled = selectedScope;
    document.getElementById('rebal-gen-shortage').disabled = selectedScope;
    document.getElementById('rebal-trim-surplus').disabled = selectedScope;
    if (selectedScope) {
      document.getElementById('rebal-count').value = String(scopedEntriesForRebalance().length);
      document.getElementById('rebal-gen-shortage').checked = false;
      document.getElementById('rebal-trim-surplus').checked = false;
    }
    const cfg = readRebalanceForm();
    const scoped = scopedEntriesForRebalance();
    if (selectedScope) Object.assign(cfg, { targetCount: scoped.length, generateShortage: false, trimSurplus: false });
    const unit = cfg.mode === 'flat' ? '(#)' : '(%)';
    document.getElementById('rebal-rank-unit').textContent = unit;
    document.getElementById('rebal-rarity-unit').textContent = unit;
    const rankSum = Object.values(cfg.rankQuotas).reduce((a, b) => a + b, 0);
    const rarSum = Object.values(cfg.rarityQuotas).reduce((a, b) => a + b, 0);
    document.getElementById('rebal-rank-total').textContent = cfg.mode === 'flat' ? `Sum: ${rankSum}` : `Sum: ${rankSum}%`;
    document.getElementById('rebal-rarity-total').textContent = cfg.mode === 'flat' ? `Sum: ${rarSum}` : `Sum: ${rarSum}%`;

    const effectiveCount = cfg.mode === 'flat' ? Math.max(rankSum, rarSum, cfg.targetCount) : cfg.targetCount;
    const rankCounts = ResolveQuotaCounts(cfg.rankQuotas, effectiveCount, cfg.mode);
    const rarCounts = ResolveQuotaCounts(cfg.rarityQuotas, effectiveCount, cfg.mode);
    const slots = BuildTargetSlots(rankCounts, rarCounts);
    const shortage = Math.max(0, slots.length - scoped.length);
    const surplus = Math.max(0, scoped.length - slots.length);
    const rankLine = Object.entries(rankCounts).filter(([, n]) => n > 0).map(([r, n]) => `R${r}: ${n}`).join(' · ') || 'none';
    const rarLine = Object.entries(rarCounts).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`).join(' · ') || 'none';
    const notes = [];
    if (shortage > 0) notes.push(cfg.generateShortage ? `Will procedurally generate +${shortage} missing ${rebalTarget}.` : `Shortage of ${shortage} (generation disabled).`);
    if (surplus > 0) notes.push(cfg.trimSurplus ? `Will trim ${surplus} surplus ${rebalTarget}.` : `${surplus} surplus ${rebalTarget} will remain untouched.`);
    document.getElementById('rebal-preview-summary').textContent = [
      `Scope: ${scoped.length} ${rebalTarget} -> Target slots: ${slots.length}`,
      `Ranks:   ${rankLine}`,
      `Rarity:  ${rarLine}`,
      ...notes,
    ].join('\n');
  }

  function setRebalanceTarget(target) {
    rebalTarget = target === 'items' ? 'items' : 'cards';
    document.getElementById('rebalance-modal-title').textContent = rebalTarget === 'cards' ? 'Rebalance power: Cards' : 'Rebalance power: Items';
    document.getElementById('rebal-target-cards').classList.toggle('is-active', rebalTarget === 'cards');
    document.getElementById('rebal-target-items').classList.toggle('is-active', rebalTarget === 'items');
    document.getElementById('rebal-rar-boss-wrap').classList.toggle('hidden', rebalTarget !== 'items');
    populateRebalanceScopes();
    loadRebalanceDefaults();
    focusedRebalanceUi?.reset();
  }

  function openRebalanceModal(target = 'cards') {
    balanceSelection = new Set();
    balanceItemSelection = new Set();
    setRebalanceTarget(target);
    document.getElementById('rebal-scope').value = 'all';
    updateRebalancePreview(); focusedRebalanceUi.open();
  }

  function openBalanceSelection(ids) {
    balanceItemSelection = new Set();
    const present = new Set(state.cards.map(card => card.id));
    balanceSelection = new Set(ids.filter(id => present.has(id)));
    if (!balanceSelection.size) { toast('Select cards to rebalance power first.'); return; }
    setRebalanceTarget('cards');
    document.getElementById('rebal-scope').value = 'selected';
    document.getElementById('rebal-count').value = String(balanceSelection.size);
    updateRebalancePreview();
    focusedRebalanceUi.open();
  }

  function openBalanceItems(keys) {
    balanceSelection = new Set();
    const present = new Set(state.items.map(item => item.key));
    balanceItemSelection = new Set(keys.filter(key => present.has(key)));
    if (!balanceItemSelection.size) { toast('Select an item to rebalance power first.'); return; }
    setRebalanceTarget('items');
    document.getElementById('rebal-scope').value = 'selected';
    document.getElementById('rebal-count').value = String(balanceItemSelection.size);
    updateRebalancePreview();
    focusedRebalanceUi.open();
  }

  function applyPoolRebalance() {
    // Generation/trimming is an explicit Advanced pool operation; selected scopes always use staged editing.
    if (!document.getElementById('rebal-pool-mode')?.checked || ['selected', 'current'].includes(document.getElementById('rebal-scope').value)) return;
    const cfg = readRebalanceForm();
    const scope = document.getElementById('rebal-scope').value || 'all';
    const scoped = scopedEntriesForRebalance();
    if (scope === 'selected') Object.assign(cfg, { targetCount: scoped.length, generateShortage: false, trimSurplus: false });
    if (!scoped.length && !cfg.generateShortage) {
      toast('No entries in scope to rebalance power.');
      return;
    }
    let deckTarget = scope.startsWith('deck:') ? (state.customDecks || []).find((d) => d.id === scope.slice(5)) : null;
    if (scope.startsWith('deck:')) {
      const view = resolveStudioDeck(state, scope.slice(5));
      if (!view) { toast('This deck no longer exists. Choose a current scope.'); return; }
      const slots = BuildTargetSlots(ResolveQuotaCounts(cfg.rankQuotas, cfg.targetCount, cfg.mode), ResolveQuotaCounts(cfg.rarityQuotas, cfg.targetCount, cfg.mode));
      if (view.readOnly && cfg.generateShortage && slots.length > scoped.length) { toast(READ_ONLY_DECK_MESSAGE); return; }
    }
    pushHistory();

    if (rebalTarget === 'cards') {
      const defaultClass = scope.startsWith('class:') ? scope.slice(6) : (deckTarget?.assignedClassId || scoped[0]?.class || 'colorless');
      const res = AutoBalanceCards(scoped, {
        ...cfg,
        scoring: state.scoring,
        defaultClass,
        faceOf: (def) => deriveFaceFromDef(def),
      });
      const selectedScope = scope === 'selected' ? new Set(scoped.map(card => card.id)) : null;
      const updatedMap = new Map(res.updated.filter(card => !selectedScope || selectedScope.has(card.id)).map((c) => {
        const normalized = normalizeStudioCard(c);
        ctx.prepareSubclassEdit?.(normalized);
        return [c.id, normalized];
      }));
      // Quota trimming explicitly authorizes these IDs (including Core cards),
      // and must remove their references from every list, not only this scope.
      Object.assign(state, removeCardsAndReferences(state, res.removedIds).nextState);
      deckTarget = scope.startsWith('deck:') ? (state.customDecks || []).find((d) => d.id === scope.slice(5)) : null;
      state.cards = state.cards
        .map((c) => updatedMap.get(c.id) || c);
      for (const gen of res.created) {
        const norm = normalizeStudioCard(gen);
        state.cards.unshift(norm);
        if (deckTarget && !deckTarget.cardIds.includes(norm.id)) deckTarget.cardIds.push(norm.id);
      }
      studioCardOverrides.clear();
      syncAllViews();
      saveDraft({ autoName: false });
      document.getElementById('rebalance-modal').close();
      toast(`Rebalanced power for ${res.report.tunedCount} cards${res.report.createdCount ? ` (+${res.report.createdCount} generated)` : ''}${res.report.removedCount ? ` (-${res.report.removedCount} trimmed)` : ''}`);
    } else {
      const defaultKind = scope.startsWith('kind:') ? scope.slice(5) : 'weapon';
      const res = AutoBalanceItems(scoped, {
        ...cfg,
        scoring: state.scoring,
        rules: state.itemRules,
        defaultKind,
      });
      const updatedMap = new Map(res.updated.map((it) => [it.key, it]));
      const removedSet = new Set(res.removedKeys);
      state.items = state.items
        .filter((it) => !removedSet.has(it.key))
        .map((it) => updatedMap.get(it.key) || it);
      for (const gen of res.created) {
        state.items.unshift(gen);
        if (deckTarget && !deckTarget.itemKeys.includes(gen.key)) deckTarget.itemKeys.push(gen.key);
      }
      if (deckTarget && removedSet.size) deckTarget.itemKeys = deckTarget.itemKeys.filter((k) => !removedSet.has(k));
      syncAllViews();
      saveDraft({ autoName: false });
      document.getElementById('rebalance-modal').close();
      toast(`Rebalanced power for ${res.report.tunedCount} items${res.report.createdCount ? ` (+${res.report.createdCount} generated)` : ''}${res.report.removedCount ? ` (-${res.report.removedCount} trimmed)` : ''}`);
    }
  }

  // -------------------------------------------------------------------------
  // 2. BATCH PROCEDURAL GENERATOR MODAL
  // -------------------------------------------------------------------------
  function setGeneratorTarget(target) {
    genTarget = target === 'items' ? 'items' : 'cards';
    document.getElementById('generate-modal-title').textContent = genTarget === 'cards' ? 'Batch Generate Cards' : 'Batch Generate Items';
    document.getElementById('gen-target-cards').classList.toggle('is-active', genTarget === 'cards');
    document.getElementById('gen-target-items').classList.toggle('is-active', genTarget === 'items');
    document.getElementById('gen-card-fields').classList.toggle('hidden', genTarget !== 'cards');
    document.getElementById('gen-item-fields').classList.toggle('hidden', genTarget !== 'items');
    populateWeaponTypeOptions();
    populateDeckAndClassDropdowns();
  }

  function openGenerateModal(target = 'cards') {
    setGeneratorTarget(target);
    document.getElementById('generate-modal').showModal();
  }

  function runBatchGenerate() {
    const count = Math.max(1, Math.min(100, Math.round(Number(document.getElementById('gen-count').value) || 5)));
    const seed = document.getElementById('gen-seed').value.trim() || String(Date.now().toString(36));
    const deckId = document.getElementById('gen-deck').value;
    const deck = deckId ? writableDeck(deckId) : null;
    if (deckId && !deck) return;
    const rankVal = document.getElementById('gen-rank').value;
    const rank = rankVal === 'auto' ? 'auto' : Number(rankVal);
    const aimMaxCp = document.getElementById('gen-aim-max').checked;
    const applyNaming = document.getElementById('gen-naming').checked;

    pushHistory();
    if (genTarget === 'cards') {
      const stances = [...document.querySelectorAll('#gen-card-stances input:checked')].map((el) => el.value);
      const keywords = [...document.querySelectorAll('#gen-card-keywords input:checked')].map((el) => el.value);
      const effVal = document.getElementById('gen-card-effects').value;
      const { cards } = GenerateCardBatch({
        count,
        seed,
        cls: document.getElementById('gen-card-class').value,
        rarity: document.getElementById('gen-card-rarity').value,
        rank,
        type: document.getElementById('gen-card-type').value,
        camp: document.getElementById('gen-card-camp').value,
        school: document.getElementById('gen-card-school').value,
        effectCount: effVal === 'auto' ? 'auto' : Number(effVal),
        targeting: document.getElementById('gen-card-targeting').value,
        stances,
        keywords,
        aimMaxCp,
        applyNaming,
        idPrefix: `gen_${Date.now().toString(36)}`,
      }, { scoring: state.scoring });

      for (const raw of cards.reverse()) {
        const card = normalizeStudioCard({ ...raw, _custom: true, _generated: true, _edited: true, _autoName: applyNaming });
        state.cards.unshift(card);
        if (deck && !deck.cardIds.includes(card.id)) deck.cardIds.push(card.id);
      }
      if (cards.length) state.selectedCardId = state.cards[0].id;
      studioCardOverrides.clear();
      syncAllViews();
      populateDeckAndClassDropdowns();
      saveDraft({ autoName: false });
      document.getElementById('generate-modal').close();
      toast(`Generated ${cards.length} card(s)${deck ? ` into "${deck.name}"` : ''}`);
    } else {
      const traitsVal = document.getElementById('gen-item-traits').value;
      const { items } = GenerateItemBatch({
        count,
        seed,
        kind: document.getElementById('gen-item-kind').value,
        rarity: document.getElementById('gen-item-rarity').value,
        rank,
        gearType: document.getElementById('gen-item-weapon-type').value,
        gearGroup: document.getElementById('gen-item-armour-group').value,
        range: document.getElementById('gen-item-range').value,
        element: document.getElementById('gen-item-element').value,
        traitCount: traitsVal === 'auto' ? 'auto' : Number(traitsVal),
        relicMode: document.getElementById('gen-item-relic-mode').value,
        aimMaxCp,
        applyNaming,
        idPrefix: `genItem_${Date.now().toString(36)}`,
      }, { scoring: state.scoring, rules: state.itemRules });

      for (const entry of items.reverse()) {
        state.items.unshift(entry);
        if (deck && !deck.itemKeys.includes(entry.key)) deck.itemKeys.push(entry.key);
      }
      if (items.length) state.selectedItemKey = state.items[0].key;
      syncAllViews();
      populateDeckAndClassDropdowns();
      saveDraft({ autoName: false });
      document.getElementById('generate-modal').close();
      toast(`Generated ${items.length} item(s)${deck ? ` into "${deck.name}"` : ''}`);
    }
  }

  // -------------------------------------------------------------------------
  // 3. CUSTOM DECKS & CLASSES MODAL
  // -------------------------------------------------------------------------
  function renderDecksModal() {
    populateDeckAndClassDropdowns();
    const activeDeck = (state.customDecks || []).find((d) => d.isActiveDeckList);
    const badge = document.getElementById('decks-active-badge');
    if (badge) badge.textContent = activeDeck ? `Active deck list: ${activeDeck.name}` : 'Active deck list: None (full pool)';

    const clsList = document.getElementById('custom-classes-list');
    if (clsList) {
      clsList.innerHTML = '';
      if (!(state.customClasses || []).length) {
        clsList.innerHTML = '<div class="studio-muted">No custom classes yet. Create one above to assign cards and decks to it.</div>';
      } else {
        for (const cls of state.customClasses) {
          const deck = (state.customDecks || []).find((d) => d.id === cls.deckId || d.assignedClassId === cls.id);
          const row = document.createElement('div');
          row.className = 'deck-row-card';
          row.innerHTML = `
            <div class="deck-row-head">
              <strong><span class="class-swatch" style="background:${esc(cls.tint)}"></span>${esc(cls.name)} <span class="studio-muted">(${esc(cls.id)} · ${cls.maxHp} HP)</span></strong>
              <button type="button" class="s-btn s-btn-sm" data-del-class="${esc(cls.id)}">Delete</button>
            </div>
            <div class="studio-muted">${esc(cls.description || 'Custom class')}${deck ? ` · Deck: ${esc(deck.name)}` : ''}</div>
          `;
          clsList.appendChild(row);
        }
      }
    }

    const deckList = document.getElementById('custom-decks-list');
    if (deckList) {
      deckList.innerHTML = '';
      if (!(state.customDecks || []).length) {
        deckList.innerHTML = '<div class="studio-muted">No custom decks yet. Create one above to group cards/items or drive the Sandbox.</div>';
      } else {
        const classes = allClassOptions();
        for (const deck of state.customDecks) {
          const readOnly = !!resolveStudioDeck(state, deck.id)?.readOnly;
          const row = document.createElement('div');
          row.className = 'deck-row-card' + (deck.isActiveDeckList ? ' is-active' : '');
          const clsOptions = `<option value="">Unassigned</option>` + classes.map((c) => `<option value="${esc(c.id)}"${deck.assignedClassId === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
          row.innerHTML = `
            <div class="deck-row-head">
              <strong>${esc(deck.name)} ${deck.isActiveDeckList ? '<span class="badge">Active List</span>' : ''}</strong>
              <span class="studio-muted">${deck.cardIds.length} cards · ${deck.itemKeys.length} items</span>
            </div>
            <div class="deck-row-actions">
              <select data-assign-deck="${esc(deck.id)}" aria-label="Assign deck to class"${readOnly ? ' disabled' : ''}>${clsOptions}</select>
              <button type="button" class="s-btn s-btn-sm" data-active-deck="${esc(deck.id)}">${deck.isActiveDeckList ? 'Clear Active' : 'Set Active List'}</button>
              <button type="button" class="s-btn s-btn-sm" data-add-selected="${esc(deck.id)}" title="${readOnly ? esc(READ_ONLY_DECK_MESSAGE) : 'Add the currently selected card &amp; item to this deck'}"${readOnly ? ' disabled' : ''}>+ Add Selected</button>
              <button type="button" class="s-btn s-btn-sm" data-export-deck="${esc(deck.id)}">Export JSON</button>
              <button type="button" class="s-btn s-btn-sm" data-del-deck="${esc(deck.id)}"${readOnly ? ' disabled' : ''}>Delete</button>
            </div>
            ${readOnly ? `<p class="studio-muted">${esc(READ_ONLY_DECK_MESSAGE)}</p>` : ''}
          `;
          deckList.appendChild(row);
        }
      }
    }
  }

  function openDecksModal() {
    renderDecksModal();
    document.getElementById('decks-modal').showModal();
  }

  // -------------------------------------------------------------------------
  // Wire Events
  // -------------------------------------------------------------------------
  focusedRebalanceUi = initFocusedRebalanceUi({ ...ctx, getTarget: () => rebalTarget,
    scopedEntries: scopedEntriesForRebalance, refreshLegacy: updateRebalancePreview, applyPool: applyPoolRebalance });
  document.getElementById('btn-auto-balance-cards')?.addEventListener('click', () => openRebalanceModal('cards'));
  document.getElementById('btn-auto-balance-items')?.addEventListener('click', () => openRebalanceModal('items'));
  document.getElementById('rebal-target-cards')?.addEventListener('click', () => setRebalanceTarget('cards'));
  document.getElementById('rebal-target-items')?.addEventListener('click', () => setRebalanceTarget('items'));
  document.getElementById('btn-rebal-defaults')?.addEventListener('click', () => { loadRebalanceDefaults(); focusedRebalanceUi.reset({ defaults: true }); });
  document.getElementById('btn-rebal-apply')?.addEventListener('click', focusedRebalanceUi.apply);
  document.getElementById('btn-rebal-export-json')?.addEventListener('click', () => {
    const entries = scopedEntriesForRebalance();
    const bundle = buildStudioBundle({
      name: `Rebalanced ${rebalTarget}`,
      cards: rebalTarget === 'cards' ? entries : null,
      items: rebalTarget === 'items' ? entries : null,
      customClasses: state.customClasses || [],
      customDecks: state.customDecks || [],
    });
    downloadJsonFile(`ashenspire-${rebalTarget}-list.json`, bundle);
    toast(`Exported ${entries.length} ${rebalTarget} as JSON`);
  });
  document.getElementById('btn-rebal-save-repo')?.addEventListener('click', () => saveBundleToRepo(currentBundle('Rebalanced Studio Bundle')));
  wireFileLoadInput('input-rebal-load-json');

  for (const id of [
    'rebal-scope', 'rebal-mode', 'rebal-count', 'rebal-seed',
    'rebal-rank-0', 'rebal-rank-1', 'rebal-rank-2', 'rebal-rank-3', 'rebal-rank-4', 'rebal-rank-5',
    'rebal-rar-common', 'rebal-rar-uncommon', 'rebal-rar-rare', 'rebal-rar-boss',
    'rebal-aim-max', 'rebal-naming', 'rebal-gen-shortage', 'rebal-trim-surplus',
  ]) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener('input', () => {
      if (id === 'rebal-scope') {
        const scoped = scopedEntriesForRebalance();
        if (scoped.length) document.getElementById('rebal-count').value = String(scoped.length);
      }
      updateRebalancePreview();
    });
    el.addEventListener('change', () => {
      if (id === 'rebal-scope') {
        const scoped = scopedEntriesForRebalance();
        if (scoped.length) document.getElementById('rebal-count').value = String(scoped.length);
      }
      updateRebalancePreview();
    });
  }

  document.getElementById('btn-batch-generate-cards')?.addEventListener('click', () => openGenerateModal('cards'));
  document.getElementById('btn-batch-generate-items')?.addEventListener('click', () => openGenerateModal('items'));
  document.getElementById('gen-target-cards')?.addEventListener('click', () => setGeneratorTarget('cards'));
  document.getElementById('gen-target-items')?.addEventListener('click', () => setGeneratorTarget('items'));
  document.getElementById('btn-gen-run')?.addEventListener('click', runBatchGenerate);

  document.getElementById('btn-custom-decks')?.addEventListener('click', openDecksModal);
  document.getElementById('btn-create-class')?.addEventListener('click', () => {
    const name = document.getElementById('new-class-name').value.trim();
    if (!name) { toast('Enter a class name first.'); return; }
    pushHistory();
    const existing = new Set([...BUILTIN_CLASSES, ...(state.customClasses || []).map((c) => c.id)]);
    const cls = createCustomClass({
      name,
      maxHp: Number(document.getElementById('new-class-hp').value) || 76,
      tint: document.getElementById('new-class-tint').value || '#7aa2f7',
      description: document.getElementById('new-class-desc').value.trim(),
    }, existing);
    state.customClasses.push(cls);
    document.getElementById('new-class-name').value = '';
    document.getElementById('new-class-desc').value = '';
    syncAllViews();
    renderDecksModal();
    saveDraft({ autoName: false });
    toast(`Created custom class "${cls.name}"`);
  });

  document.getElementById('btn-create-deck')?.addEventListener('click', () => {
    const name = document.getElementById('new-deck-name').value.trim();
    if (!name) { toast('Enter a deck name first.'); return; }
    pushHistory();
    const assignedClassId = document.getElementById('new-deck-class').value || null;
    const fromFilter = document.getElementById('new-deck-from-filter').checked;
    const setActive = document.getElementById('new-deck-set-active').checked;
    const existing = new Set((state.customDecks || []).map((d) => d.id));
    const deck = createCustomDeck({
      name,
      assignedClassId,
      isActiveDeckList: setActive,
      cardIds: fromFilter ? getFilteredCards().map((c) => c.id) : [],
      itemKeys: [],
    }, existing);
    state.customDecks.push(deck);
    if (setActive) state.customDecks = setActiveDeckList(state.customDecks, deck.id);
    if (assignedClassId) {
      const assigned = assignDeckToClass(state.customDecks, state.customClasses, deck.id, assignedClassId);
      state.customDecks = assigned.customDecks;
      state.customClasses = assigned.customClasses;
    }
    document.getElementById('new-deck-name').value = '';
    if (setActive) {
      const filterEl = document.getElementById('filter-deck');
      populateDeckAndClassDropdowns();
      if (filterEl) filterEl.value = deck.id;
    }
    syncAllViews();
    renderDecksModal();
    saveDraft({ autoName: false });
    toast(`Created deck "${deck.name}" (${deck.cardIds.length} cards)`);
  });

  document.getElementById('custom-classes-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del-class]');
    if (!btn) return;
    const cid = btn.dataset.delClass;
    pushHistory();
    state.customClasses = state.customClasses.filter((c) => c.id !== cid);
    state.customDecks = state.customDecks.map((d) => (d.assignedClassId === cid ? { ...d, assignedClassId: null } : d));
    syncAllViews();
    renderDecksModal();
    saveDraft({ autoName: false });
    toast(`Deleted custom class ${cid}`);
  });

  document.getElementById('custom-decks-list')?.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-assign-deck]');
    if (!sel) return;
    if (!writableDeck(sel.dataset.assignDeck)) { renderDecksModal(); return; }
    pushHistory();
    const res = assignDeckToClass(state.customDecks, state.customClasses, sel.dataset.assignDeck, sel.value || null);
    state.customDecks = res.customDecks;
    state.customClasses = res.customClasses;
    syncAllViews();
    renderDecksModal();
    saveDraft({ autoName: false });
    toast(sel.value ? `Assigned deck to ${sel.value}` : 'Unassigned deck from class');
  });

  document.getElementById('custom-decks-list')?.addEventListener('click', (e) => {
    const activeBtn = e.target.closest('[data-active-deck]');
    if (activeBtn) {
      const did = activeBtn.dataset.activeDeck;
      const deck = state.customDecks.find((d) => d.id === did);
      if (!deck) return;
      pushHistory();
      const nextId = deck.isActiveDeckList ? null : did;
      state.customDecks = setActiveDeckList(state.customDecks, nextId);
      populateDeckAndClassDropdowns();
      const filterEl = document.getElementById('filter-deck');
      if (filterEl) filterEl.value = nextId || 'all';
      syncAllViews();
      renderDecksModal();
      saveDraft({ autoName: false });
      toast(nextId ? `Active deck list set to "${deck.name}"` : 'Cleared active deck list');
      return;
    }
    const addBtn = e.target.closest('[data-add-selected]');
    if (addBtn) {
      const deck = writableDeck(addBtn.dataset.addSelected);
      if (!deck) return;
      pushHistory();
      const added = [];
      if (state.selectedCardId && !deck.cardIds.includes(state.selectedCardId)) { deck.cardIds.push(state.selectedCardId); added.push('card'); }
      if (state.selectedItemKey && !deck.itemKeys.includes(state.selectedItemKey)) { deck.itemKeys.push(state.selectedItemKey); added.push('item'); }
      syncAllViews();
      renderDecksModal();
      saveDraft({ autoName: false });
      toast(added.length ? `Added selected ${added.join(' & ')} to "${deck.name}"` : `Selected card & item are already in "${deck.name}"`);
      return;
    }
    const expBtn = e.target.closest('[data-export-deck]');
    if (expBtn) {
      const deck = state.customDecks.find((d) => d.id === expBtn.dataset.exportDeck);
      if (!deck) return;
      const cardSet = new Set(deck.cardIds);
      const itemSet = new Set(deck.itemKeys);
      const bundle = buildStudioBundle({
        name: deck.name,
        cards: state.cards.filter((c) => cardSet.has(c.id)),
        items: state.items.filter((i) => itemSet.has(i.key)),
        customClasses: deck.assignedClassId ? state.customClasses.filter((c) => c.id === deck.assignedClassId) : [],
        customDecks: [deck],
      });
      downloadJsonFile(`deck-${deck.id}.json`, bundle);
      toast(`Exported "${deck.name}" as JSON`);
      return;
    }
    const delBtn = e.target.closest('[data-del-deck]');
    if (delBtn) {
      const did = delBtn.dataset.delDeck;
      if (!writableDeck(did)) return;
      pushHistory();
      state.customDecks = state.customDecks.filter((d) => d.id !== did);
      state.customClasses = state.customClasses.map((c) => (c.deckId === did ? { ...c, deckId: null } : c));
      populateDeckAndClassDropdowns();
      syncAllViews();
      renderDecksModal();
      saveDraft({ autoName: false });
      toast('Deleted custom deck');
    }
  });

  document.getElementById('btn-decks-export-json')?.addEventListener('click', () => {
    downloadJsonFile('ashenspire-studio-bundle.json', currentBundle('Score Studio Full Bundle'));
    toast('Exported full Studio bundle JSON');
  });
  document.getElementById('btn-decks-save-repo')?.addEventListener('click', () => saveBundleToRepo(currentBundle('Score Studio Decks & Lists')));
  wireFileLoadInput('input-decks-load-json');

  for (const [id, context] of [['filter-deck', 'cards'], ['filter-item-deck', 'items']]) {
    const select = document.getElementById(id);
    select?.addEventListener('focus', () => { if (select.value !== '__manage__') select.dataset.previousDeckValue = select.value; });
    select?.addEventListener('change', () => {
      if (select.value === '__manage__') {
        const previous = select.dataset.previousDeckValue;
        const restored = [...select.options].some(option => option.value === previous && previous !== '__manage__') ? previous : 'all';
        select.value = restored;
        ctx.onDeckFilterChange?.({ context, id: restored, manage: true });
        return;
      }
      select.dataset.previousDeckValue = select.value;
      if (context === 'items') ctx.renderItemsGrid?.(); else ctx.renderCardsGrid?.();
      ctx.onDeckFilterChange?.({ context, id: select.value });
    });
  }

  return { populateDeckAndClassDropdowns, renderDecksModal, openDecksModal, openBalanceSelection, openBalanceItems };
}
