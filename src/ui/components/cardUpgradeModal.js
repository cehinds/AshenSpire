// The Core card-upgrade picker: one dialog for the rest site and the Blacksmith. It reuses the Smith picker's
// frame, rail, pane and decision beat (smithUpgradeModal.js) with deck-card rows. The component renders and
// routes; the host owns the run mutation. Every fact is from CardUpgradeModel.js, whose plan is the one
// commitCardUpgrade applies, so the before/after preview is exactly what the commit does.
import {
  el, modalHead, modalFooter, pill, button, eyebrow, prose, artWell, detailCard,
  blocker, glyph, railItem, railed, statusText, categoryNav, stampModalSize, landControl,
} from '../kit/index.js';
import { upgradePreviewHtml } from './card.js';
import { assetUrl } from '../assetmap.js';
import { hideOnError } from '../artFallback.js';
import { attachTooltip, esc } from './tooltip.js';
import { armOptionDecision } from '../../framework/optionDecision.js';
import { t } from '../strings.js';
import { reasonWhenDisabled } from './refusal.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { workspaceFrame, markCurrent } from './w1Workspace.js';
import { smithWorkspaceVars } from '../models/SmithWorkspaceModel.js';

const visibleFocusable = (root) => [...root.querySelectorAll(
  'button:not([disabled]), [role="button"][tabindex="0"], [role="option"][tabindex="0"], [tabindex]:not([tabindex="-1"])',
)].filter((element) => !element.hidden && element.getClientRects().length);

/** The card's art as a small ArtWell: its painted asset, or its type glyph. */
const cardArt = (row, { small = false } = {}) => {
  const well = row.artAsset
    ? artWell({ src: assetUrl(row.artAsset), alt: '', small, attrs: { class: 'smith-weapon-art' } })
    : artWell({ glyph: row.artGlyph, small, attrs: { class: 'smith-weapon-art' } });
  hideOnError(well.querySelector('img'));
  return well;
};

export function mountCardUpgradeModal(host, initialModel, {
  registries, meta, title = t('cardUpgrade.title'), backLabel = t('common.back'), consequence = '', decisionConsequence = '',
  servicePreviewHtml = () => '', onSelect, onBack, onConfirm, returnFocusElement,
}) {
  const returnFocus = returnFocusElement instanceof HTMLElement ? returnFocusElement : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const veil = document.createElement('div');
  veil.className = 'modal-veil smith-modal-veil';
  const modal = document.createElement('section');
  modal.className = 'modal smith-upgrade-modal card-upgrade-modal';
  stampModalSize(modal, 'xl');
  modal.dataset.wireframe = 'W1i';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'card-upgrade-title');
  modal.setAttribute('aria-describedby', 'card-upgrade-consequence');
  modal.tabIndex = -1;
  workspaceFrame(modal, smithWorkspaceVars());
  markUiComponent(modal, UI.smithUpgradeModal, 'cards');
  const purse = statusText('', { class: 'smith-header-stones', role: 'status' });
  const head = modalHead({ title, titleId: 'card-upgrade-title', closeLabel: backLabel, extras: purse });

  let currentModel = initialModel;
  let closed = false;
  let disarmDecision = null;

  // The model omits completed cards and orders available upgrades first.
  function cardRow(row) {
    const item = railItem({
      tag: 'div', label: '', member: row.instanceId, current: false,
      className: `smith-candidate-card smith-weapon-card card-upgrade-row rarity-${row.rarity}${row.disabled ? ' locked' : ''}`,
      attrs: { role: 'option', 'aria-controls': 'card-upgrade-preview-region', 'aria-disabled': String(row.disabled) },
    });
    item.dataset.instanceId = row.instanceId;
    item.dataset.cardId = row.cardId;
    item.dataset.upgradeState = row.disabled ? 'blocked' : row.cost === 0 ? 'free' : 'stone';
    const upgrade = t('cardUpgrade.row.status', { from: row.levelFrom, to: row.levelTo, cost: row.costLabel });
    item.replaceChildren(
      cardArt(row, { small: true }),
      el('span', { class: 'smith-row-text' }, [
        el('strong', { class: 'smith-weapon-name', text: row.name }),
        statusText(upgrade, { class: 'smith-row-status card-upgrade-cost' }),
        row.blockedReason ? statusText(row.blockedReason, { class: 'smith-row-status card-upgrade-reason' }) : null,
      ]),
      pill({ label: t('cardUpgrade.row.copies', { n: row.copies }), attrs: { class: 'smith-weapon-count', 'aria-label': t('cardUpgrade.row.copiesLabel', { n: row.copies }) } }),
    );
    const typeText = row.tags[0] || '';
    item.setAttribute('aria-label', [t('cardUpgrade.row.aria', { name: row.name, type: typeText, n: row.copies, from: row.levelFrom, to: row.levelTo, cost: row.costLabel }), row.blockedReason].filter(Boolean).join(' '));
    attachTooltip(item, () => `<div class="tt-title">${esc(row.name)} · ${esc(t('cardUpgrade.row.status', { from: row.levelFrom, to: row.levelTo, cost: row.costLabel }))}</div>`
      + `<div>${esc(row.tags.join(', '))}.</div>`
      + (row.blockedReason ? `<div>${esc(row.blockedReason)}</div>` : ''));
    markUiComponent(item, UI.smithCandidateCard, 'available');
    item.addEventListener('keydown', (event) => {
      if (event.target !== item || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      item.click();
    });
    return item;
  }
  function navigation(items) {
    return categoryNav({ items, ariaLabel: t('cardUpgrade.items'), railAttrs: { role: 'listbox' },
      face: () => currentModel.selected?.name || t('cardUpgrade.selector.none'),
      choose: (instanceId) => {
        const row = currentModel.rows.find((candidate) => candidate.instanceId === instanceId);
        if (row && !row.disabled) onSelect(instanceId);
      } });
  }
  let cards = initialModel.rows.map(cardRow);
  let nav = navigation(cards);
  const previewHost = el('div', { class: 'smith-preview-host' });
  const consequenceNode = el('p', { class: 'as-flavor smith-consequence', id: 'card-upgrade-consequence', text: consequence });
  const previewRegion = el('section', { class: 'as-pane smith-preview-region', id: 'card-upgrade-preview-region', 'aria-live': 'polite', 'aria-label': t('cardUpgrade.preview.label') }, [previewHost, consequenceNode]);
  const body = el('div', { class: 'modal-body smith-modal-body' }, railed(nav, previewRegion, { class: 'smith-candidate-region' }));
  const backBtn = button({ label: backLabel, role: 'exit', className: 'subtle smith-back' });
  const confirmBtn = button({ label: '', weight: 'primary', className: 'smith-confirm' });
  previewRegion.append(confirmBtn);
  modal.append(head, body, modalFooter({ primary: backBtn, className: 'smith-modal-footer', size: 'fill' }));
  veil.appendChild(modal);
  host.appendChild(veil);

  let confirmBlocked = '';
  const confirmReason = reasonWhenDisabled(confirmBtn, () => confirmBlocked || null);

  function previewCard(model) {
    const { selected } = model;
    const costNode = el('div', { class: `smith-summary-cell smith-preview-economy ${model.affordable ? 'affordable' : 'unaffordable'}` },
      el('span', { class: 'smith-economy-values' }, [
        glyph('weight', { class: 'smith-stone-icon', 'aria-hidden': 'true' }),
        el('b', { text: t('cardUpgrade.cost.label') }), ' ', el('strong', { class: 'card-upgrade-cost-value', text: selected.costLabel }),
      ]));
    const shortfall = selected.plan.code === 'stones'
      ? blocker(selected.plan.reason, { placement: 'pinned', attrs: { class: 'smith-preview-shortfall' } }) : null;
    const extra = servicePreviewHtml(model);
    return detailCard({
      attrs: { class: 'smith-preview-card', dataset: { uiComponent: UI.smithUpgradePreview } },
      children: [
        el('div', { class: 'smith-summary-grid' }, el('div', { class: 'smith-summary-cell smith-selected-head' }, [
          eyebrow(t('cardUpgrade.selected'), { class: 'smith-preview-label' }),
          el('b', { class: 'sr-name', text: selected.name }),
          el('span', { class: 'dc-meta', text: t('cardUpgrade.row.next', { n: selected.plan.n }) }),
        ])),
        // The plan's own before and after faces: the rolled step is already applied to `after`.
        el('div', { class: 'card-upgrade-preview', dataset: { cardUpgradePreview: selected.instanceId },
          html: upgradePreviewHtml(registries, { cardId: selected.cardId }, model.faces) }),
        extra ? el('div', { html: extra }) : null,
        el('div', { class: 'smith-cost-strip' }, [costNode, shortfall]),
      ].filter(Boolean),
    });
  }

  function commitSelected() {
    if (!currentModel.canConfirm) return;
    const { selected } = currentModel;
    close({ restoreFocus: false });
    onConfirm(selected.instanceId, selected.plan);
  }

  function draw(model) {
    let restoreNavFocus = null;
    if (model !== currentModel) {
      const active = document.activeElement;
      const focusedRow = cards.find((card) => card === active);
      const focusedToggle = active === nav.toggle;
      const wasOpen = nav.isOpen();
      nav.release();
      cards = model.rows.map(cardRow);
      nav = navigation(cards);
      body.replaceChildren(railed(nav, previewRegion, { class: 'smith-candidate-region' }));
      nav.plan();
      // The kit closes the list after a row pick, but on the nav this rebuild just released; a chosen
      // card shows its pane, so the new list stays closed (an unchosen one stays open).
      nav.setOpen(wasOpen && !model.selected);
      if (focusedRow || focusedToggle) restoreNavFocus = focusedToggle ? nav.toggle
        : cards.find((card) => card.dataset.instanceId === focusedRow.dataset.instanceId) || nav.start();
    }
    currentModel = model;
    const { selected } = model;
    markCurrent(cards, selected ? selected.instanceId : null);
    for (const card of cards) {
      const on = Boolean(selected) && card.dataset.instanceId === selected.instanceId;
      card.classList.toggle('selected', on);
      markUiComponent(card, UI.smithCandidateCard, on ? 'selected' : 'available');
    }
    nav.sync(selected ? selected.name : t('cardUpgrade.selector.none'));
    if (!selected) { nav.plan(); nav.setOpen(true); }
    purse.textContent = t('cardUpgrade.stones', { n: model.stones });
    previewHost.replaceChildren(selected ? previewCard(model)
      : el('div', { class: 'smith-preview-empty', dataset: { uiComponent: UI.smithUpgradePreview } }, [artWell({ glyph: 'smith', cool: true }), prose(t('cardUpgrade.instruction'))]));
    disarmDecision?.();
    disarmDecision = null;
    confirmBtn.disabled = !model.canConfirm;
    confirmBtn.hidden = !selected;
    confirmBtn.textContent = selected ? t('cardUpgrade.confirm', { cost: selected.costLabel }) : '';
    confirmBtn.setAttribute('aria-disabled', String(!model.canConfirm));
    confirmBlocked = selected ? model.blockedReasons.join(' ') : '';
    confirmReason();
    confirmBtn.dataset.smithActionState = !selected ? 'unselected' : model.canConfirm ? 'actionable' : 'blocked';
    if (selected) {
      const details = el('div', { html: upgradePreviewHtml(registries, { cardId: selected.cardId }, model.faces) });
      disarmDecision = armOptionDecision(confirmBtn, {
        meta, registries, id: 'smithUpgrade',
        title: t('cardUpgrade.decision.title', { name: selected.name }),
        message: t('cardUpgrade.decision.message', { cost: selected.costLabel, then: decisionConsequence }),
        consequence: t('cardUpgrade.permanent'),
        detailsHtml: details,
        confirmLabel: t('cardUpgrade.confirm', { cost: selected.costLabel }),
        cancelLabel: t('common.back'),
        onCommit: commitSelected,
        canCommit: () => Boolean(currentModel.canConfirm),
        blockedTitle: t('cardUpgrade.blocked', { name: selected.name }),
        blockedMessage: model.blockedReasons.join(' ') || t('cardUpgrade.unavailable'),
        blockedDetailsHtml: details,
        returnFocusElement: confirmBtn,
      });
    }
    if (restoreNavFocus) landControl(restoreNavFocus);
  }

  function close({ restoreFocus = true } = {}) {
    if (closed) return;
    closed = true;
    nav.release();
    disarmDecision?.();
    disarmDecision = null;
    window.removeEventListener('keydown', onKeydown, true);
    veil.remove();
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }
  function backOut() { close(); onBack(); }
  function onKeydown(event) {
    if (event.defaultPrevented || event.repeat) return;
    if ([...document.querySelectorAll('[aria-modal="true"]')].at(-1) !== modal) return;
    if (event.key === 'Escape') {
      if (modal.querySelector('.as-railed[data-cat-open="true"]')) return;
      event.preventDefault(); event.stopPropagation(); backOut(); return;
    }
    if (event.key !== 'Tab') return;
    const focusable = visibleFocusable(modal);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    else if (!modal.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
  }
  veil.addEventListener('click', (event) => { if (event.target === veil) backOut(); });
  backBtn.addEventListener('click', backOut);
  modal.querySelector('.modal-close')?.addEventListener('click', backOut);
  window.addEventListener('keydown', onKeydown, true);
  draw(initialModel);
  queueMicrotask(() => modal.focus({ preventScroll: true }));
  return { update(model) { draw(model); }, close };
}
