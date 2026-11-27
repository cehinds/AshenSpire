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
import {
    button,
    cardGrid,
    categoryNav,
    el as createElement,
    flavour,
    railed,
    railItem,
    statusText,
} from '../kit/index.js';
import { SPENT_PILES, spentPileView } from '../models/PileViewerModel.js';
// This door's words live in content/source/uiStrings.csv, like every other
// migrated surface: the ratchet (tools/uistrings.mjs) caught this file GROWING
// past its baseline when the spent-pile pair landed, which is exactly the
// regression it exists to stop.
import { t as translate } from '../strings.js';
import { MarkSelected } from '../selection.js';
import { ResolveModalConfig } from '../models/ModalModel.js';

export const PILE_MODAL_KIND = 'pileViewer';
export const DECK_VIEW_MODAL_KIND = 'deckView';
export const DRAW_PILE_MODAL_KIND = 'drawPile';
export const SPENT_PILE_MODAL_KIND = 'spentPile';

const DONE_BUTTON_CLASS = 'pile-done';
const STATUS_CLASS = 'modal-head-status';
const GRID_CLASS = 'grid';
const EMPTY_CLASS = 'pile-empty';
const EXIT_ROLE = 'exit';
const SPENT_TAB_PREFIX = 'spent-tab-';
const SPENT_PANEL_ID = 'spent-pile-panel';
const COLLECTION_CLASS = 'pile-collection';
const DETAIL_CLASS = 'pile-detail';
const PANE_CLASS = 'pile-pane';
const SELECTED_CLASS = 'on';
const SELECT_EVENT = 'cardinspectionselect';

function shuffleCards(cards)
{
    const list = [...cards];
    for (let currentIndex = list.length - 1; currentIndex > 0; currentIndex--)
    {
        const swapIndex = Math.floor(Math.random() * (currentIndex + 1));
        [list[currentIndex], list[swapIndex]] = [list[swapIndex], list[currentIndex]];
    }
    return list;
}

function buildCloseButton(config)
{
    return button({
        label: translate(config.closeLabelKey),
        role: EXIT_ROLE,
        className: DONE_BUTTON_CLASS,
        attrs: { 'data-focusable': 'true' },
    });
}

function buildPileCardGrid(
    registries,
    list,
    config,
    rules,
    onSelect = null,
)
{
    const faces = list.map((cardInstance) =>
    {
        const face = renderCard(
            registries,
            cardInstance,
            {
                small: config.smallCards !== false,
                inspectReadOnly: config.inspectReadOnly !== false,
                rules,
            },
        );
        if (onSelect)
        {
            face.addEventListener(SELECT_EVENT, () => onSelect(cardInstance));
        }
        return face;
    });
    const grid = cardGrid(faces, { class: GRID_CLASS });
    if (!list.length)
    {
        grid.appendChild(flavour(translate(config.emptyTextKey), { class: EMPTY_CLASS }));
    }
    return grid;
}

export function openPileModal(
    registries,
    title,
    cards,
    {
        kind = PILE_MODAL_KIND,
        rules = null,
    } = {},
)
{
    const config = ResolveModalConfig(kind);
    const list = config.shuffleForDisplay
        ? shuffleCards(cards)
        : [...cards];
    const showFooterClose = config.showFooterClose !== false;
    const done = showFooterClose
        ? buildCloseButton(config)
        : null;
    const cardWord = list.length === 1
        ? 'card'
        : 'cards';
    const status = statusText(`${list.length} ${cardWord}`, { class: STATUS_CLASS });
    const eyebrow = config.eyebrowKey
        ? translate(config.eyebrowKey)
        : '';

    const shell = OpenModal({
        size: config.size,
        className: config.className,
        eyebrow,
        title,
        headExtras: status,
        bodyClassName: config.bodyClassName,
        body: (host) =>
        {
            host.appendChild(buildPileCardGrid(
                registries,
                list,
                config,
                rules,
            ));
        },
        primary: done,
        footSize: config.footSize,
    });
    if (done)
    {
        done.addEventListener('click', shell.close);
    }
    return shell.veil;
}

function buildSpentRailItems()
{
    return SPENT_PILES.map((pileId) =>
    {
        return railItem({
            label: pileId,
            id: `${SPENT_TAB_PREFIX}${pileId}`,
            member: pileId,
            attrs: {
                dataset: { modalTab: pileId },
                'aria-controls': SPENT_PANEL_ID,
            },
        });
    });
}

export function openSpentPileModal(
    registries,
    piles,
    opener = document.activeElement,
    {
        kind = SPENT_PILE_MODAL_KIND,
        rules = null,
    } = {},
)
{
    const config = ResolveModalConfig(kind);
    let activePile = config.defaultTab || SPENT_PILES[0];
    let selectedInstanceId = null;

    const railItems = buildSpentRailItems();
    const collection = createElement('div', { class: COLLECTION_CLASS });
    const detail = createElement('div', {
        class: DETAIL_CLASS,
        'aria-live': 'polite',
    });
    const pane = createElement(
        'div',
        {
            class: PANE_CLASS,
            id: SPENT_PANEL_ID,
            role: 'tabpanel',
        },
        [
            collection,
            detail,
        ],
    );

    function renderDetail(cardInstance)
    {
        detail.innerHTML = cardInstance
            ? cardDetailHtml(
                registries,
                cardInstance,
                { rules },
            )
            : '';
        if (cardInstance)
        {
            decorateKeywords(detail);
        }
    }

    function paint()
    {
        const view = spentPileView(
            piles,
            activePile,
            selectedInstanceId,
        );
        railItems.forEach((item, tabIndex) =>
        {
            const tab = view.tabs[tabIndex];
            item.textContent = tab.label;
            MarkSelected(
                item,
                tab.selected,
                {
                    className: SELECTED_CLASS,
                    ariaAttribute: 'aria-selected',
                    ariaCurrent: 'true',
                },
            );
        });
        pane.setAttribute('aria-labelledby', `${SPENT_TAB_PREFIX}${activePile}`);
        const grid = buildPileCardGrid(
            registries,
            view.cards,
            config,
            rules,
            (cardInstance) =>
            {
                selectedInstanceId = cardInstance.instanceId;
                renderDetail(cardInstance);
            },
        );
        collection.replaceChildren(grid);
        renderDetail(view.detail);
    }

    function choosePile(pileId)
    {
        if (!SPENT_PILES.includes(pileId))
        {
            return;
        }
        activePile = pileId;
        selectedInstanceId = null;
        paint();
    }

    const navigation = categoryNav({
        items: railItems,
        ariaLabel: translate(config.navAriaKey),
        choose: choosePile,
    });
    const done = buildCloseButton(config);
    const shell = OpenModal({
        title: translate(config.titleKey),
        size: config.size,
        className: config.className,
        showMenuButton: config.showMenuButton,
        opener,
        bodyClassName: config.bodyClassName,
        body: (host) =>
        {
            host.append(railed(navigation, pane));
        },
        primary: done,
        footSize: config.footSize,
    });
    done.addEventListener('click', shell.close);
    paint();
    return shell;
}
