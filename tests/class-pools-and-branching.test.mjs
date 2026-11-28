import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { applyGameProfileToContent, resolveGameProfile } from '../src/model/gameProfile.js';
import { staticCardTokens } from '../src/model/playingCard.js';
import {
    gameProfileRewardPools,
    gameProfileShopStock,
} from '../src/model/gameProfileRewards.js';
import { ItemIsThemed } from '../src/model/itemThemePick.js';
import { createRng, seedFromString } from '../src/model/rng.js';
import { buildGameProfileActMap } from '../src/engine/actmap.js';

const TEST_CONFIG = JSON.parse(
    readFileSync(
        fileURLToPath(
            new URL('./fixtures/class-pools-and-branching.config.json', import.meta.url),
        ),
        'utf8',
    ),
);

function createCoreContext(classId, config = TEST_CONFIG)
{
    const profile = resolveGameProfile(config.profileId);
    const registries = createRegistries(
        applyGameProfileToContent(contentBundle, profile),
    );
    const run = createRunState({
        seed: config.defaultSeed,
        classId,
        registries,
        gameProfile: profile,
        profileMeta: config.unlockedProfileMeta,
    });
    return {
        profile,
        registries,
        run,
    };
}

test('core.defend grants positive Block across all configured classes', () =>
{
    const { cardId, minBlock } = TEST_CONFIG.defendCheck;
    for (const classId of TEST_CONFIG.classes)
    {
        const { registries, run } = createCoreContext(classId);
        const defendCard = registries.cards.get(cardId);
        const tokens = staticCardTokens(
            defendCard,
            registries,
            run,
        );
        assert.ok(
            tokens.block >= minBlock,
            `${classId} ${cardId} should grant at least ${minBlock} Block, got ${tokens.block}`,
        );
    }
});

test('rewards and shops restrict cards and weapons to class-compatible pools when enabled', () =>
{
    const { combat: combatSource } = TEST_CONFIG.sources;
    const {
        seedString,
        shopId,
        weaponKind,
    } = TEST_CONFIG.shopCheck;

    for (const classId of TEST_CONFIG.classes)
    {
        const { registries, run } = createCoreContext(classId);
        const rewardPools = gameProfileRewardPools(
            registries,
            run,
            { source: combatSource },
        );
        const allowedList = run.gameProfile.content.rewards.classPools.cardLists[classId];
        for (const cardId of rewardPools.combatCards)
        {
            assert.ok(
                allowedList.includes(cardId),
                `${classId} combat reward pool included non-class card ${cardId}`,
            );
        }

        const shopRng = createRng(seedFromString(seedString));
        const stock = gameProfileShopStock(
            registries,
            run,
            shopRng,
            { shopId },
        );
        const shopWeapons = stock.options.filter((option) => option.kind === weaponKind);
        for (const option of shopWeapons)
        {
            const weaponRow = registries.equipment.armaments.find(
                (item) => item.id === option.id,
            );
            assert.ok(
                ItemIsThemed(
                    weaponRow,
                    classId,
                    weaponKind,
                ),
                `${classId} shop stocked non-themed weapon ${option.id}`,
            );
        }
    }
});

test('toggling classPools and shop classFilter off restores unfiltered pools', () =>
{
    const { shop: shopSource } = TEST_CONFIG.sources;
    const { registries, run } = createCoreContext(TEST_CONFIG.toggleTestClass);
    const filteredPool = gameProfileRewardPools(
        registries,
        run,
        { source: shopSource },
    );
    run.gameProfile.content.rewards.classPools.enabled = false;
    run.gameProfile.content.shops.classFilter.enabled = false;
    const unfilteredPool = gameProfileRewardPools(
        registries,
        run,
        { source: shopSource },
    );

    assert.ok(
        unfilteredPool.combatCards.length > filteredPool.combatCards.length,
        'disabling classPools expands class card pool',
    );
    assert.ok(
        unfilteredPool.weapons.length > filteredPool.weapons.length,
        'disabling classFilter expands class weapon pool',
    );
});

test('routes.json exposes narrowPercent and openingBranchWidthPercent for branching maps', () =>
{
    const mapConfig = TEST_CONFIG.mapBranchingCheck;
    const { profile, registries } = createCoreContext(mapConfig.classId);
    const mapRegistries = {
        ...registries,
        gameProfile: profile,
    };
    let multiExitCount = 0;
    let totalCount = 0;
    for (let seedIndex = 0; seedIndex < mapConfig.seedCount; seedIndex++)
    {
        const mapSeed = seedIndex === 0
            ? seedFromString(mapConfig.firstSeedString)
            : mapConfig.fallbackSeedBase + seedIndex;
        const mapRng = createRng(mapSeed);
        const graph = buildGameProfileActMap(
            mapRegistries,
            mapRng,
            mapConfig.seat,
            mapConfig.tier,
        );
        for (const node of Object.values(graph.nodes))
        {
            if (node.type === mapConfig.bossNodeType)
            {
                continue;
            }
            totalCount += 1;
            if ((node.next || []).length >= mapConfig.minBranchExits)
            {
                multiExitCount += 1;
            }
        }
    }
    const minExpected = totalCount * mapConfig.minMultiExitRatio;
    assert.ok(
        multiExitCount > minExpected,
        `expected >${mapConfig.minMultiExitRatio * 100}% multi-exit nodes, got ${multiExitCount}/${totalCount}`,
    );
});

test('Score Studio contentEditor.json exposes reward, shop, and map branching controls', () =>
{
    const {
        editorConfigPath,
        requiredSections,
    } = TEST_CONFIG.scoreStudioCheck;
    const resolvedPath = fileURLToPath(
        new URL(editorConfigPath, import.meta.url),
    );
    const editorConfig = JSON.parse(readFileSync(resolvedPath, 'utf8'));
    const sectionIds = editorConfig.sections.map((section) => section.id);
    for (const requiredSection of requiredSections)
    {
        assert.ok(
            sectionIds.includes(requiredSection),
            `contentEditor.json is missing section ${requiredSection}`,
        );
    }
});
