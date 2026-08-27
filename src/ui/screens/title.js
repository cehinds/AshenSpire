// src/ui/screens/title.js — folded title menu with load/new slot modal.
//
// The title owns layout and interaction state; save-slot content stays in the
// records handed in by main.js. The same modal shell serves LOAD and NEW so the
// art and spacing can evolve without duplicating the screen structure.

import { esc } from '../components/tooltip.js';
import { beatArmer } from '../components/holdconfirm.js';
import { buildStampHtml } from '../components/buildstamp.js';
import { hudQuickSettingsHtml, wireHudQuickSettings } from '../components/hudQuickSettings.js';
import { openSaveSlotSelector } from '../components/saveSlotSelector.js';
import { hudQuickSettingsModel } from '../models/HudQuickSettingsModel.js';
import { saveSlotSelectionModel } from '../models/SaveSlotSelectionModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { focusElement } from '../input.js';

export function focusTitleDefault(app, { showCursor = true } = {}) {
  const control = app?.querySelector('.title-menu .slot-continue:not([disabled]), .title-menu .slot-new:not([disabled]), .title-menu button:not([disabled])');
  if (!control) return false;
  control.focus({ preventScroll: true });
  if (showCursor) focusElement(control);
  return document.activeElement === control;
}
function slotCopy({ slot, summary }) {
  if (!summary) {
    return `<span class="title-slot-tag">SLOT ${slot}</span><span class="title-slot-empty">Empty</span>`;
  }
  return `<span class="title-slot-tag">SLOT ${slot}</span>
    <span class="title-slot-name">${esc(summary.className)}</span>
    <span class="title-slot-meta">Act ${summary.actNumber} · Floor ${summary.floor} · ${summary.hp}/${summary.maxHp} HP</span>
    <span class="title-slot-seed">SEED ${esc(summary.seedString)}</span>`;
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
  onQuit,
  onCustom,
  onLan,
  onCompendium,
}) {
  const occupied = slots.filter(({ summary }) => !!summary);
  let modal = null;
  let selectedSlot = null;

  const selectionModel = (kind = modal) => saveSlotSelectionModel(slots, { kind, selectedSlot });

  const modalSlotHtml = (model) => model.children
    .filter((child) => child.component === UI.titleSaveSlot)
    .map(({ properties }) => {
      const { slot, selectable, selected } = properties;
      const summary = slots.find((record) => record.slot === slot)?.summary || null;
      return `<div class="title-slot-row${selected ? ' is-selected' : ''}${!selectable ? ' is-empty' : ''}" data-component="title-save-slot">
        <button class="title-slot-pick${summary ? ' is-filled' : ''}" type="button" data-slot-pick="${slot}" aria-pressed="${selected}"${selectable ? '' : ' disabled'}>
          <span class="title-slot-copy" data-component="title-save-slot-copy">${slotCopy({ slot, summary })}</span>
          <span class="title-slot-state" data-component="title-save-slot-state">${summary ? 'READY' : 'EMPTY'}</span>
        </button>
        ${summary && onDelete ? `<button class="subtle title-slot-delete" data-component="title-save-slot-delete" type="button" data-slot-delete="${slot}" aria-label="Delete slot ${slot}">✕</button>` : ''}
      </div>`;
    }).join('');

  const menuHtml = () => {
    const continueSlot = occupied[0]?.slot ?? null;
    return `<nav class="title-menu" data-component="title-menu" aria-label="Ashen Spire main menu">
      <button class="title-menu-item slot-continue" data-component="title-menu-item" type="button" data-title-action="continue"${continueSlot == null ? ' disabled' : ''}>
        <span>CONTINUE</span><span class="title-menu-gem" data-component="title-menu-gem" aria-hidden="true">◇</span>
      </button>
      <button class="title-menu-item" data-component="title-menu-item" id="load-game" type="button" data-title-action="load">
        <span>LOAD</span><span class="title-menu-gem" data-component="title-menu-gem" aria-hidden="true">◇</span>
      </button>
      <button class="title-menu-item slot-new" data-component="title-menu-item" id="new-game" type="button" data-title-action="new">
        <span>NEW</span><span class="title-menu-gem" data-component="title-menu-gem" aria-hidden="true">◇</span>
      </button>
      <!-- #armaments remains the compatibility anchor for the existing watched probe. -->
      <button class="title-menu-item" data-component="title-menu-item" id="armaments" type="button" data-title-action="collection">
        <span>COLLECTION</span><span class="title-menu-gem" data-component="title-menu-gem" aria-hidden="true">◇</span>
      </button>
      <button class="title-menu-item" data-component="title-menu-item" id="settings" type="button" data-title-action="settings">
        <span>SETTINGS</span><span class="title-menu-gem" data-component="title-menu-gem" aria-hidden="true">◇</span>
      </button>
      <button class="title-menu-item" data-component="title-menu-item" id="quit-game" type="button" data-title-action="quit">
        <span>QUIT</span><span class="title-menu-gem" data-component="title-menu-gem" aria-hidden="true">◇</span>
      </button>
    </nav>`;
  };

  const modalHtml = () => {
    if (!modal) return '';
    const model = selectionModel();
    const title = 'NEW GAME';
    return `<div class="modal-veil title-modal-veil" data-title-modal-scrim>
      <section class="modal title-menu-modal" data-component="title-menu-modal" role="dialog" aria-modal="true" aria-labelledby="title-modal-heading">
        <button class="title-modal-close" data-component="title-modal-close-control" type="button" data-title-action="close-modal" aria-label="Close ${title}">×</button>
        <h2 id="title-modal-heading" data-component="title-modal-heading">${title}</h2>
        <div class="title-modal-rule" data-component="title-modal-divider" aria-hidden="true"><span></span></div>
        <div class="title-slot-list" data-component="title-save-slot-list" aria-label="Save slots">${modalSlotHtml(model)}</div>
        <div class="title-modal-actions" data-component="title-modal-actions">
          <button class="title-modal-back" data-component="title-modal-back-control" type="button" data-title-action="back">BACK</button>
          <button class="title-modal-continue" data-component="title-modal-continue-control" type="button" data-title-action="modal-continue" data-action-slot="${model.properties.actionSlot ?? ''}"${model.properties.canContinue ? '' : ' disabled'}>CONTINUE</button>
        </div>
      </section>
    </div>`;
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
      arm(button, 'deleteSave', { onConfirm: () => onDelete(+button.dataset.slot) });
      button.title = button.dataset.holdMs ? 'Hold to delete this run' : 'Delete this run';
    });
  };

  function render() {
    app.innerHTML = `
      <div class="screen title-screen">
        ${Array.from({ length: 7 }, (_, i) => `<span class="ember" style="left:${8 + ((i * 13.7) % 84)}%;animation-delay:${(i * 1.7) % 9}s;animation-duration:${7 + (i % 4) * 2}s"></span>`).join('')}
        ${hudQuickSettingsHtml(hudQuickSettingsModel({ place: 'title', presentation: registries.balance.ui.hudQuickSettings, settings: meta.settings || {} }))}
        <div class="title-stack" data-component="title-brand-lockup">
          <h1 class="title-big title-glow" data-component="title-wordmark">ASHEN SPIRE</h1>
          <p class="subtitle" data-component="title-subtitle">A ROGUELIKE DECKBUILDER</p>
          <div class="title-rule" data-component="title-divider" aria-hidden="true"><span></span></div>
        </div>
        ${menuHtml()}
        <p class="title-tagline" data-component="title-tagline">THE EMBER FLOWS UPWARD. FOLLOW IT.</p>
        ${buildStampHtml('title')}
        ${modalHtml()}
      </div>`;

    wireHudQuickSettings(app, { settings: meta.settings || {}, onSettingsChange });
    const root = app.querySelector('.title-screen');
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal) {
        event.preventDefault();
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
}
