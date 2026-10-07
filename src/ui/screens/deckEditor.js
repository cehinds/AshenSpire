import { progressionTip } from '../components/progressionCards.js';
// src/ui/screens/deckEditor.js — the deck editor (SPEC §14.1 UX), mounted over
// whatever opened it: the Armoury or an eligible Rest screen.
//
// THE SCREEN DECIDES NOTHING. Every row, count, refusal and disabled state is
// read off `deckEditorModel` (ui/models/DeckEditorModel.js), and every change
// goes through the session `openDeckEdit` returns, which in turn goes through
// model/deckRules.js. Cancel is the session's `cancel()` — `cancelDeckEdit`
// over the snapshot `beginDeckEdit` took when this screen opened — so the two
// piles, the attack-slot allocation and the mint counter come back exactly.
//
// EVERY DRAG HAS TWO TWINS (SPEC §14.1 UX). A card moves by:
//   · the selected card's explicit Add / Remove action (a row tap inspects),
//   · the row's own ＋ or － button,
//   · a drag, on pointer events so a finger drags as well as a mouse,
//   · the keyboard: + adds the focused tile, − or Delete removes the focused
//     row, `[` / `]` switch panes, the Deck key cycles the filters, the End
//     Turn key picks a row up and ▲/▼ place it, Menu is Done, Esc is Cancel;
//   · the pad, through the same bindings: the D-pad moves the focus cursor,
//     LB/RB switch panes, A activates, X picks up, Y cycles the filters, B
//     cancels and Start confirms (§7.3).
// Reordering (Play in deck order only) is a drag onto another row, the row's
// ▲/▼ buttons, or a pick-up with X / the End Turn key.
//
// It is a `.modal-veil`, so input.js scopes the focus cursor to it and the
// map's own hotkeys stand down while it is open (components/veil.js).

import { el, button } from '../kit/index.js';
import { bindModalDismiss, modalFooter, modalHead } from '../components/modalShell.js';
import { markUiComponent, UI_COMPONENTS as UI } from '../components/uiComponents.js';
import { actionLabel, focusElement, matchAction, setInputGate, setTabRing } from '../input.js';
import { DECK_PANES, deckEditorModel, deckEditorView, nextFilterPreset, openDeckEdit } from '../models/DeckEditorModel.js';
import { t, tFull } from '../strings.js';
import { renderCard, staticTokens } from '../components/card.js';
import { resolveCard } from '../../model/registries.js';
import { playingCardArt } from '../cardArtwork.js';
import { assetUrl } from '../assetmap.js';
import { cardShapeCssProperties, cardLevelWidthCss } from '../models/CardSizeModel.js';
import { keywordExplanations } from '../components/tooltipGlossary.js';
import { deckCardAnimationPreview } from '../components/deckCardAnimationPreview.js';
import { deckEditorCosts, deckEditorResourceGroups } from '../models/deckEditorCosts.js';

// Standard-mapping pad buttons the editor reads directly while a row is held
// (input.js hands every other press to the focus cursor and the bindings).
const PAD = Object.freeze({ a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, start: 9, up: 12, down: 13 });
// How far (CSS px) a press travels before it is a drag rather than a tap, and
// how long a finger holds still before it may drag (so a swipe still scrolls).
const DRAG_SLOP = 10;
const DRAG_HOLD_MS = 250;

/**
 * mountDeckEditor(host, { registries, run, settings, onDone, onCancel }) →
 * { root, dispatch(input), close() }.
 *
 * `onDone()` runs after a confirmed edit (the host persists and re-mounts what
 * was under the editor); `onCancel()` after the edit has been undone. `dispatch`
 * takes the normalized record input.js's gate sees — `{ family: 'keyboard',
 * key }` or `{ family: 'controller', button }` — and performs exactly what the
 * real key or button does, so a test drives the same path a player does.
 */
// ONE EDITOR AT A TIME. A second door pressed while one stands (a doubled
// Enter, a stray tap) gets the live editor back: a second session would take
// its snapshot mid-edit, and cancelling the stale one would undo a confirm.
let liveEditor = null;

export function mountDeckEditor(host, { registries, run, settings = {}, onDone = null, onCancel = null, onNavigate = null, dragHoldMs = DRAG_HOLD_MS }) {
  if (liveEditor && liveEditor.root.isConnected && !liveEditor.session.closed) return liveEditor;
  const session = openDeckEdit(registries, run, settings);
  let view = deckEditorView({});
  let pane = 'collection';
  let held = null; // instanceId of the deck row picked up for reordering
  let focusKey = null;
  let notice = '';
  let model = null;
  let releaseGate = null;
  let selected = null;
  let inspected = null;
  let query = '';
  let mobileView = 'collection';
  let inspectOrigin = 'collection';
  let filtersOpen = false;
  let libraryScope = 'all';
  let deckQuery = '';
  let deckDisplay = 'list';
  const foldedTypes = new Set();
  let success = '';
  let animationPreview = null;
  let animationPaused = false;


  const root = el('div', { class: 'modal-veil deck-editor-veil' });
  const panel = el('section', {
    class: 'deck-editor', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'deck-editor-title',
  });
  root.appendChild(panel);
  panel.style.setProperty('--deck-cost-count', String(deckEditorResourceGroups().length));
  markUiComponent(root, UI.deckEditor);
  host.appendChild(root);

  // ---- rendering ------------------------------------------------------------
  const focusable = (node, key) => {
    node.dataset.focusKey = key;
    node.dataset.focusable = 'true';
    const remember = () => { focusKey = key; pane = node.closest?.('[data-pane]')?.dataset.pane || pane; };
    node.addEventListener('gpfocus', remember);
    node.addEventListener('focus', () => { remember(); focusElement(node); });
    return node;
  };

  const chip = (label, on, onClick, key) => {
    const node = el('button', {
      type: 'button', class: `deck-editor-chip${on ? ' on' : ''}`, 'aria-pressed': on ? 'true' : 'false', text: label,
    });
    node.addEventListener('click', onClick);
    return focusable(node, key);
  };

  function header() {
    const counter = el('p', {
      class: 'deck-editor-counter', role: 'status', 'aria-live': 'polite',
      dataset: { state: model.counter.outOfBounds ? 'out' : 'ok' }, title: tFull('deckEditor.counter', null),
      text: model.counter.text,
    });
    const curve = el('div', { class: 'deck-editor-curve', role: 'img', 'aria-label': tFull('deckEditor.curve') });
    for (const bar of model.curve) {
      curve.appendChild(el('span', {
        class: 'deck-editor-curve-bar', dataset: { bucket: bar.bucket, count: bar.count },
        title: tFull('deckEditor.curve.bar', { bucket: bar.bucket, count: bar.count }),
        style: { '--share': bar.share.toFixed(3) },
      }, [
        el('span', { class: 'deck-editor-curve-fill', 'aria-hidden': 'true' }),
        el('span', { class: 'deck-editor-curve-label', text: t('deckEditor.curve.bar', { bucket: bar.bucket, count: bar.count }) }),
      ]));
    }
    return el('header', { class: 'deck-editor-head' }, [
      el('div', {}, [
        el('h2', { id: 'deck-editor-title', class: 'deck-editor-title', text: t('deckEditor.readingDesk') }),
        el('p', { class: 'deck-editor-subtitle', text: t('deckEditor.readingHint') }),
      ]),
      el('span', { class: 'deck-editor-class', text: registries.classes.get(run.class)?.name || run.class }),
      counter,
      curve,
    ]);
  }

  function tools() {
    const f = model.filters;
    const toggle = (group, id) => () => {
      const list = view.filters[group];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      view = deckEditorView({ ...view, filters: { ...view.filters, [group]: next } });
      draw();
    };
    const filterChips = [
      ...f.type.map((c) => chip(c.label, c.on, toggle('type', c.id), `filter:type:${c.id}`)),
      ...f.cost.map((c) => chip(c.label, c.on, toggle('cost', c.id), `filter:cost:${c.id}`)),
      ...f.source.map((c) => chip(c.label, c.on, toggle('source', c.id), `filter:source:${c.id}`)),
      chip(f.upgraded.label, f.upgraded.on, () => {
        view = deckEditorView({ ...view, filters: { ...view.filters, upgraded: !view.filters.upgraded } });
        draw();
      }, 'filter:upgraded'),
    ];
    const sortChips = model.sorts.map((s) => chip(s.label, s.on, () => {
      view = deckEditorView({ ...view, sort: s.id });
      draw();
    }, `sort:${s.id}`));
    const details = el('details', { class: 'deck-editor-tools', open: filtersOpen }, [
      el('summary', { text: t('deckEditor.filterSort') }),
      el('div', { class: 'deck-editor-chips', role: 'group', 'aria-label': t('deckEditor.filters') }, [
        el('span', { class: 'deck-editor-chips-label', text: t('deckEditor.filters') }), ...filterChips,
      ]),
      // Under Play in deck order the deck's order IS the arrangement, so no
      // sort is offered (a sort chip that did nothing to the deck would lie).
      model.ordered ? null : el('div', { class: 'deck-editor-chips', role: 'group', 'aria-label': t('deckEditor.sort') }, [
        el('span', { class: 'deck-editor-chips-label', text: t('deckEditor.sort') }), ...sortChips,
      ]),
    ]);
    details.addEventListener('toggle', () => { filtersOpen = details.open; });
    return details;
  }

  function rulesFor(row) {
    const def = resolveCard(registries, row.ref);
    const tokens = staticTokens(def);
    return String(def.textTemplate || '').replace(/\{([^}]+)\}/g, (match, key) => tokens[key] ?? match);
  }

  function artwork(row, large = false) {
    const art = playingCardArt(row.ref, { large });
    const img = el('img', {
      class: `deck-editor-art${art?.kind === 'outline' ? ' outline' : ''}`,
      src: art ? assetUrl(art.path) : '', alt: '', draggable: 'false',
    });
    if (art?.position) img.style.setProperty('object-position', art.position);
    img.addEventListener('error', () => { img.hidden = true; });
    return img;
  }

  const selectionKey = (row, source) => source === 'collection' ? row.key : row.groupKey;
  function select(row, source, open = false) {
    if (source === 'collection' && row.equipmentEligible === false) return;
    selected = { key: selectionKey(row, source), source, row };
    if (open) { inspected = selected; inspectOrigin = source; mobileView = 'inspect'; }
    panel.dataset.mobileView = mobileView;
    for (const node of panel.querySelectorAll('.deck-editor-main')) {
      const on = node.dataset.selectionKey === selected.key && node.dataset.selectionSource === source;
      node.setAttribute('aria-pressed', String(on));
      const inspect = node.closest('.deck-editor-item')?.querySelector('.deck-editor-inline-inspect');
      if (inspect) inspect.hidden = !on;
    }
    const inspector = panel.querySelector('.deck-editor-inspector');
    if (open && inspector) { inspector.parentNode.insertBefore(inspectPane(), inspector); inspector.remove(); }
    updateMobileTabs();
    if (open && typeof matchMedia === 'function' && matchMedia('(max-width: 1000px)').matches) {
      focusNode(panel.querySelector('[data-focus-key="inspect-back"]'));
    }
  }

  function inspectPane() {
    animationPreview?.dispose();
    animationPreview = null;
    const section = el('section', { class: 'deck-editor-inspector', 'aria-label': t('deckEditor.inspect') });
    const back = chip(t('deckEditor.back'), false, () => {
      mobileView = inspectOrigin;
      pane = mobileView;
      focusKey = `mobile:${mobileView}`;
      draw();
    }, 'inspect-back');
    back.classList.add('deck-editor-inspect-back');
    section.appendChild(back);
    if (!inspected && !selected) {
      section.appendChild(el('p', { class: 'deck-editor-empty', text: t('deckEditor.empty.collection') }));
      return section;
    }
    const { row, source } = inspected || selected;
    const def = resolveCard(registries, row.ref);
    const face = renderCard(registries, row.ref, { inspection: false, level: 'inspect' });
    for (const [key, value] of Object.entries(cardShapeCssProperties())) face.style.setProperty(key, value);
    face.style.setProperty('--deck-inspect-width', cardLevelWidthCss('inspect'));
    face.querySelector('.card-costs')?.replaceChildren(rowCosts(row));
    if (def.flavor) face.querySelector('.cd-body')?.appendChild(el('p', { class: 'deck-editor-flavor', text: def.flavor }));
    // The native face keeps its authored shape. Long readings scroll inside
    // their band instead of stretching the whole card; keyboard users can
    // reach that reading without needing to open a second inspection door.
    face.querySelector('.cd-body')?.setAttribute('tabindex', '0');
    const addAction = source === 'collection';
    const allowed = addAction ? row.addable : row.removable;
    const reason = addAction ? row.refusal : row.lockSentence;
    const action = focusable(button({
      label: t(addAction ? 'deckEditor.addSelected' : 'deckEditor.removeSelected'),
      weight: 'primary', className: 'deck-editor-primary', disabled: !allowed,
      attrs: { 'aria-describedby': 'deck-editor-selected-reason' },
    }), 'selected-action');
    action.addEventListener('click', () => addAction ? add(row.key) : remove(row.instanceId));
    animationPreview = deckCardAnimationPreview({ registries, run, ref: row.ref, paused: animationPaused,
      onPaused: paused => { animationPaused = paused; } });
    section.append(
      el('div', { class: 'deck-editor-reading' }, [face,
        el('label', { class: 'deck-editor-art-toggle' }, [
          el('input', { type: 'checkbox', disabled: true, 'aria-label': t('deckEditor.art.alternative') }),
          el('span', { text: t('deckEditor.art.alternative') }),
          el('small', { text: t('deckEditor.art.basicOnly') }),
        ]),
        animationPreview.root,
        ...keywordExplanations(registries, rulesFor(row)).map(entry => el('div', { class: 'deck-editor-keyword' }, [
          el('strong', { text: entry.name }), el('p', { text: entry.explanation }),
        ])),
      ]),
      el('div', { class: 'deck-editor-selected-actions' }, [
        el('p', { id: 'deck-editor-selected-reason', class: 'deck-editor-selected-reason', text: reason || (addAction ? row.countText : row.countText || t(`deckEditor.source.${row.source}`)) }),
        action,
      ]),
    );
    return section;
  }

  function updateMobileTabs() {
    for (const node of panel.querySelectorAll('[data-mobile-tab]')) {
      const on = node.dataset.mobileTab === mobileView;
      node.setAttribute('aria-pressed', String(on));
      node.classList.toggle('on', on);
    }
    const panes = panel.querySelector('.deck-editor-panes');
    if (panes) panes.dataset.active = pane;
  }

  function navigation() {
    return el('nav', { class: 'deck-editor-mobile-tabs', 'aria-label': t('deckEditor.panes.switch') },
      ['collection', 'inspect', 'deck'].map((id) => {
        const node = chip(t(id === 'inspect' ? 'deckEditor.inspect' : `deckEditor.pane.${id}`), mobileView === id, () => {
          if (id === 'inspect' && selected) {
            const origin = pane;
            select(selected.row, selected.source, true);
            inspectOrigin = origin;
            focusNode(panel.querySelector('[data-focus-key="inspect-back"]'));
            return;
          }
          if (id === 'inspect') inspectOrigin = pane;
          mobileView = id;
          if (id !== 'inspect') pane = id;
          panel.dataset.mobileView = id;
          updateMobileTabs();
          if (id === 'inspect') focusNode(panel.querySelector('[data-focus-key="inspect-back"]'));
        }, `mobile:${id}`);
        node.dataset.mobileTab = id;
        return node;
      }));
  }

  // `grouped` is a deck row standing for several copies; a collection tile's
  // own counts are its meta line, never a badge.
  const typeName = (row) => model.filters.type.find(entry => entry.id === row.type)?.label || row.type;
  function rowCosts(row) {
    const pools = registries.framework.costProfile(resolveCard(registries, row.ref));
    return el('span', { class: 'deck-editor-costs' }, deckEditorCosts(pools).map(({id, label, value, art}) =>
      el('span', { class: `deck-editor-cost resource-${id}${art ? ' illustrated' : ''}`, title: `${label}: ${value}`,
        'aria-label': `${label}: ${value}` }, [
          ...(art ? [el('img', { class: 'deck-editor-resource-icon', src: assetUrl(art), alt: '', draggable: 'false' })] : []),
          el('small', { text: label }), el('span', { class: 'deck-editor-resource-value', text: String(value) }),
        ])));
  }
  const cardFace = (row, extra, grouped = false, illustrated = !grouped) => [
    illustrated ? artwork(row) : null,
    el('span', { class: 'deck-editor-grip', 'aria-hidden': 'true', text: '⠿' }),
    rowCosts(row),
    el('span', { class: 'deck-editor-heading' }, [
      el('span', { class: 'deck-editor-name', text: row.name }),
      el('span', { class: 'deck-editor-type', dataset: { type: row.type }, text: typeName(row) }),
    ]),
    row.equipmentEligible === false ? el('span', { class: 'deck-editor-meta', text: t('deckEditor.equipmentNotFound') }) : null,
    el('span', { class: 'deck-editor-row-rules', text: rulesFor(row) }),
    // Unordered, a deck row stands for every copy of its variant (SPEC §14.7).
    el('span', { class: 'deck-editor-count', title: extra, text: t('deckEditor.count', { count: grouped ? row.count : row.inDeck || 0 }) }),
  ].filter(Boolean);

  function inlineInspect(row, source) {
    const active = selected?.source === source && selected.key === selectionKey(row, source);
    const node = focusable(button({ label: t('deckEditor.inspectAction'), className: 'deck-editor-inline-inspect deck-editor-inspect',
      attrs: { 'aria-label': t('deckEditor.inspectNamed', { name: row.name }) } }), `inspect:${source}:${selectionKey(row, source)}`);
    node.hidden = !active;
    node.addEventListener('click', () => select(row, source, true));
    return node;
  }





  function collectionPane() {
    const search = focusable(el('input', { type: 'search', class: 'deck-editor-search', placeholder: t('deckEditor.search'), 'aria-label': t('deckEditor.search'), value: query }), 'search');
    search.addEventListener('input', () => {
      query = search.value;
      const caret = search.selectionStart;
      draw();
      const next = panel.querySelector('.deck-editor-search');
      next.focus();
      try { next.setSelectionRange(caret, caret); } catch { /* search selection varies by browser */ }
    });
    const list = el('div', { class: 'deck-editor-list', role: 'list' });
    const rows = model.collection.filter(row => (libraryScope === 'all' || row.inDeck > 0) && `${row.name} ${rulesFor(row)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    for (const tile of rows) {
      const main = focusable(el('button', {
        type: 'button', class: 'deck-editor-main', disabled: tile.equipmentEligible === false, dataset: { action: 'add', key: tile.key, illustrated: 'true' },
        'aria-label': t('deckEditor.inspectNamed', { name: tile.name }),
        'aria-pressed': String(selected?.source === 'collection' && selected.key === tile.key),
      }, cardFace(tile, tile.countText)), `tile:${tile.key}`);
      main.dataset.selectionKey = tile.key;
      main.dataset.selectionSource = 'collection';
      main.addEventListener('focus', () => select(tile, 'collection'));
      main.addEventListener('gpfocus', () => select(tile, 'collection'));
      main.addEventListener('click', () => select(tile, 'collection'));
      const plus = focusable(el('button', {
        type: 'button', class: 'deck-editor-step', disabled: tile.equipmentEligible === false, dataset: { action: 'add', key: tile.key },
        'aria-label': tFull('deckEditor.add', { name: tile.name }), 'aria-disabled': tile.addable ? 'false' : 'true',
        text: t('deckEditor.add', { name: tile.name }),
      }), `tile-add:${tile.key}`);
      plus.addEventListener('click', () => add(tile.key));
      list.appendChild(el('div', {
        class: `deck-editor-item deck-editor-tile${tile.addable ? '' : ' spent'}${tile.equipmentEligible === false ? ' equipment-missing' : ''}`, role: 'listitem',
        dataset: { key: tile.key, source: tile.source, unlimited: tile.unlimited ? 'true' : 'false' },
      }, [main, inlineInspect(tile, 'collection'), el('div', { class: 'deck-editor-actions' }, [plus])]));
    }
    if (!rows.length) list.appendChild(el('p', { class: 'deck-editor-empty', text: t('deckEditor.empty.collection') }));
    const section = paneSection('collection', t('deckEditor.pane.collection'), list);
    section.insertBefore(el('div', { class: 'deck-editor-searchbar' }, [search,
      chip(t('deckEditor.all'), libraryScope === 'all', () => { libraryScope = 'all'; draw(); }, 'scope:all'),
      chip(t('deckEditor.inDeck'), libraryScope === 'deck', () => { libraryScope = 'deck'; draw(); }, 'scope:deck'),
    ]), list);
    return section;
  }

  function deckPane() {
    const list = el('div', { class: `deck-editor-list deck-editor-display-${deckDisplay}`, role: 'list' });
    const rows = model.deck.filter(row => `${row.name} ${rulesFor(row)}`.toLocaleLowerCase().includes(deckQuery.trim().toLocaleLowerCase()));
    const groups = new Map();
    for (const row of rows) {
      const main = focusable(el('button', {
        type: 'button', class: 'deck-editor-main', dataset: { action: 'remove', instanceId: row.instanceId, illustrated: String(deckDisplay === 'cards') },
        'aria-label': t('deckEditor.inspectNamed', { name: row.name }),
        'aria-pressed': String(selected?.source === 'deck' && selected.key === row.groupKey),
      }, cardFace(row, row.locked ? row.lockText : t(`deckEditor.source.${row.source}`), true, deckDisplay === 'cards')), `row:${row.groupKey}`);
      main.dataset.selectionKey = row.groupKey;
      main.dataset.selectionSource = 'deck';
      main.addEventListener('focus', () => select(row, 'deck'));
      main.addEventListener('gpfocus', () => select(row, 'deck'));
      main.addEventListener('click', () => select(row, 'deck'));
      const item = el('div', {
        class: `deck-editor-item deck-editor-row${row.locked ? ' locked' : ''}${held === row.instanceId ? ' held' : ''}`, role: 'listitem',
        dataset: { instanceId: row.instanceId, source: row.source },
      }, [main, inlineInspect(row, 'deck')]);
      const actions = el('div', { class: 'deck-editor-actions' });
      item.appendChild(actions);
      if (model.ordered) {
        for (const [dir, id, can] of [[-1, 'deckEditor.up', row.canUp], [1, 'deckEditor.down', row.canDown]]) {
          const step = focusable(el('button', {
            type: 'button', class: 'deck-editor-step deck-editor-order', dataset: { action: dir < 0 ? 'up' : 'down', instanceId: row.instanceId },
            'aria-label': tFull(id, { name: row.name }), 'aria-disabled': can ? 'false' : 'true', text: t(id, { name: row.name }),
          }), `row-${dir < 0 ? 'up' : 'down'}:${row.instanceId}`);
          step.addEventListener('click', () => { if (can) { session.move(row.instanceId, dir); draw(); } });
          actions.appendChild(step);
        }
        const pick = focusable(el('button', {
          type: 'button', class: 'deck-editor-step deck-editor-pick', dataset: { action: 'pick', instanceId: row.instanceId },
          'aria-label': tFull('deckEditor.pickUp', { name: row.name }), 'aria-pressed': held === row.instanceId ? 'true' : 'false',
          text: t('deckEditor.pickUp', { name: row.name }),
        }), `row-pick:${row.instanceId}`);
        pick.addEventListener('click', () => togglePick(row.instanceId));
        actions.appendChild(pick);
      }
      const minus = focusable(el('button', {
        type: 'button', class: 'deck-editor-step', dataset: { action: 'remove', instanceId: row.instanceId },
        'aria-label': row.locked ? row.lockSentence : tFull('deckEditor.remove', { name: row.name }),
        'aria-disabled': row.removable ? 'false' : 'true', text: t('deckEditor.remove', { name: row.name }),
      }), `row-remove:${row.groupKey}`);
      minus.addEventListener('click', () => remove(row.instanceId));
      actions.appendChild(minus);
      if (model.ordered) list.appendChild(item);
      else {
        if (!groups.has(row.type)) groups.set(row.type, []);
        groups.get(row.type).push({ row, item });
      }
    }
    for (const [type, entries] of groups) {
      const details = el('details', { class: 'deck-editor-group', open: !foldedTypes.has(type) }, [
        focusable(el('summary', { text: `${typeName(entries[0].row)} · ${entries.reduce((sum, entry) => sum + entry.row.count, 0)}` }), `group:${type}`),
        ...entries.map(entry => entry.item),
      ]);
      details.addEventListener('toggle', () => { if (details.open) foldedTypes.delete(type); else foldedTypes.add(type); });
      list.appendChild(details);
    }
    if (!rows.length) list.appendChild(el('p', { class: 'deck-editor-empty', text: t('deckEditor.empty.deck') }));
    const section = paneSection('deck', `${t('deckEditor.pane.deck')} · ${model.counter.count}`, list);
    const search = focusable(el('input', { type: 'search', class: 'deck-editor-search', placeholder: t('deckEditor.searchDeck'), 'aria-label': t('deckEditor.searchDeck'), value: deckQuery }), 'deck-search');
    search.addEventListener('input', () => {
      deckQuery = search.value;
      const caret = search.selectionStart;
      draw();
      const next = panel.querySelector('[data-focus-key="deck-search"]');
      next.focus();
      try { next.setSelectionRange(caret, caret); } catch { /* browser search input */ }
    });
    section.insertBefore(el('div', { class: 'deck-editor-searchbar' }, [search,
      ...['list', 'cards'].map(id => chip(t(`deckEditor.display.${id}`), deckDisplay === id, () => { deckDisplay = id; draw(); }, `display:${id}`)),
    ]), list);
    section.appendChild(el('div', { class: 'deck-editor-dropwell', text: t('deckEditor.dropHere') }));
    return section;
  }

  function paneSection(id, title, list) {
    const section = el('section', {
      class: `deck-editor-pane${pane === id ? ' active' : ''}`, dataset: { pane: id }, 'aria-label': title,
    }, [el('h3', { class: 'deck-editor-pane-title', text: title }), list]);
    return section;
  }

  // ---- the drag (pointer events, so a finger drags too) -----------------------
  //
  // HTML5 drag and drop never fires from a finger, so the drag is built on
  // pointer events for every pointer: press a tile or a row's face, move past
  // DRAG_SLOP, and let go over the target. A tile let go over the deck pane is
  // added; a row let go over the collection pane is taken out; under Play in
  // deck order a row let go over another row takes its place. The target is
  // hit-tested at the release point (document.elementFromPoint). A press that
  // never passes the slop is a TAP and keeps the click path untouched; a drag
  // that happened swallows the click that follows it.
  //
  // A finger must HOLD still for `dragHoldMs` before it may drag, so a swipe
  // still scrolls the lists; once armed, the touchmove that follows is
  // prevented so the browser does not claim the gesture as a scroll. A mouse
  // or a pen drags at once.
  let press = null; // { pointerId, x, y, kind, key, armed, dragging, source, timer }
  let swallowClick = false;
  const payloadOf = (target) => {
    const main = target?.closest?.('.deck-editor-main');
    if (!main || !isInside(main, panel)) return null;
    if (main.dataset.action === 'add' && model.collection.find(row => row.key === main.dataset.key)?.addable) return { kind: 'tile', key: main.dataset.key, source: main };
    if (main.dataset.action === 'remove' && (model.deck.find(row => row.instanceId === main.dataset.instanceId)?.removable || model.ordered)) return { kind: 'row', key: main.dataset.instanceId, source: main };
    return null;
  };
  const clearMarks = () => {
    for (const node of panel.querySelectorAll('.drag-source, .drop-target')) node.classList.remove('drag-source', 'drop-target');
  };
  const dropTargetAt = (x, y, kind) => {
    const hit = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(x, y) : null;
    if (!hit || !isInside(hit, panel)) return null;
    const row = hit.closest?.('.deck-editor-row');
    if (kind === 'row' && model.ordered && row) return { kind: 'row', node: row, instanceId: row.dataset.instanceId };
    const paneNode = hit.closest?.('[data-pane]');
    if (!paneNode) return null;
    if (kind === 'tile' && paneNode.dataset.pane === 'deck') return { kind: 'pane', node: paneNode, pane: 'deck' };
    if (kind === 'row' && paneNode.dataset.pane === 'collection') return { kind: 'pane', node: paneNode, pane: 'collection' };
    return null;
  };
  const endPress = () => {
    if (press?.timer) clearTimeout(press.timer);
    press = null;
    clearMarks();
    root.classList.remove('deck-editor-dragging');
  };
  panel.addEventListener('pointerdown', (ev) => {
    if (ev.button != null && ev.button !== 0) return;
    const payload = payloadOf(ev.target);
    if (!payload) return;
    const holdMs = ev.pointerType === 'touch' ? dragHoldMs : 0;
    press = { pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY, ...payload, armed: holdMs <= 0, dragging: false, timer: null };
    if (!press.armed) {
      const armed = press;
      press.timer = setTimeout(() => { if (press === armed) armed.armed = true; }, holdMs);
    }
  });
  panel.addEventListener('pointermove', (ev) => {
    if (!press || ev.pointerId !== press.pointerId) return;
    const moved = Math.hypot(ev.clientX - press.x, ev.clientY - press.y);
    if (!press.dragging) {
      if (moved < DRAG_SLOP) return;
      // A finger that moved before the hold armed it is scrolling, not dragging.
      if (!press.armed) { endPress(); return; }
      press.dragging = true;
      root.classList.add('deck-editor-dragging');
      press.source.closest?.('.deck-editor-item')?.classList.add('drag-source');
    }
    ev.preventDefault?.();
    for (const node of panel.querySelectorAll('.drop-target')) node.classList.remove('drop-target');
    dropTargetAt(ev.clientX, ev.clientY, press.kind)?.node.classList.add('drop-target');
  });
  panel.addEventListener('touchmove', (ev) => { if (press?.armed) ev.preventDefault?.(); }, { passive: false });
  panel.addEventListener('pointerup', (ev) => {
    if (!press || ev.pointerId !== press.pointerId) return;
    const done = press;
    endPress();
    if (!done.dragging) return; // a tap: the click that follows does the work
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 0);
    const target = dropTargetAt(ev.clientX, ev.clientY, done.kind);
    if (!target) return;
    if (target.kind === 'row') {
      if (target.instanceId === done.key) return;
      session.moveTo(done.key, run.deck.findIndex((c) => c.instanceId === target.instanceId));
      draw();
    } else if (target.pane === 'deck') add(done.key);
    else remove(done.key);
  });
  panel.addEventListener('pointercancel', (ev) => { if (press && ev.pointerId === press.pointerId) endPress(); });
  // The click a finished drag leaves behind is not a tap.
  panel.addEventListener('click', (ev) => {
    if (!swallowClick) return;
    swallowClick = false;
    ev.stopPropagation?.();
    ev.stopImmediatePropagation?.();
    ev.preventDefault?.();
  }, true);

  function footer() {
    const undo = focusable(button({ label: t('deckEditor.undo'), disabled: !session.canUndo, className: 'deck-editor-undo' }), 'undo');
    undo.addEventListener('click', () => { drop(); session.undo(); success = ''; notice = ''; draw(); });
    const cancel = button({ label: t('deckEditor.cancel'), id: 'deck-editor-cancel', className: 'deck-editor-cancel', attrs: { title: tFull('deckEditor.cancel') } });
    const done = button({
      label: t('deckEditor.done'), weight: 'primary', id: 'deck-editor-done', className: 'deck-editor-done',
      disabled: model.done.disabled, attrs: { title: tFull('deckEditor.done'), 'aria-describedby': 'deck-editor-refusal' },
    });
    done.setAttribute('aria-disabled', model.done.disabled ? 'true' : 'false');
    cancel.addEventListener('click', doCancel);
    done.addEventListener('click', doDone);
    focusable(cancel, 'cancel');
    focusable(done, 'done');
    // The refusal is visible text beside Done (FINISH §6), never only a colour.
    const refusal = el('p', {
      id: 'deck-editor-refusal', class: 'deck-editor-refusal', role: 'status', 'aria-live': 'polite',
      text: notice || model.done.refusal, hidden: !(notice || model.done.refusal),
    });
    const keys = el('p', {
      class: 'deck-editor-keys',
      text: held
        ? t('deckEditor.held', { name: model.deck.find((r) => r.instanceId === held)?.name || '' })
        : t('deckEditor.keys', {
          panes: '[ ]', filter: actionLabel('deck'), move: actionLabel('endTurn'), done: actionLabel('menu'), cancel: actionLabel('cancel'),
        }),
    });
    const foot = modalFooter({ secondary: [undo, cancel], primary: done, className: 'deck-editor-foot', size: 'medium' });
    return el('div', { class: 'deck-editor-footer' }, [refusal,
      el('div', { class: 'deck-editor-feedback', hidden: !success, role: 'status', 'aria-live': 'polite', text: success }), keys, foot]);
  }

  function draw() {
    model = deckEditorModel({ registries, run, settings, view });
    const rows = selected?.source === 'deck' ? model.deck : model.collection;
    const current = selected && rows.find(row => selectionKey(row, selected.source) === selected.key);
    if (current) selected = { ...selected, row: current };
    else {
      const row = model.collection[0] || model.deck[0];
      const source = model.collection.length ? 'collection' : 'deck';
      selected = row ? { row, source, key: selectionKey(row, source) } : null;
    }
    if (inspected) {
      const inspectedRows = inspected.source === 'deck' ? model.deck : model.collection;
      const currentInspected = inspectedRows.find(row => selectionKey(row, inspected.source) === inspected.key);
      inspected = currentInspected ? { ...inspected, row: currentInspected } : selected;
    }
    panel.replaceChildren?.();
    if (!panel.replaceChildren) panel.innerHTML = '';
    panel.dataset.mobileView = mobileView;
    if (onNavigate) {
      const head = modalHead({ tabs: [
        { id: 'character', label: t('progression.tab.character') }, { id: 'armory', label: t('armoury.hub.armory') }, { id: 'deck', label: t('armoury.hub.deck'), selected: true },
      ], showMenuButton: false, onClose: doCancel, onTab: id => {
        if (id === 'deck') return;
        const result = session.confirm();
        if (!result.ok) { notice = result.refusal || model.done.refusal; draw(); return; }
        close(); onNavigate(id);
      } });
      for (const tab of head.querySelectorAll('[data-modal-tab]')) progressionTip(tab,
        tab.dataset.modalTab === 'deck' ? 'Edit your deck' : `Save deck and open ${tab.textContent}`);
      panel.append(head);
    }
    panel.append(header(), el('div', { class: 'deck-editor-toolbar' }, [navigation(), tools()]), el('div', { class: 'deck-editor-panes', dataset: { active: pane } }, [collectionPane(), inspectPane(), deckPane()]), footer());
    restoreFocus();
  }

  function restoreFocus() {
    if (!focusKey) return;
    const previous = panel.querySelector(`[data-focus-key="${cssEscape(focusKey)}"]`);
    const node = previous && previous.closest?.('.deck-editor-group')?.open !== false ? previous
      : panel.querySelector(`[data-pane="${pane}"] [data-focus-key]`);
    if (!node) return;
    focusNode(node);
  }

  function focusNode(node) {
    if (typeof node.focus === 'function') node.focus({ preventScroll: false });
    focusKey = node.dataset.focusKey;
    try { focusElement(node); } catch { /* no focus cursor (a fixture) */ }
  }

  // ---- actions --------------------------------------------------------------
  function add(key) {
    const name = model.collection.find(row => row.key === key)?.name || '';
    const result = session.add(key);
    notice = result.ok ? '' : result.refusal;
    success = result.ok ? t('deckEditor.added', { name }) : '';
    draw();
    return result;
  }

  function remove(instanceId) {
    const name = model.deck.find(row => row.instanceId === instanceId)?.name || '';
    if (held === instanceId) drop();
    const result = session.remove(instanceId);
    notice = result.ok ? '' : result.refusal;
    success = result.ok ? t('deckEditor.removed', { name }) : '';
    draw();
    return result;
  }

  function togglePick(instanceId) {
    if (held === instanceId) { drop(); draw(); return; }
    held = instanceId;
    focusKey = `row-pick:${instanceId}`;
    // While a row is held, the arrows and ▲/▼ on the pad move it instead of
    // the focus cursor; A, X (the End Turn key) or Enter drops it.
    releaseGate?.();
    releaseGate = setInputGate((input) => (input.phase === 'down' ? heldInput(input) : input.phase === 'up' && isHeldKey(input)));
    draw();
  }

  function drop() {
    held = null;
    releaseGate?.();
    releaseGate = null;
  }

  function isHeldKey(input) {
    return (input.family === 'keyboard' && ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(input.key))
      || (input.family === 'controller' && [PAD.up, PAD.down, PAD.a, PAD.x, PAD.b].includes(input.button));
  }

  /** The held row's inputs. True when consumed (input.js stops there). */
  function heldInput(input) {
    if (!held) return false;
    const keyboard = input.family === 'keyboard';
    const up = keyboard ? input.key === 'ArrowUp' : input.button === PAD.up;
    const down = keyboard ? input.key === 'ArrowDown' : input.button === PAD.down;
    if (up || down) {
      session.move(held, up ? -1 : 1);
      draw();
      return true;
    }
    // Cancel is Cancel even mid-move: Esc and B restore the whole edit (the
    // hold included). Only Enter, A and X (the End Turn key) drop the row.
    if (keyboard ? input.key === 'Escape' : input.button === PAD.b) { doCancel(); return true; }
    const dropNow = keyboard
      ? (input.key === 'Enter' || matchAction({ key: input.key }, 'endTurn'))
      : [PAD.a, PAD.x].includes(input.button);
    if (dropNow) { drop(); draw(); return true; }
    return false;
  }

  function switchPane(step) {
    const at = DECK_PANES.indexOf(pane);
    pane = DECK_PANES[(at + step + DECK_PANES.length) % DECK_PANES.length];
    mobileView = pane;
    const first = [...panel.querySelectorAll(`[data-pane="${pane}"] .deck-editor-main`)]
      .find(node => node.closest?.('.deck-editor-group')?.open !== false)
      || panel.querySelector(`[data-pane="${pane}"] [data-focus-key]`);
    focusKey = first ? first.dataset.focusKey : null;
    draw();
  }

  function cycleFilters() {
    view = deckEditorView(nextFilterPreset(model, view));
    draw();
  }

  function focused() {
    return (focusKey && panel.querySelector(`[data-focus-key="${cssEscape(focusKey)}"]`)) || null;
  }

  function activateFocused() {
    const node = focused();
    if (node && typeof node.click === 'function') node.click();
  }

  function doDone() {
    const result = session.confirm();
    if (!result.ok) { notice = ''; draw(); return result; }
    close();
    onDone?.();
    return result;
  }

  function doCancel() {
    if (session.closed) return;
    session.cancel();
    close();
    onCancel?.();
  }

  /**
   * dispatch(input) → true when the editor acted. One door for the keyboard
   * and the pad: the window keydown listener, input.js's gate (held row) and a
   * test all come through here.
   */
  function dispatch(input) {
    if (session.closed) return false;
    if (held && heldInput(input)) return true;
    if (input.family === 'controller') {
      switch (input.button) {
        case PAD.a: activateFocused(); return true;
        case PAD.b: doCancel(); return true;
        case PAD.x: { const row = focusedRow(); if (row && model.ordered) togglePick(row); return !!row; }
        case PAD.y: cycleFilters(); return true;
        case PAD.lb: switchPane(-1); return true;
        case PAD.rb: switchPane(1); return true;
        case PAD.start: doDone(); return true;
        default: return false;
      }
    }
    const key = input.key || '';
    const probe = { key };
    if (key === 'Escape') { doCancel(); return true; }
    if (focused()?.tagName === 'INPUT') return false;
    // `[` / `]` are the tab ring's (input.js), which switches the pane once;
    // answering them here too switched it twice, i.e. not at all.
    if (matchAction(probe, 'menu')) { doDone(); return true; }
    if (matchAction(probe, 'deck')) { cycleFilters(); return true; }
    if (matchAction(probe, 'endTurn')) { const row = focusedRow(); if (row && model.ordered) togglePick(row); return !!row; }
    if (key === '+' || key === '=') {
      const tileKey = focused()?.dataset.key;
      if (tileKey) { add(tileKey); return true; }
      return false;
    }
    if (key === '-' || key === '_' || key === 'Delete' || key === 'Backspace') {
      const row = focusedRow();
      if (row) { remove(row); return true; }
      return false;
    }
    if (key === 'Enter' || key === ' ') {
      if (!focused()) return false;
      activateFocused();
      return true;
    }
    return false;
  }

  function focusedRow() {
    return focused()?.dataset.instanceId || null;
  }

  // ---- wiring ---------------------------------------------------------------
  const onKey = (ev) => {
    if (session.closed) return;
    // Enter and Space on a real focused button are the browser's own click.
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target && ['BUTTON', 'SUMMARY'].includes(ev.target.tagName)) return;
    if (dispatch({ family: 'keyboard', key: ev.key })) {
      ev.preventDefault?.();
      ev.stopPropagation?.();
    }
  };
  addEventListener('keydown', onKey);
  // LB/RB and `[` / `]` switch panes while the editor stands, through the
  // tab ring alone (Law 3: the
  // bumpers ride the open surface's set).
  setTabRing({ prev: () => switchPane(-1), next: () => switchPane(1) });

  // A REAL MODAL. Everything beside the veil is `inert` while it stands, so
  // neither Tab nor a pointer can reach the map's Save & quit (which would
  // persist a half-edited deck) or a second Deck door (which would snapshot
  // the mid-edit state). The shell's dismiss binding adds the Tab wrap and
  // Escape (topmost modal only), and returns focus to the opener on close.
  const madeInert = [];
  for (const sibling of [...(host.children || [])]) {
    if (sibling === root || sibling.hasAttribute?.('inert')) continue;
    sibling.setAttribute('inert', '');
    madeInert.push(sibling);
  }
  const releaseDismiss = bindModalDismiss({ veil: root, panel, close: () => doCancel() });

  function close() {
    animationPreview?.dispose();
    animationPreview = null;
    drop();
    removeEventListener('keydown', onKey);
    setTabRing(null);
    for (const sibling of madeInert.splice(0)) sibling.removeAttribute('inert');
    releaseDismiss({ restoreFocus: true });
    root.remove();
    if (liveEditor && liveEditor.root === root) liveEditor = null;
  }

  draw();
  const first = panel.querySelector('[data-pane="collection"] .deck-editor-main');
  if (first) focusNode(first);

  liveEditor = { root, dispatch, close: () => { if (!session.closed) session.cancel(); close(); }, session };
  return liveEditor;
}

function isInside(node, ancestor) {
  for (let at = node; at; at = at.parentNode) if (at === ancestor) return true;
  return false;
}

function cssEscape(value) {
  return String(value).replace(/["\\]/g, '\\$&');
}
