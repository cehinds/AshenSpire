// The smith's card-service overlay: extract a card from an item's mount, or
// seat a deck card in one. Same dialog contract as smithUpgradeModal.js —
// the component owns rendering and the confirm decision; the screen owns run
// mutation. Three choices at most (item, mount, card), every one reversible
// until the explicit Confirm.
//
// OPTION ROWS (owner, 2026-11-14): the screen is the defensive-reaction prompt's design. The items are option rows
// (optionRowList); the selected item opens its mounts under it, the selected mount opens what leaves it (extract) or the
// deck cards it takes (install) under that, and the Stone cost closes the item's detail. One Back exit and one primary
// that stays disabled until an item is selected; the primary still opens the permanent-change review.
//
// THE CHROME IS THE SHELL'S. This door opens through modalShell.js, so the
// head (title, one close), the foot (the way out left, the way forward right),
// Escape, the veil click and focus return are the same here as on every other
// door — none of it is assembled in this file. What this file owns is the
// BODY.
//
// A dependent section only appears when the choice it depends on is made
// (SmithWorkspaceModel.js); smithServices.js clears the dependent choices when
// a parent changes.
import { engravedIcon, engravedIconHtml } from './engravedIcon.js';
import { esc } from './tooltip.js';
import { renderCard } from './card.js';
import { optionRowList } from './optionRowList.js';
import { playingCardArt } from '../cardArtwork.js';
import { armOptionDecision } from '../../framework/optionDecision.js';
import { t } from '../strings.js';
import { reasonWhenDisabled } from './refusal.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { OpenModal } from './modalShell.js';
import { el, prose, flavour, button } from '../kit/index.js';
import { smithCandidateRows } from '../models/SmithWorkspaceModel.js';
import { MarkSelected } from '../selection.js';

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
  const opener = returnFocusElement instanceof HTMLElement
    ? returnFocusElement
    : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const p0 = initialModel.properties;

  const back = button({ label: p0.backLabel, role: 'exit', className: 'smith-back' });
  const confirm = button({ label: '', weight: 'primary', className: 'smith-confirm mount-confirm', disabled: true });
  // What a chosen item still lacks says why under the foot (FINISH §6); with
  // nothing chosen the button's own label says "Select an item".
  let confirmBlocked = '';
  const confirmReason = reasonWhenDisabled(confirm, () => confirmBlocked || null);

  let currentModel = initialModel;
  let closed = false;
  // Why the door closed: the close, Escape and the veil are all "back"; Confirm is
  // not, and a programmatic close from the screen is neither.
  let leaving = 'back';
  let disarmDecision = null;

  const cardName = (cardId) => registries.cards.get(cardId)?.name || cardId;

  const count = el('p', { class: 'smith-pane-status as-flavor', role: 'status', dataset: { mountCount: '' } });
  const consequence = el('p', { class: 'as-flavor smith-consequence', id: 'mount-modal-consequence' });
  const listHost = el('div', { class: 'mount-service-list', role: 'listbox', 'aria-label': t('smith.items.mount') });
  const shell = OpenModal({
    size: 'md',
    className: 'option-choice smith-upgrade-modal mount-service-modal',
    title: p0.title,
    bodyClassName: 'as-pane',
    body: (bodyHost) => bodyHost.append(count, listHost, consequence),
    secondary: [back],
    primary: confirm,
    onClose: () => {
      if (closed) return;
      closed = true;
      disarmDecision?.();
      disarmDecision = null;
      if (leaving === 'back') onBack();
    },
    opener,
    host,
  });
  shell.veil.classList.add('smith-modal-veil');
  const modal = shell.panel;
  modal.dataset.wireframe = p0.service === 'extract' ? 'W1j' : 'W1k';
  modal.setAttribute('aria-describedby', 'mount-modal-consequence');
  markUiComponent(modal, UI.mountServiceModal, initialModel.variant);

  /** The row's art: the card face's own resolver (null when nothing resolves). */
  const cardRowArt = (cardId) => {
    try { return playingCardArt({ cardId }, { definition: registries?.cards?.get?.(cardId), registries }) || null; } catch { return null; }
  };

  /** One candidate item as an option row: art, name, its status line; the where-pill is the trailing chip. */
  function itemRowSpec(item, row, detail) {
    return { id: item.itemRef, name: item.name, className: `smith-candidate-card smith-weapon-card rarity-${item.rarity}`, costs: [],
      text: t(row.status.id, row.status.tokens), line: [], artAsset: item.artAsset, artGlyph: item.artAsset ? null : 'attack', detail };
  }
  /** After the list is built: the engraved where-pill (worn or carried) and the row's reading, as the rail row wore them. */
  function dressItemRow(rowEl, item, selected) {
    rowEl.dataset.itemRef = item.itemRef;
    rowEl.setAttribute('role', 'option');
    MarkSelected(rowEl, selected, { className: ['selected', 'is-chosen'], ariaAttribute: 'aria-selected' });
    rowEl.append(el('span', { class: 'as-pill smith-weapon-count', role: 'img', 'aria-label': item.whereLabel }, engravedIcon(item.equipped ? 'attack' : 'block') || item.whereLabel));
    rowEl.setAttribute('aria-label', `${item.name}, ${item.whereLabel}, ${item.mounts.length} mount${item.mounts.length === 1 ? '' : 's'}, costs ${item.cost} Smithing Stone. Select to choose a mount.`);
    markUiComponent(rowEl, UI.mountCandidateCard, selected ? 'selected' : 'available');
  }

  const mountRowSpec = (mount, p, detail) => ({
    id: mount.mountKey, className: 'mount-row',
    name: `${mount.kindLabel}: ${mount.cardId ? mount.cardName : (mount.state === 'open' ? 'Open mount' : 'Nothing seated')}`,
    costs: [], line: [], detail,
    text: `${mount.stateLabel}${mount.state === 'fallback' && mount.cardName ? ` · showing ${mount.cardName}` : ''}${mount.fallbackCardId && mount.state !== 'fallback' && p.service === 'extract' ? ` · falls back to ${cardName(mount.fallbackCardId)}` : ''}`,
    artAsset: mount.cardId ? cardRowArt(mount.cardId)?.path || null : null, artGlyph: mount.cardId ? null : 'block',
  });

  const costPairHtml = (selected) => `<span class="smith-cost-pair">
      <em>REQ</em><i aria-hidden="true">/</i><em>AVAIL</em>
      <strong class="smith-cost-required">${selected.cost}</strong><i aria-hidden="true">/</i><strong class="smith-cost-available">${selected.stones}</strong>
    </span>`;
  const economyHtml = (selected) => `<span class="smith-economy-values"><span class="smith-stone-icon" aria-hidden="true">${engravedIconHtml('weight') || 'Stone'}</span><b>${t('smith.cost.label')}</b>${costPairHtml(selected)}</span>`;


  const confirmationDetails = (p) => `
    <div class="confirmation-cost ${p.selected.affordable ? 'affordable' : 'unaffordable'}">
      ${economyHtml(p.selected)}
    </div>
    <div class="confirmation-change-list">
      <div><b>${esc(p.selected.name)}</b><span>${esc(p.selectedMount ? `${p.selectedMount.kindLabel} mount · ${p.selectedMount.stateLabel}` : '')}</span></div>
      ${p.service === 'extract' && p.selectedMount ? `<div><b>${esc(p.selectedMount.cardName)}</b><span>leaves the item and joins your deck${p.selectedMount.fallbackCardId ? `; the mount shows ${esc(cardName(p.selectedMount.fallbackCardId))}` : '; the mount shows nothing'}</span></div>` : ''}
      ${p.service === 'install' && p.selectedCard ? `<div><b>${esc(p.selectedCard.cardName)}</b><span>leaves your deck and is seated in ${esc(p.selected.name)}</span></div>` : ''}
    </div>`;


  function commitSelected() {
    const p = currentModel.properties;
    if (!p.canConfirm) return;
    const selection = { itemRef: p.selected.itemRef, mountKey: p.selectedMount.mountKey, instanceId: p.selectedCard ? p.selectedCard.instanceId : undefined };
    leaving = 'confirm';
    shell.close();
    onConfirm(selection);
  }


  /** A section label inside the pane: the kit's data heading, as the upgrade draws it. */
  const heading = (label, hint) => el('div', { class: 'smith-data-row' }, el('span', { class: 'smith-data-heading' }, [
    el('b', { class: 'sr-name', text: label }), el('small', { class: 'sr-hint', text: hint }),
  ]));


  /** The deck cards a mount takes (install), each a row; the chosen one says where it goes under it. */
  function deckCardRows(p) {
    const mount = p.selectedMount;
    const rows = mount.cards.map((card) => ({
      id: card.instanceId, name: card.cardName ? `${card.cardName}${card.upgraded ? '+' : ''}` : card.cardId, className: 'mount-card-row', costs: [], line: [], text: '',
      artAsset: cardRowArt(card.cardId)?.path || null, artGlyph: cardRowArt(card.cardId) ? null : 'attack',
      detail: card.selected ? el('div', { class: 'mount-service-outcome mount-install-preview' }, [
        el('div', { class: 'smith-card-sprite' }, renderCard(registries, { cardId: card.cardId, upgraded: card.upgraded }, { small: true, tooltip: false, inspectReadOnly: true })),
        prose(t('smith.preview.install', { card: card.cardName, item: p.selected.name })),
      ]) : null,
    }));
    const selectedCard = mount.cards.find((card) => card.selected);
    const list = optionRowList(rows, { idAttr: 'data-instance-id', selectedId: selectedCard ? selectedCard.instanceId : null, columns: 1, onSelect: (id) => onSelectCard(id) });
    return [heading(t('smith.heading.deck'), `${mount.cards.length} card${mount.cards.length === 1 ? '' : 's'} this mount takes`), list];
  }

  /** What leaving does (extract): the card that leaves the mount, and what the mount shows after. */
  function extractOutcome(p) {
    const mount = p.selectedMount;
    return el('div', { class: 'mount-service-outcome mount-extract-preview' }, [
      mount.cardId ? el('div', { class: 'smith-card-sprite' }, renderCard(registries, { cardId: mount.cardId, upgraded: mount.upgraded }, { small: true, tooltip: false, inspectReadOnly: true })) : null,
      el('div', { class: 'smith-card-facts' }, [
        prose(t('smith.preview.extract', { card: mount.cardName, item: p.selected.name })),
        flavour(mount.fallbackCardId ? t('smith.preview.fallback', { card: cardName(mount.fallbackCardId) }) : t('smith.preview.fallbackNone')),
      ]),
    ].filter(Boolean));
  }

  /** The selected item's detail: its mounts (with what each opens), then the Stone cost. */
  function itemDetail(p) {
    const selected = p.selected;
    const mount = p.selectedMount;
    const mountRows = selected.mounts.map((candidate) => mountRowSpec(candidate, p, mount && candidate.mountKey === mount.mountKey
      ? (p.service === 'extract' ? extractOutcome(p) : el('div', { class: 'mount-card-section' }, deckCardRows(p))) : null));
    const mountList = optionRowList(mountRows, { idAttr: 'data-mount-key', selectedId: mount ? mount.mountKey : null, columns: 1, onSelect: (key) => onSelectMount(key) });
    return el('div', { class: 'mount-item-detail smith-preview-card', dataset: { uiComponent: UI.mountServicePreview } }, [
      heading(p.listLabel, p.service === 'extract' ? 'choose one' : 'choose a mount'),
      mountList,
      el('div', { class: 'smith-cost-strip' }, [
        el('div', { class: `smith-summary-cell smith-preview-economy ${selected.affordable ? 'affordable' : 'unaffordable'}`, html: economyHtml(selected) }),
        selected.affordable ? null : el('div', { class: 'as-blocker pinned smith-preview-shortfall', text: `Short ${selected.shortfall} Smithing Stone${selected.shortfall === 1 ? '' : 's'}.` }),
      ]),
    ]);
  }

  const identityOf = (node) => (node?.getAttribute ? (node.getAttribute('data-instance-id') ? `[data-instance-id="${CSS.escape(node.getAttribute('data-instance-id'))}"]`
    : node.getAttribute('data-mount-key') ? `[data-mount-key="${CSS.escape(node.getAttribute('data-mount-key'))}"]`
      : node.getAttribute('data-item-ref') ? `[data-item-ref="${CSS.escape(node.getAttribute('data-item-ref'))}"]` : null) : null);

  const rows = smithCandidateRows(initialModel);
  function draw(model) {
    currentModel = model;
    const p = model.properties;
    markUiComponent(modal, UI.mountServiceModal, model.variant);
    const selected = p.selected;
    const was = document.activeElement;
    const refocus = was && listHost.contains(was) ? identityOf(was) : null;

    const itemRows = p.candidates.map((item, index) => itemRowSpec(item, rows[index] || smithCandidateRows(model)[index], selected && selected.itemRef === item.itemRef ? itemDetail(p) : null));
    const list = optionRowList(itemRows, { idAttr: 'data-item-ref', selectedId: selected ? selected.itemRef : null, columns: 1, onSelect: (itemRef) => onSelectItem(itemRef) });
    for (const item of p.candidates) {
      const rowEl = [...list.querySelectorAll('[data-item-ref]')].find((node) => node.getAttribute('data-item-ref') === item.itemRef);
      if (rowEl) dressItemRow(rowEl, item, Boolean(selected) && selected.itemRef === item.itemRef);
    }
    for (const rowEl of list.querySelectorAll('.mount-row')) markUiComponent(rowEl, UI.mountRow, rowEl.getAttribute('aria-pressed') === 'true' ? 'selected' : 'available');
    listHost.replaceChildren(...[selected ? null : prose(p.instruction), list].filter(Boolean));
    count.textContent = t('smith.pane.status', { purse: p.purseLabel, n: p.candidates.length });
    consequence.textContent = p.consequence;
    if (refocus) queueMicrotask(() => listHost.querySelector(refocus)?.focus({ preventScroll: true }));

    disarmDecision?.();
    disarmDecision = null;
    confirm.disabled = !selected;
    confirm.textContent = p.confirmLabel;
    confirm.setAttribute('aria-disabled', String(!p.canConfirm));
    confirmBlocked = selected ? p.blockedReasons.join(' ') : '';
    confirmReason();
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
        // W2: the way out is Back (bottom-left), the same word every review wears.
        cancelLabel: t('common.back'),
        onCommit: commitSelected,
        canCommit: () => Boolean(currentModel.properties.canConfirm),
        blockedTitle: `Cannot ${p.verb.toLowerCase()} yet`,
        blockedMessage: p.blockedReasons.join(' ') || 'This service is not currently available.',
        blockedDetailsHtml: confirmationDetails(p),
        returnFocusElement: confirm,
      });
    }
  }

  // Back is a way out, and the shell's close, Escape and veil click are the same way out.
  back.addEventListener('click', shell.close);
  draw(initialModel);
  queueMicrotask(() => modal.focus({ preventScroll: true }));

  return {
    update(model) { draw(model); },
    close() {
      leaving = 'screen';
      shell.close();
    },
  };
}
