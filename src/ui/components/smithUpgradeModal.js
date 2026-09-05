// Dedicated Smith selection/review overlay. The component owns dialog
// semantics, focus containment and rendering; the screen owns run mutation.
//
// THE BODY IS THE KIT'S (2026-09-04, the sweep; kit §05 body E): the chooser on
// the left is OptionCards in a grid — each an ArtWell with the item's count as
// a StatePill and its kind and tags as Tags — and the inspector on the right is
// a DetailCard: the selected item's name and tier delta, the stone cost as a
// StatPair, then a StatRow per fact (intrinsic stats, requirements, every
// affected card with its deltas) and the shortfall as a Blocker pinned at the
// bottom. `.smith-*` stay on the kit elements because
// tools/armament-smithing-ui.mjs reads them; styles/ui.css draws nothing.
import { assetUrl } from '../assetmap.js';
import { esc, attachTooltip } from './tooltip.js';
import {
  el, html, modalHead, modalFooter, pill, button, subtitle, eyebrow, prose, flavour, artWell, detailCard, optionCard, optionGrid,
  statRow, blocker, glyph,
} from '../kit/index.js';
import { renderCard } from './card.js';
// The interaction router goes through the framework's adopted door.
import { armOptionDecision } from '../../framework/optionDecision.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { FOLD_GLYPH } from './foldGlyph.js';

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
      optionGrid([], { class: 'smith-card-list', role: 'listbox', 'aria-label': 'Items available to upgrade' }),
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

  /** One candidate: an OptionCard — ArtWell, name, its kind and tags as Tags, the owned count as a StatePill. */
  function candidateCard(item, model) {
    const well = item.artAsset
      ? artWell({ src: assetUrl(item.artAsset), alt: '', attrs: { class: 'smith-weapon-art' } })
      : artWell({ glyph: item.artGlyph, attrs: { class: 'smith-weapon-art' } });
    const types = item.itemTypes.length
      ? item.itemTypes.map((type) => el('em', { class: 'as-tag', dataset: { itemType: type.tag }, text: type.label }))
      : [el('em', { class: 'as-tag', text: item.kindLabel })];
    const card = optionCard({
      tag: 'div', arrow: false, art: well, name: item.name, selected: item.selected,
      body: [
        el('span', { class: 'smith-item-type-row' }, types),
        el('span', { class: 'smith-weapon-tags' }, item.tags.map((tag) => el('em', { class: 'as-tag', text: tag }))),
      ],
      className: `smith-candidate-card smith-weapon-card rarity-${item.rarity}${item.selected ? ' selected' : ''}`,
      attrs: { role: 'option', 'aria-selected': String(item.selected), dataset: { itemRef: item.itemRef, ...(item.armamentId ? { armamentId: item.armamentId } : {}) } },
    });
    card.dataset.itemRef = item.itemRef;
    card.querySelector('.on').replaceChildren(el('strong', { class: 'smith-weapon-name', text: item.name }));
    card.prepend(pill({ label: String(item.inventoryCount), attrs: { class: 'smith-weapon-count', 'aria-label': `${item.inventoryCount} in inventory` } }));
    const art = well.querySelector('img');
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
    return card;
  }

  /** The inspector: a DetailCard of the selection, its cost, and a StatRow per fact. */
  function previewCard(selected, model) {
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
    const card = detailCard({
      attrs: { class: 'smith-preview-card', dataset: { uiComponent: UI.smithUpgradePreview } },
      children: [
        el('div', { class: 'smith-summary-grid' }, [
          el('div', { class: 'smith-summary-cell smith-selected-head' }, [
            eyebrow('Selected item', { class: 'smith-preview-label' }),
            el('b', { class: 'sr-name', text: selected.name }),
            el('span', { class: 'dc-meta' }, ['Tier ', deltaNode(String(selected.currentLevel), String(selected.nextLevel)), ` · ×${selected.inventoryCount} owned`]),
          ]),
          el('div', { class: `smith-summary-cell smith-preview-economy ${selected.affordable ? 'affordable' : 'unaffordable'}` }, economyNode(selected)),
        ]),
        intrinsicStatsNode(selected),
        requirementsRow(selected),
        folds,
        selected.affordable ? null : blocker(`Short ${selected.shortfall} Smithing Stone${selected.shortfall === 1 ? '' : 's'}.`, { placement: 'pinned', attrs: { class: 'smith-preview-shortfall' } }),
      ],
    });
    return card;
  }

  function draw(model, { focusSelection = false } = {}) {
    currentModel = model;
    markUiComponent(modal, UI.smithUpgradeModal, model.variant);
    cardsHost.innerHTML = '';
    count.textContent = `${model.properties.purseLabel} · ${model.properties.candidates.length} eligible`;
    for (const item of model.properties.candidates) cardsHost.appendChild(candidateCard(item, model));

    const selected = model.properties.selected;
    previewHost.replaceChildren(selected
      ? previewCard(selected, model)
      : el('div', { class: 'smith-preview-empty', dataset: { uiComponent: UI.smithUpgradePreview } }, [
        artWell({ glyph: '⚒', cool: true }),
        prose('Select an item to compare every authored change.'),
        flavour('Nothing changes until you confirm, or deliberately hold Upgrade.'),
      ]));
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
