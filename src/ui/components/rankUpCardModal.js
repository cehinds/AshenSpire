import { t as translate } from '../strings.js';
import { UpgradeSlots } from '../../model/cardUpgradeLimits.js';
import { RankUpCandidates, RankUpBlock, RankUpPrice } from '../../model/rankUpService.js';
import { OwnCardRank } from '../../model/cardRank.js';
import { RankLabel } from '../rankLabel.js';
import { OpenChoiceModal } from './choiceModal.js';
import { PlayingCardArtworkOrNull } from './choiceRowSources.js';
import { RenderSmithPriceLine } from './smithOptionsModal.js';

const RANK_UP_KIND = 'rankUpCard';
const ROW_CLASS = 'rank-up-option';
const FALLBACK_ART_GLYPH = 'attack';

function findCardArt(card, definition, registries)
{
    return PlayingCardArtworkOrNull(
        card.cardId,
        definition,
        registries,
    );
}

function buildRankUpRow(card, registries, run, shelfPrice)
{
    const definition = registries.cards.get(card.cardId);
    const rank = OwnCardRank(card);
    const rankedUpCard = {
        ...card,
        rank: rank + 1,
    };
    const cardArt = findCardArt(
        card,
        definition,
        registries,
    );
    return {
        id: card.instanceId,
        className: ROW_CLASS,
        name: definition?.name || card.cardId,
        // A card the full-upgrade rule holds back is shown, disabled, with its reason (owner, 2026-11-23).
        text: RankUpBlock(run, card) || [
            translate('blacksmith.rankUp.desc', {
                from: RankLabel(definition, rank),
                to: RankLabel(definition, rank + 1),
            }),
            // Owner 2026-11-23: each card names its price, the rank-up price times the rank it reaches.
            Number.isSafeInteger(shelfPrice) ? translate('rankUp.pick.rowPrice', { cost: RankUpPrice(shelfPrice, rank + 1) }) : '',
        ].filter(Boolean).join(' '),
        disabled: !!RankUpBlock(run, card),
        chip: translate('rankUp.pick.slots', { slots: UpgradeSlots(run, rankedUpCard) }),
        artAsset: cardArt?.path || null,
        artGlyph: cardArt?.path
            ? null
            : FALLBACK_ART_GLYPH,
        artComposition: cardArt,
    };
}

export function RankUpCardRows(registries, run, shelfPrice = null)
{
    return RankUpCandidates(registries, run).map((card) =>
        buildRankUpRow(
            card,
            registries,
            run,
            shelfPrice,
        )
    );
}

export function OpenRankUpCardModal({
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
        kind: RANK_UP_KIND,
        rows: RankUpCardRows(registries, run, shelfPrice),
        eyebrow: translate('rankUp.pick.eyebrow'),
        title: translate('rankUp.pick.title'),
        opener,
        renderBeforeList: (host) => RenderSmithPriceLine(host, price),
        onClosed,
        onCommit: onChoose,
    });
}
