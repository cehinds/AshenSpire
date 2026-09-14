// The smith's card-service overlay: extract a card from an item's mount, or
// seat a deck card in one. Same dialog contract as smithUpgradeModal.js —
// the component owns rendering and the confirm decision; the screen owns run
// mutation. Three choices at most (item, mount, card), every one reversible
// until the explicit Confirm.
//
// THE CHROME IS THE SHELL'S. This door opens through modalShell.js, so the
// head (title, one ✕), the foot (the way out left, the way forward right),
// Escape, the veil click and focus return are the same here as on every other
// door — none of it is assembled in this file. What this file owns is the
// BODY.
//
// W1j EXTRACT CARD / W1k INSTALL CARD (2026-09-14). The body is a W1 workspace
// with no categories, like W1i: the item list is the left column (the kit's
// rail through the shared navigation; one `[Selection ▾]` selector above the
// pane on compact hosts), and the pane is the selected item, then its mount
// selector, then — once a mount is chosen — the card that would leave it and
// what the mount shows after (extract), or the deck cards it takes and, once
// one is chosen, where it goes (install); the Stone cost is pinned last. A
// dependent slot only appears when the choice it depends on is made
// (SmithWorkspaceModel.js); smithServices.js clears the dependent choices when
// a parent changes.
import { assetUrl } from '../assetmap.js';
import { esc, attachTooltip } from './tooltip.js';
import { renderCard } from './card.js';
import { armOptionDecision } from '../../framework/optionDecision.js';
import { t } from '../strings.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { openModal } from './modalShell.js';
import { bindCardInspection } from './cardInspection.js';
import { renderEquipmentInspection } from './equipmentCard.js';
import { el, artWell, eyebrow, prose, flavour, detailCard, railItem, railed, statusText, categoryNav } from '../kit/index.js';
import { workspaceFrame, markCurrent } from './w1Workspace.js';
import { smithWorkspaceVars, smithCandidateRows, smithSelectorFace, smithPaneSlots } from '../models/SmithWorkspaceModel.js';

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

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'subtle smith-back';
  back.textContent = p0.backLabel;

  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'smith-confirm mount-confirm';

  let currentModel = initialModel;
  let closed = false;
  // Why the door closed: the ✕, Escape and the veil are all "back"; Confirm is
  // not, and a programmatic close from the screen is neither.
  let leaving = 'back';
  let disarmDecision = null;

  const cardName = (cardId) => registries.cards.get(cardId)?.name || cardId;

  /** One candidate: a rail row — its art, its name, where it is and its mount count. */
  function candidateCard(item, row) {
    const card = railItem({
      tag: 'div', label: '', member: item.itemRef, current: item.selected,
      className: `smith-candidate-card smith-weapon-card rarity-${item.rarity}${item.selected ? ' selected is-chosen' : ''}`,
      attrs: { role: 'option', 'aria-controls': 'mount-preview-region' },
    });
    card.dataset.itemRef = item.itemRef;
    const well = artWell({ src: assetUrl(item.artAsset), alt: '', small: true, attrs: { class: 'smith-weapon-art' } });
    const art = well.querySelector('img');
    art?.addEventListener('error', () => art.remove());
    card.replaceChildren(
      well,
      el('span', { class: 'smith-row-text' }, [
        el('strong', { class: 'smith-weapon-name', text: item.name }),
        statusText(t(row.status.id, row.status.tokens), { class: 'smith-row-status' }),
      ]),
      el('span', { class: 'as-pill smith-weapon-count', 'aria-label': item.whereLabel, text: item.equipped ? '⚔' : '▣' }),
    );
    card.setAttribute('aria-label', `${item.name}, ${item.whereLabel}, ${item.mounts.length} mount${item.mounts.length === 1 ? '' : 's'}, costs ${item.cost} Smithing Stone. Select to choose a mount.`);
    attachTooltip(card, () => `<div class="tt-title">${esc(item.name)} · ${esc(item.whereLabel)}</div>`
      + `<div>${item.mounts.map((mount) => `${esc(mount.kindLabel)}: ${esc(mount.cardName || mount.stateLabel)}`).join('<br>')}</div>`
      + `<div>Smith Stone Cost: 🪨 ${item.cost}/${item.stones} available.</div>`);
    markUiComponent(card, UI.mountCandidateCard, item.selected ? 'selected' : 'available');
    const piece = item.itemKind === 'armor'
      ? registries.equipment.armour.find(piece => piece.id === item.itemId && piece.classId === item.classId)
      : registries.equipment.armaments.find(piece => piece.id === item.itemId);
    // Two taps: the first highlights and reveals the `i`, the second reaches
    // the navigation's `choose`. Bound BEFORE the navigation listens, so the
    // selecting tap it swallows never reaches it. The footer's verb is still
    // the commit.
    if (piece) bindCardInspection(card, { title: item.name, open: opener => openModal({
      title: item.name, eyebrow: 'Item information', opener, size: 'lg',
      body: renderEquipmentInspection(registries, piece, { interactive: false }),
    }) });
    card.addEventListener('keydown', (event) => {
      if (event.target !== card || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      card.click();
    });
    return card;
  }

  const rows = smithCandidateRows(initialModel);
  const cards = p0.candidates.map((item, index) => candidateCard(item, rows[index]));
  // The kit's W1 category navigation; the Smith's items are a listbox.
  const nav = categoryNav({ items: cards, ariaLabel: t('smith.items.mount'), railAttrs: { role: 'listbox' }, choose: (itemRef) => onSelectItem(itemRef) });
  const count = statusText('', { class: 'smith-pane-status', role: 'status', dataset: { mountCount: '' } });
  const previewHost = el('div', { class: 'smith-preview-host' });
  const consequence = el('p', { class: 'as-flavor smith-consequence', id: 'mount-modal-consequence' });
  const previewRegion = el('section', {
    class: 'as-pane smith-preview-region', id: 'mount-preview-region', 'aria-live': 'polite', 'aria-label': 'Selected item\'s mounts',
  }, [count, previewHost, consequence]);

  const shell = openModal({
    size: 'xl',
    className: 'smith-upgrade-modal mount-service-modal',
    title: p0.title,
    bodyClassName: 'smith-modal-body',
    body: (bodyHost) => bodyHost.append(railed(nav, previewRegion, { class: 'smith-candidate-region' })),
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
  // The shrine pane sits above the rest screen's own veil; same stacking the
  // upgrade door uses.
  shell.veil.classList.add('smith-modal-veil');
  const modal = shell.panel;
  modal.dataset.wireframe = p0.service === 'extract' ? 'W1j' : 'W1k';
  modal.setAttribute('aria-describedby', 'mount-modal-consequence');
  workspaceFrame(modal);
  for (const [prop, value] of Object.entries(smithWorkspaceVars())) modal.style.setProperty(prop, value);
  markUiComponent(modal, UI.mountServiceModal, initialModel.variant);

  const costPairHtml = (selected) => `<span class="smith-cost-pair">
      <em>REQ</em><i aria-hidden="true">/</i><em>AVAIL</em>
      <strong class="smith-cost-required">${selected.cost}</strong><i aria-hidden="true">/</i><strong class="smith-cost-available">${selected.stones}</strong>
    </span>`;
  const economyHtml = (selected) => `<span class="smith-economy-values"><span class="smith-stone-icon" aria-hidden="true">🪨</span><b>Smithing Stone Cost</b>${costPairHtml(selected)}</span>`;

  const mountRowHtml = (mount) => `
    <div class="mount-row${mount.selected ? ' selected' : ''}${mount.extra ? ' is-extra' : ''}" role="option" aria-selected="${String(mount.selected)}"
         data-mount-key="${esc(mount.mountKey)}" tabindex="0">
      <em>${esc(mount.kindLabel)}</em>
      <b>${mount.cardId ? esc(mount.cardName) : (mount.state === 'open' ? 'Open mount' : 'Nothing seated')}</b>
      <small>${esc(mount.stateLabel)}${mount.state === 'fallback' && mount.cardName ? ` · showing ${esc(mount.cardName)}` : ''}${mount.fallbackCardId && mount.state !== 'fallback' && currentModel.properties.service === 'extract' ? ` · falls back to ${esc(cardName(mount.fallbackCardId))}` : ''}</small>
    </div>`;

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

  /** The pane, in W1j / W1k order, holding only the slots the model declares. */
  function previewCard(p, slots) {
    const selected = p.selected;
    const mount = p.selectedMount;
    const types = selected.itemTypes.length
      ? selected.itemTypes.map((type) => el('em', { class: 'as-tag', dataset: { itemType: type.tag }, text: type.label }))
      : [el('em', { class: 'as-tag', text: selected.kindLabel })];
    const well = artWell({ src: assetUrl(selected.artAsset), alt: '', attrs: { class: 'smith-weapon-art' } });
    const art = well.querySelector('img');
    art?.addEventListener('error', () => art.remove());
    const slot = {
      selected: [el('div', { class: 'smith-summary-grid' }, el('div', { class: 'smith-summary-cell smith-selected-head' }, [
        well,
        eyebrow('Selected item', { class: 'smith-preview-label' }),
        el('b', { class: 'sr-name', text: selected.name }),
        el('span', { class: 'dc-meta', text: `${selected.whereLabel} · ${selected.mounts.length} mount${selected.mounts.length === 1 ? '' : 's'}` }),
        el('span', { class: 'smith-item-type-row' }, types),
      ]))],
      mounts: [
        heading(p.listLabel, p.service === 'extract' ? 'choose one' : 'choose a mount'),
        el('div', { class: 'mount-row-list', role: 'listbox', 'aria-label': p.listLabel, html: selected.mounts.map(mountRowHtml).join('') }),
      ],
      extractionPreview: mount ? [el('div', { class: 'mount-service-outcome mount-extract-preview' }, [
        mount.cardId ? el('div', { class: 'smith-card-sprite', dataset: { mountPreviewCard: '' } }) : null,
        el('div', { class: 'smith-card-facts' }, [
          prose(t('smith.preview.extract', { card: mount.cardName, item: selected.name })),
          flavour(mount.fallbackCardId ? t('smith.preview.fallback', { card: cardName(mount.fallbackCardId) }) : t('smith.preview.fallbackNone')),
        ]),
      ])] : [],
      cards: mount ? [
        heading(t('smith.heading.deck'), `${mount.cards.length} card${mount.cards.length === 1 ? '' : 's'} this mount takes`),
        el('div', { class: 'mount-card-list', role: 'listbox', 'aria-label': 'Deck cards this mount takes' }),
      ] : [],
      installPreview: p.selectedCard ? [el('div', { class: 'mount-service-outcome mount-install-preview' },
        prose(t('smith.preview.install', { card: p.selectedCard.cardName, item: selected.name })))] : [],
      cost: [el('div', { class: 'smith-cost-strip' }, [
        el('div', { class: `smith-summary-cell smith-preview-economy ${selected.affordable ? 'affordable' : 'unaffordable'}`, html: economyHtml(selected) }),
        selected.affordable ? null : el('div', { class: 'as-blocker pinned smith-preview-shortfall', text: `Short ${selected.shortfall} Smithing Stone${selected.shortfall === 1 ? '' : 's'}.` }),
      ])],
    };
    return detailCard({
      attrs: { class: 'smith-preview-card', dataset: { uiComponent: UI.mountServicePreview } },
      children: slots.flatMap((name) => slot[name] || []),
    });
  }

  function draw(model) {
    currentModel = model;
    const p = model.properties;
    markUiComponent(modal, UI.mountServiceModal, model.variant);
    const selected = p.selected;
    markCurrent(cards, selected ? selected.itemRef : null);
    for (const card of cards) {
      const on = Boolean(selected) && card.dataset.itemRef === selected.itemRef;
      card.classList.toggle('selected', on);
      markUiComponent(card, UI.mountCandidateCard, on ? 'selected' : 'available');
    }
    const face = smithSelectorFace(model);
    nav.sync(face.text ?? t(face.id));
    count.textContent = t('smith.pane.status', { purse: p.purseLabel, n: p.candidates.length });
    consequence.textContent = p.consequence;

    // The pane is redrawn from the model, so a control focused inside it is
    // found again by its identity afterwards (the mount, or the deck card).
    const was = document.activeElement;
    const refocus = was && previewHost.contains(was)
      ? (was.dataset.mountKey ? `[data-mount-key="${CSS.escape(was.dataset.mountKey)}"]`
        : was.dataset.instanceId ? `[data-instance-id="${CSS.escape(was.dataset.instanceId)}"]` : null)
      : null;

    previewHost.replaceChildren(selected
      ? previewCard(p, smithPaneSlots(model))
      : el('div', { class: 'smith-preview-empty', dataset: { uiComponent: UI.mountServicePreview } }, [
        artWell({ glyph: '⚙', cool: true }),
        prose(p.instruction),
      ]));
    if (selected) {
      for (const row of previewHost.querySelectorAll('.mount-row')) {
        markUiComponent(row, UI.mountRow, row.classList.contains('selected') ? 'selected' : 'available');
        const mount = selected.mounts.find(mount => mount.mountKey === row.dataset.mountKey);
        bindCardInspection(row, { title: mount.cardName || mount.kindLabel, open: opener => openModal({
          title: mount.cardName || 'Open mount', eyebrow: mount.kindLabel, opener,
          bodyClassName: 'as-pane', body: host => {
            if (mount.cardId) host.append(renderCard(registries, { cardId: mount.cardId, upgraded: mount.upgraded }, { inspection: false, tooltip: false }));
            const description = document.createElement('p');
            description.textContent = `${selected.name} · ${mount.kindLabel} · ${mount.stateLabel}. ${p.service === 'extract' ? 'Confirm extraction to move the card into your deck.' : 'Choose a compatible deck card, then confirm to seat it here.'}`;
            host.append(description);
          },
        }) });
        const choose = () => onSelectMount(row.dataset.mountKey);
        row.addEventListener('click', choose);
        row.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          choose();
        });
      }
      const sprite = previewHost.querySelector('[data-mount-preview-card]');
      if (sprite && p.selectedMount?.cardId) {
        sprite.appendChild(renderCard(registries, { cardId: p.selectedMount.cardId, upgraded: p.selectedMount.upgraded }, { small: true, tooltip: false, inspectReadOnly: true }));
      }
      const cardList = previewHost.querySelector('.mount-card-list');
      if (cardList && p.selectedMount) {
        for (const card of p.selectedMount.cards) {
          const face = renderCard(registries, { cardId: card.cardId, upgraded: card.upgraded, instanceId: card.instanceId }, { small: true });
          face.classList.toggle('selected', card.selected);
          // #997: the picked card wears the game's one chosen ring, not a
          // gold outline of the stables' own invention.
          face.classList.toggle('is-chosen', card.selected);
          face.setAttribute('role', 'option');
          face.setAttribute('aria-selected', String(card.selected));
          face.dataset.instanceId = card.instanceId;
          face.tabIndex = 0;
          const choose = () => onSelectCard(card.instanceId);
          face.addEventListener('click', choose);
          face.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            choose();
          });
          cardList.appendChild(face);
        }
      }
    }
    if (refocus) queueMicrotask(() => previewHost.querySelector(refocus)?.focus({ preventScroll: true }));
    disarmDecision?.();
    disarmDecision = null;
    confirm.disabled = !selected;
    confirm.textContent = p.confirmLabel;
    confirm.setAttribute('aria-disabled', String(!p.canConfirm));
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

  // Back is a way out, and the shell's ✕, Escape and veil click are the same
  // way out — all four land on onBack through onClose. An open compact item
  // list takes Escape first (w1Workspace.js listens a step earlier).
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
