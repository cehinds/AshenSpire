import { hideOnError } from '../artFallback.js';
import { bindCardInspection, openCardInspection } from './cardInspection.js';
import { renderEquipmentCard, equipmentDetails } from './equipmentCard.js';
import { renderCollectibleCard } from './collectibleCard.js';
// Dedicated Smith selection/review overlay. The component owns dialog
// semantics, focus containment and rendering; the screen owns run mutation.
//
// ONE SCREEN, ONE MODAL (owner, 2026-11-04). The overlay is the item list (the upgrade desk, upgradeDesk.js):
// a compact head, the rows, and a footer whose one button leaves. Tapping an item opens its upgrade modal at
// once, the shared confirmation modal ("Upgrade Greatsword?": cost, recovery, every affected card's before
// and after, requirements; Back and Upgrade). There is no detail view in the list and no Back button for one.
// `.smith-*` stay on these elements because tools/armament-smithing-ui.mjs reads them.
import { assetUrl } from '../assetmap.js';
import { esc, attachTooltip } from './tooltip.js';
import { el, html, pill, prose, artWell, statRow, glyph, statusText } from '../kit/index.js';
import { mountUpgradeDesk, deskRow, deskArt } from './upgradeDesk.js';
import { renderCard } from './card.js';
import { resolveCard } from '../../model/registries.js';
import { upgradeFacesNode, upgradeConfirmNodes } from './upgradeConfirm.js';
// The interaction router goes through the framework's adopted door.
import { armOptionDecision } from '../../framework/optionDecision.js';
import { t } from '../strings.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { deltaNode, changeSummary, economyNode } from './smithPaneParts.js';
import { smithCandidateRows } from '../models/SmithWorkspaceModel.js';

const visibleFocusable = (root) => [...root.querySelectorAll(
  'button:not([disabled]), [role="button"][tabindex="0"], [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
)].filter((element) => !element.hidden && element.getClientRects().length);

/** The item's art as an ArtWell: its painted asset, or its glyph (a relic). */
const itemArt = (item, { small = false } = {}) => {
  const well = item.artAsset
    ? artWell({ src: assetUrl(item.artAsset), alt: '', small, attrs: { class: 'smith-weapon-art' } })
    : artWell({ glyph: item.artGlyph, small, attrs: { class: 'smith-weapon-art' } });
  const img = well.querySelector('img');
  hideOnError(img);
  return well;
};

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
  const desk = mountUpgradeDesk(host, {
    title: initialModel.properties.title, titleId: 'smith-modal-title', listLabel: t('smith.items.upgrade'),
    backLabel: initialModel.properties.backLabel, kind: 'item',
  });
  const { veil, panel: modal, purse, backBtn, confirmBtn } = desk;
  modal.classList.add('smith-upgrade-modal');
  markUiComponent(modal, UI.smithUpgradeModal, initialModel.variant);

  let currentModel = initialModel;
  let closed = false;
  let disarmDecision = null;
  let review = null;

  /** The requirement: "STR 10 → 9", with what the player has under it. */
  const requirementNodes = (selected) => (selected.requirements.length
    ? selected.requirements.map((row) => el('span', { class: `smith-requirement ${row.metAfter ? 'met' : 'unmet'}` }, [
      el('span', { class: 'smith-requirement-values as-statpair' }, [el('em', { class: 'sp-k', text: row.label }), deltaNode(String(row.currentRequired), String(row.nextRequired), { spaced: false })]),
      el('small', { text: `You have ${row.actual == null ? '?' : row.actual}` }),
    ]))
    : [el('span', { class: 'smith-requirement smith-requirement-none met' }, el('b', { class: 'sp-v', text: 'None' }))]);

  /**
   * The first affected card as its before and after faces. A live card instance steps its own smithing tier; a Core
   * row carries only the card's id and its live value before and after (`damage` or `block`), so its faces are the
   * card's definition with that effect's amount set to each value. No such card: no faces, the rows say it all.
   */
  const facesFor = (selected) => {
    const face = (reference, definition) => renderCard(registries, reference, { small: true, tooltip: false, inspectReadOnly: true, ...(definition ? { definition } : {}) });
    const live = selected.affectedRows.find((entry) => entry.reference);
    if (live) {
      const level = Number(live.reference.smithingLevel) || 0;
      return upgradeFacesNode({ before: face(live.reference), after: face({ ...live.reference, smithingLevel: level + 1 }) });
    }
    for (const row of selected.affectedRows) {
      const change = row.cardId && row.values.find((value) => value.kind === 'card');
      if (!change) continue;
      try {
        const base = resolveCard(registries, { cardId: row.cardId });
        const at = (amount) => ({ ...base, effects: base.effects.map((effect) => (effect.op === change.op ? { ...effect, amount } : effect)) });
        if (!base.effects.some((effect) => effect.op === change.op)) continue;
        return upgradeFacesNode({ before: face({ cardId: row.cardId }, at(change.before)), after: face({ cardId: row.cardId }, at(change.after)) });
      } catch { /* a card the registry cannot resolve draws no face */ }
    }
    return null;
  };

  /** The Blacksmith's cinder charge for the selected item (the host's quote), beside the Stone cost; red when the purse is short. */
  const cinderNode = (p) => (p.cinderCost > 0
    ? el('div', { class: `confirmation-cost confirmation-cinders as-statrow flat ${p.cinderHave >= p.cinderCost ? 'affordable' : 'unaffordable'}` },
      `${t('blacksmith.modal.price', { cinders: p.cinderCost })} (${t('blacksmith.modal.cinders', { cinders: p.cinderHave })})`)
    : null);

  /** The decision door's details (the shared body, upgradeConfirm.js): cost, recovery, the faces, then the rows under them. */
  const confirmationDetails = (selected) => html([
    el('div', { class: 'smith-confirm-details' }, upgradeConfirmNodes({
      cost: el('div', { class: `confirmation-cost as-statrow flat ${selected.affordable ? 'affordable' : 'unaffordable'}` }, economyNode(selected)),
      cinders: cinderNode(currentModel.properties),
      recovery: currentModel.properties.servicePreviewHtml ? el('div', { class: 'smith-confirm-recovery', html: currentModel.properties.servicePreviewHtml }) : null,
      faces: facesFor(selected),
      // Name left, change right: each row is a two-column grid (CSS), the change on one line.
      rows: [
        ...selected.affectedRows.map((row) => statRow({ flat: true, className: 'smith-confirm-row', nameNode: el('b', { class: 'sr-name', text: row.name }), values: changeSummary(row) })),
        statRow({ flat: true, className: 'smith-confirm-row smith-confirm-requirements', nameNode: el('b', { class: 'sr-name', text: 'Requirements' }), values: el('span', { class: 'smith-fold-values' }, requirementNodes(selected)) }),
      ],
    })),
  ]);

  function commitSelected() {
    if (!currentModel.properties.canConfirm) return;
    const selectedId = currentModel.properties.selected.itemRef;
    close({ restoreFocus: false });
    onConfirm(selectedId);
  }

  /**
   * One candidate: a rail row — its art, its name, the tier step, and the
   * owned count as a StatePill. A div, not the kit's default button, because
   * the inspection door hangs its own `i` control inside it.
   */
  function candidateCard(item, row) {
    const { item: wrapper, main: card } = deskRow({
      className: `smith-candidate-card smith-weapon-card rarity-${item.rarity}${item.selected ? ' selected' : ''}`,
      attrs: { role: 'option', tabindex: '0', 'aria-selected': String(Boolean(item.selected)), dataset: item.armamentId ? { armamentId: item.armamentId } : {} },
      disabled: row.disabled,
      art: deskArt(itemArt(item, { small: true })),
      name: item.name,
      meta: el('span', { class: 'deck-editor-meta smith-row-text' }, statusText(t(row.status.id, row.status.tokens), { class: 'smith-row-status' })),
      side: [pill({ label: String(item.inventoryCount), attrs: { class: 'smith-weapon-count', 'aria-label': `${item.inventoryCount} in inventory` } })],
    });
    card.wrapper = wrapper;
    card.dataset.itemRef = item.itemRef;
    // A Blacksmith-gated item stays listed but disabled: dimmed, announced as
    // such, still selectable (the pane then disables Upgrade) and still in the
    // keyboard order.
    if (row.disabled) {
      card.classList.add('is-needs-blacksmith');
      card.setAttribute('aria-disabled', 'true');
    }
    // A tap chooses the item and opens its upgrade modal at once: the host's update arms the decision, then it opens.
    card.addEventListener('click', () => { onSelect(item.itemRef); review?.(); });
    const itemTypeText = item.itemTypes.map((type) => type.label).join(', ') || item.kindLabel;
    card.setAttribute('aria-label', `${item.name}, ${itemTypeText}, ${item.inventoryCount} in inventory, tier ${item.currentLevel} to ${item.nextLevel}, costs ${item.cost} Smithing Stone.${row.disabled ? ' Needs a Blacksmith.' : ''} Select to review its exact changes and requirements.`);
    attachTooltip(card, () => `<div class="tt-title">${esc(item.name)} · Tier ${item.currentLevel} → ${item.nextLevel}</div>`
      + `<div>Type: ${esc(itemTypeText)}.</div>`
      + `<div>Smith Stone Cost: ${item.cost}/${item.stones} available.</div>`
      + `<div>${item.requirements.length ? item.requirements.map((req) => `${esc(req.label)} ${req.currentRequired} → ${req.nextRequired}; you have ${req.actual == null ? '?' : req.actual}`).join('<br>') : 'No attribute requirement.'}</div>`);
    markUiComponent(card, UI.smithCandidateCard, item.selected ? 'selected' : 'available');
    const piece = item.itemKind === 'relic' ? registries.relics.get(item.itemId)
      : item.itemKind === 'armor' ? registries.equipment.armour.find(piece => piece.id === item.itemId && piece.classId === item.classId)
        : registries.equipment.armaments.find(piece => piece.id === item.itemId);
    // Selecting an item only opens its upgrade preview, so the first tap can
    // choose it immediately. The information button remains a separate action.
    if (piece) bindCardInspection(card, { title: item.name, actionOwnsTouch: true, open: opener => {
      const owned = Number.isInteger(item.inventoryCount) ? item.inventoryCount : null;
      // This face goes straight into openCardInspection, so it is an inspect card.
      const rendered = item.itemKind === 'relic' ? renderCollectibleCard(registries, piece, 'Relic', { inspection: false, interactive: false, owned, level: 'inspect' })
        : renderEquipmentCard(registries, piece, { inspection: false, interactive: false, owned, level: 'inspect' });
      const details = equipmentDetails(rendered.explanations);
      details.prepend(prose('Smithing tier ' + item.currentLevel + ' → ' + item.nextLevel + '. Cost: ' + item.cost + ' Smithing Stone. Select the item in the Smith to review its exact upgrade changes.'));
      return openCardInspection({ title: item.name, card: rendered.card, details, opener });
    } });
    // A row is not a native button, so Enter and Space press it the way a
    // click does; the navigation then chooses it.
    card.addEventListener('keydown', (event) => {
      if (event.target !== card || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      card.click();
    });
    return card;
  }

  // ---- the body: the item list; a tap opens the item's upgrade modal ----------
  const rows = smithCandidateRows(initialModel);
  const cards = initialModel.properties.candidates.map((item, index) => candidateCard(item, rows[index]));
  desk.setRows(cards.map((card) => card.wrapper));
  const back = backBtn;
  const confirm = confirmBtn;

  function draw(model) {
    currentModel = model;
    const p = model.properties;
    markUiComponent(modal, UI.smithUpgradeModal, model.variant);
    const selected = p.selected;
    for (const card of cards) {
      const on = Boolean(selected) && card.dataset.itemRef === selected.itemRef;
      card.classList.toggle('selected', on);
      card.setAttribute('aria-selected', String(on));
      markUiComponent(card, UI.smithCandidateCard, on ? 'selected' : 'available');
    }
    purse.textContent = `${p.purseLabel} available`;
    disarmDecision?.();
    disarmDecision = null;
    review = null;
    if (selected) {
      const armed = armOptionDecision(confirm, {
        meta,
        registries,
        id: 'smithUpgrade',
        title: t('smith.upgrade.title', { name: selected.name }),
        message: `Tier ${selected.currentLevel} becomes tier ${selected.nextLevel}. This spends the shown Stone cost${model.properties.staysAtShrine ? '; ' : ' '}${model.properties.decisionConsequence}.`,
        consequence: 'PERMANENT FOR THIS RUN',
        detailsHtml: confirmationDetails(selected),
        confirmLabel: t('smith.upgrade.confirm', { cost: selected.cost }) + (p.cinderCost > 0 ? ` · ${t('blacksmith.modal.cinders', { cinders: p.cinderCost })}` : ''),
        // W2: the way out is Back (bottom-left), the same word every review wears.
        cancelLabel: t('common.back'),
        onCommit: commitSelected,
        canCommit: () => Boolean(currentModel.properties.canConfirm),
        blockedTitle: `Cannot upgrade ${selected.name}`,
        blockedMessage: model.properties.blockedReasons.join(' ') || 'This upgrade is not currently available.',
        blockedDetailsHtml: confirmationDetails(selected),
        returnFocusElement: cards.find((card) => card.dataset.itemRef === selected.itemRef) || null,
      });
      disarmDecision = armed;
      review = armed.review;
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
    if (event.defaultPrevented || event.repeat) return;
    if ([...document.querySelectorAll('[aria-modal="true"]')].at(-1) !== modal) return;
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

  veil.addEventListener('click', (event) => { if (event.target === veil) backOut(); });
  back.addEventListener('click', backOut);

  // The shell's close box is the same way out as Back.

  desk.closeBtn.addEventListener('click', backOut);
  window.addEventListener('keydown', onKeydown, true);
  draw(initialModel);
  queueMicrotask(() => modal.focus({ preventScroll: true }));
  // Mounted with an item already chosen (the Blacksmith's per-item Upgrade): its modal opens at once.
  if (initialModel.properties.selected) review?.();

  return {
    update(model) { draw(model); },
    close,
  };
}
