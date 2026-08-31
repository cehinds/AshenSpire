// Dedicated Smith selection/review overlay. The component owns dialog
// semantics, focus containment and rendering; the screen owns run mutation.
import { assetUrl } from '../assetmap.js';
import { esc } from './tooltip.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

const visibleFocusable = (root) => [...root.querySelectorAll(
  'button:not([disabled]), [role="button"][tabindex="0"], [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
)].filter((element) => !element.hidden && element.getClientRects().length);

export function mountSmithUpgradeModal(host, initialModel, {
  registries,
  onSelect,
  onBack,
  onConfirm,
  returnFocusElement,
}) {
  const returnFocus = returnFocusElement instanceof HTMLElement
    ? returnFocusElement
    : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const veil = document.createElement('div');
  veil.className = 'modal-veil smith-modal-veil';
  const modal = document.createElement('section');
  modal.className = 'modal smith-upgrade-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'smith-modal-title');
  modal.setAttribute('aria-describedby', 'smith-modal-instruction');
  modal.tabIndex = -1;
  markUiComponent(modal, UI.smithUpgradeModal, initialModel.variant);
  modal.innerHTML = `
    <header class="smith-modal-head">
      <div>
        <span class="smith-modal-eyebrow">${esc(initialModel.properties.eyebrow)}</span>
        <h2 id="smith-modal-title">${esc(initialModel.properties.title)}</h2>
        <p id="smith-modal-instruction">${esc(initialModel.properties.instruction)}</p>
      </div>
      <span class="smith-modal-consequence">LEAVES SHRINE</span>
    </header>
    <div class="smith-modal-body">
      <section class="smith-candidate-region" aria-labelledby="smith-candidate-title">
        <div class="smith-region-head">
          <h3 id="smith-candidate-title">Choose an armament</h3>
          <span data-smith-count></span>
        </div>
        <div class="smith-card-list" role="listbox" aria-label="Armaments available to Smith"></div>
      </section>
      <section class="smith-preview-region" aria-live="polite" aria-label="Selected upgrade preview"></section>
    </div>
    <footer class="smith-modal-footer">
      <p>${esc(initialModel.properties.consequence)}</p>
      <div class="smith-modal-actions">
        <button type="button" class="subtle smith-back">${esc(initialModel.properties.backLabel)}</button>
        <button type="button" class="smith-confirm"></button>
      </div>
    </footer>`;
  veil.appendChild(modal);
  host.appendChild(veil);

  const cardsHost = modal.querySelector('.smith-card-list');
  const previewHost = modal.querySelector('.smith-preview-region');
  const count = modal.querySelector('[data-smith-count]');
  const back = modal.querySelector('.smith-back');
  const confirm = modal.querySelector('.smith-confirm');
  let currentModel = initialModel;
  let closed = false;

  function draw(model, { focusSelection = false } = {}) {
    currentModel = model;
    markUiComponent(modal, UI.smithUpgradeModal, model.variant);
    cardsHost.innerHTML = '';
    count.textContent = `${model.properties.purseLabel} · ${model.properties.candidates.length} eligible`;
    for (const item of model.properties.candidates) {
      const card = document.createElement('div');
      card.className = `smith-candidate-card smith-weapon-card rarity-${item.rarity}`;
      card.classList.toggle('selected', item.selected);
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', String(item.selected));
      card.dataset.armamentId = item.armamentId;
      card.innerHTML = `
        <span class="smith-weapon-count" aria-label="${item.inventoryCount} in inventory">${item.inventoryCount}</span>
        <strong class="smith-weapon-name">${esc(item.name)}</strong>
        <span class="smith-weapon-art"><img src="${esc(assetUrl(item.artAsset))}" alt=""></span>
        <span class="smith-weapon-type">WEAPON</span>
        <span class="smith-weapon-tags">${item.tags.map((tag) => `<em>${esc(tag)}</em>`).join('')}</span>`;
      const art = card.querySelector('.smith-weapon-art img');
      art.addEventListener('error', () => art.remove());
      card.setAttribute('aria-label', `${item.name}, ${item.inventoryCount} in inventory, tier ${item.currentLevel} to ${item.nextLevel}, costs ${item.cost} Smithing Stone. Select to review ${item.affectedCount} affected cards.`);
      card.tabIndex = item.selected || (!model.properties.selected && cardsHost.childElementCount === 0) ? 0 : -1;
      markUiComponent(card, UI.smithCandidateCard, item.selected ? 'selected' : 'available');
      const choose = () => onSelect(item.armamentId);
      card.addEventListener('click', choose);
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        choose();
      });
      cardsHost.appendChild(card);
    }

    const selected = model.properties.selected;
    previewHost.innerHTML = selected
      ? `<div class="smith-preview-card" data-ui-component="${UI.smithUpgradePreview}">
          <span class="smith-preview-label">Selected armament</span>
          <div class="tt-title">${esc(selected.name)} · Tier ${selected.currentLevel} → ${selected.nextLevel}</div>
          <div class="smith-preview-economy"><b>Cost ${selected.cost}</b><span>Purse ${selected.stones}</span></div>
          ${selected.affectedRows.map((row) => `<div class="smith-preview-delta">
            <b>${row.count}× ${esc(row.name)}</b><small>${esc(row.role)}</small>
            <span>${row.changes.map(esc).join(' · ')}</span>
          </div>`).join('')}
          ${selected.affordable ? '' : `<div class="smith-preview-shortfall">Short ${selected.shortfall} Smithing Stone${selected.shortfall === 1 ? '' : 's'}.</div>`}
        </div>`
      : `<div class="smith-preview-empty" data-ui-component="${UI.smithUpgradePreview}">
          <span class="smith-preview-glyph" aria-hidden="true">⚒</span>
          <b>Select an armament to compare every sourced basic card.</b>
          <span>Nothing changes until Confirm.</span>
        </div>`;
    confirm.disabled = !model.properties.canConfirm;
    confirm.textContent = model.properties.confirmLabel;
    confirm.setAttribute('aria-disabled', String(!model.properties.canConfirm));
    if (focusSelection && selected) {
      queueMicrotask(() => cardsHost.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true }));
    }
  }

  function close({ restoreFocus = true } = {}) {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKeydown, true);
    veil.remove();
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }

  function backOut() {
    close();
    onBack();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      backOut();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = visibleFocusable(modal);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!modal.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  back.addEventListener('click', backOut);
  confirm.addEventListener('click', () => {
    if (!currentModel.properties.canConfirm) return;
    const selectedId = currentModel.properties.selected.armamentId;
    close({ restoreFocus: false });
    onConfirm(selectedId);
  });
  window.addEventListener('keydown', onKeydown, true);
  draw(initialModel);
  queueMicrotask(() => modal.focus({ preventScroll: true }));

  return {
    update(model) { draw(model, { focusSelection: true }); },
    close,
  };
}
