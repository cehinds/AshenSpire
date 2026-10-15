import { loadableTitleSlots } from '../models/GameProfileTitleModel.js';
// src/ui/screens/title.js — folded title menu with load/new slot modal.
//
// The title owns layout and interaction state; save-slot content stays in the
// records handed in by main.js. The same modal shell serves LOAD and NEW so the
// art and spacing can evolve without duplicating the screen structure.

import { beatArmer } from '../../framework/optionDecision.js';
import { buildStampHtml } from '../components/buildstamp.js';
import { closeSaveSlotSelector, deleteSlotReview, openSaveSlotSelector, slotFacts, slotOption, slotDoor, slotDecisionDoor } from '../components/saveSlotSelector.js';
import { el, html, titleMenu } from '../kit/index.js';
import { t, tFull } from '../strings.js';
import { saveSlotSelectionModel } from '../models/SaveSlotSelectionModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { focusElement } from '../input.js';
import { assetUrl } from '../assetmap.js';
import { engravedIconHtml } from '../components/engravedIcon.js';
import { registerModal } from '../modalState.js';

let releaseActiveTitleBack = null;

// The Title's default focus, in PRIORITY order, not document order: Continue
// when there is a run to continue, else Quick start (FINISH §6: a keyboard or
// controller player's first press after the startup gate is the quick start),
// else New, else the first live control. One comma-joined querySelector would
// answer in document order and only happen to agree.
const TITLE_DEFAULT_FOCUS = ['.slot-continue', '.slot-quick', '.slot-new', 'button']
  .map((s) => `.title-menu ${s}:not([disabled])`);
export function focusTitleDefault(app, { showCursor = true } = {}) {
  const control = TITLE_DEFAULT_FOCUS.map((s) => app?.querySelector(s)).find(Boolean);
  if (!control) return false;
  control.focus({ preventScroll: true });
  if (showCursor) focusElement(control);
  return document.activeElement === control;
}
export function mountTitle(app, {
  slots,
  meta,
  registries,
  onContinue,
  onNew,
  onQuickStart = null,
  onDelete,
  onHistory,
  onProfile,
  onSettings,
  onOffline,
  onSettingsChange,
  onCollapse,
  onQuit,
  onCustom,
  onLan,
  onCompendium,
  onBestiary,
  reopen = null, // 'new' | 'load' — re-open that door after a remount (a delete returns to where it was)
  // Draws the built-in art's notice into the title root after every render
  // (step 5, src/ui/components/artLoadNotice.js); the composition root decides
  // whether there is one. The title's own redraws would otherwise drop it.
  artNotice = null,
}) {
  // A delete from this Title replaces the slot list in place (deleteSlot), so
  // every read goes through currentSlots and occupied() rather than the mount's
  // argument.
  let currentSlots = slots;
  const occupied = () => loadableTitleSlots(currentSlots);
  let modal = null;
  let selectedSlot = null;
  let newReviewSlot = null; // the slot the New Game decision door is asking about
  let activatedSlot = null; // the slot the last tap landed on — a second tap on it opens the door
  let releaseTitleModal = null; // modalState.js entry for the open New Game door
  let registeredLayer = null; // the modal layer element that entry was registered against
  let introPlayed = false; // the scene replays itself on the first render of this mount only

  // Only one title mount may own the global Cancel action. render() replaces
  // the title DOM in place, so this listener lives for the mount rather than
  // for one rendered root and is released when another screen replaces it.
  releaseActiveTitleBack?.();
  const titleBackAbort = new AbortController();
  let titleBackObserver = null;
  const releaseTitleBack = () => {
    titleBackAbort.abort();
    titleBackObserver?.disconnect();
    titleBackObserver = null;
    releaseTitleModal?.();
    releaseTitleModal = null;
    if (releaseActiveTitleBack === releaseTitleBack) releaseActiveTitleBack = null;
  };
  releaseActiveTitleBack = releaseTitleBack;

  const selectionModel = (kind = modal) => saveSlotSelectionModel(currentSlots, { kind, selectedSlot });

  const modalSlotRows = (model) => model.children
    .filter((child) => child.component === UI.titleSaveSlot)
    .map(({ properties }) => {
      const { slot, selectable, selected } = properties;
      const summary = currentSlots.find((record) => record.slot === slot)?.summary || null;
      return slotOption({ slot, summary, selected, selectable, deletable: !!(summary && onDelete) });
    });

  // THE FRONT DOOR IS THE KIT'S TitleMenu: display face, centred, ornamented,
  // the one menu with no panel around it. The stable component ids ride on
  // the kit's parts (the lockup is the assembly, the wordmark its name, the
  // divider its first ornament, the gem its second) so the tools that read
  // the page keep reading it.
  const menuHtml = () => {
    const continueSlot = occupied()[0]?.slot ?? null;
    const entry = (label, action, { id = '', className = '', disabled = false, reason = '' } = {}) => ({
      label,
      className: `title-menu-item ${className}`.trim(),
      disabled,
      reason,
      attrs: { id: id || null, dataset: { titleAction: action, component: UI.titleMenuItem } },
    });
    const menu = titleMenu({
      name: 'ASHEN SPIRE',
      subtitle: 'A roguelike deckbuilder',
      entries: [
        ...(continueSlot == null ? [] : [entry('Continue', 'continue', { className: 'slot-continue' })]),
        entry('New Game', 'new', { id: 'new-game', className: 'slot-new' }),
        ...(continueSlot == null ? [] : [entry('Load Game', 'load', { id: 'load-game' })]),
        entry('Settings', 'settings', { id: 'settings' }),
        entry('Exit', 'quit', { id: 'quit-game' }),
      ],
      attrs: { 'data-component': UI.titleBrandLockup },
    });
    const quick = menu.querySelector('#quick-start');
    if (quick) quick.title = tFull('title.quickstart');
    menu.querySelector('.tm-name').dataset.component = UI.titleWordmark;
    menu.querySelector('.tm-name').classList.add('title-glow');
    menu.querySelector('.tm-sub').dataset.component = UI.titleSubtitle;
    const [first, second] = menu.querySelectorAll('.as-ornament');
    first.dataset.component = UI.titleDivider;
    second.querySelector('span').dataset.component = UI.titleMenuGem;
    const list = menu.querySelector('ul');
    list.className = 'title-menu';
    list.dataset.component = UI.titleMenu;
    list.setAttribute('aria-label', 'Ashen Spire main menu');
    for (const [action, icon] of Object.entries({ history: 'history', collection: 'compendium', settings: 'settings', lan: 'coop' })) {
      list.querySelector(`[data-title-action="${action}"]`)?.insertAdjacentHTML('afterbegin', engravedIconHtml(icon));
    }
    // W3b: an available Continue is highlighted and its exact save sits beside
    // the menu (below it on narrow hosts); the wordmark above stays centred.
    // With no save this is W3a: the lone centred menu, no empty placeholder.
    const saved = occupied()[0];
    if (saved) {
      list.querySelector('.slot-continue')?.classList.add('is-highlighted');
      const resume = list.querySelector('.slot-continue');
      const copy = el('span', { class: 'title-save-preview' }, [
        el('span', { class: 'title-save-heading', text: t('common.continue') }),
        el('span', { class: 'title-save-name', text: saved.summary.className }),
        el('span', { class: 'title-save-facts', text: slotFacts(saved.summary) }),
      ]);
      resume.replaceChildren(copy);
      resume.insertAdjacentHTML('afterbegin', engravedIconHtml('journey'));
      resume.insertAdjacentHTML('beforeend', engravedIconHtml('next'));
    }
    const tagline = document.createElement('p');
    tagline.className = 'tm-foot title-tagline';
    tagline.dataset.component = UI.titleTagline;
    tagline.textContent = 'The ember flows upward. Follow it.';
    menu.appendChild(tagline);
    return html(menu);
  };

  const modalHtml = () => {
    if (!modal) return '';
    if (newReviewSlot != null) {
      const summary = currentSlots.find((record) => record.slot === newReviewSlot)?.summary || null;
      return `<div class="modal-veil title-modal-veil" data-title-modal-scrim>${html(slotDecisionDoor({ kind: 'new', slot: newReviewSlot, summary }))}</div>`;
    }
    const model = selectionModel();
    // W1l: titled by what it is for, primary by what it does.
    const door = slotDoor({
      eyebrow: '',
      title: t('title.slots.door.new'),
      closeLabel: 'Close New Game',
      rows: modalSlotRows(model),
      backLabel: t('common.back'),
      continueLabel: t('title.slots.primary.new'),
      canContinue: !!model.properties.canContinue,
      actionSlot: model.properties.actionSlot,
    });
    return `<div class="modal-veil title-modal-veil" data-title-modal-scrim>${html(door)}</div>`;
  };

  const focusModal = (selector = '.title-slot-pick:not([disabled]), .title-modal-back') => {
    const control = app.querySelector(selector);
    if (control) {
      control.focus({ preventScroll: true });
      focusElement(control);
    }
  };

  const openModal = (kind) => {
    modal = kind;
    activatedSlot = null;
    selectedSlot = saveSlotSelectionModel(currentSlots, { kind }).properties.selectedSlot;
    renderModal();
    focusModal(selectedSlot == null ? undefined : `[data-slot-pick="${selectedSlot}"]`);
  };

  const openLoadSelector = (launcher) => {
    openSaveSlotSelector({
      host: app,
      slots: currentSlots,
      meta,
      registries,
      inlineReview: true,
      returnFocusElement: launcher,
      onRequestLoad: (slot) => onContinue(slot),
      onRequestNew: (slot) => onNew(slot),
      onDelete: (slot) => deleteSlot(slot, 'load'),
    });
  };

  const openNewReview = (slot) => {
    if (slot == null) return;
    newReviewSlot = slot;
    renderModal();
    focusModal('[data-title-action="review-new"]');
  };
  const closeNewReview = () => {
    const slot = newReviewSlot;
    newReviewSlot = null;
    renderModal();
    focusModal(`[data-slot-pick="${slot}"]`);
  };
  const closeModal = () => {
    modal = null;
    selectedSlot = null;
    newReviewSlot = null;
    activatedSlot = null;
    renderModal();
    focusTitleDefault(app, { showCursor: false });
  };

  const wireTitleActions = (scope) => {
    scope.querySelectorAll('[data-title-action]').forEach((button) => {
      if (button.closest('[data-title-modal-layer]')) return; // wired by renderModal()
      button.addEventListener('click', () => {
        const action = button.dataset.titleAction;
        if (action === 'continue') onContinue(occupied()[0].slot);
        else if (action === 'quick-start') onQuickStart?.();
        else if (action === 'load') openLoadSelector(button);
        else if (action === 'new') openModal(action);
        else if (action === 'collection' && onCompendium) onCompendium();
        else if (action === 'bestiary') onBestiary?.();
        else if (action === 'history') onHistory?.();
        else if (action === 'profile') onProfile?.();
        else if (action === 'custom') onCustom?.();
        else if (action === 'lan') onLan?.();
        else if (action === 'settings') onSettings();
        else if (action === 'offline') onOffline?.();
        else if (action === 'quit' && onQuit) onQuit();
      });
    });
  };

  // A slot deletion changes only the Continue/save preview in the menu. Swap
  // that fragment and leave the title root, artwork, embers, quick settings and
  // their animation state intact.
  function renderMenu() {
    const current = app.querySelector('.as-titlemenu');
    if (!current) return;
    const holder = document.createElement('div');
    holder.innerHTML = menuHtml();
    const next = holder.firstElementChild;
    if (!next) return;
    current.replaceWith(next);
    wireTitleActions(next);
  }

  const activateSlot = (slot) => {
    // Two taps: the first highlights, the second on the highlighted slot opens
    // its decision door (Start / Overwrite). Continue opens it as well.
    const repeat = selectedSlot === slot && activatedSlot === slot;
    selectedSlot = slot;
    activatedSlot = slot;
    if (repeat) { openNewReview(slot); return; }
    renderModal();
    focusModal(`[data-slot-pick="${selectedSlot}"]`);
  };

  // A delete updates the Title in place: the host returns the fresh slot list,
  // the mount keeps it, and only the affected menu and modal fragments redraw.
  // The New door stays open; the load selector is reopened with fresh rows.
  const deleteSlot = (slot, from) => {
    const fresh = onDelete(slot, from);
    if (!Array.isArray(fresh)) return;
    currentSlots = fresh;
    const stillThere = (value) => value != null && currentSlots.some((record) => record.slot === value);
    if (!stillThere(activatedSlot)) activatedSlot = null;
    if (modal && !stillThere(selectedSlot)) selectedSlot = saveSlotSelectionModel(currentSlots, { kind: modal }).properties.selectedSlot;
    renderMenu();
    renderModal();
    if (modal) focusModal(selectedSlot == null ? undefined : `[data-slot-pick="${selectedSlot}"]`);
    if (from === 'load') openLoadSelector(app.querySelector('[data-title-action="load"]'));
  };

  const wireDelete = (root) => {
    if (!onDelete) return;
    const arm = beatArmer(meta, registries);
    root.querySelectorAll('.title-slot-delete').forEach((button) => {
      const slot = +button.dataset.slotDelete;
      arm(button, 'deleteSave', {
        ...deleteSlotReview(slot, currentSlots.find((record) => record.slot === slot)?.summary || null),
        onConfirm: () => deleteSlot(slot, 'new'),
      });
      button.title = button.dataset.holdMs ? 'Hold to delete this run' : 'Delete this run';
    });
  };

  // Redraws only the New Game modal layer. The modal's own handlers call this
  // instead of render(), so a click inside the modal never rebuilds the Title
  // screen (no intro replay, no new embers, no HUD re-wire).
  function renderModal() {
    const layer = app.querySelector('[data-title-modal-layer]');
    if (!layer) return;
    layer.innerHTML = modalHtml();
    layer.querySelector('[data-title-modal-scrim]')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeModal();
    });
    layer.querySelectorAll('[data-slot-pick]').forEach((button) => {
      button.addEventListener('click', () => {
        activateSlot(+button.dataset.slotPick);
      });
    });
    wireDelete(layer);
    layer.querySelectorAll('[data-title-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.titleAction;
        if (action === 'close-modal' || action === 'back') closeModal();
        else if (action === 'modal-continue') openNewReview(selectionModel().properties.actionSlot);
        else if (action === 'review-back') closeNewReview();
        else if (action === 'review-new') {
          if (newReviewSlot == null) return;
          onNew(newReviewSlot);
        }
      });
    });
    // The New Game door is a registered modal while it is open. A render() builds
    // a new layer element, so an entry made against the old one is replaced here.
    // The new entry goes in before the old one is released, so the stack never
    // reads empty in between.
    if (modal && (!releaseTitleModal || registeredLayer !== layer)) {
      const previous = releaseTitleModal;
      releaseTitleModal = registerModal('title-new', layer);
      registeredLayer = layer;
      previous?.();
    } else if (!modal && releaseTitleModal) {
      releaseTitleModal();
      releaseTitleModal = null;
      registeredLayer = null;
    }
  }

  function render() {
    // The modal layer is display:contents on purpose: `.title-screen > *` (ui.css)
    // makes a direct child a z-index:1 stacking context, which would trap the
    // modal veil under the menu panel.
    app.innerHTML = `
      <div class="screen title-screen">
        <div class="title-landscape" aria-hidden="true"></div>
        <img class="title-traveler" src="${assetUrl('assets/player-polish/illustrations/title-traveler.webp')}" alt="" aria-hidden="true">
        <div class="tower-hall" aria-hidden="true"><div class="tower-interior-city"></div><div class="tower-door-frame"></div></div>
        ${Array.from({ length: 7 }, (_, i) => `<span class="ember" style="left:${8 + ((i * 13.7) % 84)}%;animation-delay:${(i * 1.7) % 9}s;animation-duration:${7 + (i % 4) * 2}s"></span>`).join('')}
        ${menuHtml()}
        ${buildStampHtml('title')}
        <div class="title-modal-layer" data-title-modal-layer style="display:contents">${modalHtml()}</div>
      </div>`;

    const root = app.querySelector('.title-screen');
    const replayScene = () => {
      if (document.body.classList.contains('reduced-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      root.querySelector('.title-landscape')?.animate([{ opacity: .35, transform: 'scale(1.04)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 1400, easing: 'ease-out' });
      root.querySelector('.title-traveler')?.animate([{ opacity: 0, transform: 'translateX(-18px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 1000, easing: 'ease-out' });
    };
    root.querySelector('.tower-preview-replay')?.addEventListener('click', replayScene);
    // The scene plays on the first render of this mount only; the Replay button
    // plays it on demand. A redraw after a delete must not replay it.
    if (!introPlayed) {
      introPlayed = true;
      replayScene();
    }
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (newReviewSlot != null) closeNewReview();
        else closeModal();
      } else if (event.key === 'Tab' && modal) {
        const controls = [...root.querySelectorAll('.title-menu-modal button:not([disabled])')];
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus({ preventScroll: true });
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus({ preventScroll: true });
        }
      }
    });
    wireTitleActions(root);
    renderModal();
    artNotice?.(root);
  }

  render();
  // Back where the player was: a delete remounts the title, and the door it
  // was done from re-opens with the slot now empty.
  if (reopen === 'new') openModal('new');
  else if (reopen === 'load') openLoadSelector(app.querySelector('[data-title-action="load"]'));

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.repeat || event.defaultPrevented) return;

    // Controller Cancel is synthesized at the document rather than at the
    // focused element. Give the title's own modal and the shared Load selector the same
    // priority they receive from a physical keyboard press.
    if (modal) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeModal();
      return;
    }
    if (document.querySelector('.title-modal-veil')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeSaveSlotSelector();
      return;
    }
    const more = app.querySelector('.title-more[open]');
    if (more) {
      event.preventDefault();
      event.stopImmediatePropagation();
      more.open = false;
      more.querySelector('summary')?.focus();
      return;
    }

    // Other dialogs and selectors own Back before the expanded title does.
    if (document.querySelector('[aria-modal="true"]') || typeof onCollapse !== 'function') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    onCollapse();
  }, { signal: titleBackAbort.signal });

  titleBackObserver = new MutationObserver(() => {
    queueMicrotask(() => {
      if (!app.querySelector('.title-screen')) releaseTitleBack();
    });
  });
  titleBackObserver.observe(app, { childList: true });
}
