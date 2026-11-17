import { t as translate } from '../strings.js';
import { UpgradeSlots } from '../../model/cardUpgradeLimits.js';
import { InstanceRank, RankUpCandidates } from '../../model/rankUpService.js';
import { OpenChoiceModal } from './choiceModal.js';
import { PlayingCardArtworkOrNull } from './choiceRowSources.js';
import { RenderSmithPriceLine } from './smithOptionsModal.js';

const RANK_UP_KIND = 'rankUpCard';
const ROW_CLASS = 'rank-up-option';
const FALLBACK_ART_GLYPH = 'attack';

function findCardArtPath(card, definition, registries)
{
    const cardArt = PlayingCardArtworkOrNull(
        card.cardId,
        definition,
        registries,
    );
    return cardArt?.path || null;
}

function buildRankUpRow(card, registries, run)
{
    const definition = registries.cards.get(card.cardId);
    const rank = InstanceRank(card);
    const rankedUpCard = {
        ...card,
        rank: rank + 1,
    };
    const artPath = findCardArtPath(
        card,
        definition,
        registries,
    );
    return {
        id: card.instanceId,
        className: ROW_CLASS,
        name: definition?.name || card.cardId,
        text: translate('blacksmith.rankUp.desc', {
            from: rank,
            to: rank + 1,
        }),
        chip: translate('rankUp.pick.slots', { slots: UpgradeSlots(run, rankedUpCard) }),
        artAsset: artPath,
        artGlyph: artPath
            ? null
            : FALLBACK_ART_GLYPH,
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
