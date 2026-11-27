// src/ui/components/piles.js — pile viewer modal (SPEC §7.2)
//
// Draw-pile views are display-shuffled (Math.random is fine here — pure
// presentation, never game state) so pile inspection leaks no order info,
// like StS.
//
// THIS DOOR HAD NO WAY OUT THAT A KEYBOARD COULD REACH. Before adopting the
// shell it built its own veil and panel, listened for a click on the veil, and
// stopped there: no close control, no Escape, no `aria-modal`, no focus
// return. A player on a pad or a keyboard who opened the draw pile was stuck
// in it. That is not a styling divergence — it is the reason modalShell.js
// owns dismissal rather than advising about it.
//
// What is left here is the BODY, which is all this file ever should have been:
// a grid of card faces, display-shuffled where the pile is hidden.

import { renderCard, cardDetailHtml } from './card.js';
import { OpenModal } from './modalShell.js';
import { decorateKeywords } from './tooltipGlossary.js';
import { button, cardGrid, categoryNav, el, flavour, railed, railItem, statusText } from '../kit/index.js';
import { SPENT_PILES, spentPileView } from '../models/PileViewerModel.js';
// This door's words live in content/source/uiStrings.csv, like every other
// migrated surface: the ratchet (tools/uistrings.mjs) caught this file GROWING
// past its baseline when the spent-pile pair landed, which is exactly the
// regression it exists to stop.
import { t as translate } from '../strings.js';
import { MarkSelected } from '../selection.js';

export function openPileModal(
    registries,
    title,
    cards,
    {
        shuffleForDisplay = false,
        rules = null,
        deckView = false,
    } = {},
)
{
    const list = [...cards];
    if (shuffleForDisplay)
    {
        for (let currentIndex = list.length - 1; currentIndex > 0; currentIndex--)
        {
            const swapIndex = Math.floor(Math.random() * (currentIndex + 1));
            [list[currentIndex], list[swapIndex]] = [list[swapIndex], list[currentIndex]];
        }
    }

    const done = button({
        label: translate('common.close'),
        role: 'exit',
        className: 'pile-done',
        attrs: { 'data-focusable': 'true' },
    });
    const cardWord = list.length === 1
        ? 'card'
        : 'cards';
    const status = statusText(`${list.length} ${cardWord}`, { class: 'modal-head-status' });
    const className = deckView
        ? 'pile-modal deck-view-modal'
        : 'pile-modal';
    const eyebrow = deckView
        ? ''
        : translate('piles.eyebrow');

    const shell = OpenModal({
        size: 'xl',
        className,
        eyebrow,
        title,
        headExtras: status,
        bodyClassName: 'pile-body',
        body: (host) =>
        {
            const faces = list.map((cardInstance) =>
            {
                return renderCard(registries, cardInstance, {
                    small: true,
                    inspectReadOnly: true,
                    rules,
                });
            });
            const grid = cardGrid(faces, { class: 'grid' });
            if (!list.length)
            {
                grid.appendChild(flavour(translate('piles.empty'), { class: 'pile-empty' }));
            }
            host.appendChild(grid);
        },
        primary: deckView
            ? null
            : done,
        footSize: 'short',
    });
    if (!deckView)
    {
        done.addEventListener('click', shell.close);
    }
    return shell.veil;
}

/**
 * W1h: one entry, two distinct piles. The piles are categories, so they sit on
 * the kit's W1 category navigation (a rail on wide hosts, one `[Pile ▾]`
 * selector above the pane on compact ones), never as tabs across the head.
 * The pane shows the pile beside the reading of the selected card; a single
 * Close ends it. Viewing never moves or merges any cards. The rail items keep
 * `role=tab`, `aria-selected`, `data-member` and `data-modal-tab`, the hooks
 * the HUD tools read. The arrows and the pad are the input router's; the kit
 * adds Home / End.
 */
export function openSpentPileModal(registries, piles, opener = document.activeElement, { rules = null } = {}) {
  let active = 'discard';
  let selectedId = null;
  const items = SPENT_PILES.map((id) => railItem({ label: id, id: 'spent-tab-' + id, member: id,
    attrs: { dataset: { modalTab: id }, 'aria-controls': 'spent-pile-panel' } }));
  const collection = el('div', { class: 'pile-collection' });
  const detail = el('div', { class: 'pile-detail', 'aria-live': 'polite' });
  const pane = el('div', { class: 'pile-pane', id: 'spent-pile-panel', role: 'tabpanel' }, [collection, detail]);
  const read = (inst) => {
    detail.innerHTML = inst ? cardDetailHtml(registries, inst, { rules }) : '';
    if (inst) decorateKeywords(detail);
  };
  const paint = () => {
    const view = spentPileView(piles, active, selectedId);
    items.forEach((item, i) => {
      const tab = view.tabs[i];
      item.textContent = tab.label;
      MarkSelected(item, tab.selected, { className: 'on', ariaAttribute: 'aria-selected', ariaCurrent: 'true' });
    });
    pane.setAttribute('aria-labelledby', 'spent-tab-' + active);
    const faces = view.cards.map((inst) => {
      const face = renderCard(registries, inst, { small: true, inspectReadOnly: true, rules });
      face.addEventListener('cardinspectionselect', () => { selectedId = inst.instanceId; read(inst); });
      return face;
    });
    const grid = cardGrid(faces, { class: 'grid' });
    if (view.empty) grid.appendChild(flavour(translate('piles.empty'), { class: 'pile-empty' }));
    collection.replaceChildren(grid);
    read(view.detail);
  };
  const choose = (id) => { if (!SPENT_PILES.includes(id)) return; active = id; selectedId = null; paint(); };
  const nav = categoryNav({ items, ariaLabel: translate('piles.spent.nav'), choose });
  const done = button({ label: translate('common.close'), role: 'exit', className: 'pile-done', attrs: { 'data-focusable': 'true' } });
  const shell = OpenModal({ title: translate('piles.spent.title'), size: 'xl', className: 'pile-modal spent-pile-modal',
    showMenuButton: false, opener, bodyClassName: 'pile-body',
    body: (host) => host.append(railed(nav, pane)),
    primary: done, footSize: 'short',
  });
  done.addEventListener('click', shell.close);
  paint(); return shell;
}
