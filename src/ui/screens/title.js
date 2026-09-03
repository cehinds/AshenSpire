// src/ui/screens/title.js — folded title menu with load/new slot modal.
//
// The title owns layout and interaction state; save-slot content stays in the
// records handed in by main.js. The same modal shell serves LOAD and NEW so the
// art and spacing can evolve without duplicating the screen structure.

import { beatArmer } from '../../framework/optionDecision.js';
import { buildStampHtml } from '../components/buildstamp.js';
import { hudQuickSettingsHtml, wireHudQuickSettings } from '../components/hudQuickSettings.js';
import { closeSaveSlotSelector, openSaveSlotSelector, slotOption, slotDoor } from '../components/saveSlotSelector.js';
import { html, titleMenu } from '../kit/index.js';
import { hudQuickSettingsModel } from '../models/HudQuickSettingsModel.js';
import { saveSlotSelectionModel } from '../models/SaveSlotSelectionModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { focusElement } from '../input.js';

let releaseActiveTitleBack = null;

export function focusTitleDefault(app, { showCursor = true } = {}) {
  const control = app?.querySelector('.title-menu .slot-continue:not([disabled]), .title-menu .slot-new:not([disabled]), .title-menu button:not([disabled])');
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
  onDelete,
  onHistory,
  onProfile,
  onSettings,
  onSettingsChange,
  onCollapse,
  onQuit,
  onCustom,
  onLan,
  onCompendium,
}) {
  const occupied = slots.filter(({ summary }) => !!summary);
  let modal = null;
  let selectedSlot = null;

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
    if (releaseActiveTitleBack === releaseTitleBack) releaseActiveTitleBack = null;
  };
  releaseActiveTitleBack = releaseTitleBack;

  const selectionModel = (kind = modal) => saveSlotSelectionModel(slots, { kind, selectedSlot });

  const modalSlotRows = (model) => model.children
    .filter((child) => child.component === UI.titleSaveSlot)
    .map(({ properties }) => {
      const { slot, selectable, selected } = properties;
      const summary = slots.find((record) => record.slot === slot)?.summary || null;
      return slotOption({ slot, summary, selected, selectable, deletable: !!(summary && onDelete) });
    });

  // THE FRONT DOOR IS THE KIT'S TitleMenu: display face, centred, ornamented,
  // the one menu with no panel around it. The stable component ids ride on
  // the kit's parts (the lockup is the assembly, the wordmark its name, the
  // divider its first ornament, the gem its second) so the tools that read
  // the page keep reading it.
  const menuHtml = () => {
    const continueSlot = occupied[0]?.slot ?? null;
    const entry = (label, action, { id = '', className = '', disabled = false } = {}) => ({
      label,
      className: `title-menu-item ${className}`.trim(),
      disabled,
      attrs: { id: id || null, dataset: { titleAction: action, component: UI.titleMenuItem } },
    });
    const menu = titleMenu({
      name: 'ASHEN SPIRE',
      subtitle: 'A roguelike deckbuilder',
      entries: [
        entry('Continue', 'continue', { className: 'slot-continue', disabled: continueSlot == null }),
        entry('Load', 'load', { id: 'load-game' }),
        entry('New', 'new', { id: 'new-game', className: 'slot-new' }),
        // #armaments remains the compatibility anchor for the existing watched probe.
        entry('Collection', 'collection', { id: 'armaments' }),
        entry('Settings', 'settings', { id: 'settings' }),
        entry('Quit', 'quit', { id: 'quit-game' }),
      ],
      attrs: { 'data-component': UI.titleBrandLockup },
    });
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
    const tagline = document.createElement('p');
    tagline.className = 'tm-foot title-tagline';
    tagline.dataset.component = UI.titleTagline;
    tagline.textContent = 'The ember flows upward. Follow it.';
    menu.appendChild(tagline);
    return html(menu);
  };

  const modalHtml = () => {
    if (!modal) return '';
    const model = selectionModel();
    const door = slotDoor({
      eyebrow: 'New game',
      title: 'Choose a slot',
      closeLabel: 'Close New Game',
      rows: modalSlotRows(model),
      backLabel: 'Back',
      continueLabel: 'Continue',
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
    selectedSlot = saveSlotSelectionModel(slots, { kind }).properties.selectedSlot;
    render();
    focusModal(selectedSlot == null ? undefined : `[data-slot-pick="${selectedSlot}"]`);
  };

  const openLoadSelector = (launcher) => {
    openSaveSlotSelector({
      host: app,
      slots,
      meta,
      registries,
      inlineReview: true,
      returnFocusElement: launcher,
      onRequestLoad: (slot) => onContinue(slot),
      onDelete,
    });
  };

  const closeModal = () => {
    modal = null;
    selectedSlot = null;
    render();
    focusTitleDefault(app, { showCursor: false });
  };

  const activateSlot = (slot) => {
    selectedSlot = slot;
    render();
    focusModal(`[data-slot-pick="${selectedSlot}"]`);
  };

  const wireDelete = (root) => {
    if (!onDelete) return;
    const arm = beatArmer(meta, registries);
    root.querySelectorAll('.title-slot-delete').forEach((button) => {
      arm(button, 'deleteSave', { onConfirm: () => onDelete(+button.dataset.slotDelete) });
      button.title = button.dataset.holdMs ? 'Hold to delete this run' : 'Delete this run';
    });
  };

  function render() {
    app.innerHTML = `
      <div class="screen title-screen">
        ${Array.from({ length: 7 }, (_, i) => `<span class="ember" style="left:${8 + ((i * 13.7) % 84)}%;animation-delay:${(i * 1.7) % 9}s;animation-duration:${7 + (i % 4) * 2}s"></span>`).join('')}
        ${hudQuickSettingsHtml(hudQuickSettingsModel({ place: 'title', presentation: registries.balance.ui.hudQuickSettings, settings: meta.settings || {} }))}
        ${menuHtml()}
        ${buildStampHtml('title')}
        ${modalHtml()}
      </div>`;

    wireHudQuickSettings(app, { settings: meta.settings || {}, onSettingsChange });
    const root = app.querySelector('.title-screen');
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeModal();
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
    root.querySelectorAll('[data-title-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.titleAction;
        if (action === 'continue') onContinue(occupied[0].slot);
        else if (action === 'load') openLoadSelector(button);
        else if (action === 'new') openModal(action);
        else if (action === 'collection' && onCompendium) onCompendium();
        else if (action === 'settings') onSettings();
        else if (action === 'quit' && onQuit) onQuit();
        else if (action === 'close-modal' || action === 'back') closeModal();
        else if (action === 'modal-continue') {
          const target = selectionModel().properties.actionSlot;
          if (target == null) return;
          onNew(target);
        }
      });
    });
    root.querySelector('[data-title-modal-scrim]')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeModal();
    });
    root.querySelectorAll('[data-slot-pick]').forEach((button) => {
      button.addEventListener('click', () => {
        activateSlot(+button.dataset.slotPick);
      });
    });
    wireDelete(root);
    if (onHistory) void onHistory;
    if (onProfile) void onProfile;
    if (onCustom) void onCustom;
    if (onLan) void onLan;
  }

  render();

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.repeat || event.defaultPrevented) return;

    // Controller Cancel is synthesized at window rather than at the focused
    // element. Give the title's own modal and the shared Load selector the same
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
