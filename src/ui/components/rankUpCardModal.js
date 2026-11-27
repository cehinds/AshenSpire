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
const cindersOf = (run) => (Number.isSafeInteger(run?.cinders) ? run.cinders : 0);

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
    // Owner 2026-11-23: each card names its price, the rank-up price times the rank it reaches.
    const cost = Number.isSafeInteger(shelfPrice)
        ? RankUpPrice(shelfPrice, rank + 1)
        : null;
    // A card the full-upgrade rule holds back, or one whose price is past the purse, is shown, disabled, with its reason.
    const blockedReason = RankUpBlock(run, card, registries)
        || (cost !== null && cost > cindersOf(run) ? translate('shop.refuse.cinders') : '');
    return {
        id: card.instanceId,
        className: ROW_CLASS,
        name: definition?.name || card.cardId,
        text: blockedReason || [
            translate('blacksmith.rankUp.desc', {
                from: RankLabel(definition, rank),
                to: RankLabel(definition, rank + 1),
            }),
            cost !== null ? translate('rankUp.pick.rowPrice', { cost }) : '',
        ].filter(Boolean).join(' '),
        disabled: !!blockedReason,
        chip: translate('rankUp.pick.slots', { slots: UpgradeSlots(run, rankedUpCard, registries) }),
        artAsset: cardArt?.path || null,
        artGlyph: cardArt?.path
            ? null
            : FALLBACK_ART_GLYPH,
        artComposition: cardArt,
    };
}

export function RankUpCardRows(registries, run, shelfPrice = null)
{
    const rows = RankUpCandidates(registries, run).map((card) =>
        buildRankUpRow(
            card,
            registries,
            run,
            shelfPrice,
        )
    );
    return rows.sort((a, b) => Number(a.disabled) - Number(b.disabled));
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
