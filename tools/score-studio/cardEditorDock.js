// One customization pane and one copy of every form. Switching galleries or
// docking reparents live DOM nodes, preserving inputs, listeners and selection.
export const CARD_EDITOR_DOCK_KEY = 'ashenspire:scoreStudioEditorDocked:v1';
const VIEW_KEY = 'ashenspire:scoreStudioCustomizationView:v1';
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
  const selectedName = () => context === 'cards' ? ctx.state?.cards?.find(card => card.id === selectedId(context))?.name : ctx.getSelectedItemName?.(selectedId(context));
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
  const entityName = doc.createElement('h2'); entityName.id = 'customization-entity-name'; entityName.className = 'customization-entity-name'; entityName.tabIndex = -1;
  const scope = doc.createElement('p'); scope.id = 'customization-scope'; scope.className = 'customization-scope';
  const previewSlot = doc.createElement('div'); previewSlot.className = 'customization-entity-preview';
  const previews = { cards: properties.cards.querySelector('.inspector-preview-wrap'), items: properties.items?.querySelector('#item-preview-host') || null };
  for (const node of Object.values(previews)) if (node) { rememberHome(node); previewSlot.append(node); }
  entity.append(entityName, scope, previewSlot);
  const content = doc.createElement('div'); content.id = 'customization-content';
  const slots = Object.fromEntries(VIEWS.map(id => {
    const slot = doc.createElement('div'); slot.className = 'customization-view'; slot.dataset.customizationView = id; content.append(slot); return [id, slot];
  }));
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

  const dialog = doc.createElement('dialog'); dialog.id = 'card-editor-modal'; dialog.className = 'card-editor-modal';
  dialog.setAttribute('aria-labelledby', 'card-editor-modal-title');
  const head = doc.createElement('header'); head.className = 'card-editor-modal-head';
  const title = doc.createElement('h2'); title.id = 'card-editor-modal-title';
  const actions = doc.createElement('div'); actions.className = 'card-editor-modal-actions';
  const rename = button('Rename', () => (context === 'items' ? ctx.renameItem : ctx.renameCard)?.(selectedId(context))); rename.id = 'card-editor-rename';
  const balance = button('Rebalance power', () => (context === 'items' ? ctx.balanceItem : ctx.balanceCard)?.(selectedId(context))); balance.id = 'card-editor-balance';
  const modalDock = button('Dock', () => setDocked(true)); modalDock.id = 'card-editor-modal-dock';
  const closeButton = button('Close', close); closeButton.id = 'card-editor-modal-close';
  actions.append(rename, balance, modalDock, closeButton); head.append(title, actions);
  const modalBody = doc.createElement('div'); modalBody.className = 'card-editor-modal-body';
  dialog.append(head, modalBody); doc.body.append(dialog);

  function focusReturn() {
    const kind = returnTarget?.kind || context, id = returnTarget?.id || selectedId(kind);
    const grid = doc.getElementById(kind === 'items' ? 'items-grid' : 'cards-grid');
    const tile = [...(grid?.querySelectorAll(kind === 'items' ? '.item-grid-tile' : '.studio-card-tile') || [])].find(node => (node.dataset.itemKey || node.dataset.cardId) === id);
    // Item tiles are plain divs. Their Edit action is a real focusable button,
    // unlike the tile itself (whose focus() is ignored by native browsers).
    const target = kind === 'items' ? tile?.querySelector('.card-editor-edit-button') || tile : tile;
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
    setView('properties'); openModal();
  }
  function decorate(tile, def, kind) {
    const id = kind === 'items' ? def.key || def.id : def.id;
    const existing = tile.querySelector('.card-editor-edit-button');
    const stage = kind === 'items' ? tile.querySelector('.studio-item-card-stage') || tile.firstElementChild || tile : tile.querySelector('.studio-card-stage') || tile;
    stage.classList.add('card-editor-art-stage');
    if (kind === 'items') stage.classList.add('studio-item-card-stage');
    if (id !== selectedId(kind)) { existing?.remove(); return; }
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
    const noun = context === 'items' ? 'item' : 'card', name = selectedName() || selectedId(context) || 'none';
    entity.setAttribute('aria-label', context === 'items' ? 'Active item' : 'Active card');
    entityName.textContent = name;
    scope.textContent = SCOPE_TEXT[view](noun, name);
    pane.setAttribute('data-scope', VIEW_SCOPES[view]);
    for (const [key, node] of Object.entries(previews)) if (node) node.hidden = key !== context;
  }
  function refresh() {
    attachViews(); select.value = view;
    for (const [key, slot] of Object.entries(slots)) slot.hidden = key !== view;
    for (const [key, node] of Object.entries(properties)) if (node) node.hidden = key !== context;
    renderEntity();
    title.textContent = view === 'properties' ? `Edit ${selectedName() || (context === 'cards' ? 'card' : 'item')}` : `Customize ${select.querySelector(`option[value="${view}"]`)?.textContent || view}`;
    rename.hidden = balance.hidden = view !== 'properties'; rename.disabled = balance.disabled = !selectedId(context);
    for (const node of toggles) { node.textContent = docked ? (node === paneToggle ? 'Undock' : 'Undock editor') : (node === paneToggle ? 'Dock' : 'Dock editor'); node.setAttribute('aria-pressed', String(docked)); }
    for (const tile of doc.querySelectorAll('#cards-grid .studio-card-tile')) decorate(tile, ctx.state?.cards?.find(card => card.id === tile.dataset.cardId) || { id: tile.dataset.cardId }, 'cards');
    for (const tile of doc.querySelectorAll('#items-grid .item-grid-tile')) decorate(tile, { key: tile.dataset.itemKey, name: ctx.getSelectedItemName?.(tile.dataset.itemKey) }, 'items');
  }
  select.addEventListener('change', () => setView(select.value));
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => { if (docked) dockPane(); doc.body.classList.remove('card-editor-modal-open'); focusReturn(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  // Both galleries share one remembered width and the same live pane. The old
  // card-only resizer is replaced by these handlers at the composition root.
  const WIDTH_KEY = 'ashenspire:studioInspectorW';
  let width = 420;
  try { const saved = Number(storage?.getItem(WIDTH_KEY)); if (saved >= 340 && saved <= 780) width = saved; } catch { /* Optional persistence. */ }
  const setWidth = next => {
    width = Math.max(340, Math.min(780, Math.round(next)));
    for (const layout of Object.values(layouts)) {
      layout?.style.setProperty('--inspector-width', `${width}px`);
      layout?.querySelector('.inspector-resizer')?.setAttribute('aria-valuenow', String(width));
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
    resizer.setAttribute('aria-valuemin', '340'); resizer.setAttribute('aria-valuemax', '780');
    resizer.setAttribute('aria-controls', 'studio-customization-pane');
    resizer.addEventListener('pointerdown', event => { if (!docked) return; dragging = true; resizer.classList.add('is-dragging'); resizer.setPointerCapture?.(event.pointerId); event.preventDefault(); });
    resizer.addEventListener('pointermove', event => {
      if (!dragging) return;
      const box = layout.getBoundingClientRect();
      setWidth(Math.min(box.width - 260, (box.right ?? box.left + box.width) - event.clientX));
    });
    const stop = () => { dragging = false; resizer.classList.remove('is-dragging'); };
    resizer.addEventListener('pointerup', stop); resizer.addEventListener('pointercancel', stop);
    resizer.addEventListener('keydown', event => {
      if (!docked || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); setContext(key); setWidth(width + (event.key === 'ArrowLeft' ? 20 : -20));
    });
  }
  setContext('cards'); setDocked(docked); setView(view);
  return { edit: id => edit(id, 'cards'), editItem: id => edit(id, 'items'), decorateTile: (tile, def) => decorate(tile, def, 'cards'), decorateItemTile: (tile, def) => decorate(tile, def, 'items'), open: openModal, refresh, refreshEntity: renderEntity, setDocked, setContext, setView, isDocked: () => docked, getView: () => view, element: pane };
}
