import { t as translate } from '../strings.js';
import { UpgradeSlots } from '../../model/cardUpgradeLimits.js';
import { RankUpCandidates } from '../../model/rankUpService.js';
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

function buildRankUpRow(card, registries, run)
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
        text: translate('blacksmith.rankUp.desc', {
            from: RankLabel(definition, rank),
            to: RankLabel(definition, rank + 1),
        }),
        chip: translate('rankUp.pick.slots', { slots: UpgradeSlots(run, rankedUpCard) }),
        artAsset: cardArt?.path || null,
        artGlyph: cardArt?.path
            ? null
            : FALLBACK_ART_GLYPH,
        artComposition: cardArt,
    };
}

export function RankUpCardRows(registries, run)
{
    return RankUpCandidates(registries, run).map((card) =>
        buildRankUpRow(
            card,
            registries,
            run,
        )
    );
}

export function OpenRankUpCardModal({
    registries,
    run,
    price = '',
    opener = document.activeElement,
    onChoose,
    onClosed = null,
})
{
    return OpenChoiceModal({
        kind: RANK_UP_KIND,
        rows: RankUpCardRows(registries, run),
        eyebrow: translate('rankUp.pick.eyebrow'),
        title: translate('rankUp.pick.title'),
        opener,
        renderBeforeList: (host) => RenderSmithPriceLine(host, price),
        onClosed,
        onCommit: onChoose,
    });
}
