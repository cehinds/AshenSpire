// The card pick of the "copy a card" service (owner 2026-11-20): option rows of every card the player owns, one per
// variant (model/cardCopyService.js CardCopyCandidates). Presentation only; the purchase is the host's.
import { t as translate } from '../strings.js';
import { CardCopyCandidates } from '../../model/cardCopyService.js';
import { InstanceRank } from '../../model/rankUpService.js';
import { OpenChoiceModal } from './choiceModal.js';
import { PlayingCardArtworkOrNull } from './choiceRowSources.js';
import { RenderSmithPriceLine } from './smithOptionsModal.js';

const CARD_COPY_KIND = 'cardCopyPick';
const ROW_CLASS = 'card-copy-option';
const FALLBACK_ART_GLYPH = 'attack';

function buildCardCopyRow(card, registries)
{
    const definition = registries.cards.get(card.cardId);
    const cardArt = PlayingCardArtworkOrNull(
        card.cardId,
        definition,
        registries,
    );
    const rank = InstanceRank(card);
    return {
        id: card.instanceId,
        className: ROW_CLASS,
        name: `${definition?.name || card.cardId}${card.upgraded ? '+' : ''}`,
        text: translate('cardCopy.pick.row'),
        chip: rank > 1 ? translate('deckEditor.rank', { rank }) : '',
        artAsset: cardArt?.path || null,
        artGlyph: cardArt?.path
            ? null
            : FALLBACK_ART_GLYPH,
        artComposition: cardArt,
    };
}

/** CardCopyRows(registries, run) -> the picker's rows, one per copyable card. */
export function CardCopyRows(registries, run)
{
    return CardCopyCandidates(registries, run).map((card) =>
        buildCardCopyRow(
            card,
            registries,
        )
    );
}

export function OpenCardCopyModal({
    registries,
    run,
    price = '',
    opener = document.activeElement,
    onChoose,
    onClosed = null,
})
{
    return OpenChoiceModal({
        kind: CARD_COPY_KIND,
        rows: CardCopyRows(registries, run),
        eyebrow: translate('cardCopy.pick.eyebrow'),
        title: translate('cardCopy.pick.title'),
        opener,
        renderBeforeList: (host) => RenderSmithPriceLine(host, price),
        onClosed,
        onCommit: onChoose,
    });
}
