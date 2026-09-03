// The smith's card-service overlay: extract a card from an item's mount, or
// seat a deck card in one. Same dialog contract as smithUpgradeModal.js —
// the component owns dialog semantics, focus containment and rendering; the
// screen owns run mutation. Three columns of choice at most (item, mount,
// card), every one reversible until the explicit Confirm.
import { assetUrl } from '../assetmap.js';
import { esc, attachTooltip } from './tooltip.js';
import { renderCard } from './card.js';
import { armOptionDecision } from '../../framework/optionDecision.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

const visibleFocusable = (root) => [...root.querySelectorAll(
  'button:not([disabled]), [role="button"][tabindex="0"], [role="option"][tabindex="0"], [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
)].filter((element) => !element.hidden && element.getClientRects().length);

export function mountMountServiceModal(host, initialModel, {
  registries,
  meta,
  onSelectItem,
  onSelectMount,
  onSelectCard,
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
  modal.className = 'modal smith-upgrade-modal mount-service-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'mount-modal-title');
  modal.setAttribute('aria-describedby', 'mount-modal-instruction');
  modal.tabIndex = -1;
  markUiComponent(modal, UI.mountServiceModal, initialModel.variant);
  modal.innerHTML = `
    <header class="smith-modal-head">
      <div>
        <span class="smith-modal-eyebrow">${esc(initialModel.properties.eyebrow)}</span>
        <h2 id="mount-modal-title">${esc(initialModel.properties.title)}</h2>
        <p id="mount-modal-instruction">${esc(initialModel.properties.instruction)}</p>
      </div>
      <span class="smith-modal-consequence">${esc(initialModel.properties.consequenceBadge)}</span>
    </header>
    <div class="smith-modal-body">
      <section class="smith-candidate-region" aria-labelledby="mount-candidate-title">
        <div class="smith-region-head">
          <h3 id="mount-candidate-title">Choose an item</h3>
          <span data-mount-count></span>
        </div>
        <div class="smith-card-list" role="listbox" aria-label="Items with a mount to work on"></div>
      </section>
      <section class="smith-preview-region" aria-live="polite" aria-label="Selected item's mounts"></section>
    </div>
    <footer class="smith-modal-footer">
      <p>${esc(initialModel.properties.consequence)}</p>
      <div class="smith-modal-actions">
        <button type="button" class="subtle smith-back">${esc(initialModel.properties.backLabel)}</button>
        <button type="button" class="smith-confirm mount-confirm"></button>
      </div>
    </footer>`;
  veil.appendChild(modal);
  host.appendChild(veil);

  const cardsHost = modal.querySelector('.smith-card-list');
  const previewHost = modal.querySelector('.smith-preview-region');
  const count = modal.querySelector('[data-mount-count]');
  const back = modal.querySelector('.smith-back');
  const confirm = modal.querySelector('.mount-confirm');
  let currentModel = initialModel;
  let closed = false;
  let disarmDecision = null;

  const costPairHtml = (selected) => `<span class="smith-cost-pair">
      <em>REQ</em><i aria-hidden="true">/</i><em>AVAIL</em>
      <strong class="smith-cost-required">${selected.cost}</strong><i aria-hidden="true">/</i><strong class="smith-cost-available">${selected.stones}</strong>
    </span>`;

  const mountRowHtml = (mount) => `
    <div class="mount-row${mount.selected ? ' selected' : ''}${mount.extra ? ' is-extra' : ''}" role="option" aria-selected="${String(mount.selected)}"
         data-mount-key="${esc(mount.mountKey)}" tabindex="${mount.selected ? 0 : -1}">
      <em>${esc(mount.kindLabel)}</em>
      <b>${mount.cardId ? esc(mount.cardName) : (mount.state === 'open' ? 'Open mount' : 'Nothing seated')}</b>
      <small>${esc(mount.stateLabel)}${mount.state === 'fallback' && mount.cardName ? ` · showing ${esc(mount.cardName)}` : ''}${mount.fallbackCardId && mount.state !== 'fallback' && currentModel.properties.service === 'extract' ? ` · falls back to ${esc(registries.cards.get(mount.fallbackCardId)?.name || mount.fallbackCardId)}` : ''}</small>
    </div>`;

  const confirmationDetails = (p) => `
    <div class="confirmation-cost ${p.selected.affordable ? 'affordable' : 'unaffordable'}">
      <span class="smith-economy-values"><span class="smith-stone-icon" aria-hidden="true">🪨</span><b>Smithing Stone Cost</b>${costPairHtml(p.selected)}</span>
    </div>
    <div class="confirmation-change-list">
      <div><b>${esc(p.selected.name)}</b><span>${esc(p.selectedMount ? `${p.selectedMount.kindLabel} mount · ${p.selectedMount.stateLabel}` : '')}</span></div>
      ${p.service === 'extract' && p.selectedMount ? `<div><b>${esc(p.selectedMount.cardName)}</b><span>leaves the item and joins your deck${p.selectedMount.fallbackCardId ? `; the mount shows ${esc(registries.cards.get(p.selectedMount.fallbackCardId)?.name || p.selectedMount.fallbackCardId)}` : '; the mount shows nothing'}</span></div>` : ''}
      ${p.service === 'install' && p.selectedCard ? `<div><b>${esc(p.selectedCard.cardName)}</b><span>leaves your deck and is seated in ${esc(p.selected.name)}</span></div>` : ''}
    </div>`;

  function commitSelected() {
    const p = currentModel.properties;
    if (!p.canConfirm) return;
    const selection = { itemRef: p.selected.itemRef, mountKey: p.selectedMount.mountKey, instanceId: p.selectedCard ? p.selectedCard.instanceId : undefined };
    close({ restoreFocus: false });
    onConfirm(selection);
  }

  function draw(model, { focusSelection = false } = {}) {
    currentModel = model;
    const p = model.properties;
    markUiComponent(modal, UI.mountServiceModal, model.variant);
    cardsHost.innerHTML = '';
    count.textContent = `${p.purseLabel} · ${p.candidates.length} eligible`;
    for (const item of p.candidates) {
      const card = document.createElement('div');
      card.className = `smith-candidate-card smith-weapon-card rarity-${item.rarity}`;
      card.classList.toggle('selected', item.selected);
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', String(item.selected));
      card.dataset.itemRef = item.itemRef;
      const typeHtml = item.itemTypes.length
        ? item.itemTypes.map((type) => `<em data-item-type="${esc(type.tag)}">${esc(type.label)}</em>`).join('')
        : `<em>${esc(item.kindLabel)}</em>`;
      card.innerHTML = `
        <span class="smith-weapon-count" aria-label="${esc(item.whereLabel)}">${item.equipped ? '⚔' : '▣'}</span>
        <strong class="smith-weapon-name">${esc(item.name)}</strong>
        <span class="smith-weapon-art"><img src="${esc(assetUrl(item.artAsset))}" alt=""></span>
        <span class="smith-item-type-row">${typeHtml}</span>
        <span class="smith-weapon-tags"><em>${esc(item.whereLabel)}</em><em>${item.mounts.length} mount${item.mounts.length === 1 ? '' : 's'}</em></span>`;
      const art = card.querySelector('.smith-weapon-art img');
      art?.addEventListener('error', () => art.remove());
      card.setAttribute('aria-label', `${item.name}, ${item.whereLabel}, ${item.mounts.length} mount${item.mounts.length === 1 ? '' : 's'}, costs ${item.cost} Smithing Stone. Select to choose a mount.`);
      attachTooltip(card, () => `<div class="tt-title">${esc(item.name)} · ${esc(item.whereLabel)}</div>`
        + `<div>${item.mounts.map((mount) => `${esc(mount.kindLabel)}: ${esc(mount.cardName || mount.stateLabel)}`).join('<br>')}</div>`
        + `<div>Smith Stone Cost: 🪨 ${item.cost}/${item.stones} available.</div>`);
      card.tabIndex = item.selected || (!p.selected && cardsHost.childElementCount === 0) ? 0 : -1;
      markUiComponent(card, UI.mountCandidateCard, item.selected ? 'selected' : 'available');
      const choose = () => onSelectItem(item.itemRef);
      card.addEventListener('click', choose);
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        choose();
      });
      cardsHost.appendChild(card);
    }

    const selected = p.selected;
    previewHost.innerHTML = selected
      ? `<div class="smith-preview-card" data-ui-component="${UI.mountServicePreview}">
          <div class="smith-summary-grid">
            <div class="smith-summary-cell smith-selected-head"><span class="smith-preview-label">Selected item</span><b>${esc(selected.name)}</b><span>${esc(selected.whereLabel)} · ${selected.mounts.length} mount${selected.mounts.length === 1 ? '' : 's'}</span></div>
            <div class="smith-summary-cell smith-preview-economy ${selected.affordable ? 'affordable' : 'unaffordable'}">
              <span class="smith-economy-values"><span class="smith-stone-icon" aria-hidden="true">🪨</span><b>Smithing Stone Cost</b>${costPairHtml(selected)}</span>
            </div>
          </div>
          <div class="smith-data-row">
            <span class="smith-data-heading"><b>${esc(p.listLabel)}</b><small>${p.service === 'extract' ? 'choose one' : 'choose a mount'}</small></span>
          </div>
          <div class="mount-row-list" role="listbox" aria-label="${esc(p.listLabel)}">${selected.mounts.map(mountRowHtml).join('')}</div>
          ${p.service === 'install' && p.selectedMount ? `
          <div class="smith-data-row">
            <span class="smith-data-heading"><b>From your deck</b><small>${p.selectedMount.cards.length} card${p.selectedMount.cards.length === 1 ? '' : 's'} this mount takes</small></span>
          </div>
          <div class="mount-card-list" role="listbox" aria-label="Deck cards this mount takes"></div>` : ''}
          ${selected.affordable ? '' : `<div class="smith-preview-shortfall">Short ${selected.shortfall} Smithing Stone${selected.shortfall === 1 ? '' : 's'}.</div>`}
        </div>`
      : `<div class="smith-preview-empty" data-ui-component="${UI.mountServicePreview}">
          <span class="smith-preview-glyph" aria-hidden="true">⚙</span>
          <b>${esc(p.idle)}</b>
          <span>Nothing changes until you confirm, or deliberately hold ${esc(p.verb)}.</span>
        </div>`;
    if (selected) {
      for (const row of previewHost.querySelectorAll('.mount-row')) {
        markUiComponent(row, UI.mountRow, row.classList.contains('selected') ? 'selected' : 'available');
        const choose = () => onSelectMount(row.dataset.mountKey);
        row.addEventListener('click', choose);
        row.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          choose();
        });
      }
      const cardList = previewHost.querySelector('.mount-card-list');
      if (cardList && p.selectedMount) {
        for (const card of p.selectedMount.cards) {
          const el = renderCard(registries, { cardId: card.cardId, upgraded: card.upgraded, instanceId: card.instanceId }, { small: true });
          el.classList.toggle('selected', card.selected);
          el.setAttribute('role', 'option');
          el.setAttribute('aria-selected', String(card.selected));
          el.dataset.instanceId = card.instanceId;
          el.tabIndex = 0;
          const choose = () => onSelectCard(card.instanceId);
          el.addEventListener('click', choose);
          el.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            choose();
          });
          cardList.appendChild(el);
        }
      }
    }
    disarmDecision?.();
    disarmDecision = null;
    confirm.disabled = !selected;
    confirm.textContent = p.confirmLabel;
    confirm.setAttribute('aria-disabled', String(!p.canConfirm));
    confirm.dataset.smithActionState = !selected ? 'unselected' : (p.canConfirm ? 'actionable' : 'blocked');
    if (selected) {
      confirm.setAttribute('aria-label', `${p.verb} for ${selected.cost} Smithing Stone${selected.cost === 1 ? '' : 's'}`);
      disarmDecision = armOptionDecision(confirm, {
        meta,
        registries,
        id: p.decisionId,
        title: `${p.verb} ${p.service === 'extract' ? (p.selectedMount ? p.selectedMount.cardName : 'a card') : (p.selectedCard ? p.selectedCard.cardName : 'a card')}?`,
        message: `${p.decisionConsequence}. This spends the shown Stone cost.`,
        consequence: 'PERMANENT FOR THIS RUN',
        detailsHtml: confirmationDetails(p),
        confirmLabel: `${p.verb} (${selected.cost})`,
        cancelLabel: 'Keep reviewing',
        onCommit: commitSelected,
        canCommit: () => Boolean(currentModel.properties.canConfirm),
        blockedTitle: `Cannot ${p.verb.toLowerCase()} yet`,
        blockedMessage: p.blockedReasons.join(' ') || 'This service is not currently available.',
        blockedDetailsHtml: confirmationDetails(p),
        returnFocusElement: confirm,
      });
    }
    if (focusSelection && selected) {
      queueMicrotask(() => (previewHost.querySelector('.mount-row.selected') || cardsHost.querySelector('[aria-selected="true"]'))?.focus({ preventScroll: true }));
    }
  }

  function close({ restoreFocus = true } = {}) {
    if (closed) return;
    closed = true;
    disarmDecision?.();
    disarmDecision = null;
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
  window.addEventListener('keydown', onKeydown, true);
  draw(initialModel);
  queueMicrotask(() => modal.focus({ preventScroll: true }));

  return {
    update(model) { draw(model, { focusSelection: true }); },
    close,
  };
}
