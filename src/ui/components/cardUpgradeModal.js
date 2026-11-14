// The Core card-upgrade picker: one dialog for the rest site and the Blacksmith, in the defensive-reaction prompt's
// design (owner, 2026-11-14): option rows (optionRowList), the selected row opens its before -> after faces and
// change rows UNDER it, a Back exit and one primary Upgrade button that stays disabled until a card is selected.
// The primary still opens the permanent-change confirmation (armOptionDecision). The component renders and
// routes; the host owns the run mutation. Every fact is from CardUpgradeModel.js, whose plan is the one
// commitCardUpgrade applies, so the before/after preview is exactly what the commit does.
import { el, eyebrow, statRow, button } from '../kit/index.js';
import { openModal } from './modalShell.js';
import { optionRowList } from './optionRowList.js';
import { renderCard } from './card.js';
import { upgradeFacesNode, upgradeConfirmNodes } from './upgradeConfirm.js';
import { changeSummary, economyNode } from './smithPaneParts.js';
import { pushModalParent, dropModalParent, returnToModalParent, modalParentLabel } from '../modalReturn.js';
import { armOptionDecision } from '../../framework/optionDecision.js';
import { t } from '../strings.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';


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

  let currentModel = initialModel;
  // The option picked among several (blacksmith choice): the index into the selected row's `options`; it resets with the card.
  let chosen = 0;
  let chosenFor = null;
  let closed = false;
  let committing = false;
  let disarmDecision = null;
  let bodyHost = null;
  let listHost = null;
  let detailHost = null;
  let list = null;

  // The Upgrade button is the control the permanent-change review is armed on; it stays disabled until a card is selected.
  const confirmBtn = button({ label: t('cardUpgrade.confirmIdle'), weight: 'primary', className: 'smith-confirm card-upgrade-confirm', disabled: true });
  const backBtn = button({ label: backLabel, role: 'exit', className: 'smith-back' });
  const shell = openModal({
    title, eyebrow: '', size: 'md', className: 'option-choice smith-upgrade-modal card-upgrade-modal',
    host, opener: returnFocus, closeLabel: backLabel, secondary: [backBtn], primary: confirmBtn,
    bodyClassName: 'as-pane', deferFocus: true,
    initialFocus: () => (focusInstanceId && list?.querySelector(`[data-instance-id="${focusInstanceId}"]`)) || list?.querySelector('[data-instance-id]:not([disabled])') || null,
    body(bodyEl) { bodyHost = bodyEl; },
    onClose: () => {
      if (closed) return;
      closed = true;
      disarmDecision?.();
      disarmDecision = null;
      // Any way out but a confirmed upgrade (Back, the close, Escape, the veil) is a full exit: the parent is forgotten.
      if (!committing) { if (parentRecord) dropModalParent(parentRecord); onBack(); }
    },
  });
  backBtn.addEventListener('click', () => shell.close());
  const modal = shell.panel;
  markUiComponent(modal, UI.smithUpgradeModal, 'cards');
  const purse = el('p', { class: 'smith-header-stones', role: 'status', 'aria-live': 'polite' });
  bodyHost.append(purse);
  listHost = el('div', { class: 'card-upgrade-list', role: 'listbox', 'aria-label': t('cardUpgrade.items') });
  bodyHost.append(listHost);

  /** The row's chip line: the rank and upgrade price, whether it is in the deck. */
  const rowOf = (row, model) => {
    const upgrade = row.weaponBound ? '' : t('cardUpgrade.row.status', { from: row.levelFrom, to: row.levelTo, cost: row.costLabel });
    return {
      id: row.instanceId, name: row.name, className: `card-upgrade-row smith-candidate-card rarity-${row.rarity}${row.disabled ? ' locked' : ''}`,
      costs: [upgrade, row.inDeck ? t('cardUpgrade.row.inDeck') : ''].filter(Boolean),
      text: row.blockedReason || '', line: [], disabled: row.disabled,
      chip: t('cardUpgrade.row.copies', { n: row.copies }),
      artAsset: row.artAsset || null, artGlyph: row.artAsset ? null : row.artGlyph,
      detail: model.selected && model.selected.instanceId === row.instanceId ? detailHost : null,
    };
  };

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
        const optionButton = el('button', {
          type: 'button', class: `card-upgrade-option${on ? ' selected' : ''}`, role: 'radio', 'aria-checked': String(on), tabindex: on ? '0' : '-1',
          'aria-label': t('cardUpgrade.option.aria', { n: option.index + 1, total: selected.options.length, summary }),
          dataset: { cardUpgradeOption: String(option.index) },
        }, el('span', { class: 'card-upgrade-option-body' }, [
          el('b', { class: 'card-upgrade-option-title', text: t('cardUpgrade.option.n', { n: option.index + 1 }) }),
          // The face is part of the option's radio button: a click or tap on it picks the option (not inspectReadOnly, which
          // would swallow the click and open the reading), and actionOwnsTouch lets the first touch tap through.
          el('div', { class: 'card-upgrade-option-face' }, renderCard(registries, { cardId: selected.cardId }, { small: true, tooltip: false, actionOwnsTouch: true, definition: option.after })),
          el('ul', { class: 'card-upgrade-option-changes' }, option.changes.map((change) => el('li', { text: `${change.label} ${change.before} → ${change.after}` }))),
        ]));
        optionButton.addEventListener('click', () => pick(option.index));
        return optionButton;
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
    detailHost?.querySelector(`[data-card-upgrade-option="${index}"]`)?.focus({ preventScroll: true });
  }

  /** The details (the shared body, upgradeConfirm.js): cost, both faces, then the change rows under them. */
  const detailNodes = (raw) => { const model = viewOf(raw); const nodes = upgradeConfirmNodes({
    cost: el('div', { class: `confirmation-cost as-statrow flat ${(model.selected.shortStones ?? model.selected.plan.code === 'stones') || !model.selected.ok ? 'unaffordable' : 'affordable'}` }, priceNode(model)),
    faces: model.faces ? facesNode(model) : null,
    rows: model.selected.changes.map((change) => statRow({ flat: true, nameNode: el('b', { class: 'sr-name', text: change.label }), values: changeSummary({ values: [change] }) })),
  }); return model.selected.nextDiffers ? [el('p', { class: 'card-upgrade-note', text: t('cardUpgrade.row.nextDiffers') }), ...nodes] : nodes; };
  const confirmationNode = (raw) => el('div', { class: 'card-upgrade-modal-details' }, detailNodes(raw));
  // The live node under the selected row: with a choice among options it holds the options too, and they redraw in place.
  function fillDetails() {
    if (!detailHost) return;
    detailHost.replaceChildren(...[optionsNode(currentModel), ...detailNodes(currentModel)].filter(Boolean));
  }

  function commitSelected() {
    if (!currentModel.canConfirm) return;
    const { selected } = currentModel;
    const option = selected.options?.length > 1 ? selected.options[chosen] : null;
    // With a choice, a pick that no longer names an option commits nothing.
    if (selected.options?.length > 1 && !option) return;
    committing = true;
    shell.close();
    // With a choice, the quote carries the picked step; the service re-plans the same list and checks it is on it.
    // `false` from onConfirm (or a throw) is a refusal: the list stays closed so the refusal text is not covered.
    let committed = false;
    try { committed = onConfirm(selected.instanceId, option ? { ...selected.plan, step: option.step, after: option.after } : selected.plan) !== false; }
    finally { if (parentRecord) { if (committed) returnToModalParent(selected.instanceId); else dropModalParent(parentRecord); } }
  }

  function draw(model) {
    const focusedId = list?.contains?.(document.activeElement) ? document.activeElement.getAttribute?.('data-instance-id') : null;
    currentModel = model;
    const { selected } = model;
    if ((selected ? selected.instanceId : null) !== chosenFor) { chosenFor = selected ? selected.instanceId : null; chosen = 0; }
    // The option list can shrink under a redraw (a changed quote); never leave `chosen` past its end.
    if (selected?.options?.length) chosen = Math.min(Math.max(chosen, 0), selected.options.length - 1);
    detailHost = selected ? el('div', { class: 'card-upgrade-modal-details' }) : null;
    fillDetailsSafe(selected);
    list = optionRowList(model.rows.map((row) => rowOf(row, model)), {
      idAttr: 'data-instance-id', selectedId: selected ? selected.instanceId : null, columns: 1,
      onSelect: (id) => { onSelect(id); },
    });
    for (const rowEl of list.querySelectorAll('[data-instance-id]')) {
      const row = model.rows.find((candidate) => candidate.instanceId === rowEl.getAttribute('data-instance-id'));
      if (!row) continue;
      rowEl.dataset.cardId = row.cardId;
      rowEl.dataset.upgradeState = row.disabled ? 'blocked' : row.cost === 0 ? 'free' : 'stone';
      rowEl.setAttribute('role', 'option');
      rowEl.setAttribute('aria-disabled', String(row.disabled));
      rowEl.setAttribute('aria-selected', String(Boolean(selected) && selected.instanceId === row.instanceId));
      rowEl.classList.toggle('selected', Boolean(selected) && selected.instanceId === row.instanceId);
      const typeText = row.tags[0] || '';
      rowEl.setAttribute('aria-label', [t(row.inDeck ? 'cardUpgrade.row.aria' : 'cardUpgrade.row.ariaSide', { name: row.name, type: typeText, n: row.copies, from: row.levelFrom, to: row.levelTo, cost: row.costLabel }), row.blockedReason].filter(Boolean).join(' '));
      markUiComponent(rowEl, UI.smithCandidateCard, selected && selected.instanceId === row.instanceId ? 'selected' : 'available');
    }
    listHost.replaceChildren(list);
    purse.textContent = t('cardUpgrade.stones', { n: model.stones });
    disarmDecision?.();
    disarmDecision = null;
    confirmBtn.disabled = !selected;
    if (selected) {
      confirmBtn.textContent = confirmText(selected);
      disarmDecision = armOptionDecision(confirmBtn, {
        meta, registries, id: 'smithUpgrade',
        title: t('smith.upgrade.title', { name: selected.name }),
        message: t('cardUpgrade.decision.message', { from: selected.levelFrom, to: selected.levelTo, then: decisionConsequence }),
        consequence: t('cardUpgrade.permanent'),
        detailsNode: () => confirmationNode(currentModel),
        confirmLabel: confirmText(selected),
        cancelLabel: t('common.back'),
        onCommit: commitSelected,
        canCommit: () => Boolean(currentModel.canConfirm) && (!(selected.options?.length > 1) || Boolean(selected.options[chosen])),
        blockedTitle: t('cardUpgrade.blocked', { name: selected.name }),
        blockedMessage: model.blockedReasons.join(' ') || t('cardUpgrade.unavailable'),
        blockedDetailsNode: () => confirmationNode(currentModel),
        returnFocusElement: list.querySelector(`[data-instance-id="${selected.instanceId}"]`) || confirmBtn,
      });
    }
    if (focusedId) (list.querySelector(`[data-instance-id="${focusedId}"]`) || list.querySelector('[data-instance-id]'))?.focus?.({ preventScroll: true });
  }
  function fillDetailsSafe(selected) { if (selected && currentModel.faces) fillDetails(); }

  draw(initialModel);
  queueMicrotask(() => {
    const row = list?.querySelector(`[data-instance-id="${focusInstanceId}"]`);
    if (row) row.dataset.quietFocus = 'true'; // refocused by the return, not by the player: no card tooltip over the list
  });
  return { update(model) { draw(model); }, close() { shell.close(); } };
}
