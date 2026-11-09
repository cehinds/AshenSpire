import { drawSeatOrder } from '../engine/actmap.js';
import { createRng, seedToString } from '../engine/rng.js';
import { dealtAttackSlotCount, isPoolDeckMode, POOL_DECK_RULE } from '../model/cardRemoval.js';
import { cancelDeckEdit } from '../model/deckRules.js';
import { isConfiguredRun } from '../model/gameProfileRun.js';
import { createDeck, createIdGen, createRunState } from '../model/state.js';

/** Builds a complete run and RNG before the host adopts either. */
export function CreatePreparedRun({
    seed,
    registries,
    gameProfile,
    profileMeta,
    configSnapshot,
    combatExpansionVersion,
    enemyKnowledgeVersion,
    reactionRulesVersion,
    classId,
    customization,
    custom,
    startingKitId,
    startingHands,
    startingArmourId,
    startingRelicId,
    startingAbilityIds,
    attributeMode,
    attributes,
    deckEdit,
    quickStart,
})
{
    const run = createRunState({
        seed,
        classId,
        registries,
        startingKitId,
        startingHands,
        startingArmourId,
        startingRelicId,
        startingAbilityIds,
        attributeMode,
        attributes,
        gameProfile,
        profileMeta,
        combatExpansionVersion,
        enemyKnowledgeVersion,
        reactionRulesVersion,
    });
    if (deckEdit && isConfiguredRun(run))
    {
        cancelDeckEdit(run, deckEdit);
    }
    run.advancedConfigSnapshot = configSnapshot;
    run.seedString = seedToString(seed);
    run.beginChoices = structuredClone({
        classId,
        customization,
        custom,
        startingKitId,
        startingHands,
        startingArmourId,
        startingRelicId,
        startingAbilityIds,
        attributeMode,
        attributes,
        ...(deckEdit ? { deckEdit } : {}),
    });
    run.customization = customization || { name: 'Forsaken', glyph: 'sword', tint: 'gold' };
    run.custom = custom || { ascension: 0, mods: {}, deckMode: 'standard' };
    if (quickStart)
    {
        run.quickStart = true;
    }
    run.stats = { fightsWon: 0, damageDealt: 0, damageTaken: 0 };
    run.path = [];
    run.seenEvents = [];
    run.lastEncounters = [];
    const rng = createRng(seed);
    // A pinned first seat rotates the same draw, leaving every stream counter intact.
    run.seatOrder = drawSeatOrder(registries, rng, { firstSeat: run.custom.firstSeat || null });

    const deckMode = run.custom.deckMode || 'standard';
    if (deckMode === 'sealed')
    {
        run.deck = createDeck(sealedDeckIds(registries, rng, classId), createIdGen('rc'));
    }
    else if (deckMode === 'draft')
    {
        run.deck = createDeck(draftBaseIds(), createIdGen('rc'));
    }
    if (isPoolDeckMode(run))
    {
        run.equipmentAttackSlotCount = dealtAttackSlotCount(run.deck);
        run.poolDeckRule = POOL_DECK_RULE;
    }
    return { run, rng };
}

function sealedDeckIds(registries, rng, classId)
{
    const pool = registries.classes.get(classId).cardPool.slice();
    const ids = draftBaseIds();
    for (let i = 0; i < 3 && pool.length; i++)
    {
        const id = rng.pick('misc', pool);
        pool.splice(pool.indexOf(id), 1);
        ids.push(id);
    }
    return ids;
}

function draftBaseIds()
{
    return ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend'];
}
