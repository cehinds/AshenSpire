import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplyGearCardRules } from '../src/model/gearEffects.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { stanceOf } from '../src/model/stanceRules.js';
import { core2Registries } from './helpers/core2.mjs';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { cardPlayCosts, dispatch } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import {
    CardSpellCostExceptions,
    ExpectedSpellPrice,
    SpellCostCondition,
} from './helpers/spellCostRules.mjs';

const spell = {
    id: 'qa.reach-spell',
    type: 'attack',
    cost: 1,
    staminaCost: 1,
    manaCost: 1,
    tags: [
        'camp:spell',
        'source:spell',
        'maneuver:casting',
        'school:force',
        'range:reach',
        'targeting:single',
        'counter:spell',
        'trait:reaction',
    ],
    effects: [{ op: 'damage', target: 'enemy', amount: 9 }],
    keywords: [],
};
const bonus = [{
    selector: 'spell',
    arg: null,
    conds: [],
    stat: 'damage',
    mode: 'add',
    amount: 1,
    source: 'qa-focus',
}];

test('a gear projection materializing a tagged range keeps the complete spell identity', () =>
{
    const before = structuredClone(spell);
    const projected = ApplyGearCardRules(bonus, spell);
    assert.deepEqual(projected.combatProfile, combatProfileFor(spell));
    assert.deepEqual(stanceOf(projected), {
        maneuver: 'casting',
        camp: 'spell',
        range: 'reach',
        school: 'force',
    });
    assert.deepEqual(projected.combatProfile.traits, ['reaction']);
    assert.equal(projected.combatProfile.counterMode, 'spell');
    assert.equal(projected.effects[0].amount, 10);
    assert.deepEqual(
        spell,
        before,
        'identity inference and the gear bonus never mutate the source',
    );
});

for (
    const overrides of [
        { school: 'frost', counterCoverage: { camps: ['spell'] }, counterPayload: { ward: 2 } },
        {
            camp: 'physical',
            maneuver: 'counter',
            school: 'earth',
            targeting: 'area',
            traits: ['impact'],
            counterMode: 'melee',
            range: 'melee',
        },
    ]
)
{
    test(`an authored ${overrides.camp ? 'full' : 'partial'} combat profile overrides inferred identity while the projected range wins`, () =>
    {
        const authored = { ...structuredClone(spell), combatProfile: structuredClone(overrides) };
        const before = structuredClone(authored);
        const projected = ApplyGearCardRules(bonus, authored);
        assert.deepEqual(projected.combatProfile, {
            ...combatProfileFor(authored),
            ...overrides,
            range: 'reach',
        });
        assert.deepEqual(authored, before);
    });
}

const registries = core2Registries();
const preparedCardIds = [
    'core.meteor',
    'custom.copy_mwx6hh79',
];
// [right hand, Focus Mana cut in Prepared]
const preparedHands = [
    ['greatsword', 0],
    ['ashStaff', 1],
];
// Worked gear and class cuts in Prepared: the Graduate takes one positive printed MP, the robe one.
const graduateManaCut = 1;
const robeManaCut = 1;
const quoteInstanceId = 'range-identity';
const deepPool = 20;

function preparedFight(cardId, hand)
{
    const run = createRunState({
        registries,
        classId: 'starseer',
        seed: 29,
        profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['one'] } } },
    });
    run.loadout.sets.rightHand[0] = hand;
    run.loadout.sets.leftHand[0] = null;
    const combat = createRunCombat({
        registries,
        run,
        rng: createRng(29),
        enemyIds: ['wanderingSoldier'],
    });
    combat.player.stamina = combat.player.maxStamina = deepPool;
    combat.player.mana = combat.player.maxMana = deepPool;
    combat.player.combatStance = { maneuver: 'prepared', camp: 'spell' };
    combat.piles.hand = [{ cardId, instanceId: quoteInstanceId }];
    return combat;
}

function expectedPreparedQuote(combat, authored, focusCut)
{
    const block = combat.fixCoreRules.spellCosts;
    const graduateCut = authored.manaCost > 0
        ? graduateManaCut
        : 0;
    const spellPrice = ExpectedSpellPrice({
        block,
        conditions: [SpellCostCondition.Prepared],
        exceptions: CardSpellCostExceptions(block, authored),
        price: {
            stamina: authored.staminaCost,
            mana: authored.manaCost - graduateCut,
        },
    });
    return {
        energy: spellPrice.stamina,
        stamina: spellPrice.stamina,
        mana: Math.max(0, spellPrice.mana - robeManaCut - focusCut),
    };
}

for (const cardId of preparedCardIds)
{
    test(`${cardId}: Prepared keeps the spell identity and pays rule, Graduate, gear cuts`, () =>
    {
        for (const [hand, focusCut] of preparedHands)
        {
            const combat = preparedFight(cardId, hand);
            const authored = combat.gameProfile.content.cards.find(card => card.id === cardId);
            const resolved = resolveCombatCard(combat, combat.piles.hand[0]);
            assert.equal(stanceOf(resolved).camp, 'spell');
            assert.equal(stanceOf(resolved).school, combatProfileFor(authored).school);
            const expected = expectedPreparedQuote(combat, authored, focusCut);
            const quote = cardPlayCosts(combat, quoteInstanceId);
            assert.deepEqual(quote, expected, `${cardId}/${hand}: rules, Graduate, robe, Focus`);
            const played = dispatch(combat, {
                type: 'playCard',
                cardInstanceId: quoteInstanceId,
                targetId: combat.enemies[0].id,
            });
            const paid = played.events.find(event => event.type === 'cardPlayed');
            assert.equal(paid.manaSpent, expected.mana);
        }
    });
}
