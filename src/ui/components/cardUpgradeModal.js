// The Core card-upgrade picker: one dialog for the rest site and the Blacksmith. It reuses the Smith picker's
// frame, rail, pane and decision beat (smithUpgradeModal.js) with deck-card rows. The component renders and
// routes; the host owns the run mutation. Every fact is from CardUpgradeModel.js, whose plan is the one
// commitCardUpgrade applies, so the before/after preview is exactly what the commit does.
import {
  el, modalHead, modalFooter, pill, button, eyebrow, prose, artWell, detailCard,
  blocker, glyph, railItem, railed, statusText, categoryNav, stampModalSize,
} from '../kit/index.js';
import { upgradePreviewHtml } from './card.js';
import { armOptionDecision } from '../../framework/optionDecision.js';
import { t } from '../strings.js';
import { reasonWhenDisabled } from './refusal.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { workspaceFrame, markCurrent } from './w1Workspace.js';
import { smithWorkspaceVars } from '../models/SmithWorkspaceModel.js';

const visibleFocusable = (root) => [...root.querySelectorAll(
  'button:not([disabled]), [role="button"][tabindex="0"], [role="option"][tabindex="0"], [tabindex]:not([tabindex="-1"])',
)].filter((element) => !element.hidden && element.getClientRects().length);

export function mountCardUpgradeModal(host, initialModel, {
  registries, meta, title = t('cardUpgrade.title'), consequence = '', decisionConsequence = '',
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
  const head = modalHead({ title, titleId: 'card-upgrade-title', closeLabel: t('common.back'), extras: purse });

  let currentModel = initialModel;
  let closed = false;
  let disarmDecision = null;

  // One rail row per deck card: its name, what the next upgrade costs (or "Fully upgraded"), the upgrade count.
  const cards = initialModel.rows.map((row) => {
    const item = railItem({
      tag: 'div', label: '', member: row.instanceId, current: false,
      className: `smith-candidate-card smith-weapon-card card-upgrade-row rarity-${row.rarity}${row.disabled ? ' locked' : ''}`,
      attrs: { role: 'option', 'aria-controls': 'card-upgrade-preview-region', 'aria-disabled': String(row.disabled) },
    });
    item.dataset.instanceId = row.instanceId;
    item.dataset.cardId = row.cardId;
    item.dataset.upgradeState = row.disabled ? 'maxed' : row.cost === 0 ? 'free' : 'stone';
    item.replaceChildren(
      el('span', { class: 'smith-row-text' }, [
        el('strong', { class: 'smith-weapon-name', text: row.name }),
        statusText(row.costLabel, { class: 'smith-row-status card-upgrade-cost' }),
      ]),
      pill({ label: `+${row.upgrades}`, attrs: { class: 'smith-weapon-count', 'aria-label': t('cardUpgrade.row.count', { n: row.upgrades }) } }),
    );
    item.setAttribute('aria-label', `${row.name}, ${row.costLabel}`);
    markUiComponent(item, UI.smithCandidateCard, 'available');
    item.addEventListener('keydown', (event) => {
      if (event.target !== item || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      item.click();
    });
    return item;
  });
  const nav = categoryNav({ items: cards, ariaLabel: t('cardUpgrade.items'), railAttrs: { role: 'listbox' },
    face: () => currentModel.selected?.name || t('cardUpgrade.selector.none'),
    // A disabled row is not a choice: "Fully upgraded" cannot be picked.
    choose: (instanceId) => { if (!initialModel.rows.find((row) => row.instanceId === instanceId)?.disabled) onSelect(instanceId); } });
  const previewHost = el('div', { class: 'smith-preview-host' });
  const consequenceNode = el('p', { class: 'as-flavor smith-consequence', id: 'card-upgrade-consequence', text: consequence });
  const previewRegion = el('section', { class: 'as-pane smith-preview-region', id: 'card-upgrade-preview-region', 'aria-live': 'polite', 'aria-label': t('cardUpgrade.preview.label') }, [previewHost, consequenceNode]);
  const body = el('div', { class: 'modal-body smith-modal-body' }, railed(nav, previewRegion, { class: 'smith-candidate-region' }));
  const backBtn = button({ label: t('common.back'), role: 'exit', className: 'subtle smith-back' });
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
    confirmBtn.disabled = !selected;
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
