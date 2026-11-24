// The card pick of the "copy a card" service (owner 2026-11-20): option rows of every card the player owns, one per
// variant (model/cardCopyService.js CardCopyCandidates). Presentation only; the purchase is the host's.
import { t as translate } from '../strings.js';
import { CardCopyCandidates, CardCopyPrice } from '../../model/cardCopyService.js';
import { OwnCardRank } from '../../model/cardRank.js';
import { OpenChoiceModal } from './choiceModal.js';
import { PlayingCardArtworkOrNull } from './choiceRowSources.js';
import { RenderSmithPriceLine } from './smithOptionsModal.js';

const CARD_COPY_KIND = 'cardCopyPick';
const ROW_CLASS = 'card-copy-option';
const FALLBACK_ART_GLYPH = 'attack';

function buildCardCopyRow(card, registries, run, shelfPrice)
{
    const definition = registries.cards.get(card.cardId);
    const cardArt = PlayingCardArtworkOrNull(
        card.cardId,
        definition,
        registries,
    );
    const rank = OwnCardRank(card);
    return {
        id: card.instanceId,
        className: ROW_CLASS,
        name: `${definition?.name || card.cardId}${card.upgraded ? '+' : ''}`,
        // Owner 2026-11-23: each card names its own price, the shelf's raised for the rank it shows.
        text: Number.isSafeInteger(shelfPrice)
            ? translate('cardCopy.pick.rowPriced', { cost: CardCopyPrice(run, shelfPrice, card) })
            : translate('cardCopy.pick.row'),
        chip: rank > 0 ? translate('deckEditor.rank', { rank }) : '',
        artAsset: cardArt?.path || null,
        artGlyph: cardArt?.path
            ? null
            : FALLBACK_ART_GLYPH,
        artComposition: cardArt,
    };
}

/**
 * CardCopyRows(registries, run[, shelfPrice]) -> the picker's rows, one per copyable card. With the shelf's price, each row
 * names what copying that card costs (CardCopyPrice).
 */
export function CardCopyRows(registries, run, shelfPrice = null)
{
    return CardCopyCandidates(registries, run).map((card) =>
        buildCardCopyRow(
            card,
            registries,
            run,
            shelfPrice,
        )
    );
}

export function OpenCardCopyModal({
    registries,
    run,
    price = '',
    shelfPrice = null,
    opener = document.activeElement,
    onChoose,
    onClosed = null,
})
{
    return OpenChoiceModal({
        kind: CARD_COPY_KIND,
        rows: CardCopyRows(registries, run, shelfPrice),
        eyebrow: translate('cardCopy.pick.eyebrow'),
        title: translate('cardCopy.pick.title'),
        opener,
        renderBeforeList: (host) => RenderSmithPriceLine(host, price),
        onClosed,
        onCommit: onChoose,
    });
}
