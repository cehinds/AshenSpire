// Subclass list authoring uses the same generated definitions for preview, editing and game export.
import { SUBCLASS_CATALOG, GenerateSubclassCatalog, RefreshSubclassCard } from '../../src/model/subclassCardGenerator.js';
import { ValidateSubclassCatalog, SerializeSubclassCatalog } from '../../src/model/subclassCatalogExport.js';
import { CardDefinitionToScoreFace } from '../../src/model/cardUpgradeCp.js';
import { ScoreCard, CombatPower, RankOf } from '../../src/model/combatPower.js';

const clone = value => structuredClone(value);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const DECK_PREFIX = 'subclass-list.';
const CARD_STUDIO_FIELDS = new Set(['face', 'scoringOverride', 'kindIds', 'cardRatingValues']);
const errorSummary = errors => errors.slice(0, 3).join(' ') + (errors.length > 3 ? ` (${errors.length - 3} more validation errors.)` : '');

function metadataForState(state) {
  const rows = new Map((state.customDecks || []).flatMap(deck => Array.isArray(deck.subclassMetadata) ? deck.subclassMetadata : []).map(row => [row.cardId, row]));
  for (const row of state.subclassCatalog?.metadata || []) rows.set(row.cardId, row);
  return [...rows.values()];
}

export function cleanSubclassCard(card) {
  const clean = Object.fromEntries(Object.entries(clone(card)).filter(([key]) => !key.startsWith('_') && !CARD_STUDIO_FIELDS.has(key)));
  if (clean.upgrade && typeof clean.upgrade === 'object') clean.upgrade = cleanSubclassCard(clean.upgrade);
  return clean;
}

/** Deck metadata also survives the existing full Studio bundle round trip. */
export function subclassListsForState(state) {
  const lists = new Map((state.subclassCatalog?.lists || []).map(list => [list.id, clone(list)]));
  // Exported cards are ordinary Core registry entries on the next page load.
  for (const style of SUBCLASS_CATALOG) {
    if (lists.has(style.id)) continue;
    const cardIds = (state.cards || []).filter(card => card.id?.startsWith(`subclass.${style.id}.`) && card.class === style.classId).map(card => card.id);
    if (cardIds.length) lists.set(style.id, { id: style.id, classId: style.classId, name: style.name, cardIds });
  }
  for (const deck of state.customDecks || []) {
    if (!deck.id?.startsWith(DECK_PREFIX)) continue;
    const id = deck.id.slice(DECK_PREFIX.length);
    const style = SUBCLASS_CATALOG.find(row => row.id === id);
    if (!style) continue;
    lists.set(id, { id, classId: style.classId, name: style.name, cardIds: [...(deck.cardIds || [])] });
  }
  return [...lists.values()];
}

/** Always export the current edited cards. Missing list members are errors, never silently dropped. */
export function currentSubclassCatalog(state, subclassIds = null) {
  const allowed = subclassIds ? new Set(subclassIds) : null;
  const lists = subclassListsForState(state).filter(list => !allowed || allowed.has(list.id));
  if (!lists.length) throw new Error('Generate or import a subclass list first.');
  const cardsById = new Map((state.cards || []).map(card => [card.id, card]));
  const ids = [...new Set(lists.flatMap(list => list.cardIds))];
  const missing = ids.filter(id => !cardsById.has(id));
  if (missing.length) throw new Error(`List cards are missing: ${missing.slice(0, 3).join(', ')}. Restore the cards before exporting.`);
  const seed = state.subclassCatalog?.seed ?? (state.customDecks || []).find(deck => deck.id?.startsWith(DECK_PREFIX))?.subclassSeed ?? 'subclasses';
  const catalog = { formatVersion: 1, kind: 'ashenspire.subclassCatalog', seed, cards: ids.map(id => cleanSubclassCard(RefreshSubclassCard(cardsById.get(id), { scoring: state.scoring, rebuildText: false }))), lists };
  const priorMetadata = new Map(metadataForState(state).map(row => [row.cardId, row]));
  catalog.metadata = catalog.cards.map(card => {
    const prior = priorMetadata.get(card.id) || {};
    const raw = ScoreCard(CardDefinitionToScoreFace(card, { scoring: state.scoring }), state.scoring).raw;
    const cp = CombatPower(raw, card.rarity, state.scoring);
    const { signatureUpgrade: previousSignature, ...notes } = clone(prior);
    const after = card.upgrade ? { ...card, ...card.upgrade } : null;
    const upgradedRaw = after ? ScoreCard(CardDefinitionToScoreFace(after, { scoring: state.scoring }), state.scoring).raw : null;
    const upgradedCp = after ? CombatPower(upgradedRaw, after.rarity, state.scoring) : null;
    return { ...notes, cardId: card.id, projectedRaw: raw, projectedCp: cp, projectedRank: RankOf(cp, state.scoring), ...(after ? { signatureUpgrade: { projectedRaw: upgradedRaw, projectedCp: upgradedCp, projectedRank: RankOf(upgradedCp, state.scoring) } } : {}), ...(Number.isFinite(prior.targetCp) ? { miss: cp !== prior.targetCp } : {}) };
  });
  catalog.summary = { cardCount: catalog.cards.length, subclassCount: lists.length, scoring: 'Uses the card renderer static mechanical baseline. Conditional and next-card effects use estimated reliability.', missCount: catalog.metadata.filter(row => row.miss).length };
  const errors = ValidateSubclassCatalog(catalog);
  if (errors.length) throw new Error(errorSummary(errors));
  return catalog;
}

/** Validate completely before changing cards or lists, preserving unrelated authored content. */
export function mergeSubclassCatalog(state, catalog, { replace = false, normalize = value => value } = {}) {
  const errors = ValidateSubclassCatalog(catalog);
  if (errors.length) throw new Error(errorSummary(errors));
  const owned = new Set(subclassListsForState(state).flatMap(list => list.cardIds));
  const existing = new Map((state.cards || []).map(card => [card.id, card]));
  for (const card of catalog.cards) {
    if (!existing.has(card.id)) continue;
    if (!owned.has(card.id)) throw new Error(`Card ${card.id} already exists outside these subclass lists. It will not be replaced.`);
    if (!replace) throw new Error('These lists already contain cards. Select “Replace cards already in these lists” to regenerate or import over them.');
  }
  const cards = catalog.cards.map(card => normalize({ ...cleanSubclassCard(card), _custom: true, _generated: true, _autoName: false }));
  const incomingIds = new Set(cards.map(card => card.id));
  const incomingLists = new Set(catalog.lists.map(list => list.id));
  const lists = [...subclassListsForState(state).filter(list => !incomingLists.has(list.id)), ...clone(catalog.lists)];
  const metadata = [...metadataForState(state).filter(row => !incomingIds.has(row.cardId)), ...(Array.isArray(catalog.metadata) ? clone(catalog.metadata) : [])];
  const decks = (state.customDecks || []).filter(deck => !catalog.lists.some(list => deck.id === DECK_PREFIX + list.id));
  for (const list of catalog.lists) decks.push({
    id: DECK_PREFIX + list.id, name: list.name, assignedClassId: list.classId,
    isActiveDeckList: false, cardIds: [...list.cardIds], itemKeys: [],
    notes: SUBCLASS_CATALOG.find(style => style.id === list.id)?.description || '', subclassSeed: catalog.seed,
    subclassMetadata: metadata.filter(row => list.cardIds.includes(row.cardId)),
  });
  return {
    cards: [...cards, ...(state.cards || []).filter(card => !incomingIds.has(card.id))],
    customDecks: decks,
    subclassCatalog: { formatVersion: 1, kind: catalog.kind, seed: catalog.seed, lists, metadata },
    selectedCardId: cards[0]?.id ?? state.selectedCardId,
  };
}

export function upgradeNames(card) {
  const names = { dmg: 'Damage', blk: 'Block', poise: 'Poise damage', stk: 'Status strength', addStatus: 'Add status', cost: 'Efficient', hits: 'Extra hit', element: 'Element', range: 'Reach', targeting: 'Targets', maneuver: 'Stance', school: 'School', 'fx:heal': 'Purified: healing', 'fx:cleanse': 'Purified: cleanse', 'fx:unexhaust': 'Refined: remove Exhaust', 'fx:unethereal': 'Refined: remove Ethereal', 'fx:steady': 'Refined: steady', 'fx:block': 'Tempered: Block', 'fx:counter': 'Tempered: Counter' };
  return [...(card.upgrade ? ['Signature upgrade'] : []), ...(card.upgradeMenu || []).map(kind => names[kind] || String(kind).replace(/^fx:/, '').replace(/([a-z])([A-Z])/g, '$1 $2'))];
}

function downloadCatalog(catalog) {
  const url = URL.createObjectURL(new Blob([SerializeSubclassCatalog(catalog)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'ashenspire-subclass-catalog.json' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initSubclassCatalogUi(ctx) {
  const { state, isLocalServer, pushHistory, saveDraft, syncAllViews, toast, normalizeStudioCard, studioCardOverrides } = ctx;
  const el = id => document.getElementById(id);
  const dialog = el('subclass-catalog-modal');
  // Persist/reconstruct lists from existing full Studio bundles and exported game cards.
  for (const list of subclassListsForState(state)) {
    if (!(state.customDecks || []).some(deck => deck.id === DECK_PREFIX + list.id)) state.customDecks.push({ id: DECK_PREFIX + list.id, name: list.name, assignedClassId: list.classId, isActiveDeckList: false, cardIds: [...list.cardIds], itemKeys: [] });
  }
  let preview = null;
  let busy = false;
  const selectedIds = () => SUBCLASS_CATALOG.filter(style => (el('subclass-class').value === 'all' || style.classId === el('subclass-class').value)
    && (el('subclass-style').value === 'all' || style.id === el('subclass-style').value)).map(style => style.id);
  const status = (text, error = false) => {
    el('subclass-status').textContent = text;
    el('subclass-status').classList.toggle('is-error', error);
  };

  function populateStyles() {
    const value = el('subclass-style').value;
    const styles = SUBCLASS_CATALOG.filter(style => el('subclass-class').value === 'all' || style.classId === el('subclass-class').value);
    el('subclass-style').innerHTML = '<option value="all">All subclasses</option>' + styles.map(style => `<option value="${esc(style.id)}">${esc(style.name)}</option>`).join('');
    if (styles.some(style => style.id === value)) el('subclass-style').value = value;
  }

  function render() {
    const ids = new Set(selectedIds());
    const styles = SUBCLASS_CATALOG.filter(style => ids.has(style.id));
    const lists = preview?.lists || subclassListsForState(state);
    const cards = new Map((preview?.cards || state.cards).map(card => [card.id, card]));
    const metadata = new Map((preview?.metadata || metadataForState(state)).map(row => [row.cardId, row]));
    const listedIds = new Set(lists.filter(list => ids.has(list.id)).flatMap(list => list.cardIds));
    const shownMetadata = [...metadata.values()].filter(row => listedIds.has(row.cardId));
    const misses = shownMetadata.filter(row => {
      const card = cards.get(row.cardId);
      return card && Number.isFinite(row.targetCp) && CombatPower(ScoreCard(CardDefinitionToScoreFace(card, { scoring: state.scoring }), state.scoring).raw, card.rarity, state.scoring) !== row.targetCp;
    }).length;
    const adapted = shownMetadata.filter(row => row.adaptations?.length).length;
    el('subclass-score-note').textContent = `Scores estimate conditional and next-card effects.${shownMetadata.length ? ` ${misses} cards differ from target power; ${adapted} have rules adjustments.` : ''} Expand a list to review its cards and upgrade choices.`;
    el('subclass-count').textContent = `${styles.length} subclass list${styles.length === 1 ? '' : 's'} · ${styles.length * 15} cards to generate`;
    el('subclass-preview').innerHTML = `<table><caption>${preview ? 'Generated preview — not added yet' : 'Subclass lists'}</caption><thead><tr><th scope="col">Subclass</th><th scope="col">Class</th><th scope="col">Cards and upgrades</th></tr></thead><tbody>${styles.map(style => {
      const list = lists.find(row => row.id === style.id);
      const members = list?.cardIds || [];
      const missing = members.filter(id => !cards.has(id));
      const detail = members.length ? `<details><summary>${members.length} cards${missing.length ? ` · ${missing.length} missing` : ''}</summary><ol>${members.map(id => {
        const card = cards.get(id);
        const adaptations = metadata.get(id)?.adaptations || [];
        const meta = metadata.get(id);
        const raw = card ? ScoreCard(CardDefinitionToScoreFace(card, { scoring: state.scoring }), state.scoring).raw : 0;
        const cp = card ? CombatPower(raw, card.rarity, state.scoring) : 0;
        const scoreText = card ? `Projected CP ${cp} · Rank ${RankOf(cp, state.scoring)}${Number.isFinite(meta?.targetCp) ? ` · Target CP ${meta.targetCp}${meta.targetCp !== cp ? ' (miss)' : ''}` : ''}` : '';
        return `<li>${card ? `<strong>${esc(card.name)}</strong><span class="subclass-card-rules">${esc(scoreText)}</span><span class="subclass-card-rules">${esc(card.textTemplate || '')}</span><span class="subclass-card-upgrades">Upgrades: ${esc(upgradeNames(card).join(', ') || 'None')}</span>${adaptations.length ? `<span class="subclass-card-rules">${esc(adaptations.join(' '))}</span>` : ''}` : `<strong>Missing: ${esc(id)}</strong>`}</li>`;
      }).join('')}</ol></details>` : 'Not generated';
      return `<tr><th scope="row">${esc(style.name)}<span class="subclass-style-description">${esc(style.description || '')}</span></th><td>${esc(style.classId)}</td><td>${detail}${!preview && list ? `<button class="s-btn" type="button" data-open-subclass="${esc(style.id)}">View cards</button>` : ''}</td></tr>`;
    }).join('')}</tbody></table>`;
    const hasLists = subclassListsForState(state).some(list => ids.has(list.id));
    el('btn-subclass-download').disabled = busy || !hasLists;
    el('btn-subclass-export').disabled = busy || !hasLists || !isLocalServer;
    el('btn-subclass-generate').disabled = busy;
    el('btn-subclass-preview').disabled = busy;
  }

  function generate() {
    const ids = selectedIds();
    if (!ids.length) throw new Error('Select at least one subclass.');
    const rankText = el('subclass-rank').value;
    return GenerateSubclassCatalog({ subclassIds: ids, seed: el('subclass-seed').value.trim() || 'subclasses', ...(rankText ? { rank: Number(rankText) } : {}) }, { scoring: state.scoring });
  }

  function apply(catalog) {
    const next = mergeSubclassCatalog(state, catalog, { replace: el('subclass-replace').checked, normalize: normalizeStudioCard });
    pushHistory();
    Object.assign(state, next);
    studioCardOverrides.clear();
    preview = null;
    syncAllViews();
    saveDraft({ autoName: false });
    render();
    status(`Added ${catalog.cards.length} cards in ${catalog.lists.length} subclass lists. Review or edit them in the gallery before exporting.`);
    toast(`Added ${catalog.lists.length} subclass lists`);
  }

  async function run(button, action) {
    if (busy) return;
    busy = true;
    const label = button.textContent;
    button.textContent = 'Working…';
    status('Preparing subclass lists…');
    render();
    // Leave a paint before scoring a complete set of lists.
    await new Promise(resolve => setTimeout(resolve, 30));
    try { await action(); } catch (error) { status(error.message, true); }
    finally { busy = false; button.textContent = label; render(); }
  }

  el('btn-subclass-lists').addEventListener('click', () => {
    preview = null;
    populateStyles();
    render();
    status(isLocalServer ? 'Generate lists, review their cards, then export them into this local game.' : 'Generate and edit here, then download the catalog. Open it in a local Score Studio to export into the game.');
    dialog.showModal();
  });
  for (const id of ['subclass-class', 'subclass-style', 'subclass-rank', 'subclass-seed']) el(id).addEventListener('change', () => {
    preview = null;
    if (id === 'subclass-class') populateStyles();
    render();
  });
  el('btn-subclass-preview').addEventListener('click', event => run(event.currentTarget, () => {
    preview = generate();
    status(`Preview ready: ${preview.cards.length} cards. Generate to add them to your editable lists.`);
  }));
  el('btn-subclass-generate').addEventListener('click', event => run(event.currentTarget, () => apply(preview || generate())));
  el('btn-subclass-download').addEventListener('click', () => {
    try {
      const catalog = currentSubclassCatalog(state, selectedIds());
      downloadCatalog(catalog);
      status(`Downloaded ${catalog.cards.length} current card definitions and their upgrade choices.`);
    } catch (error) { status(error.message, true); }
  });
  el('input-subclass-catalog').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await run(el('btn-subclass-generate'), async () => {
      const catalog = JSON.parse(await file.text());
      apply(catalog);
    });
  });
  el('btn-subclass-export').hidden = !isLocalServer;
  el('btn-subclass-export').addEventListener('click', event => run(event.currentTarget, async () => {
    const catalog = currentSubclassCatalog(state, selectedIds());
    const response = await fetch('/__studio/subclass-catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalog, rebuild: true }) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Game export failed.');
    status(`Exported ${result.cardCount ?? catalog.cards.length} cards in ${result.listCount ?? catalog.lists.length} lists into the game. Reload the game to use the rebuilt content.`);
    toast('Subclass lists exported into the game');
  }));
  el('subclass-preview').addEventListener('click', event => {
    const button = event.target.closest('[data-open-subclass]');
    if (!button) return;
    const list = subclassListsForState(state).find(row => row.id === button.dataset.openSubclass);
    if (!list) return;
    for (const id of ['filter-type', 'filter-class', 'filter-rank', 'filter-shift']) el(id).value = 'all';
    el('card-search').value = '';
    state.selectedCardId = list.cardIds[0];
    syncAllViews();
    el('filter-deck').value = DECK_PREFIX + list.id;
    syncAllViews();
    dialog.close();
  });
  populateStyles();
  return { refresh() { if (dialog.open && !busy) render(); } };
}
