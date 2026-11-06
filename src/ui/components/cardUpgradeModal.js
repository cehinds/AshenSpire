// The Core card-upgrade picker: one dialog for the rest site and the Blacksmith. It reuses the Smith picker's
// frame, rail, pane and decision beat (smithUpgradeModal.js) with deck-card rows. The component renders and
// routes; the host owns the run mutation. Every fact is from CardUpgradeModel.js, whose plan is the one
// commitCardUpgrade applies, so the before/after preview is exactly what the commit does.
import { el, pill, eyebrow, artWell, statRow, statusText, landControl } from '../kit/index.js';
import { mountUpgradeDesk, deskRow, deskArt } from './upgradeDesk.js';
import { renderCard } from './card.js';
import { upgradeFacesNode, upgradeConfirmNodes } from './upgradeConfirm.js';
import { changeSummary, economyNode } from './smithPaneParts.js';
import { assetUrl } from '../assetmap.js';
import { hideOnError } from '../artFallback.js';
import { pushModalParent, dropModalParent, returnToModalParent, modalParentLabel } from '../modalReturn.js';
import { attachTooltip, esc } from './tooltip.js';
import { armOptionDecision } from '../../framework/optionDecision.js';
import { t } from '../strings.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

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
  registries, meta, title = t('cardUpgrade.title'), backLabel: backLabelOverride, decisionConsequence = '',
  onSelect, onBack, onConfirm, returnFocusElement, focusInstanceId = null,
  // The list's own return record ({ place: where Back leads, e.g. t('common.place.blacksmith'), reopen(focus): draw this list again), see modalReturn.js.
  // With it, a confirmed upgrade lands back on a refreshed list, and the Back label names `place`.
  parent = null,
}) {
  const parentRecord = parent ? pushModalParent(parent) : null;
  const backLabel = backLabelOverride || modalParentLabel(parentRecord);
  const returnFocus = returnFocusElement instanceof HTMLElement ? returnFocusElement : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const desk = mountUpgradeDesk(host, {
    title, titleId: 'card-upgrade-title', listLabel: t('cardUpgrade.items'), backLabel, kind: 'card',
  });
  const { veil, panel: modal, purse, backBtn, confirmBtn } = desk;
  modal.classList.add('smith-upgrade-modal', 'card-upgrade-modal');
  markUiComponent(modal, UI.smithUpgradeModal, 'cards');

  let currentModel = initialModel;
  // The option picked among several (blacksmith choice): the index into the selected row's `options`; it resets with the card.
  let chosen = 0;
  let chosenFor = null;
  let closed = false;
  let disarmDecision = null;
  let review = null;

  // The model omits completed cards and orders available upgrades first.
  function cardRow(row) {
    const upgrade = t('cardUpgrade.row.status', { from: row.levelFrom, to: row.levelTo, cost: row.costLabel });
    const { item: wrapper, main: item } = deskRow({
      className: `smith-candidate-card smith-weapon-card card-upgrade-row rarity-${row.rarity}${row.disabled ? ' locked' : ''}`,
      attrs: { role: 'option', tabindex: '0', 'aria-selected': 'false', 'aria-disabled': String(row.disabled) },
      disabled: row.disabled,
      art: deskArt(cardArt(row, { small: true })),
      name: row.name,
      badges: [row.inDeck ? el('span', { class: 'as-tag card-upgrade-indeck', text: t('cardUpgrade.row.inDeck') }) : null],
      meta: el('span', { class: 'deck-editor-meta smith-row-text' }, [
        statusText(upgrade, { class: 'smith-row-status card-upgrade-cost' }),
        row.blockedReason ? statusText(row.blockedReason, { class: 'smith-row-status card-upgrade-reason' }) : null,
      ]),
      side: [pill({ label: t('cardUpgrade.row.copies', { n: row.copies }), attrs: { class: 'smith-weapon-count', 'aria-label': t(row.inDeck ? 'cardUpgrade.row.copiesLabel' : 'cardUpgrade.row.copiesLabelSide', { n: row.copies }) } })],
    });
    item.dataset.instanceId = row.instanceId;
    item.dataset.cardId = row.cardId;
    item.dataset.upgradeState = row.disabled ? 'blocked' : row.cost === 0 ? 'free' : 'stone';
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
    // A blocked row stays listed and dimmed; choosing it does nothing, as before.
    item.addEventListener('click', () => {
      const current = currentModel.rows.find((candidate) => candidate.instanceId === row.instanceId);
      if (current && !current.disabled) { onSelect(row.instanceId); review?.(); }
    });
    item.wrapper = wrapper;
    return item;
  }
  const mountRows = (rows) => desk.setRows(rows.map((row) => row.wrapper));
  let cards = initialModel.rows.map(cardRow);
  mountRows(cards);

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
  /** The plan's own before and after faces as small cards, side by side. */
  const facesNode = (model) => upgradeFacesNode(Object.fromEntries(['before', 'after'].map((which) => [which,
    renderCard(registries, { cardId: model.selected.cardId }, { small: true, tooltip: false, inspectReadOnly: true, definition: model.faces[which] })])));

  /** The row's chosen option (the first when there is no choice). */
  const optionOf = (model) => model.selected.options?.[chosen] || model.selected.options?.[0] || null;
  /** The model as the pane shows it: the chosen option's after face and change rows. */
  const viewOf = (model) => {
    const option = model.selected && model.faces ? optionOf(model) : null;
    if (!option || model.selected.options.length < 2) return model;
    return { ...model, selected: { ...model.selected, changes: option.changes }, faces: { before: model.faces.before, after: option.after } };
  };
  /** Two or three after-faces side by side (stacked on a phone); the picked one is highlighted. */
  const optionsNode = (model) => {
    const { selected } = model;
    if (!(selected.options?.length > 1)) return null;
    const group = el('div', { class: 'card-upgrade-options', role: 'radiogroup', 'aria-label': t('cardUpgrade.options.label'), dataset: { cardUpgradeOptions: String(selected.options.length) } }, [
      eyebrow(t('cardUpgrade.options.label')),
      el('div', { class: 'card-upgrade-option-list' }, selected.options.map((option) => {
        const on = option.index === chosen;
        const summary = option.changes.map((change) => `${change.label} ${change.before} to ${change.after}`).join(', ');
        const button = el('button', {
          type: 'button', class: `card-upgrade-option${on ? ' selected' : ''}`, role: 'radio', 'aria-checked': String(on), tabindex: on ? '0' : '-1',
          'aria-label': t('cardUpgrade.option.aria', { n: option.index + 1, total: selected.options.length, summary }),
          dataset: { cardUpgradeOption: String(option.index) },
        }, el('span', { class: 'card-upgrade-option-body' }, [
          el('b', { class: 'card-upgrade-option-title', text: t('cardUpgrade.option.n', { n: option.index + 1 }) }),
          el('div', { class: 'card-upgrade-option-face' }, // The face is part of the option's radio button: a click or tap on it picks the option (not inspectReadOnly, which
          // would swallow the click and open the reading), and actionOwnsTouch lets the first touch tap through. The (i) badge
          // a selected face reveals, and a press-and-hold, still open the card's reading.
          renderCard(registries, { cardId: selected.cardId }, { small: true, tooltip: false, actionOwnsTouch: true, definition: option.after })),
          el('ul', { class: 'card-upgrade-option-changes' }, option.changes.map((change) => el('li', { text: `${change.label} ${change.before} → ${change.after}` }))),
        ]));
        button.addEventListener('click', () => pick(option.index));
        return button;
      })),
    ]);
    group.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault(); event.stopPropagation();
      pick((chosen + step + selected.options.length) % selected.options.length);
    });
    return group;
  };
  function pick(index) {
    chosen = index;
    fillDetails();
    modalDetails?.querySelector(`[data-card-upgrade-option="${index}"]`)?.focus({ preventScroll: true });
  }

  /** The decision door's details (the shared body, upgradeConfirm.js): cost, both faces, then the change rows under them. */
  const detailNodes = (raw) => { const model = viewOf(raw); return upgradeConfirmNodes({
    cost: el('div', { class: `confirmation-cost as-statrow flat ${(model.selected.shortStones ?? model.selected.plan.code === 'stones') || !model.selected.ok ? 'unaffordable' : 'affordable'}` }, priceNode(model)),
    faces: model.faces ? facesNode(model) : null,
    rows: model.selected.changes.map((change) => statRow({ flat: true, nameNode: el('b', { class: 'sr-name', text: change.label }), values: changeSummary({ values: [change] }) })),
  }); };
  const confirmationNode = (raw) => el('div', { class: 'card-upgrade-modal-details' }, detailNodes(raw));
  // With a choice among options, the modal holds the choice itself: a live node the options redraw in place.
  let modalDetails = null;
  function fillDetails() {
    if (!modalDetails) return;
    modalDetails.replaceChildren(...[optionsNode(currentModel), ...detailNodes(currentModel)].filter(Boolean));
  }

  function commitSelected() {
    if (!currentModel.canConfirm) return;
    const { selected } = currentModel;
    const option = selected.options?.length > 1 ? selected.options[chosen] : null;
    // With a choice, a pick that no longer names an option commits nothing.
    if (selected.options?.length > 1 && !option) return;
    close({ restoreFocus: false, keepParent: true });
    // With a choice, the quote carries the picked step; the service re-plans the same list and checks it is on it.
    try { onConfirm(selected.instanceId, option ? { ...selected.plan, step: option.step, after: option.after } : selected.plan); }
    finally { if (parentRecord) returnToModalParent(selected.instanceId); }
  }

  function draw(model) {
    let restoreFocus = null;
    if (model !== currentModel) {
      const focusedRow = cards.find((card) => card === document.activeElement);
      cards = model.rows.map(cardRow);
      mountRows(cards);
      if (focusedRow) restoreFocus = cards.find((card) => card.dataset.instanceId === focusedRow.dataset.instanceId) || cards[0] || null;
    }
    currentModel = model;
    const { selected } = model;
    if ((selected ? selected.instanceId : null) !== chosenFor) { chosenFor = selected ? selected.instanceId : null; chosen = 0; }
    // The option list can shrink under a redraw (a changed quote); never leave `chosen` past its end.
    if (selected?.options?.length) chosen = Math.min(Math.max(chosen, 0), selected.options.length - 1);
    for (const card of cards) {
      const on = Boolean(selected) && card.dataset.instanceId === selected.instanceId;
      card.classList.toggle('selected', on);
      card.setAttribute('aria-selected', String(on));
      markUiComponent(card, UI.smithCandidateCard, on ? 'selected' : 'available');
    }
    purse.textContent = t('cardUpgrade.stones', { n: model.stones });
    disarmDecision?.();
    disarmDecision = null;
    review = null;
    modalDetails = null;
    if (selected) {
      const choice = selected.options?.length > 1;
      if (choice) { modalDetails = el('div', { class: 'card-upgrade-modal-details' }); fillDetails(); }
      const armed = armOptionDecision(confirmBtn, {
        meta, registries, id: 'smithUpgrade',
        title: t('smith.upgrade.title', { name: selected.name }),
        message: t('cardUpgrade.decision.message', { from: selected.levelFrom, to: selected.levelTo, then: decisionConsequence }),
        consequence: t('cardUpgrade.permanent'),
        detailsNode: choice ? modalDetails : () => confirmationNode(model),
        confirmLabel: confirmText(selected),
        cancelLabel: t('common.back'),
        onCommit: commitSelected,
        canCommit: () => Boolean(currentModel.canConfirm) && (!(selected.options?.length > 1) || Boolean(selected.options[chosen])),
        blockedTitle: t('cardUpgrade.blocked', { name: selected.name }),
        blockedMessage: model.blockedReasons.join(' ') || t('cardUpgrade.unavailable'),
        blockedDetailsNode: () => confirmationNode(model),
        returnFocusElement: cards.find((card) => card.dataset.instanceId === selected.instanceId) || null,
      });
      disarmDecision = armed;
      review = armed.review;
    }
    if (restoreFocus) landControl(restoreFocus);
  }

  function close({ restoreFocus = true, keepParent = false } = {}) {
    if (closed) return;
    closed = true;
    if (parentRecord && !keepParent) dropModalParent(parentRecord);
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
  desk.closeBtn.addEventListener('click', backOut);
  window.addEventListener('keydown', onKeydown, true);
  draw(initialModel);
  queueMicrotask(() => (cards.find((card) => card.dataset.instanceId === focusInstanceId) || modal).focus({ preventScroll: true }));
  // Mounted with a card already chosen: its modal opens at once.
  if (initialModel.selected) review?.();
  return { update(model) { draw(model); }, close };
}
