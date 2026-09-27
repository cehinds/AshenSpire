// src/ui/screens/deckEditor.js — the deck editor (SPEC §14.1 UX), mounted over
// whatever opened it: the map's Quick Access, the Armoury, or a Rest screen.
//
// THE SCREEN DECIDES NOTHING. Every row, count, refusal and disabled state is
// read off `deckEditorModel` (ui/models/DeckEditorModel.js), and every change
// goes through the session `openDeckEdit` returns, which in turn goes through
// model/deckRules.js. Cancel is the session's `cancel()` — `cancelDeckEdit`
// over the snapshot `beginDeckEdit` took when this screen opened — so the two
// piles, the attack-slot allocation and the mint counter come back exactly.
//
// EVERY DRAG HAS TWO TWINS (SPEC §14.1 UX). A card moves by:
//   · a tap on its tile or row (the main face is one big button),
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
import { bindModalDismiss, modalFooter } from '../components/modalShell.js';
import { markUiComponent, UI_COMPONENTS as UI } from '../components/uiComponents.js';
import { actionLabel, focusElement, matchAction, setInputGate, setTabRing } from '../input.js';
import { DECK_PANES, deckEditorModel, deckEditorView, nextFilterPreset, openDeckEdit } from '../models/DeckEditorModel.js';
import { t, tFull } from '../strings.js';

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

export function mountDeckEditor(host, { registries, run, settings = {}, onDone = null, onCancel = null, dragHoldMs = DRAG_HOLD_MS }) {
  if (liveEditor && liveEditor.root.isConnected && !liveEditor.session.closed) return liveEditor;
  const session = openDeckEdit(registries, run, settings);
  let view = deckEditorView({});
  let pane = 'collection';
  let held = null; // instanceId of the deck row picked up for reordering
  let focusKey = null;
  let notice = '';
  let model = null;
  let releaseGate = null;


  const root = el('div', { class: 'modal-veil deck-editor-veil' });
  const panel = el('section', {
    class: 'deck-editor', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'deck-editor-title',
  });
  root.appendChild(panel);
  markUiComponent(root, UI.deckEditor);
  host.appendChild(root);

  // ---- rendering ------------------------------------------------------------
  const focusable = (node, key) => {
    node.dataset.focusKey = key;
    node.dataset.focusable = 'true';
    node.addEventListener('focus', () => { focusKey = key; pane = node.closest?.('[data-pane]')?.dataset.pane || pane; });
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
      el('h2', { id: 'deck-editor-title', class: 'deck-editor-title', text: t('deckEditor.title') }),
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
    return el('div', { class: 'deck-editor-tools' }, [
      el('div', { class: 'deck-editor-chips', role: 'group', 'aria-label': t('deckEditor.filters') }, [
        el('span', { class: 'deck-editor-chips-label', text: t('deckEditor.filters') }), ...filterChips,
      ]),
      // Under Play in deck order the deck's order IS the arrangement, so no
      // sort is offered (a sort chip that did nothing to the deck would lie).
      model.ordered ? null : el('div', { class: 'deck-editor-chips', role: 'group', 'aria-label': t('deckEditor.sort') }, [
        el('span', { class: 'deck-editor-chips-label', text: t('deckEditor.sort') }), ...sortChips,
      ]),
    ]);
  }

  // `grouped` is a deck row standing for several copies; a collection tile's
  // own counts are its meta line, never a badge.
  const cardFace = (row, extra, grouped = false) => [
    el('span', { class: 'deck-editor-cost', 'aria-hidden': 'true', text: row.costBucket === 'X' ? 'X' : String(row.cost) }),
    el('span', { class: 'deck-editor-name', text: row.name }),
    el('span', { class: 'deck-editor-meta', text: extra }),
    // Unordered, a deck row stands for every copy of its variant (SPEC §14.7).
    grouped && row.countText ? el('span', { class: 'deck-editor-count', title: tFull('deckEditor.count', { count: row.count }), text: row.countText }) : null,
  ].filter(Boolean);





  function collectionPane() {
    const list = el('div', { class: 'deck-editor-list', role: 'list' });
    for (const tile of model.collection) {
      const main = focusable(el('button', {
        type: 'button', class: 'deck-editor-main', dataset: { action: 'add', key: tile.key },
        'aria-label': tFull('deckEditor.add', { name: tile.name }),
        'aria-disabled': tile.addable ? 'false' : 'true',
        title: tile.refusal || tFull('deckEditor.add', { name: tile.name }),
      }, cardFace(tile, tile.countText)), `tile:${tile.key}`);
      main.addEventListener('click', () => add(tile.key));
      const plus = focusable(el('button', {
        type: 'button', class: 'deck-editor-step', dataset: { action: 'add', key: tile.key },
        'aria-label': tFull('deckEditor.add', { name: tile.name }), 'aria-disabled': tile.addable ? 'false' : 'true',
        text: t('deckEditor.add', { name: tile.name }),
      }), `tile-add:${tile.key}`);
      plus.addEventListener('click', () => add(tile.key));
      list.appendChild(el('div', {
        class: `deck-editor-item deck-editor-tile${tile.addable ? '' : ' spent'}`, role: 'listitem',
        dataset: { key: tile.key, source: tile.source, unlimited: tile.unlimited ? 'true' : 'false' },
      }, [main, el('div', { class: 'deck-editor-actions' }, [plus])]));
    }
    if (!model.collection.length) list.appendChild(el('p', { class: 'deck-editor-empty', text: t('deckEditor.empty.collection') }));
    return paneSection('collection', t('deckEditor.pane.collection'), list);
  }

  function deckPane() {
    const list = el('div', { class: 'deck-editor-list', role: 'list' });
    for (const row of model.deck) {
      const main = focusable(el('button', {
        type: 'button', class: 'deck-editor-main', dataset: { action: 'remove', instanceId: row.instanceId },
        'aria-label': row.locked ? row.lockSentence : tFull('deckEditor.remove', { name: row.name }),
        'aria-disabled': row.removable ? 'false' : 'true',
        title: row.locked ? row.lockSentence : tFull('deckEditor.remove', { name: row.name }),
      }, cardFace(row, row.locked ? row.lockText : t(`deckEditor.source.${row.source}`), true)), `row:${row.groupKey}`);
      main.addEventListener('click', () => remove(row.instanceId));
      const item = el('div', {
        class: `deck-editor-item deck-editor-row${row.locked ? ' locked' : ''}${held === row.instanceId ? ' held' : ''}`, role: 'listitem',
        dataset: { instanceId: row.instanceId, source: row.source },
      }, [main]);
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
      list.appendChild(item);
    }
    if (!model.deck.length) list.appendChild(el('p', { class: 'deck-editor-empty', text: t('deckEditor.empty.deck') }));
    return paneSection('deck', t('deckEditor.pane.deck'), list);
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
    if (main.dataset.action === 'add' && main.getAttribute('aria-disabled') !== 'true') return { kind: 'tile', key: main.dataset.key, source: main };
    if (main.dataset.action === 'remove' && (main.getAttribute('aria-disabled') !== 'true' || model.ordered)) return { kind: 'row', key: main.dataset.instanceId, source: main };
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
    const foot = modalFooter({ secondary: [cancel], primary: done, className: 'deck-editor-foot', size: 'medium' });
    return el('div', { class: 'deck-editor-footer' }, [refusal, keys, foot]);
  }

  function draw() {
    model = deckEditorModel({ registries, run, settings, view });
    panel.replaceChildren?.();
    if (!panel.replaceChildren) panel.innerHTML = '';
    panel.append(header(), tools(), el('div', { class: 'deck-editor-panes', dataset: { active: pane } }, [collectionPane(), deckPane()]), footer());
    restoreFocus();
  }

  function restoreFocus() {
    if (!focusKey) return;
    const node = panel.querySelector(`[data-focus-key="${cssEscape(focusKey)}"]`)
      || panel.querySelector(`[data-pane="${pane}"] [data-focus-key]`);
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
    const result = session.add(key);
    notice = result.ok ? '' : result.refusal;
    draw();
    return result;
  }

  function remove(instanceId) {
    if (held === instanceId) drop();
    const result = session.remove(instanceId);
    notice = result.ok ? '' : result.refusal;
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
    const first = panel.querySelector(`[data-pane="${pane}"] [data-focus-key]`);
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
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target && ev.target.tagName === 'BUTTON') return;
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
    drop();
    removeEventListener('keydown', onKey);
    setTabRing(null);
    for (const sibling of madeInert.splice(0)) sibling.removeAttribute('inert');
    releaseDismiss({ restoreFocus: true });
    root.remove();
    if (liveEditor && liveEditor.root === root) liveEditor = null;
  }

  draw();
  const first = panel.querySelector('[data-pane="collection"] [data-focus-key]');
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
