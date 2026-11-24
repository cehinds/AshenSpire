import { projectEnemyKnowledge } from '../../model/enemyKnowledgeView.js';
import { renderEnemyKnowledge } from '../components/enemyKnowledge.js';
import { MountKnowledgeDoor } from '../components/knowledgeDoor.js';
import { optionCard, titleS } from '../kit/index.js';
import { t } from '../strings.js';

function readLearnedDefinitions(registries, learned)
{
    return registries.enemies.all()
        .filter((definition) => Object.hasOwn(learned, definition.id))
        .sort((first, second) => first.name.localeCompare(second.name));
}

// Weaknesses are discovery-gated (SPEC 5.3) and their ledger lives on the run, so the title-screen
// Bestiary lists none rather than spoil them. Unencountered enemies are never projected.
function projectLearnedEnemies(registries, learned, { combatExpansionVersion, stanceRules })
{
    return readLearnedDefinitions(registries, learned).map((definition) =>
        projectEnemyKnowledge(
            definition,
            learned[definition.id],
            {
                registries,
                ratingsRules: registries.balance?.combatRatings || null,
                combatExpansionVersion,
                stanceRules,
                weaknesses: [],
            },
        )
    );
}

function buildEnemyEntry(view)
{
    return optionCard({
        name: view.name,
        meta: t('knowledge.progress', {
            label: view.progress.label,
            points: view.progress.points,
            target: view.progress.target,
        }),
        attrs: { dataset: { member: view.id } },
    });
}

function renderEnemyDetail(view)
{
    return [
        titleS(view.name),
        renderEnemyKnowledge(view),
    ];
}

export function mountBestiary(
    app,
    {
        registries,
        meta = {},
        onBack,
        initialEnemyId = null,
        combatExpansionVersion = 2,
        stanceRules = null,
    },
)
{
    const learned = meta.enemyKnowledge?.enemies || {};
    return MountKnowledgeDoor(app, {
        screen: 'bestiary',
        entries: projectLearnedEnemies(registries, learned, {
            combatExpansionVersion,
            stanceRules,
        }),
        selectedId: initialEnemyId,
        buildEntry: buildEnemyEntry,
        renderDetail: renderEnemyDetail,
        onBack,
    });
}
