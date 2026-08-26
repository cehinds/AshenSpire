// src/ui/screens/title.js — folded title menu with load/new slot modal.
//
// The title owns layout and interaction state; save-slot content stays in the
// records handed in by main.js. The same modal shell serves LOAD and NEW so the
// art and spacing can evolve without duplicating the screen structure.

import { attachTooltip, esc, hideTooltip } from '../components/tooltip.js';
import { armHold, beatArmer } from '../components/holdconfirm.js';
import { buildStampHtml } from '../components/buildstamp.js';
import { hudQuickSettingsHtml, wireHudQuickSettings } from '../components/hudQuickSettings.js';
import { hudQuickSettingsModel } from '../models/HudQuickSettingsModel.js';
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

function firstSlot(slots, predicate) {
  return slots.find(({ summary }) => predicate(summary))?.slot ?? null;
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
  let activatedLoadSlot = null;
  let loadReviewSlot = null;

  const modalSlotHtml = (kind) => slots.map(({ slot, summary }) => {
    const selectable = kind === 'new' || !!summary;
    const selected = selectedSlot === slot;
    const loadHint = kind === 'load' && summary
      ? ` title="Select slot ${slot}. Hold to load now; activate the selected slot again to review." aria-label="Slot ${slot}, ${esc(summary.className)}. Hold to load now; activate twice to review."`
      : '';
    return `<div class="title-slot-row${selected ? ' is-selected' : ''}${!selectable ? ' is-empty' : ''}" data-component="title-save-slot">
      <button class="title-slot-pick${summary ? ' is-filled' : ''}" type="button" data-slot-pick="${slot}" aria-pressed="${selected}"${loadHint}${selectable ? '' : ' disabled'}>
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
    if (modal === 'load' && loadReviewSlot != null) {
      const record = slots.find(({ slot }) => slot === loadReviewSlot);
      if (!record?.summary) loadReviewSlot = null;
      else return `<div class="modal-veil title-modal-veil" data-title-modal-scrim>
        <section class="modal title-menu-modal title-load-review" data-component="title-menu-modal" data-variant="load-review" role="dialog" aria-modal="true" aria-labelledby="title-modal-heading">
          <button class="title-modal-close" data-component="title-modal-close-control" type="button" data-title-action="close-modal" aria-label="Close Load Game">×</button>
          <h2 id="title-modal-heading" data-component="title-modal-heading">LOAD SLOT ${record.slot}?</h2>
          <div class="title-modal-rule" data-component="title-modal-divider" aria-hidden="true"><span></span></div>
          <article class="title-load-review-slot" data-component="title-save-slot" aria-label="Selected save summary">
            <span class="title-slot-copy" data-component="title-save-slot-copy">${slotCopy(record)}</span>
          </article>
          <p class="title-load-review-copy">Load this saved climb now?</p>
          <div class="title-modal-actions" data-component="title-modal-actions">
            <button class="title-modal-back title-load-review-back" data-component="title-modal-back-control" type="button" data-title-action="review-back">BACK TO SAVES</button>
            <button class="title-load-review-confirm" data-component="title-modal-continue-control" type="button" data-title-action="review-load">LOAD SAVE</button>
          </div>
        </section>
      </div>`;
    }
    const title = modal === 'load' ? 'LOAD GAME' : 'NEW GAME';
    const canContinue = selectedSlot != null && (modal === 'new' || !!slots.find(({ slot }) => slot === selectedSlot)?.summary);
    return `<div class="modal-veil title-modal-veil" data-title-modal-scrim>
      <section class="modal title-menu-modal" data-component="title-menu-modal" role="dialog" aria-modal="true" aria-labelledby="title-modal-heading">
        <button class="title-modal-close" data-component="title-modal-close-control" type="button" data-title-action="close-modal" aria-label="Close ${title}">×</button>
        <h2 id="title-modal-heading" data-component="title-modal-heading">${title}</h2>
        <div class="title-modal-rule" data-component="title-modal-divider" aria-hidden="true"><span></span></div>
        <div class="title-slot-list" data-component="title-save-slot-list" aria-label="Save slots">${modalSlotHtml(modal)}</div>
        <div class="title-modal-actions" data-component="title-modal-actions">
          <button class="title-modal-back" data-component="title-modal-back-control" type="button" data-title-action="back">BACK</button>
          <button class="title-modal-continue" data-component="title-modal-continue-control" type="button" data-title-action="modal-continue"${canContinue ? '' : ' disabled'}>CONTINUE</button>
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
    selectedSlot = kind === 'new' ? firstSlot(slots, (summary) => !summary) ?? slots[0]?.slot ?? null : firstSlot(slots, (summary) => !!summary);
    activatedLoadSlot = null;
    loadReviewSlot = null;
    render();
    focusModal();
  };

  const closeModal = () => {
    modal = null;
    selectedSlot = null;
    activatedLoadSlot = null;
    loadReviewSlot = null;
    render();
    focusTitleDefault(app, { showCursor: false });
  };

  const closeLoadReview = () => {
    const slot = loadReviewSlot;
    loadReviewSlot = null;
    render();
    focusModal(`[data-slot-pick="${slot}"]`);
  };

  const activateSlot = (slot) => {
    hideTooltip();
    if (modal === 'load') {
      if (selectedSlot === slot && activatedLoadSlot === slot) {
        loadReviewSlot = slot;
        render();
        focusModal('[data-title-action="review-load"]');
        return;
      }
      selectedSlot = slot;
      activatedLoadSlot = slot;
    } else {
      selectedSlot = slot;
    }
    render();
    focusModal(`[data-slot-pick="${selectedSlot}"]`);
  };

  const wireLoadSlots = (root) => {
    if (modal !== 'load') return;
    const configured = Number(registries.balance.ui.titleLoadHold?.ms);
    const duration = Number.isFinite(configured) && configured > 0 ? configured : 600;
    root.querySelectorAll('.title-slot-pick.is-filled').forEach((button) => {
      const slot = +button.dataset.slotPick;
      const record = slots.find((candidate) => candidate.slot === slot);
      attachTooltip(button, () => `<div class="tt-title">Slot ${slot} · ${esc(record?.summary?.className || 'Saved climb')}</div>`
        + 'Tap once to select. Tap the selected slot again to review. Hold to load now.');
      armHold(button, {
        ms: duration,
        id: 'loadSave',
        pointerOnly: true,
        hintHost: button,
        onTap: () => activateSlot(slot),
        onConfirm: () => { hideTooltip(); onContinue(slot); },
      });
    });
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
        if (loadReviewSlot != null) closeLoadReview();
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
    root.querySelectorAll('[data-title-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.titleAction;
        if (action === 'continue') onContinue(occupied[0].slot);
        else if (action === 'load' || action === 'new') openModal(action);
        else if (action === 'collection' && onCompendium) onCompendium();
        else if (action === 'settings') onSettings();
        else if (action === 'quit' && onQuit) onQuit();
        else if (action === 'close-modal' || action === 'back') closeModal();
        else if (action === 'review-back') closeLoadReview();
        else if (action === 'review-load') onContinue(loadReviewSlot);
        else if (action === 'modal-continue') {
          if (selectedSlot == null) return;
          if (modal === 'load') onContinue(selectedSlot);
          else onNew(selectedSlot);
        }
      });
    });
    root.querySelector('[data-title-modal-scrim]')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeModal();
    });
    root.querySelectorAll('[data-slot-pick]').forEach((button) => {
      if (modal === 'load' && button.classList.contains('is-filled')) return;
      button.addEventListener('click', () => {
        activateSlot(+button.dataset.slotPick);
      });
    });
    wireLoadSlots(root);
    wireDelete(root);
    if (onHistory) void onHistory;
    if (onProfile) void onProfile;
    if (onCustom) void onCustom;
    if (onLan) void onLan;
  }

  render();
}
