// The Core card-upgrade picker: one dialog for the rest site and the Blacksmith. It reuses the Smith picker's
// frame, rail, pane and decision beat (smithUpgradeModal.js) with deck-card rows. The component renders and
// routes; the host owns the run mutation. Every fact is from CardUpgradeModel.js, whose plan is the one
// commitCardUpgrade applies, so the before/after preview is exactly what the commit does.
import {
  el, html, modalHead, modalFooter, pill, button, eyebrow, prose, artWell, detailCard, statRow,
  blocker, glyph, railItem, railed, statusText, categoryNav, stampModalSize, landControl,
} from '../kit/index.js';
import { upgradePreviewHtml, renderCard } from './card.js';
import { FOLD_GLYPH } from './foldGlyph.js';
import { deltaNode, changeSummary, economyNode } from './smithPaneParts.js';
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
        row.inDeck ? el('span', { class: 'as-tag card-upgrade-indeck', text: t('cardUpgrade.row.inDeck') }) : null,
        statusText(upgrade, { class: 'smith-row-status card-upgrade-cost' }),
        row.blockedReason ? statusText(row.blockedReason, { class: 'smith-row-status card-upgrade-reason' }) : null,
      ]),
      pill({ label: t('cardUpgrade.row.copies', { n: row.copies }), attrs: { class: 'smith-weapon-count', 'aria-label': t(row.inDeck ? 'cardUpgrade.row.copiesLabel' : 'cardUpgrade.row.copiesLabelSide', { n: row.copies }) } }),
    );
    const typeText = row.tags[0] || '';
    item.setAttribute('aria-label', [t(row.inDeck ? 'cardUpgrade.row.aria' : 'cardUpgrade.row.ariaSide', { name: row.name, type: typeText, n: row.copies, from: row.levelFrom, to: row.levelTo, cost: row.costLabel }), row.blockedReason].filter(Boolean).join(' '));
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

  const shortfallOf = (model) => Math.max(0, model.selected.cost - model.stones);
  const shortBlocker = (model) => blocker(
    t(shortfallOf(model) === 1 ? 'cardUpgrade.short.one' : 'cardUpgrade.short.many', { n: shortfallOf(model) }),
    { placement: 'pinned', attrs: { class: 'smith-preview-shortfall' } });
  // The price a row asks: Smithing Stones (the rest site's), plus cinders when a quote names them (the Blacksmith's).
  const priceNode = (model) => {
    const { selected } = model;
    if (!(selected.cinders > 0)) return economyNode({ cost: selected.cost, stones: model.stones });
    return el('span', { class: 'card-upgrade-cinders' }, [
      selected.cost > 0 ? economyNode({ cost: selected.cost, stones: model.stones }) : null,
      el('b', { text: t('cardUpgrade.cinders', { n: selected.cinders }) }),
    ].filter(Boolean));
  };
  const confirmText = (selected) => (selected.cinders > 0 ? t('cardUpgrade.confirmCinders', { n: selected.cinders }) : t('smith.upgrade.confirm', { cost: selected.cost }));
  const costStrip = (model) => {
    const { selected } = model;
    const short = selected.shortStones ?? selected.plan.code === 'stones';
    // A quote (the Blacksmith's) can block on something other than stones, so its reason is shown as it stands.
    const unaffordable = short || !selected.ok;
    return el('div', { class: 'smith-cost-strip' }, [
      el('div', { class: `smith-summary-cell smith-preview-economy ${unaffordable ? 'unaffordable' : 'affordable'}` }, priceNode(model)),
      short && shortfallOf(model) > 0 ? shortBlocker(model) : !selected.ok && selected.blockedReason ? blocker(selected.blockedReason, { placement: 'pinned', attrs: { class: 'smith-preview-shortfall' } }) : null,
    ]);
  };
  /** The plan's own before and after faces as small cards, side by side. */
  const facesNode = (model) => el('div', { class: 'card-upgrade-faces' }, ['before', 'after'].map((which) => el('div', { class: `card-upgrade-face ${which}`, dataset: { cardUpgradeFace: which } },
    renderCard(registries, { cardId: model.selected.cardId }, { small: true, tooltip: false, inspectReadOnly: true, definition: model.faces[which] }))));

  function previewCard(model) {
    const { selected } = model;
    const head = el('div', { class: 'smith-summary-grid' }, el('div', { class: 'smith-summary-cell smith-selected-head' }, [
      cardArt(selected),
      eyebrow(t('cardUpgrade.selected'), { class: 'smith-preview-label' }),
      el('b', { class: 'sr-name', text: selected.name }),
      el('span', { class: 'dc-meta' }, [`${t('cardUpgrade.pane.level')} `, deltaNode(String(selected.levelFrom), String(selected.levelTo)), ` · ${t('cardUpgrade.pane.owned', { n: selected.copies })}`]),
      selected.tags.length ? el('span', { class: 'smith-weapon-tags' }, selected.tags.map((tag) => el('em', { class: 'as-tag', text: tag }))) : null,
    ]));
    const stats = selected.changes.length ? statRow({
      flat: true,
      nameNode: el('span', { class: 'smith-data-heading' }, [el('b', { class: 'sr-name', text: t('cardUpgrade.stats.title') }), el('small', { class: 'sr-hint', text: selected.tags[0] || '' })]),
      values: changeSummary({ values: selected.changes }),
      className: 'smith-data-row smith-intrinsic-stats',
    }) : null;
    // The plan's own before and after faces: the rolled step is already applied to `after`.
    const fold = model.faces ? el('div', { class: 'smith-upgrade-folds' }, el('details', { class: 'smith-upgrade-fold smith-upgrade-row' }, [
      el('summary', {}, statRow({
        tag: 'span', nameNode: el('b', { class: 'sr-name', text: selected.name }),
        values: [changeSummary({ values: selected.changes }), glyph(FOLD_GLYPH.collapsed, { class: 'caret smith-fold-caret' })],
      })),
      el('div', { class: 'smith-fold-detail' }, [
        facesNode(model),
        el('div', { class: 'smith-card-facts' }, [
          eyebrow(t('smith.upgrade.fold')),
          el('div', { class: 'card-upgrade-preview', dataset: { cardUpgradePreview: selected.instanceId },
            html: upgradePreviewHtml(registries, { cardId: selected.cardId }, model.faces) }),
        ]),
      ]),
    ])) : null;
    const extra = servicePreviewHtml(model);
    return detailCard({
      attrs: { class: 'smith-preview-card', dataset: { uiComponent: UI.smithUpgradePreview } },
      children: [head, stats, fold, extra ? el('div', { html: extra }) : null, costStrip(model)].filter(Boolean),
    });
  }

  /** The decision door's details: cost, the same change rows, and both faces. */
  const confirmationDetails = (model) => html([
    el('div', { class: `confirmation-cost as-statrow flat ${(model.selected.shortStones ?? model.selected.plan.code === 'stones') || !model.selected.ok ? 'unaffordable' : 'affordable'}` }, priceNode(model)),
    el('div', { class: 'confirmation-change-list' }, model.selected.changes.map((change) => statRow({ flat: true, nameNode: el('b', { class: 'sr-name', text: change.label }), values: changeSummary({ values: [change] }) }))),
    model.faces ? facesNode(model) : null,
  ].filter(Boolean));

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
    confirmBtn.textContent = selected ? confirmText(selected) : '';
    confirmBtn.setAttribute('aria-disabled', String(!model.canConfirm));
    confirmBlocked = selected ? model.blockedReasons.join(' ') : '';
    confirmReason();
    confirmBtn.dataset.smithActionState = !selected ? 'unselected' : model.canConfirm ? 'actionable' : 'blocked';
    if (selected) {
      const details = confirmationDetails(model);
      confirmBtn.setAttribute('aria-label', t(selected.cost === 1 ? 'smith.upgrade.aria.one' : 'smith.upgrade.aria.many', { name: selected.name, cost: selected.cost }));
      disarmDecision = armOptionDecision(confirmBtn, {
        meta, registries, id: 'smithUpgrade',
        title: t('smith.upgrade.title', { name: selected.name }),
        message: t('cardUpgrade.decision.message', { from: selected.levelFrom, to: selected.levelTo, then: decisionConsequence }),
        consequence: t('cardUpgrade.permanent'),
        detailsHtml: details,
        confirmLabel: confirmText(selected),
        cancelLabel: t('common.back'),
        onCommit: commitSelected,
        canCommit: () => Boolean(currentModel.canConfirm),
        blockedTitle: t('cardUpgrade.blocked', { name: selected.name }),
        blockedMessage: model.blockedReasons.join(' ') || t('cardUpgrade.unavailable'),
        blockedDetailsHtml: confirmationDetails(model),
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
