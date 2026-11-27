// One customization pane and one copy of every form. Switching galleries or
// docking reparents live DOM nodes, preserving inputs, listeners and selection.
export const CARD_EDITOR_DOCK_KEY = 'ashenspire:scoreStudioEditorDocked:v1';
const VIEW_KEY = 'ashenspire:scoreStudioCustomizationView:v1';
const PREVIEW_KEY = 'ashenspire:scoreStudioEntityPreview:v1';
const VIEWS = ['properties', 'design', 'weights', 'decks'];
// What an edit in each view reaches: the selected card only, shared art rules,
// global scoring or one deck's membership.
const VIEW_SCOPES = { properties: 'card', design: 'shared', weights: 'global', decks: 'deck' };
const SCOPE_TEXT = {
  properties: (noun, name) => `Selected ${noun} · edits change only ${name}`,
  design: (noun, name) => `Shared art layers · rules apply to every matching card. Preview: ${name}`,
  weights: (noun, name) => `Global scoring · changes rescore every card. Preview: ${name}`,
  decks: (noun, name) => `Deck membership · changes only the chosen deck. Preview: ${name}`,
};

export function initCardEditorDock(ctx) {
  const doc = ctx.document || document;
  const properties = { cards: doc.getElementById('card-inspector'), items: doc.getElementById('item-inspector-pane') };
  if (!properties.cards) throw new Error('Customization requires #card-inspector');
  const homes = new Map(), layouts = {};
  function rememberHome(node) {
    if (!node || homes.has(node)) return;
    const placeholder = doc.createElement('span'); placeholder.hidden = true;
    placeholder.setAttribute('data-customization-home', node.id || 'view');
    node.replaceWith(placeholder); placeholder.after(node);
    homes.set(node, placeholder);
  }
  for (const [key, node] of Object.entries(properties)) if (node) {
    layouts[key] = node.closest('.cards-layout'); rememberHome(node);
  }
  let storage = ctx.storage;
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
  let docked = true, view = 'properties', context = 'cards', returnTarget = null;
  try { docked = storage?.getItem(CARD_EDITOR_DOCK_KEY) !== 'false'; view = storage?.getItem(VIEW_KEY) || view; } catch { /* Optional persistence. */ }
  if (!VIEWS.includes(view)) view = 'properties';
  const button = (label, action, className = 's-btn') => {
    const node = doc.createElement('button'); node.type = 'button'; node.className = className; node.textContent = label;
    node.addEventListener('click', action); return node;
  };
  const selectedId = kind => kind === 'items' ? ctx.getSelectedItemId?.() ?? ctx.state?.selectedItemKey : ctx.getSelectedId?.() ?? ctx.state?.selectedCardId;
  // A selection is valid only while its definition still exists; card actions
  // read it at click time so they never act on a stale or different entity.
  const isValid = kind => {
    const id = selectedId(kind);
    if (!id) return false;
    if (kind === 'items') return ctx.getSelectedItemName ? ctx.getSelectedItemName(id) !== undefined : true;
    return ctx.state?.cards ? ctx.state.cards.some(card => card.id === id) : true;
  };
  const nameOf = kind => kind === 'cards' ? ctx.state?.cards?.find(card => card.id === selectedId(kind))?.name : ctx.getSelectedItemName?.(selectedId(kind));
  const selectedName = () => nameOf(context);
  const pane = doc.createElement('aside'); pane.id = 'studio-customization-pane'; pane.className = 'studio-customization-pane';
  pane.setAttribute('aria-label', 'Customization');
  const toolbar = doc.createElement('div'); toolbar.className = 'customization-toolbar';
  const label = doc.createElement('label'); label.setAttribute('for', 'customization-view'); label.textContent = 'Customize';
  const select = doc.createElement('select'); select.id = 'customization-view'; select.setAttribute('aria-label', 'Customization view');
  for (const [value, text] of [['properties', 'Properties'], ['design', 'Design'], ['weights', 'Weights'], ['decks', 'Deck lists']]) {
    const option = doc.createElement('option'); option.value = value; option.setAttribute('value', value); option.textContent = text; select.append(option);
  }
  // One active entity for every view: its name, an honest scope line and the
  // one native preview, moved here from the inspector rather than cloned.
  const entity = doc.createElement('section'); entity.id = 'customization-entity'; entity.className = 'customization-entity';
  entity.setAttribute('role', 'region'); entity.setAttribute('aria-label', 'Active card');
  // The name bar is the preview's disclosure button: click the card name to collapse or expand it.
  const entityHeading = doc.createElement('h2'); entityHeading.className = 'customization-entity-heading';
  const entityName = doc.createElement('button'); entityName.type = 'button'; entityName.id = 'customization-entity-name'; entityName.className = 'customization-entity-name';
  // Name on the left; the card's rank, rarity and CP sit on the right of the same banner.
  const entityNameText = doc.createElement('span'); entityNameText.className = 'customization-entity-name-text';
  entityName.append(entityNameText); entityHeading.append(entityName);
  const scope = doc.createElement('p'); scope.id = 'customization-scope'; scope.className = 'customization-scope';
  const previewSlot = doc.createElement('div'); previewSlot.id = 'customization-entity-preview'; previewSlot.className = 'customization-entity-preview';
  const previews = { cards: properties.cards.querySelector('.inspector-preview-wrap'), items: properties.items?.querySelector('#item-preview-host') || null };
  for (const node of Object.values(previews)) if (node) { rememberHome(node); previewSlot.append(node); }
  // Preview state is view state only: whether it is collapsed.
  let previewPrefs = { collapsed: false };
  try {
    const saved = JSON.parse(storage?.getItem(PREVIEW_KEY) || '{}');
    previewPrefs = { collapsed: !!(saved.collapsed ?? saved.hidden) };
  } catch { /* Optional persistence. */ }
  const savePreviewPrefs = () => {
    const { collapsed } = previewPrefs;
    try { storage?.setItem(PREVIEW_KEY, JSON.stringify({ collapsed })); } catch { /* Optional persistence. */ }
  };
  const previewBody = doc.createElement('div'); previewBody.className = 'customization-preview-body';
  previewBody.append(previewSlot);
  // The card is as tall as the fields beside it (2:3, never stretched), so the section needs no scroll bar.
  function fitCardToFields() {
    const height = quickFieldsShown() ? Math.round(quick.getBoundingClientRect().height) : 0;
    if (height > 0) { previewBody.style.setProperty('--entity-card-h', `${height}px`); previewBody.dataset.fit = 'fields'; }
    else { previewBody.style.removeProperty('--entity-card-h'); delete previewBody.dataset.fit; }
  }
  const fieldsObserver = typeof (doc.defaultView || globalThis).ResizeObserver === 'function'
    ? new (doc.defaultView || globalThis).ResizeObserver(() => fitCardToFields()) : null;
  function setPreviewCollapsed(value) {
    previewPrefs.collapsed = !!value; savePreviewPrefs();
    previewBody.hidden = previewPrefs.collapsed;
    entityName.setAttribute('aria-expanded', String(!previewPrefs.collapsed));
    entity.dataset.previewCollapsed = String(previewPrefs.collapsed);
    placeQuickFields();
  }
  entityName.setAttribute('aria-controls', previewSlot.id);
  entityName.addEventListener('click', () => setPreviewCollapsed(!previewPrefs.collapsed));
  // Card basics beside the card: the live Name, Card Type, Rarity, SP and MP fields move next to CP while the
  // preview is open in Properties, and go back to Card Basics otherwise. Moved, never cloned.
  const quickFields = ['edit-name', 'edit-type', 'edit-rarity', 'edit-sp', 'edit-mp']
    .map(id => doc.getElementById(id)?.closest('.form-wide, label, .studio-field')).filter(Boolean);
  for (const node of quickFields) rememberHome(node);
  const entityDetails = doc.createElement('div'); entityDetails.className = 'customization-entity-details';
  const quick = doc.createElement('div'); quick.className = 'form-grid customization-quick-fields'; quick.hidden = true;
  quick.setAttribute('role', 'group'); quick.setAttribute('aria-label', 'Card basics');
  const scoreSummary = previews.cards?.querySelector('#inspector-score-summary');
  if (scoreSummary) { scoreSummary.before(entityDetails); entityDetails.append(quick); rememberHome(scoreSummary); entityName.append(scoreSummary); }
  // Card options: a vertical ellipsis at the top right of the fields. The composition root supplies the actions.
  const cardMenuWrap = doc.createElement('div'); cardMenuWrap.className = 'studio-menu customization-card-menu-wrap';
  const cardMenuButton = button('\u22EE', () => (cardMenu.hidden ? openCardMenu() : closeCardMenu(true)), 's-btn s-btn-icon customization-card-menu-button');
  cardMenuButton.id = 'customization-card-menu-button'; cardMenuButton.setAttribute('aria-label', 'Card options');
  cardMenuButton.setAttribute('aria-haspopup', 'menu'); cardMenuButton.setAttribute('aria-expanded', 'false'); cardMenuButton.setAttribute('aria-controls', 'customization-card-menu');
  const cardMenu = doc.createElement('div'); cardMenu.id = 'customization-card-menu'; cardMenu.className = 'studio-menu-panel is-right customization-card-menu';
  cardMenu.setAttribute('role', 'menu'); cardMenu.setAttribute('aria-label', 'Card options'); cardMenu.hidden = true;
  cardMenuWrap.append(cardMenuButton, cardMenu); quick.append(cardMenuWrap);
  const menuItems = () => [...cardMenu.querySelectorAll('[role="menuitem"]:not([disabled])')];
  function openCardMenu() {
    cardMenu.replaceChildren();
    for (const action of ctx.getCardActions?.() || []) {
      if (action.separator) { const line = doc.createElement('div'); line.className = 'menu-sep'; line.setAttribute('role', 'separator'); cardMenu.append(line); continue; }
      const item = button(action.label, () => { closeCardMenu(false); action.run(); }, 'menu-item');
      item.setAttribute('role', 'menuitem'); item.disabled = action.enabled === false; if (action.hint) item.title = action.hint;
      cardMenu.append(item);
    }
    cardMenu.hidden = false; cardMenuButton.setAttribute('aria-expanded', 'true');
    menuItems()[0]?.focus?.();
  }
  function closeCardMenu(returnFocus) {
    if (cardMenu.hidden) return;
    cardMenu.hidden = true; cardMenuButton.setAttribute('aria-expanded', 'false');
    if (returnFocus) cardMenuButton.focus?.();
  }
  cardMenu.addEventListener('keydown', event => {
    const items = menuItems(), at = items.indexOf(doc.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); closeCardMenu(true); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); items[(at + 1) % items.length]?.focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); items[(at - 1 + items.length) % items.length]?.focus(); }
    else if (event.key === 'Tab') closeCardMenu(false);
  });
  doc.addEventListener('pointerdown', event => { if (!cardMenu.hidden && !cardMenuWrap.contains(event.target)) closeCardMenu(false); });
  const quickFieldsShown = () => !quick.hidden && !previewBody.hidden;
  function placeQuickFields() {
    const inHeader = !!scoreSummary && view === 'properties' && context === 'cards' && isValid('cards') && !previewPrefs.collapsed;
    for (const node of quickFields) {
      if (inHeader) { if (node.parentNode !== quick) quick.append(node); }
      else { const home = homes.get(node); if (home && home.nextSibling !== node) home.after(node); }
    }
    quick.hidden = !inHeader;
    fitCardToFields();
  }
  const entityHead = doc.createElement('div'); entityHead.className = 'customization-entity-head';
  entityHead.append(entityHeading);
  entity.append(entityHead, scope, previewBody);
  const content = doc.createElement('div'); content.id = 'customization-content';
  const slots = Object.fromEntries(VIEWS.map(id => {
    const slot = doc.createElement('div'); slot.className = 'customization-view'; slot.dataset.customizationView = id; content.append(slot); return [id, slot];
  }));
  const empty = doc.createElement('p'); empty.id = 'customization-empty'; empty.className = 'studio-muted customization-empty'; empty.hidden = true;
  slots.properties.append(empty);
  for (const node of Object.values(properties)) if (node) slots.properties.append(node);
  const attached = new Set();
  function attachViews() {
    const nodes = { design: ctx.views?.design || doc.getElementById('tab-art'), weights: ctx.views?.weights || doc.getElementById('tab-weights'), decks: ctx.views?.decks };
    for (const [id, candidate] of Object.entries(nodes)) {
      const node = typeof candidate === 'function' ? candidate() : candidate;
      if (!node || attached.has(node)) continue;
      rememberHome(node); slots[id].append(node); node.classList.add('customization-mounted-view'); attached.add(node);
    }
  }
  const toggles = [];
  const toggle = () => {
    const wasDocked = docked; setDocked(!docked);
    if (wasDocked) openModal();
  };
  const paneToggle = button('Undock', toggle); paneToggle.id = 'customization-dock-toggle'; toggles.push(paneToggle);
  toolbar.append(label, select, paneToggle); pane.append(toolbar, entity, content);
  for (const [key, layout] of Object.entries(layouts)) {
    const row = layout?.querySelector('.cards-gallery-pane .names-row') || layout?.querySelector('.cards-gallery-pane .filter-row');
    if (row) {
      const node = button('Undock editor', () => { setContext(key); toggle(); });
      node.id = key === 'cards' ? 'card-editor-gallery-toggle' : 'item-editor-gallery-toggle';
      node.setAttribute('aria-controls', 'studio-customization-pane'); row.append(node); toggles.push(node);
    }
  }
  // Narrow screens show the library or the editor, never both squeezed. The
  // panel is page state only; the active card is kept across switches.
  const narrowMedia = (ctx.matchMedia || (query => globalThis.matchMedia?.(query)))(ctx.narrowQuery || '(max-width: 900px)');
  let panel = 'library';
  const navs = [];
  for (const [key, layout] of Object.entries(layouts)) {
    if (!layout) continue;
    const nav = doc.createElement('nav'); nav.id = key === 'cards' ? 'customization-narrow-nav' : 'customization-narrow-nav-items';
    nav.className = 'customization-narrow-nav'; nav.setAttribute('aria-label', key === 'cards' ? 'Card workspace' : 'Item workspace');
    const library = button('Library', () => showLibrary(key), 's-btn customization-nav-library'); library.dataset.narrowPanel = 'library';
    const editor = button('', () => showEditor(key), 's-btn customization-nav-editor'); editor.dataset.narrowPanel = 'editor';
    editor.setAttribute('aria-controls', 'studio-customization-pane');
    nav.append(library, editor); layout.prepend(nav); navs.push({ key, library, editor });
  }

  const dialog = doc.createElement('dialog'); dialog.id = 'card-editor-modal'; dialog.className = 'card-editor-modal';
  dialog.setAttribute('aria-labelledby', 'card-editor-modal-title');
  const head = doc.createElement('header'); head.className = 'card-editor-modal-head';
  const title = doc.createElement('h2'); title.id = 'card-editor-modal-title';
  const actions = doc.createElement('div'); actions.className = 'card-editor-modal-actions';
  const actOnSelection = (cardAction, itemAction) => () => { if (isValid(context)) (context === 'items' ? itemAction : cardAction)?.(selectedId(context)); };
  const rename = button('Rename', actOnSelection(ctx.renameCard, ctx.renameItem)); rename.id = 'card-editor-rename';
  const balance = button('Rebalance power', actOnSelection(ctx.balanceCard, ctx.balanceItem)); balance.id = 'card-editor-balance';
  const modalDock = button('Dock', () => setDocked(true)); modalDock.id = 'card-editor-modal-dock';
  const closeButton = button('Close', close); closeButton.id = 'card-editor-modal-close';
  actions.append(rename, balance, modalDock, closeButton); head.append(title, actions);
  // The floating editor moves by its title bar.
  let dialogDrag = null;
  head.addEventListener('pointerdown', event => {
    if (event.target.closest?.('button, input, select, a')) return;
    const box = dialog.getBoundingClientRect(); dialogDrag = { dx: event.clientX - box.left, dy: event.clientY - box.top };
    head.setPointerCapture?.(event.pointerId); head.classList.add('is-dragging');
  });
  head.addEventListener('pointermove', event => {
    if (!dialogDrag) return;
    const win = doc.defaultView || globalThis, box = dialog.getBoundingClientRect();
    const left = Math.max(0, Math.min((win.innerWidth || 1280) - 80, event.clientX - dialogDrag.dx));
    const top = Math.max(0, Math.min((win.innerHeight || 800) - 40, event.clientY - dialogDrag.dy));
    dialog.style.margin = '0'; dialog.style.left = `${left}px`; dialog.style.top = `${top}px`;
    void box;
  });
  const endDialogDrag = () => { dialogDrag = null; head.classList.remove('is-dragging'); };
  head.addEventListener('pointerup', endDialogDrag); head.addEventListener('pointercancel', endDialogDrag);
  const modalBody = doc.createElement('div'); modalBody.className = 'card-editor-modal-body';
  dialog.append(head, modalBody); doc.body.append(dialog);

  function tileTarget(kind, id) {
    const grid = doc.getElementById(kind === 'items' ? 'items-grid' : 'cards-grid');
    const tile = [...(grid?.querySelectorAll(kind === 'items' ? '.item-grid-tile' : '.studio-card-tile') || [])].find(node => (node.dataset.itemKey || node.dataset.cardId) === id);
    // Item tiles are plain divs. Their Edit action is a real focusable button,
    // unlike the tile itself (whose focus() is ignored by native browsers).
    return kind === 'items' ? tile?.querySelector('.card-editor-edit-button') || tile : tile;
  }
  function focusReturn() {
    const kind = returnTarget?.kind || context, id = returnTarget?.id || selectedId(kind);
    tileTarget(kind, id)?.focus?.({ preventScroll: true });
  }
  function applyPanel() {
    const narrow = !!narrowMedia?.matches, editing = narrow && docked && panel === 'editor';
    doc.body.classList.toggle('customize-narrow', narrow);
    // The nav sticks just below the sticky Studio top bar.
    if (narrow) doc.body.style?.setProperty?.('--customization-nav-top', `${Math.round(doc.querySelector('.studio-topbar')?.getBoundingClientRect?.().height || 0)}px`);
    doc.body.classList.toggle('customize-panel-editor', editing);
    for (const nav of navs) {
      nav.library.setAttribute('aria-pressed', String(!editing));
      nav.editor.setAttribute('aria-pressed', String(editing));
    }
  }
  function setPanel(value) {
    if (!['library', 'editor'].includes(value)) return;
    // The panel choice only means something in the docked narrow layout; a
    // desktop or floating Edit must not decide where a later narrow view opens.
    if (value === 'editor' && !(narrowMedia?.matches && docked)) return;
    panel = value; applyPanel();
  }
  function showEditor(kind) {
    setContext(kind);
    if (!docked) { openModal(); return; }
    setPanel('editor');
    pane.scrollIntoView?.({ block: 'start' });
    entityName.focus?.({ preventScroll: true });
  }
  // Back to the library, with the active card in view and focused.
  function showLibrary(kind) {
    setPanel('library');
    const target = tileTarget(kind, selectedId(kind));
    target?.scrollIntoView?.({ block: 'center' });
    target?.focus?.({ preventScroll: true });
  }
  function dockPane() {
    const home = homes.get(properties[context]);
    if (home) { pane.remove(); home.after(pane); }
  }
  function close() {
    if (dialog.open) dialog.close();
    if (docked) dockPane();
    doc.body.classList.remove('card-editor-modal-open'); focusReturn();
  }
  function openModal() {
    if (docked) setDocked(false);
    returnTarget = { kind: context, id: selectedId(context) };
    doc.body.classList.remove('inspector-open', 'item-inspector-open');
    modalBody.append(pane);
    if (!dialog.open) dialog.showModal();
    doc.body.classList.add('card-editor-modal-open'); closeButton.focus?.(); refresh();
  }
  function setDocked(value) {
    docked = !!value;
    try { storage?.setItem(CARD_EDITOR_DOCK_KEY, String(docked)); } catch { /* Optional persistence. */ }
    for (const layout of Object.values(layouts)) layout?.classList.toggle('card-editor-undocked', !docked);
    doc.body.classList.remove('inspector-open', 'item-inspector-open');
    if (docked) { dockPane(); if (dialog.open) dialog.close(); doc.body.classList.remove('card-editor-modal-open'); }
    else modalBody.append(pane);
    refresh();
  }
  function setContext(value) {
    if (!['cards', 'items'].includes(value) || !properties[value]) return;
    context = value;
    if (docked) dockPane();
    for (const [key, node] of Object.entries(properties)) if (node) node.hidden = key !== context;
    refresh(); ctx.onContextChange?.(context);
  }
  function setView(value) {
    if (!VIEWS.includes(value)) throw new Error(`Unknown customization view '${value}'`);
    view = value;
    try { storage?.setItem(VIEW_KEY, value); } catch { /* Optional persistence. */ }
    refresh(); ctx.onViewChange?.(view);
  }
  function edit(id, kind = 'cards') {
    if (!id) return;
    setContext(kind); returnTarget = { kind, id };
    (kind === 'items' ? ctx.selectItem : ctx.selectCard)?.(id);
    if (kind === 'cards' && !ctx.selectCard && ctx.state) ctx.state.selectedCardId = id;
    if (docked) showProperties();
    else { setView('properties'); openModal(); }
  }
  // Docked editing never opens a dialog: show Properties in place and move
  // focus to the entity heading, never into a form field.
  function showProperties() {
    setView('properties'); setPanel('editor');
    pane.scrollIntoView?.({ block: 'start' });
    entityName.focus?.({ preventScroll: true });
  }
  function decorate(tile, def, kind) {
    const id = kind === 'items' ? def.key || def.id : def.id;
    const existing = tile.querySelector('.card-editor-edit-button');
    const stage = kind === 'items' ? tile.querySelector('.studio-item-card-stage') || tile.firstElementChild || tile : tile.querySelector('.studio-card-stage') || tile;
    stage.classList.add('card-editor-art-stage');
    if (kind === 'items') stage.classList.add('studio-item-card-stage');
    if (!isValid(kind) || id !== selectedId(kind)) { existing?.remove(); return; }
    if (existing) { if (existing.parentNode !== stage) stage.append(existing); return; }
    const node = button('', event => { event.stopPropagation(); edit(id, kind); }, 's-btn card-editor-edit-button');
    node.setAttribute('aria-label', `Edit ${def.name || (kind === 'items' ? 'item' : 'card')}`);
    const pill = doc.createElement('span'); pill.className = 'card-editor-edit-pill';
    const pencil = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    pencil.setAttribute('viewBox', '0 0 24 24'); pencil.setAttribute('aria-hidden', 'true'); pencil.setAttribute('focusable', 'false');
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M4 16 3 21 8 20 20 8 16 4 4 16ZM14 6 18 10');
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.8'); path.setAttribute('stroke-linejoin', 'round');
    pencil.append(path);
    const text = doc.createElement('span'); text.textContent = 'Edit';
    pill.append(pencil, text); node.append(pill);
    node.addEventListener('keydown', event => event.stopPropagation()); stage.append(node);
  }
  function renderEntity() {
    const noun = context === 'items' ? 'item' : 'card', valid = isValid(context), name = valid ? selectedName() || selectedId(context) : 'none';
    entity.setAttribute('aria-label', context === 'items' ? 'Active item' : 'Active card');
    entityNameText.textContent = valid ? name : `No ${noun} selected`;
    if (scoreSummary) scoreSummary.hidden = context !== 'cards' || !valid;
    scope.textContent = SCOPE_TEXT[view](noun, name);
    if (!valid && view === 'properties') scope.textContent = `Choose a ${noun} in the library to edit it.`;
    pane.setAttribute('data-scope', VIEW_SCOPES[view]);
    pane.setAttribute('data-empty', String(!valid));
    // The empty state replaces stale content rather than leaving the last card on show.
    empty.textContent = `No ${noun} selected. Choose a ${noun} in the library.`; empty.hidden = valid;
    for (const [key, node] of Object.entries(properties)) if (node) node.hidden = key !== context || !valid;
    for (const [key, node] of Object.entries(previews)) if (node) node.hidden = key !== context || !valid;
    rename.disabled = balance.disabled = !valid;
    placeQuickFields();
    for (const nav of navs) {
      const navName = isValid(nav.key) ? nameOf(nav.key) || selectedId(nav.key) : 'none';
      nav.editor.textContent = `${nav.key === 'items' ? 'Item' : 'Card'}: ${navName}`;
    }
    // A selection change seen only here (an inspector render) still moves Edit.
    if (selectionKey() !== decoratedKey) decorateAll();
  }
  let decoratedKey = null;
  const selectionKey = () => ['cards', 'items'].map(kind => `${selectedId(kind)}:${isValid(kind)}`).join('|');
  function decorateAll() {
    decoratedKey = selectionKey();
    for (const tile of doc.querySelectorAll('#cards-grid .studio-card-tile')) decorate(tile, ctx.state?.cards?.find(card => card.id === tile.dataset.cardId) || { id: tile.dataset.cardId }, 'cards');
    for (const tile of doc.querySelectorAll('#items-grid .item-grid-tile')) decorate(tile, { key: tile.dataset.itemKey, name: ctx.getSelectedItemName?.(tile.dataset.itemKey) }, 'items');
  }
  function refresh() {
    attachViews(); select.value = view;
    for (const [key, slot] of Object.entries(slots)) slot.hidden = key !== view;
    decorateAll(); renderEntity(); applyPanel();
    title.textContent = view === 'properties' ? `Edit ${selectedName() || (context === 'cards' ? 'card' : 'item')}` : `Customize ${select.querySelector(`option[value="${view}"]`)?.textContent || view}`;
    rename.hidden = balance.hidden = view !== 'properties';
    for (const node of toggles) { node.textContent = docked ? (node === paneToggle ? 'Undock' : 'Undock editor') : (node === paneToggle ? 'Dock' : 'Dock editor'); node.setAttribute('aria-pressed', String(docked)); }
  }
  select.addEventListener('change', () => setView(select.value));
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => { dialog.style.removeProperty('margin'); dialog.style.removeProperty('left'); dialog.style.removeProperty('top'); if (docked) dockPane(); doc.body.classList.remove('card-editor-modal-open'); focusReturn(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  // Both galleries share one remembered width and the same live pane. The old
  // card-only resizer is replaced by these handlers at the composition root.
  const WIDTH_KEY = 'ashenspire:studioInspectorW';
  const MIN_WIDTH = 340, MAX_WIDTH = 780;
  let width = 420;
  try { const saved = Number(storage?.getItem(WIDTH_KEY)); if (saved >= MIN_WIDTH && saved <= MAX_WIDTH) width = saved; } catch { /* Optional persistence. */ }
  const setWidth = next => {
    width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(next)));
    for (const layout of Object.values(layouts)) {
      layout?.style.setProperty('--inspector-width', `${width}px`);
      const resizer = layout?.querySelector('.inspector-resizer');
      resizer?.setAttribute('aria-valuenow', String(width));
      resizer?.setAttribute('aria-valuetext', `${width} pixels, minimum ${MIN_WIDTH}`);
    }
    try { storage?.setItem(WIDTH_KEY, String(width)); } catch { /* Optional persistence. */ }
  };
  setWidth(width);
  for (const [key, layout] of Object.entries(layouts)) {
    const resizer = layout?.querySelector('.inspector-resizer');
    if (!resizer) continue;
    let dragging = false;
    resizer.tabIndex = 0; resizer.setAttribute('aria-label', 'Resize customization pane');
    resizer.setAttribute('role', 'separator'); resizer.setAttribute('aria-orientation', 'vertical');
    resizer.setAttribute('aria-valuemin', String(MIN_WIDTH)); resizer.setAttribute('aria-valuemax', String(MAX_WIDTH));
    resizer.title = `Drag or use arrow keys to resize. Home is the minimum (${MIN_WIDTH} pixels), End the maximum (${MAX_WIDTH}).`;
    resizer.setAttribute('aria-controls', 'studio-customization-pane');
    resizer.addEventListener('pointerdown', event => { if (!docked) return; dragging = true; resizer.classList.add('is-dragging'); resizer.setPointerCapture?.(event.pointerId); event.preventDefault(); resizer.focus?.({ preventScroll: true }); });
    resizer.addEventListener('pointermove', event => {
      if (!dragging) return;
      const box = layout.getBoundingClientRect();
      setWidth(Math.min(box.width - 260, (box.right ?? box.left + box.width) - event.clientX));
    });
    const stop = () => { dragging = false; resizer.classList.remove('is-dragging'); };
    resizer.addEventListener('pointerup', stop); resizer.addEventListener('pointercancel', stop);
    // The pane sits right of the separator: ArrowLeft widens it, Home and End jump to the limits.
    const keyWidths = { ArrowLeft: () => width + 20, ArrowRight: () => width - 20, Home: () => MIN_WIDTH, End: () => MAX_WIDTH };
    resizer.addEventListener('keydown', event => {
      if (!docked || !keyWidths[event.key]) return;
      event.preventDefault(); setContext(key); setWidth(keyWidths[event.key]());
    });
  }
  // Crossing the breakpoint starts on the library, so focus is never left on a hidden gallery tile.
  narrowMedia?.addEventListener?.('change', () => { panel = 'library'; applyPanel(); });
  setContext('cards'); setDocked(docked); setView(view);
  setPreviewCollapsed(previewPrefs.collapsed); fieldsObserver?.observe(quick); fitCardToFields();
  return { edit: id => edit(id, 'cards'), editItem: id => edit(id, 'items'), decorateTile: (tile, def) => decorate(tile, def, 'cards'), decorateItemTile: (tile, def) => decorate(tile, def, 'items'), open: openModal, refresh, refreshEntity: renderEntity, showProperties, setPanel, getPanel: () => panel, setDocked, setContext, setView, isDocked: () => docked, getView: () => view, element: pane };
}
