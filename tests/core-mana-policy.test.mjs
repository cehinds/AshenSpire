import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCard } from '../src/model/registries.js';
import { core2Registries } from './helpers/core2.mjs';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, cardPlayCosts, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { beginGameProfileRest, commitGameProfileRest } from '../src/model/gameProfileRest.js';
import { buildActMap } from '../src/engine/actmap.js';
import { getStacks } from '../src/engine/statuses.js';
import { pinLegacyRests } from './helpers/legacy-core-rests.mjs';
import { withGameProfileService } from '../src/model/gameProfileRun.js';
import { applyLevelUp, rederivePools } from '../src/model/levelup.js';
import { legacyGearRegistries } from './helpers/legacy-gear.mjs';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { GearSelectorMatches } from '../src/model/gearEffects.js';
import {
    CardSpellCostExceptions,
    ExpectedSpellPrice,
    LegacySpellCostBlock,
    ShippedSpellCostBlock,
    SpellCostCondition,
} from './helpers/spellCostRules.mjs';
const registries = core2Registries();
function fresh(classId = 'reaver', reg = registries)
{
    return createRunState({
        seed: 73,
        classId,
        registries: reg,
        runId: 'mana-policy-test',
        profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['one'] } } },
    });
}
function fight(cardId, classId = 'reaver', reg = registries)
{
    const run = fresh(classId, reg);
    // A caster's staff is a Focus armament (-1 MP, tests/focus-mana-discount.test.mjs); these tests price the printed Mana.
    run.loadout.sets.rightHand[0] = 'greatsword';
    run.loadout.sets.leftHand[0] = null;
    const combat = createRunCombat({
        registries: reg,
        rng: createRng(3),
        run,
        enemyIds: ['wanderingSoldier'],
        settings: {},
    });
    const card = { instanceId: 'mana-test-card', cardId, upgraded: false };
    combat.piles.hand = [card];
    combat.enemies[0].hp = combat.enemies[0].maxHp = 1000;
    return { combat, card };
}

const spellCostModes = {
    current: () => ShippedSpellCostBlock(),
    none: () => null,
    saved: () => LegacySpellCostBlock(),
};
const robeFocusCases = [
    ['core.cometLance', 'current'],
    ['core.meteor', 'current'],
    ['core.cantrip', 'current'],
    ['core.meteor', 'none'],
    ['core.cometLance', 'saved'],
    ['core.meteor', 'saved'],
    ['core.cantrip', 'saved'],
];
// [right hand, stance maneuver]
const robeFocusContexts = [
    ['greatsword', null],
    ['ashStaff', null],
    ['boneSceptre', null],
    ['greatsword', 'casting'],
    ['ashStaff', 'casting'],
    ['ashStaff', 'prepared'],
    ['boneSceptre', 'casting'],
];
// Worked class and gear cuts in Prepared: the Graduate takes one positive printed MP, and the
// Starseer robe's Arcane Initiate one more off an Arcane spell. Weapons carry no type-level cut.
const graduateManaCut = 1;
const arcaneInitiateCut = 1;
const arcaneSelector = 'arcaneSpell';
const quoteInstanceId = 'robe-focus';

function setSpellCostBlock(combat, block)
{
    if (block === null)
    {
        delete combat.fixCoreRules.spellCosts;
        return;
    }
    combat.fixCoreRules.spellCosts = block;
}

function expectedRobeFocusPrice(authored, block, stance)
{
    const prepared = stance !== null;
    const graduateCut = prepared && authored.manaCost > 0
        ? graduateManaCut
        : 0;
    const printed = {
        stamina: authored.staminaCost,
        mana: authored.manaCost - graduateCut,
    };
    const conditions = prepared
        ? [SpellCostCondition.Prepared]
        : [];
    const spellPrice = block === null
        ? printed
        : ExpectedSpellPrice({
            block,
            conditions,
            exceptions: CardSpellCostExceptions(block, authored),
            price: printed,
        });
    const arcane = GearSelectorMatches(arcaneSelector, null, registries.cards.get(authored.id));
    const gearCut = prepared && arcane
        ? arcaneInitiateCut
        : 0;
    return [
        spellPrice.stamina,
        Math.max(0, spellPrice.mana - gearCut),
    ];
}

function robeFocusFight(cardId, block, hand, stance)
{
    const run = fresh('starseer');
    // Two earned Wisdom points keep the highest quoted cost payable.
    run.level.unspentPoints = 2;
    withGameProfileService(run, 'levelUp', () =>
    {
        applyLevelUp(registries, run, 'wisdom');
        applyLevelUp(registries, run, 'wisdom');
    });
    run.loadout.sets.rightHand[0] = hand;
    run.loadout.sets.leftHand[0] = null;
    const combat = createRunCombat({
        registries,
        run,
        rng: createRng(3),
        enemyIds: ['wanderingSoldier'],
    });
    setSpellCostBlock(combat, block);
    combat.piles.hand = [
        {
            instanceId: quoteInstanceId,
            cardId,
            upgraded: false,
        },
    ];
    combat.enemies[0].hp = combat.enemies[0].maxHp = 1000;
    combat.enemies[0].persistentPoise = { value: 100, max: 100 };
    if (stance)
    {
        combat.player.combatStance = { maneuver: stance, camp: 'spell' };
    }
    return combat;
}

function playQuoteCard(combat)
{
    return dispatch(combat, {
        type: 'playCard',
        cardInstanceId: quoteInstanceId,
        targetId: combat.enemies[0].id,
    });
}

function assertQuotePayResume(combat, expected, label)
{
    const before = serializeCombatSnapshot(combat);
    const counters = combat.rng.getCounters();
    const costs = cardPlayCosts(combat, quoteInstanceId);
    const preview = previewCard(combat, quoteInstanceId, combat.enemies[0].id);
    assert.deepEqual([costs.stamina, costs.mana], expected, label);
    assert.deepEqual([preview.staminaCost, preview.manaCost], expected, label);
    assert.deepEqual(serializeCombatSnapshot(combat), before, 'quotes do not mutate combat');
    assert.deepEqual(combat.rng.getCounters(), counters, 'quotes consume no RNG');
    const restored = restoreCombatSnapshot({
        registries,
        snapshot: before,
        rng: createRng(combat.rng.seed, counters),
        expectedGameProfile: combat.gameProfile,
    });
    const actual = playQuoteCard(combat);
    const resumed = playQuoteCard(restored);
    const paid = actual.events.find(event =>
        event.type === 'cardPlayed' && event.cardInstanceId === quoteInstanceId
    );
    assert.deepEqual([paid.staminaSpent, paid.manaSpent], expected, label);
    assert.deepEqual(actual, resumed, 'restored payment and events match');
    assert.deepEqual(serializeCombatSnapshot(combat), serializeCombatSnapshot(restored));
}

// Current Core Mana starts at 1 + Wisdom, independent of Intelligence.
test('core Reaver Mana grows by one with each earned Wisdom, independent of Intelligence', () =>
{
    // Level Up is no longer a shipped rest service; a run pinned to the pre-one-pick rests keeps it.
    const run = pinLegacyRests(fresh());
    assert.equal(run.maxMana, 2);
    assert.equal(run.mana, 2);
    assert.equal(run.attributes.wisdom, 1);
    run.attributes.intelligence = 7;
    run.attributes.wisdom = 3;
    rederivePools(registries, run, 'test');
    assert.equal(run.maxMana, 4, 'Mana is 1 + WIS 3 despite the higher Intelligence');
    run.mapGraph = buildActMap(registries, createRng(73), run.seatOrder[0], 1);
    run.mapNodeId = Object.values(run.mapGraph.nodes).find(n => n.type === 'shrine').id; // the first rest of act 1 (a branch may open narrow)
    beginGameProfileRest(run, '1:' + run.mapNodeId);
    run.level.unspentPoints = 1;
    commitGameProfileRest(registries, run, 'levelUp', { attributeId: 'wisdom' });
    assert.equal(run.maxMana, 5);
    assert.equal(run.mana, 5);
});

// Owner ruling 2026-11-21 (starter budget): Sundering Art is Unranked, so it prints 32 (was 3x Smash = 36).
test('core Smash deals 2/3 of 2x Strike and breaks that Block; Sundering Art is a 2 SP + 1 MP Smash', () =>
{
    const strike = resolveCard(registries, { cardId: 'core.strike' });
    const smash = resolveCard(registries, { cardId: 'core.smash' });
    const art = resolveCard(registries, { cardId: 'core.reaverSpecial' });
    assert.deepEqual([strike.effects[0].amount, strike.staminaCost, strike.manaCost], [6, 1, 0]);
    const smashHit = smash.effects[0];
    const artHit = art.effects[0];
    assert.deepEqual([smashHit.amount, smashHit.breakBlock, smash.staminaCost, smash.manaCost], [8, 8, 2, 0]);
    assert.deepEqual([artHit.amount, artHit.breakBlock, art.staminaCost, art.manaCost], [24, 24, 2, 1]);
    assert.ok(smash.tags.includes('maneuver:smash') && art.tags.includes('maneuver:smash'));
});

test('Sundering Art preview, affordability and actual combat payment use the same 2 SP and 1 MP', () =>
{
    const { combat, card } = fight('core.reaverSpecial');
    assert.deepEqual(cardPlayCosts(combat, card.instanceId), { energy: 2, stamina: 2, mana: 1 });
    combat.player.mana = 0;
    const before = combat.player.stamina;
    assert.throws(
        () =>
            dispatch(combat, {
                type: 'playCard',
                cardInstanceId: card.instanceId,
                targetId: combat.enemies[0].id,
            }),
        /mana/i,
    );
    assert.equal(combat.player.stamina, before, 'refused play pays nothing');
    combat.player.mana = 1;
    dispatch(combat, {
        type: 'playCard',
        cardInstanceId: card.instanceId,
        targetId: combat.enemies[0].id,
    });
    assert.equal(combat.player.mana, 0);
    assert.equal(combat.player.stamina, before - 2);
    assert.ok(
        combat.eventLog.some(event =>
            event.type === 'cardPlayed' && event.cardInstanceId === card.instanceId
        ),
    );
});

// Star Spark is Unranked, so it applies no Vulnerable; its Mana follows the spell cost rules.
test('Star Spark pays the Mana the spell cost rules give and applies no Vulnerable', () =>
{
    // This fixture predates armour-type discounts; current robe/Focus integration is exercised below.
    const { combat, card } = fight(
        'core.starseerSpecial',
        'starseer',
        legacyGearRegistries(registries),
    );
    combat.player.maxMana = Math.max(combat.player.maxMana, 2);
    combat.player.mana = 2;
    // Magic spends Poise 1:1 (owner, 2026-10-31), so the spell would empty the soldier's Poise 5 and the break's Staggered adds a third Vulnerable.
    // A deep pool keeps this test about the card's own two stacks.
    combat.enemies[0].persistentPoise = { value: 100, max: 100 };
    const block = combat.fixCoreRules.spellCosts;
    const authored = registries.gameProfile.content.cards.find(row => row.id === card.cardId);
    const expected = ExpectedSpellPrice({
        block,
        exceptions: CardSpellCostExceptions(block, authored),
        price: {
            stamina: authored.staminaCost,
            mana: authored.manaCost,
        },
    });
    const before = combat.player.mana;
    dispatch(combat, {
        type: 'playCard',
        cardInstanceId: card.instanceId,
        targetId: combat.enemies[0].id,
    });
    assert.equal(before - combat.player.mana, expected.mana, 'the rules price the paid Mana');
    assert.equal(getStacks(combat.enemies[0], 'vulnerable'), 0);
    assert.equal(registries.statuses.get('vulnerable').modifiers.damageTakenMult, 1.25);
    assert.equal(registries.statuses.get('vulnerable').decay, 'perTurnEnd');
});

test('robes, Focus and Prepared: spell quote, payment and restored snapshot agree', () =>
{
    for (const [cardId, mode] of robeFocusCases)
    {
        const authored = registries.gameProfile.content.cards.find(card => card.id === cardId);
        for (const [hand, stance] of robeFocusContexts)
        {
            const label = `${cardId}/${hand}/${stance}/spellCosts=${mode}`;
            const block = spellCostModes[mode]();
            const combat = robeFocusFight(cardId, block, hand, stance);
            assert.equal(combat.gameProfile.modules.gear.typeEffectsVersion, 1, 'current gear');
            assert.equal(combat.player.maxMana, 4, 'two earned Wisdom points make 4 MP payable');
            assert.equal(getStacks(combat.player, 'ward'), 0, 'no automatic turn-start Ward');
            const expected = expectedRobeFocusPrice(authored, block, stance);
            assertQuotePayResume(combat, expected, label);
        }
    }
});
