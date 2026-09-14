import { bindCardInspection, openCardInspection } from './cardInspection.js';
import { renderEquipmentCard, equipmentDetails } from './equipmentCard.js';
import { renderCollectibleCard } from './collectibleCard.js';
// Dedicated Smith selection/review overlay. The component owns dialog
// semantics, focus containment and rendering; the screen owns run mutation.
//
// W1i SMITH UPGRADE (2026-09-14). The door is a W1 workspace with no
// categories: the item list is its left column (the kit's rail, built by the
// shared category navigation, so a compact host folds it into one
// `[Selection ▾]` selector above the pane), and the pane is the selected item —
// what it is, its current → proposed stats and requirements, every affected
// card, then the Stone cost pinned under them. The header carries the title
// and its exit, the footer Back and Upgrade. The stay/leave consequence sits
// under the cost, next to the action it explains. Which slots the pane draws
// is SmithWorkspaceModel.js's; every fact still comes from SmithSelectionModel.
// `.smith-*` stay on these elements because tools/armament-smithing-ui.mjs
// reads them.
import { assetUrl } from '../assetmap.js';
import { esc, attachTooltip } from './tooltip.js';
import {
  el, html, modalHead, modalFooter, pill, button, eyebrow, prose, flavour, artWell, detailCard,
  statRow, blocker, glyph, railItem, railed, statusText, categoryNav,
} from '../kit/index.js';
import { renderCard } from './card.js';
// The interaction router goes through the framework's adopted door.
import { armOptionDecision } from '../../framework/optionDecision.js';
import { t } from '../strings.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { FOLD_GLYPH } from './foldGlyph.js';
import { workspaceFrame, markCurrent } from './w1Workspace.js';
import { smithWorkspaceVars, smithCandidateRows, smithSelectorFace, smithPaneSlots } from '../models/SmithWorkspaceModel.js';

const visibleFocusable = (root) => [...root.querySelectorAll(
  'button:not([disabled]), [role="button"][tabindex="0"], [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
)].filter((element) => !element.hidden && element.getClientRects().length);

/** A StatPair whose key and value are separated by a space, so the text reads "AR 5". */
const pairSpaced = (key, valueNode, className = '') => el('span', { class: `as-statpair${className ? ` ${className}` : ''}` }, [
  el('em', { class: 'sp-k', text: key }), ' ', valueNode,
]);
/** A delta as the kit draws it, with the tags the Smith tool reads (b before, i arrow, strong after). */
const deltaNode = (from, to, { spaced = true } = {}) => {
  const dir = Number(to) > Number(from) ? 'up' : Number(to) < Number(from) ? 'down' : 'flat';
  return el('span', { class: 'sp-v as-delta', dataset: { dir } }, spaced
    ? [el('b', { class: 'd-from', text: from }), ' ', el('i', { class: 'd-arrow', 'aria-hidden': 'true', text: '→' }), ' ', el('strong', { class: 'd-to', text: to })]
    : [el('b', { class: 'd-from', text: from }), el('i', { class: 'd-arrow', 'aria-hidden': 'true', text: '→' }), el('strong', { class: 'd-to', text: to })]);
};
/** The item's art as an ArtWell: its painted asset, or its glyph (a relic). */
const itemArt = (item, { small = false } = {}) => {
  const well = item.artAsset
    ? artWell({ src: assetUrl(item.artAsset), alt: '', small, attrs: { class: 'smith-weapon-art' } })
    : artWell({ glyph: item.artGlyph, small, attrs: { class: 'smith-weapon-art' } });
  const img = well.querySelector('img');
  img?.addEventListener('error', () => img.remove());
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
  const veil = document.createElement('div');
  veil.className = 'modal-veil smith-modal-veil';
  const modal = document.createElement('section');
  modal.className = 'modal smith-upgrade-modal';
  modal.dataset.size = 'xl';
  modal.dataset.wireframe = 'W1i';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'smith-modal-title');
  modal.setAttribute('aria-describedby', 'smith-modal-consequence');
  modal.tabIndex = -1;
  // The W1 frame's shares, then the item column's own (it is W1i's 44 of 90,
  // not a category rail's 21.6).
  workspaceFrame(modal);
  for (const [prop, value] of Object.entries(smithWorkspaceVars())) modal.style.setProperty(prop, value);
  markUiComponent(modal, UI.smithUpgradeModal, initialModel.variant);
  // W1 header: the title top-left and its exit top-right, nothing else.
  const head = modalHead({
    title: initialModel.properties.title,
    titleId: 'smith-modal-title',
    closeLabel: initialModel.properties.backLabel,
  });

  let currentModel = initialModel;
  let closed = false;
  let disarmDecision = null;

  const CHANGE_LABELS = {
    damage: 'AR', block: 'GUARD', draw: 'DRAW', discard: 'DISCARD', 'cost:action': 'ACTION', 'cost:mana': 'MANA', 'cost:stamina': 'STAMINA',
  };
  /** A row's changes as StatPairs with deltas: "AR 7 → 10". */
  const changeSummary = (row) => el('span', { class: 'smith-fold-values' }, row.values.map((change) => {
    const label = change.label || CHANGE_LABELS[change.op] || String(change.op || 'change');
    return pairSpaced(label, deltaNode(String(change.before), String(change.after)));
  }));

  /** The requirement: "STR 10 → 9", with what the player has under it. */
  const requirementNodes = (selected) => (selected.requirements.length
    ? selected.requirements.map((row) => el('span', { class: `smith-requirement ${row.metAfter ? 'met' : 'unmet'}` }, [
      el('span', { class: 'smith-requirement-values as-statpair' }, [el('em', { class: 'sp-k', text: row.label }), deltaNode(String(row.currentRequired), String(row.nextRequired), { spaced: false })]),
      el('small', { text: `You have ${row.actual == null ? '?' : row.actual}` }),
    ]))
    : [el('span', { class: 'smith-requirement met' }, el('span', { class: 'smith-requirement-values as-statpair' }, [el('em', { class: 'sp-k', text: 'NONE' }), ' ', el('b', { class: 'sp-v', text: 'No attribute requirement' })]))]);

  /** The stone cost as a StatPair: "REQ/AVAIL 1/0", the available count coloured by affordability. */
  const costPairNode = (selected) => el('span', { class: 'as-statpair smith-cost-pair' }, [
    el('span', { class: 'sp-k' }, [el('em', { text: 'REQ' }), el('i', { 'aria-hidden': 'true', text: '/' }), el('em', { text: 'AVAIL' })]),
    ' ',
    el('span', { class: 'sp-v' }, [el('strong', { class: 'smith-cost-required', text: String(selected.cost) }), el('i', { 'aria-hidden': 'true', text: '/' }), el('strong', { class: 'smith-cost-available', text: String(selected.stones) })]),
  ]);
  const economyNode = (selected) => el('span', { class: 'smith-economy-values' }, [
    el('span', { class: 'smith-stone-icon', 'aria-hidden': 'true', text: '🪨' }),
    el('b', { text: 'Smithing Stone Cost' }), ' ', costPairNode(selected),
  ]);

  const intrinsicStatsNode = (selected) => {
    const stats = selected.intrinsicStats || {};
    const hasStats = ['attackRating', 'defenseRating', 'weight', 'weaponArtManaCost', 'uniqueSkillStaminaCost']
      .every((key) => stats[key] !== null && stats[key] !== undefined);
    if (!hasStats) return null;
    const rowNode = statRow({
      flat: true,
      nameNode: el('span', { class: 'smith-data-heading' }, [el('b', { class: 'sr-name', text: 'Equipment Stats' }), el('small', { class: 'sr-hint', text: selected.kindLabel })]),
      values: [
        el('span', { class: 'smith-fold-values smith-primary-stats' }, [
          pairSpaced('AR', el('b', { class: 'sp-v', text: String(stats.attackRating) })),
          pairSpaced('DEF', el('b', { class: 'sp-v', text: String(stats.defenseRating) })),
          pairSpaced('WEIGHT', el('b', { class: 'sp-v', text: String(stats.weight) })),
        ]),
        el('span', { class: 'smith-stat-costs as-flavor' }, [
          el('span', {}, ['Weapon Art ', el('strong', { text: `Mana ${stats.weaponArtManaCost}` })]), el('i', { text: ' · ' }),
          el('span', {}, ['Unique Skill ', el('strong', { text: `Stamina ${stats.uniqueSkillStaminaCost}` })]),
        ]),
      ],
      className: 'smith-data-row smith-intrinsic-stats',
    });
    return rowNode;
  };

  const requirementsRow = (selected) => statRow({
    flat: true,
    nameNode: el('span', { class: 'smith-data-heading' }, [el('b', { class: 'sr-name', text: 'Requirements' }), el('small', { class: 'sr-hint', text: 'attribute' })]),
    values: el('span', { class: 'smith-fold-values' }, requirementNodes(selected)),
    className: 'smith-data-row smith-requirements',
  });

  /** The decision door's details: the same cost and deltas, as kit rows. */
  const confirmationDetails = (selected) => html([
    el('div', { class: `confirmation-cost as-statrow flat ${selected.affordable ? 'affordable' : 'unaffordable'}` }, economyNode(selected)),
    el('div', { class: 'confirmation-change-list' }, [
      ...selected.affectedRows.map((row) => statRow({ flat: true, nameNode: el('b', { class: 'sr-name', text: row.name }), values: changeSummary(row) })),
      statRow({ flat: true, nameNode: el('b', { class: 'sr-name', text: 'Requirements' }), values: el('span', { class: 'smith-fold-values' }, requirementNodes(selected)) }),
    ]),
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
    const card = railItem({
      tag: 'div', label: '', member: item.itemRef, current: item.selected,
      className: `smith-candidate-card smith-weapon-card rarity-${item.rarity}${item.selected ? ' selected' : ''}`,
      attrs: { role: 'option', 'aria-controls': 'smith-preview-region', dataset: item.armamentId ? { armamentId: item.armamentId } : {} },
    });
    card.dataset.itemRef = item.itemRef;
    card.replaceChildren(
      itemArt(item, { small: true }),
      el('span', { class: 'smith-row-text' }, [
        el('strong', { class: 'smith-weapon-name', text: item.name }),
        statusText(t(row.status.id, row.status.tokens), { class: 'smith-row-status' }),
      ]),
      pill({ label: String(item.inventoryCount), attrs: { class: 'smith-weapon-count', 'aria-label': `${item.inventoryCount} in inventory` } }),
    );
    const itemTypeText = item.itemTypes.map((type) => type.label).join(', ') || item.kindLabel;
    card.setAttribute('aria-label', `${item.name}, ${itemTypeText}, ${item.inventoryCount} in inventory, tier ${item.currentLevel} to ${item.nextLevel}, costs ${item.cost} Smithing Stone. Select to review its exact changes and requirements.`);
    attachTooltip(card, () => `<div class="tt-title">${esc(item.name)} · Tier ${item.currentLevel} → ${item.nextLevel}</div>`
      + `<div>Type: ${esc(itemTypeText)}.</div>`
      + `<div>Smith Stone Cost: 🪨 ${item.cost}/${item.stones} available.</div>`
      + `<div>${item.requirements.length ? item.requirements.map((req) => `${esc(req.label)} ${req.currentRequired} → ${req.nextRequired}; you have ${req.actual == null ? '?' : req.actual}`).join('<br>') : 'No attribute requirement.'}</div>`);
    markUiComponent(card, UI.smithCandidateCard, item.selected ? 'selected' : 'available');
    const piece = item.itemKind === 'relic' ? registries.relics.get(item.itemId)
      : item.itemKind === 'armor' ? registries.equipment.armour.find(piece => piece.id === item.itemId && piece.classId === item.classId)
        : registries.equipment.armaments.find(piece => piece.id === item.itemId);
    // TWO TAPS: HIGHLIGHT, THEN CHOOSE (Constantine, 2026-09-12). The first
    // tap highlights this candidate and reveals its `i`; the second reaches
    // the navigation's `choose` and makes it the Smith's selection, which is
    // what greens the footer's Upgrade. A press-and-hold reaches it too — it
    // never travelled through `click`. The door is bound BEFORE the
    // navigation listens, so the selecting tap it swallows never reaches it.
    if (piece) bindCardInspection(card, { title: item.name, open: opener => {
      const owned = Number.isInteger(item.inventoryCount) ? item.inventoryCount : null;
      const rendered = item.itemKind === 'relic' ? renderCollectibleCard(registries, piece, 'Relic', { inspection: false, interactive: false, owned })
        : renderEquipmentCard(registries, piece, { inspection: false, interactive: false, owned });
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

  // ---- the body: the item column beside (or, compact, under a selector
  // above) the selected item's pane -------------------------------------------
  const rows = smithCandidateRows(initialModel);
  const cards = initialModel.properties.candidates.map((item, index) => candidateCard(item, rows[index]));
  // The kit's W1 category navigation (rail beside the pane, one selector above
  // it on compact hosts); the Smith's items are a listbox, not tabs.
  const nav = categoryNav({ items: cards, ariaLabel: t('smith.items.upgrade'), railAttrs: { role: 'listbox' }, choose: (itemRef) => onSelect(itemRef) });
  const count = statusText('', { class: 'smith-pane-status', role: 'status', dataset: { smithCount: '' } });
  const previewHost = el('div', { class: 'smith-preview-host' });
  const consequence = el('p', { class: 'as-flavor smith-consequence', id: 'smith-modal-consequence' });
  const previewRegion = el('section', {
    class: 'as-pane smith-preview-region', id: 'smith-preview-region', 'aria-live': 'polite', 'aria-label': 'Selected upgrade preview',
  }, [count, previewHost, consequence]);
  const body = el('div', { class: 'modal-body smith-modal-body' }, railed(nav, previewRegion, { class: 'smith-candidate-region' }));
  const backBtn = button({ label: initialModel.properties.backLabel, className: 'subtle smith-back' });
  const confirmBtn = button({ label: '', weight: 'primary', className: 'smith-confirm' });
  const foot = modalFooter({ secondary: [backBtn], primary: confirmBtn, className: 'smith-modal-footer', size: 'long' });
  modal.append(head, body, foot);
  veil.appendChild(modal);
  host.appendChild(veil);

  const back = modal.querySelector('.smith-back');
  const confirm = modal.querySelector('.smith-confirm');

  /**
   * The pane, in W1i's order: the selected item (art, name, tier, kind and
   * tags), its current → proposed stats and requirements, every affected card,
   * then the Stone cost — pinned under the facts so it stands beside the
   * action — and the shortfall when there is one.
   */
  function previewCard(selected, slots) {
    const types = selected.itemTypes.length
      ? selected.itemTypes.map((type) => el('em', { class: 'as-tag', dataset: { itemType: type.tag }, text: type.label }))
      : [el('em', { class: 'as-tag', text: selected.kindLabel })];
    const head = el('div', { class: 'smith-summary-grid' }, [
      el('div', { class: 'smith-summary-cell smith-selected-head' }, [
        itemArt(selected),
        eyebrow('Selected item', { class: 'smith-preview-label' }),
        el('b', { class: 'sr-name', text: selected.name }),
        el('span', { class: 'dc-meta' }, ['Tier ', deltaNode(String(selected.currentLevel), String(selected.nextLevel)), ` · ×${selected.inventoryCount} owned`]),
        el('span', { class: 'smith-item-type-row' }, types),
        selected.tags.length ? el('span', { class: 'smith-weapon-tags' }, selected.tags.map((tag) => el('em', { class: 'as-tag', text: tag }))) : null,
      ]),
    ]);
    const folds = el('div', { class: 'smith-upgrade-folds' }, selected.affectedRows.map((row, index) => {
      const fold = el('details', { class: `smith-upgrade-fold smith-upgrade-row${row.used === false ? ' is-unused' : ''}` });
      const summary = el('summary', {}, statRow({
        tag: 'span',
        nameNode: el('b', { class: 'sr-name', text: row.name }),
        hintNode: el('small', { class: 'sr-hint', text: `${row.role} · ${row.used === false ? 'not in active deck' : `${row.activeCopies || 1} active`}` }),
        values: [changeSummary(row), glyph(FOLD_GLYPH.collapsed, { class: 'caret smith-fold-caret' })],
      }));
      const facts = el('div', { class: 'smith-card-facts' }, [
        eyebrow('Current → upgraded'),
        ...row.changes.map((change) => prose(change)),
        row.scaling
          ? flavour(`Scales with ${row.scaling.label}: +${row.scaling.gainPerTier} per ${row.scaling.pointsPerTier} points · current ${row.scaling.actual == null ? '?' : row.scaling.actual}`, { class: 'smith-scaling' })
          : flavour('No attribute scaling.', { class: 'smith-scaling' }),
        flavour(`Source: ${selected.name}`),
      ]);
      const detail = el('div', { class: `smith-fold-detail${row.reference ? '' : ' no-card'}` }, [
        row.reference ? el('div', { class: 'smith-card-sprite', dataset: { smithCardRow: String(index) } }) : null,
        facts,
      ]);
      fold.append(summary, detail);
      return fold;
    }));
    const cost = el('div', { class: 'smith-cost-strip' }, [
      el('div', { class: `smith-summary-cell smith-preview-economy ${selected.affordable ? 'affordable' : 'unaffordable'}` }, economyNode(selected)),
      selected.affordable ? null : blocker(`Short ${selected.shortfall} Smithing Stone${selected.shortfall === 1 ? '' : 's'}.`, { placement: 'pinned', attrs: { class: 'smith-preview-shortfall' } }),
    ]);
    const slot = { selected: [head], changes: [intrinsicStatsNode(selected), requirementsRow(selected), folds], cost: [cost] };
    return detailCard({
      attrs: { class: 'smith-preview-card', dataset: { uiComponent: UI.smithUpgradePreview } },
      children: slots.flatMap((name) => slot[name] || []),
    });
  }

  function draw(model) {
    currentModel = model;
    const p = model.properties;
    markUiComponent(modal, UI.smithUpgradeModal, model.variant);
    const selected = p.selected;
    markCurrent(cards, selected ? selected.itemRef : null);
    for (const card of cards) {
      const on = Boolean(selected) && card.dataset.itemRef === selected.itemRef;
      card.classList.toggle('selected', on);
      markUiComponent(card, UI.smithCandidateCard, on ? 'selected' : 'available');
    }
    const face = smithSelectorFace(model);
    nav.sync(face.text ?? t(face.id));
    count.textContent = t('smith.pane.status', { purse: p.purseLabel, n: p.candidates.length });
    consequence.textContent = p.consequence;

    previewHost.replaceChildren(selected
      ? previewCard(selected, smithPaneSlots(model))
      : el('div', { class: 'smith-preview-empty', dataset: { uiComponent: UI.smithUpgradePreview } }, [
        artWell({ glyph: '⚒', cool: true }),
        prose(p.instruction),
      ]));
    if (selected) {
      selected.affectedRows.forEach((row, index) => {
        const slot = previewHost.querySelector(`[data-smith-card-row="${index}"]`);
        if (slot && row.reference) slot.appendChild(renderCard(registries, row.reference, { small: true, tooltip: false, inspectReadOnly: true }));
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
        // W2: the way out is Back (bottom-left), the same word every review wears.
        cancelLabel: t('common.back'),
        onCommit: commitSelected,
        canCommit: () => Boolean(currentModel.properties.canConfirm),
        blockedTitle: `Cannot upgrade ${selected.name}`,
        blockedMessage: model.properties.blockedReasons.join(' ') || 'This upgrade is not currently available.',
        blockedDetailsHtml: confirmationDetails(selected),
        returnFocusElement: confirm,
      });
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
      // An open compact item list closes first; its own listener takes this key.
      if (modal.querySelector('.as-railed[data-cat-open="true"]')) return;
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

  modal.querySelector('.modal-close')?.addEventListener('click', backOut);
  window.addEventListener('keydown', onKeydown, true);
  draw(initialModel);
  queueMicrotask(() => modal.focus({ preventScroll: true }));

  return {
    update(model) { draw(model); },
    close,
  };
}
