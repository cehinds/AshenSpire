// Dedicated Smith selection/review overlay. The component owns dialog
// semantics, focus containment and rendering; the screen owns run mutation.
import { assetUrl } from '../assetmap.js';
import { esc, attachTooltip } from './tooltip.js';
import { el, modalHead, modalFooter, pill, button, subtitle } from '../kit/index.js';
import { renderCard } from './card.js';
// The interaction router goes through the framework's adopted door.
import { armOptionDecision } from '../../framework/optionDecision.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { FOLD_GLYPH } from './foldGlyph.js';

const visibleFocusable = (root) => [...root.querySelectorAll(
  'button:not([disabled]), [role="button"][tabindex="0"], [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
)].filter((element) => !element.hidden && element.getClientRects().length);

export function mountSmithUpgradeModal(host, initialModel, {

  registries,
  meta,
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
  modal.dataset.size = 'xl'; // body E: the chooser on the left, the inspector on the right
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'smith-modal-title');
  modal.setAttribute('aria-describedby', 'smith-modal-instruction');
  modal.tabIndex = -1;
  markUiComponent(modal, UI.smithUpgradeModal, initialModel.variant);
  // THE SHELL'S HEAD AND FOOT (kit §04): eyebrow + title, the consequence as
  // a StatePill in the head's actions, the close box; the foot carries the
  // consequence sentence as its note and the two ways out on the ladder.
  const head = modalHead({
    eyebrow: initialModel.properties.eyebrow,
    title: initialModel.properties.title,
    titleId: 'smith-modal-title',
    extras: pill({ label: initialModel.properties.consequenceBadge, attrs: { class: 'smith-modal-consequence' } }),
    closeLabel: initialModel.properties.backLabel,
  });
  const body = el('div', { class: 'modal-body smith-modal-body' }, [
    el('section', { class: 'smith-candidate-region', 'aria-labelledby': 'smith-candidate-title' }, [
      el('div', { class: 'smith-region-head' }, [
        el('div', { class: 'as-labelstack' }, [
          el('h3', { id: 'smith-candidate-title', class: 'as-title-s', text: 'Choose an item' }),
          subtitle(initialModel.properties.instruction, { id: 'smith-modal-instruction' }),
        ]),
        el('span', { class: 'as-status', dataset: { smithCount: '' } }),
      ]),
      el('div', { class: 'smith-card-list', role: 'listbox', 'aria-label': 'Items available to upgrade' }),
    ]),
    el('section', { class: 'smith-preview-region', 'aria-live': 'polite', 'aria-label': 'Selected upgrade preview' }),
  ]);
  const backBtn = button({ label: initialModel.properties.backLabel, className: 'subtle smith-back' });
  const confirmBtn = button({ label: '', weight: 'primary', className: 'smith-confirm' });
  const foot = modalFooter({ note: initialModel.properties.consequence, secondary: [backBtn], primary: confirmBtn, className: 'smith-modal-footer', size: 'long' });
  modal.append(head, body, foot);
  veil.appendChild(modal);
  host.appendChild(veil);

  const cardsHost = modal.querySelector('.smith-card-list');
  const previewHost = modal.querySelector('.smith-preview-region');
  const count = modal.querySelector('[data-smith-count]');
  const back = modal.querySelector('.smith-back');
  const confirm = modal.querySelector('.smith-confirm');
  let currentModel = initialModel;
  let closed = false;
  let disarmDecision = null;

  const changeSummary = (row) => row.values.map((change) => {
    const label = change.label || ({
      damage: 'AR',
      block: 'GUARD',
      draw: 'DRAW',
      discard: 'DISCARD',
      'cost:action': 'ACTION',
      'cost:mana': 'MANA',
      'cost:stamina': 'STAMINA',
    })[change.op] || String(change.op || 'change').toUpperCase();
    return `<span><em>${esc(label)}</em> ${esc(change.before)} <i aria-hidden="true">→</i> <strong>${esc(change.after)}</strong></span>`;
  }).join('');

  const requirementHtml = (selected) => selected.requirements.length
    ? selected.requirements.map((row) => `<span class="smith-requirement ${row.metAfter ? 'met' : 'unmet'}">
        <span class="smith-requirement-values"><em>${esc(row.label)}</em><b>${esc(row.currentRequired)}</b><i aria-hidden="true">→</i><strong>${esc(row.nextRequired)}</strong></span>
        <small>You have ${row.actual == null ? '?' : esc(row.actual)}</small>
      </span>`).join('')
    : '<span class="smith-requirement met"><span class="smith-requirement-values"><em>NONE</em><b>No attribute requirement</b></span></span>';

  const costPairHtml = (selected) => `<span class="smith-cost-pair">
      <em>REQ</em><i aria-hidden="true">/</i><em>AVAIL</em>
      <strong class="smith-cost-required">${selected.cost}</strong><i aria-hidden="true">/</i><strong class="smith-cost-available">${selected.stones}</strong>
    </span>`;

  const intrinsicStatsHtml = (selected) => {
    const stats = selected.intrinsicStats || {};
    const hasStats = ['attackRating', 'defenseRating', 'weight', 'weaponArtManaCost', 'uniqueSkillStaminaCost']
      .every((key) => stats[key] !== null && stats[key] !== undefined);
    if (!hasStats) return '';
    return `<div class="smith-data-row smith-intrinsic-stats">
        <span class="smith-data-heading"><b>Equipment Stats</b><small>${esc(selected.kindLabel)}</small></span>
        <span class="smith-fold-values smith-primary-stats">
          <span><em>AR</em> <b>${esc(stats.attackRating)}</b></span>
          <span><em>DEF</em> <b>${esc(stats.defenseRating)}</b></span>
          <span><em>WEIGHT</em> <b>${esc(stats.weight)}</b></span>
        </span>
        <span class="smith-stat-costs"><span>Weapon Art <strong>Mana ${esc(stats.weaponArtManaCost)}</strong></span><i>·</i><span>Unique Skill <strong>Stamina ${esc(stats.uniqueSkillStaminaCost)}</strong></span></span>
      </div>`;
  };

  const confirmationDetails = (selected) => `
    <div class="confirmation-cost ${selected.affordable ? 'affordable' : 'unaffordable'}">
      <span class="smith-economy-values"><span class="smith-stone-icon" aria-hidden="true">🪨</span><b>Smithing Stone Cost</b>${costPairHtml(selected)}</span>
    </div>
    <div class="confirmation-change-list">
      ${selected.affectedRows.map((row) => `<div><b>${esc(row.name)}</b>${changeSummary(row)}</div>`).join('')}
      <div><b>Requirements</b>${requirementHtml(selected)}</div>
    </div>`;

  function commitSelected() {
    if (!currentModel.properties.canConfirm) return;
    const selectedId = currentModel.properties.selected.itemRef;
    close({ restoreFocus: false });
    onConfirm(selectedId);
  }

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
      card.dataset.itemRef = item.itemRef;
      if (item.armamentId) card.dataset.armamentId = item.armamentId;
      const artHtml = item.artAsset
        ? `<img src="${esc(assetUrl(item.artAsset))}" alt="">`
        : `<span class="smith-item-glyph" aria-hidden="true">${esc(item.artGlyph)}</span>`;
      const typeHtml = item.itemTypes.length
        ? item.itemTypes.map((type) => `<em data-item-type="${esc(type.tag)}">${esc(type.label)}</em>`).join('')
        : `<em>${esc(item.kindLabel)}</em>`;
      card.innerHTML = `
        <span class="smith-weapon-count" aria-label="${item.inventoryCount} in inventory">${item.inventoryCount}</span>
        <strong class="smith-weapon-name">${esc(item.name)}</strong>
        <span class="smith-weapon-art">${artHtml}</span>
        <span class="smith-item-type-row">${typeHtml}</span>
        <span class="smith-weapon-tags">${item.tags.map((tag) => `<em>${esc(tag)}</em>`).join('')}</span>`;
      const art = card.querySelector('.smith-weapon-art img');
      art?.addEventListener('error', () => art.remove());
      const itemTypeText = item.itemTypes.map((type) => type.label).join(', ') || item.kindLabel;
      card.setAttribute('aria-label', `${item.name}, ${itemTypeText}, ${item.inventoryCount} in inventory, tier ${item.currentLevel} to ${item.nextLevel}, costs ${item.cost} Smithing Stone. Select to review its exact changes and requirements.`);
      attachTooltip(card, () => `<div class="tt-title">${esc(item.name)} · Tier ${item.currentLevel} → ${item.nextLevel}</div>`
        + `<div>Type: ${esc(itemTypeText)}.</div>`
        + `<div>Smith Stone Cost: 🪨 ${item.cost}/${item.stones} available.</div>`
        + `<div>${item.requirements.length ? item.requirements.map((row) => `${esc(row.label)} ${row.currentRequired} → ${row.nextRequired}; you have ${row.actual == null ? '?' : row.actual}`).join('<br>') : 'No attribute requirement.'}</div>`);
      card.tabIndex = item.selected || (!model.properties.selected && cardsHost.childElementCount === 0) ? 0 : -1;
      markUiComponent(card, UI.smithCandidateCard, item.selected ? 'selected' : 'available');
      const choose = () => onSelect(item.itemRef);
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
          <div class="smith-summary-grid">
            <div class="smith-summary-cell smith-selected-head"><span class="smith-preview-label">Selected item</span><b>${esc(selected.name)}</b><span>Tier ${selected.currentLevel} → <strong>${selected.nextLevel}</strong> · ×${selected.inventoryCount} owned</span></div>
            <div class="smith-summary-cell smith-preview-economy ${selected.affordable ? 'affordable' : 'unaffordable'}">
              <span class="smith-economy-values"><span class="smith-stone-icon" aria-hidden="true">🪨</span><b>Smithing Stone Cost</b>${costPairHtml(selected)}</span>
            </div>
          </div>
          ${intrinsicStatsHtml(selected)}
          <div class="smith-data-row smith-requirements">
            <span class="smith-data-heading"><b>Requirements</b><small>attribute</small></span>
            <span class="smith-fold-values">${requirementHtml(selected)}</span>
          </div>
          <div class="smith-upgrade-folds">
            ${selected.affectedRows.map((row, index) => `<details class="smith-upgrade-fold smith-upgrade-row${row.used === false ? ' is-unused' : ''}">
              <summary><span><b>${esc(row.name)}</b><small>${esc(row.role)} · ${row.used === false ? 'not in active deck' : `${row.activeCopies || 1} active`}</small></span><span class="smith-fold-values">${changeSummary(row)}</span><i class="smith-fold-caret" aria-hidden="true">${FOLD_GLYPH.collapsed}</i></summary>
              <div class="smith-fold-detail${row.reference ? '' : ' no-card'}">
                ${row.reference ? `<div class="smith-card-sprite" data-smith-card-row="${index}"></div>` : ''}
                <div class="smith-card-facts">
                  <b>Current → upgraded</b>
                  ${row.changes.map((change) => `<span>${esc(change)}</span>`).join('')}
                  ${row.scaling ? `<span class="smith-scaling">Scales with <strong>${esc(row.scaling.label)}</strong>: +${esc(row.scaling.gainPerTier)} per ${esc(row.scaling.pointsPerTier)} points · current ${row.scaling.actual == null ? '?' : esc(row.scaling.actual)}</span>` : '<span class="smith-scaling">No attribute scaling.</span>'}
                  <small>Source: ${esc(selected.name)}</small>
                </div>
              </div>
            </details>`).join('')}
          </div>
          ${selected.affordable ? '' : `<div class="smith-preview-shortfall">Short ${selected.shortfall} Smithing Stone${selected.shortfall === 1 ? '' : 's'}.</div>`}
        </div>`
      : `<div class="smith-preview-empty" data-ui-component="${UI.smithUpgradePreview}">
          <span class="smith-preview-glyph" aria-hidden="true">⚒</span>
          <b>Select an item to compare every authored change.</b>
          <span>Nothing changes until you confirm, or deliberately hold Upgrade.</span>
        </div>`;
    if (selected) {
      selected.affectedRows.forEach((row, index) => {
        const slot = previewHost.querySelector(`[data-smith-card-row="${index}"]`);
        if (slot && row.reference) slot.appendChild(renderCard(registries, row.reference, { small: true, tooltip: false }));
      });
      previewHost.querySelectorAll('.smith-requirement').forEach((element) => attachTooltip(element, () => {
        const row = selected.requirements.find((entry) => element.textContent.includes(entry.label));
        if (!row) return '<div class="tt-title">No requirement</div>This item has no attribute minimum.';
        return `<div class="tt-title">${esc(row.label)} requirement</div>Current minimum ${row.currentRequired}; after upgrade ${row.nextRequired}. You have ${row.actual == null ? '?' : row.actual}.`;
      }));
    }
    disarmDecision?.();
    disarmDecision = null;
    confirm.disabled = !selected;
    confirm.textContent = model.properties.confirmLabel;
    confirm.setAttribute('aria-disabled', String(!model.properties.canConfirm));
    confirm.dataset.smithActionState = !selected ? 'unselected' : (selected.affordable ? 'actionable' : 'blocked');
    if (selected) {
      confirm.setAttribute('aria-label', `Upgrade ${selected.name} for ${selected.cost} Smithing Stone${selected.cost === 1 ? '' : 's'}`);
      disarmDecision = armOptionDecision(confirm, {
        meta,
        registries,
        id: 'smithUpgrade',
        title: `Upgrade ${selected.name}?`,
        message: `Tier ${selected.currentLevel} becomes tier ${selected.nextLevel}. This spends the shown Stone cost${model.properties.staysAtShrine ? '; ' : ' '}${model.properties.decisionConsequence}.`,
        consequence: 'PERMANENT FOR THIS RUN',
        detailsHtml: confirmationDetails(selected),
        confirmLabel: `Upgrade (${selected.cost})`,
        cancelLabel: 'Keep reviewing',
        onCommit: commitSelected,
        canCommit: () => Boolean(currentModel.properties.canConfirm),
        blockedTitle: `Cannot upgrade ${selected.name}`,
        blockedMessage: model.properties.blockedReasons.join(' ') || 'This upgrade is not currently available.',
        blockedDetailsHtml: confirmationDetails(selected),
        returnFocusElement: confirm,
      });
    }
    if (focusSelection && selected) {
      queueMicrotask(() => cardsHost.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true }));
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

  // The shell's close box is the same way out as Back.

  modal.querySelector('.modal-close')?.addEventListener('click', backOut);
  window.addEventListener('keydown', onKeydown, true);
  draw(initialModel);
  queueMicrotask(() => modal.focus({ preventScroll: true }));

  return {
    update(model) { draw(model, { focusSelection: true }); },
    close,
  };
}
