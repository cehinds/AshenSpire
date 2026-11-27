/**
 * Card faces outside a fight (deck, rewards, shop, upgrade picker) show the price the player would
 * pay under the run's spell cost rules, with no stance; pile faces in a fight follow the fight.
 * Expected prices come from the rule data through the model, never from fixed surcharges.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight, reg as currentReg } from './elementFixture.mjs';
import { createRunState } from '../src/model/state.js';
import {
    FaceCostProfile,
    SetFaceCostCombat,
    SetFaceCostPricer,
    SetFaceCostRun,
} from '../src/model/faceCosts.js';
import { SpellCostAdjust } from '../src/engine/spellCosts.js';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { cardManaCategory } from '../src/model/cardManaPolicy.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { cardPlayCosts, dispatch } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { legacyGearRegistries } from './helpers/legacy-gear.mjs';
import { GearSelectorMatches } from '../src/model/gearEffects.js';
import {
    CardSpellCostExceptions,
    ExpectedSpellPrice,
    LegacySpellCostBlock,
    ShippedSpellCostBlock,
    SpellCostCondition,
    WithSpellCostRules,
} from './helpers/spellCostRules.mjs';

const reg = legacyGearRegistries(currentReg);
const profile = reg.gameProfile;
const completedRunIds = [
    'a',
    'b',
    'c',
];
const meta = { gameProfileUnlocks: { core: { completedRunIds } } };
const shippedBlock = ShippedSpellCostBlock();
const variableCost = 'X';
const spellCategory = 'spell';
const plainHand = 'greatsword';
const focusHands = [
    'boneSceptre',
    'duskChime',
];
const preparedStance = Object.freeze({
    maneuver: 'casting',
    camp: 'spell',
});
const minimumFaceSpellCount = 20;
const victory = 'victory';
const faceInstanceId = 'face-mana';
const spells = profile.content.cards
    .map(card => reg.cards.get(card.id))
    .filter(definition => cardManaCategory(reg, definition) === spellCategory);
// [class, right hand, left hand]
const gearCases = [
    ['reaver', 'ashStaff', null],
    ['starseer', 'greatsword', null],
    ['starseer', 'ashStaff', null],
    ['starseer', 'boneSceptre', 'emberlightSceptre'],
    ['starseer', 'emberlightSceptre', 'boneSceptre'],
    ['starseer', 'boneSceptre', 'blightRod'],
    ['starseer', 'gorefireBrand', 'emberlightSceptre'],
    ['starseer', 'duskChime', null],
    ['starseer', 'duskChime', 'boneSceptre'],
];
// Prepared Mana cuts come only from Initiates: the Starseer robe's Arcane Initiate and Dusk Chime's
// Decay Initiate; at most one applies to a spell.
const initiateManaCut = 1;
const arcaneSelector = 'arcaneSpell';
const schoolSelector = 'schoolSpell';
const chimeWeaponId = 'duskChime';
const chimeSchool = 'decay';
const gearCardIds = [
    'core.meteor',
    'core.cantrip',
];
// A mirrored cantrip takes the successive-Spell cut; Starseer is a Graduate, Reaver is not.
const chainCutCardId = 'core.cantrip';
const graduateClassId = 'starseer';
const graduateManaCut = 1;
const chainManaCut = 1;

SetFaceCostPricer(SpellCostAdjust);

function newRun(hand)
{
    const run = createRunState({
        registries: reg,
        classId: 'starseer',
        seed: 5,
        profileMeta: meta,
    });
    run.loadout.sets.rightHand[0] = hand;
    return run;
}

function printed(definition)
{
    return reg.framework.costProfile(definition);
}

function hasNoException(definition)
{
    return CardSpellCostExceptions(shippedBlock, definition).size === 0;
}

function rulePrice(block, definition, conditions, price = printed(definition))
{
    return ExpectedSpellPrice({
        block,
        conditions,
        exceptions: CardSpellCostExceptions(block, definition),
        price,
    });
}

function plainSpellWith(predicate)
{
    return spells.find(definition =>
        hasNoException(definition)
        && definition.cost !== variableCost
        && predicate(printed(definition))
    );
}

function gearFight(run, cardId)
{
    const combat = createRunCombat({
        registries: currentReg,
        run,
        rng: createRng(5),
        enemyIds: ['wanderingSoldier'],
    });
    combat.player.stamina = combat.player.maxStamina = 40;
    combat.player.mana = combat.player.maxMana = 40;
    combat.piles.hand = [
        {
            instanceId: faceInstanceId,
            cardId,
            upgraded: false,
        },
    ];
    return combat;
}

function preparedManaRules(combat)
{
    const cardRules = combat.player.itemProps.cardRules ?? [];
    return cardRules.filter(row =>
        row.stat === 'manaCost' && row.conds.some(cond => cond.name === 'stance')
    );
}

function initiateCut(classId, wornWeaponIds, definition)
{
    const robeInitiate = classId === graduateClassId
        && GearSelectorMatches(arcaneSelector, null, definition);
    const chimeInitiate = wornWeaponIds.includes(chimeWeaponId)
        && GearSelectorMatches(schoolSelector, chimeSchool, definition);
    return robeInitiate || chimeInitiate
        ? initiateManaCut
        : 0;
}

function expectedPileMana(classId, cardId, definition, initiate)
{
    const printedMana = currentReg.framework.costProfile(definition).mana;
    const graduateCut = classId === graduateClassId && printedMana > 0
        ? graduateManaCut
        : 0;
    const chainCut = cardId === chainCutCardId
        ? chainManaCut
        : 0;
    const spellMana = rulePrice(shippedBlock, definition, [SpellCostCondition.Prepared], {
        stamina: definition.staminaCost,
        mana: printedMana - graduateCut,
    }).mana;
    return Math.max(0, spellMana - initiate - chainCut);
}

function assertResumedPayment(combat, snapshot, counters, paidMana)
{
    const restored = restoreCombatSnapshot({
        registries: currentReg,
        snapshot,
        rng: createRng(5, counters),
        expectedGameProfile: combat.gameProfile,
    });
    const play = context =>
        dispatch(context, {
            type: 'playCard',
            cardInstanceId: faceInstanceId,
            targetId: context.enemies[0].id,
        });
    const live = play(combat);
    const resumed = play(restored);
    assert.deepEqual(live, resumed);
    assert.equal(live.events.find(event => event.type === 'cardPlayed').manaSpent, paidMana);
}

function assertGearFaces(cardId, [classId, right, left])
{
    const label = `${classId}/${right}/${left}/${cardId}`;
    const run = createRunState({ registries: currentReg, classId, seed: 5, profileMeta: meta });
    run.loadout.sets.rightHand[0] = right;
    run.loadout.sets.leftHand[0] = left;
    const definition = currentReg.cards.get(cardId);
    SetFaceCostRun(run);
    const deck = playingCardModel(currentReg, { cardId }, { rules: run }).costs;
    const faceMana = rulePrice(shippedBlock, definition, []).mana;
    assert.equal(deck.mana, faceMana, `${label}: the deck shows no Prepared gear discounts`);
    const combat = gearFight(run, cardId);
    SetFaceCostCombat(combat);
    const idle = playingCardModel(currentReg, { cardId }, { rules: combat }).costs;
    assert.equal(idle.mana, deck.mana, `${label}: the initial pile and deck agree`);
    combat.player.combatStance = { maneuver: 'prepared', camp: 'spell' };
    const snapshot = serializeCombatSnapshot(combat);
    const counters = combat.rng.getCounters();
    const quote = cardPlayCosts(combat, faceInstanceId);
    const pile = playingCardModel(currentReg, { cardId }, { rules: combat }).costs;
    const projected = resolveCombatCard(combat, combat.piles.hand[0]);
    assert.equal(FaceCostProfile(currentReg, projected).mana, quote.mana, `${label}: priced once`);
    assert.equal(pile.mana, quote.mana, `${label}: Prepared pile equals the live quote`);
    const wornWeaponIds = [right, left].filter(Boolean);
    const preparedRules = preparedManaRules(combat);
    const weaponCuts = preparedRules.filter(row => wornWeaponIds.includes(row.source));
    const chimeCuts = wornWeaponIds.includes(chimeWeaponId)
        ? 1
        : 0;
    assert.equal(weaponCuts.length, chimeCuts, `${label}: only Dusk Chime cuts Prepared Mana`);
    assert.ok(
        preparedRules.every(row => row.initiate),
        `${label}: every Prepared cut is an Initiate`,
    );
    const initiate = initiateCut(classId, wornWeaponIds, definition);
    const pileMana = expectedPileMana(classId, cardId, definition, initiate);
    assert.equal(pile.mana, pileMana, `${label}: Prepared, one Initiate cut`);
    assert.deepEqual(serializeCombatSnapshot(combat), snapshot, `${label}: faces are pure`);
    assertResumedPayment(combat, snapshot, counters, pile.mana);
}

test('a face outside a fight shows the rules price with no stance; others are printed', () =>
{
    const run = newRun(plainHand);
    assert.ok(spells.length > minimumFaceSpellCount);
    for (const definition of spells)
    {
        const face = FaceCostProfile(reg, definition, run);
        const expected = rulePrice(shippedBlock, definition, []);
        assert.equal(face.mana, expected.mana, definition.id);
        if (definition.cost !== variableCost)
        {
            assert.equal(face.stamina, expected.stamina, definition.id);
        }
    }
    const smash = reg.cards.get('base.smash');
    assert.deepEqual(FaceCostProfile(reg, smash, run), printed(smash));
});

test('a Focus item prices the face by the Focus rule; Prepared never applies outside', () =>
{
    const plain = newRun(plainHand);
    const definition = plainSpellWith(price => price.mana > 0);
    const focusFace = rulePrice(shippedBlock, definition, [SpellCostCondition.LegacyFocusHeld]);
    for (const hand of focusHands)
    {
        assert.equal(FaceCostProfile(reg, definition, newRun(hand)).mana, focusFace.mana, hand);
    }
    const noStance = rulePrice(shippedBlock, definition, []);
    assert.equal(FaceCostProfile(reg, definition, plain).stamina, noStance.stamina, 'no Prepared');
    const carriedBlocks = {
        'Stamina surcharge on': WithSpellCostRules(shippedBlock, {
            staminaSurcharge: { enabled: true },
        }),
        'saved version 1': LegacySpellCostBlock(),
    };
    for (const [name, block] of Object.entries(carriedBlocks))
    {
        const saved = newRun(plainHand);
        saved.fixCoreRules = {
            ...shipped,
            spellCosts: block,
        };
        const face = FaceCostProfile(reg, definition, saved);
        const expected = rulePrice(block, definition, []);
        assert.deepEqual([face.stamina, face.mana], [expected.stamina, expected.mana], name);
    }
});

test('a run made before the rules keeps printed costs; the registered run is the one read', () =>
{
    const old = newRun(plainHand);
    const { spellCosts, elementFlux, ...saved } = shipped;
    old.fixCoreRules = saved;
    const definition = spells.find(spell => printed(spell).mana > 0);
    assert.deepEqual(FaceCostProfile(reg, definition, old), printed(definition));
    assert.deepEqual(FaceCostProfile(reg, definition, null), printed(definition), 'no run');
    const focusFace = rulePrice(shippedBlock, definition, [SpellCostCondition.LegacyFocusHeld]);
    SetFaceCostRun(newRun(focusHands[0]));
    assert.equal(FaceCostProfile(reg, definition).mana, focusFace.mana, 'the registered run');
    SetFaceCostRun(null);
    assert.deepEqual(FaceCostProfile(reg, definition), printed(definition));
});

test('in a fight the pile faces are priced by the fight, Prepared included, as paid', () =>
{
    const multiple = plainSpellWith(price => price.stamina > 1);
    const single = plainSpellWith(price => price.stamina === 1);
    const prepared = [SpellCostCondition.Prepared];
    const { combat } = fight({ registries: reg });
    combat.loadout.sets.rightHand[0] = plainHand;
    try
    {
        SetFaceCostCombat(combat);
        const noStance = rulePrice(shippedBlock, multiple, []).stamina;
        assert.equal(FaceCostProfile(reg, multiple).stamina, noStance, 'no stance');
        combat.player.combatStance = { ...preparedStance };
        for (const definition of [multiple, single])
        {
            const expected = rulePrice(shippedBlock, definition, prepared).stamina;
            assert.equal(FaceCostProfile(reg, definition).stamina, expected, definition.id);
        }
        combat.fixCoreRules.spellCosts = LegacySpellCostBlock();
        const savedPrice = rulePrice(combat.fixCoreRules.spellCosts, multiple, prepared).stamina;
        assert.equal(FaceCostProfile(reg, multiple).stamina, savedPrice, 'a saved version 1 fight');
        combat.result = victory;
        const over = FaceCostProfile(reg, multiple, null).stamina;
        assert.equal(over, printed(multiple).stamina, 'a finished fight no longer prices faces');
    }
    finally
    {
        SetFaceCostCombat(null);
    }
});

test('deck and pile Mana faces share gear pricing with quotes, payments and resumes', () =>
{
    for (const cardId of gearCardIds)
    {
        for (const gearCase of gearCases)
        {
            try
            {
                assertGearFaces(cardId, gearCase);
            }
            finally
            {
                SetFaceCostCombat(null);
                SetFaceCostRun(null);
            }
        }
    }
});
