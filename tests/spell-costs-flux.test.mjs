/**
 * Spell cost rules (model/spellCostRules.js, engine/spellCosts.js) and the elemental flux
 * (engine/elementFlux.js). Spell prices are checked against the rule data through the model, so a
 * change of numbers or toggles in fixCoreMechanics.json `spellCosts` needs no test edit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { validateFixCoreRules } from '../src/model/fixCoreMechanics.js';
import {
    ActiveSpellCostRules,
    ApplySpellCostRules,
    NormalizeSpellCostRules,
    SpellCostResource,
    ValidateSpellCostRules,
} from '../src/model/spellCostRules.js';
import { cardManaCategory } from '../src/model/cardManaPolicy.js';
import {
    cardNeedsEnemyTargetNow,
    cardPlayCosts,
    dispatch,
    previewCard,
} from '../src/engine/combat.js';
import { candidateState } from '../src/engine/combatRules.js';
import { PlayConditionMet } from '../src/engine/cardBehavior.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import {
    ElementFluxRules,
    FluxElement,
    FluxMultiplier,
    FluxScale,
} from '../src/engine/elementFlux.js';
import { FluxTip, PlayerFluxView } from '../src/ui/models/StanceBenefitModel.js';
import { fight, profile, reg } from './elementFixture.mjs';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { legacyGearRegistries } from './helpers/legacy-gear.mjs';
import {
    CardSpellCostExceptions,
    ExpectedSpellPrice,
    LegacySpellCostBlock,
    ShippedSpellCostBlock,
    SpellCostCondition,
    WithSpellCostRules,
} from './helpers/spellCostRules.mjs';

const ruleCases = JSON.parse(
    readFileSync(new URL('./fixtures/spell-cost-rule-cases.json', import.meta.url), 'utf8'),
);
const printedCostRegistries = legacyGearRegistries(reg);
const legacyFocusManaDiscount = printedCostRegistries.balance.mana.focusManaDiscount;
const spellCategory = 'spell';
const variableCost = 'X';
const cardPlayedEvent = 'cardPlayed';
const plainHand = 'greatsword';
const focusHand = 'boneSceptre';
const preparedStance = Object.freeze({
    maneuver: 'casting',
    camp: 'spell',
});
const preparedManeuvers = [
    'casting',
    'prepared',
];
const deepPool = 30;
const minimumSpellCount = 60;
const parityPriceLimit = 3;
const zeroStaminaSpell = 'core.cometLance';
const freeCantrip = 'core.mendingTouch';
const basicAttack = 'core.strike';
const shippedSpells = profile.content.cards.filter(card =>
    cardManaCategory(reg, reg.cards.get(card.id)) === spellCategory
);
const priceContexts = [
    {
        name: 'base',
        hand: plainHand,
        stance: null,
        conditions: [],
    },
    {
        name: 'Prepared',
        hand: plainHand,
        stance: preparedStance,
        conditions: [SpellCostCondition.Prepared],
    },
    {
        name: 'Focus',
        hand: focusHand,
        stance: null,
        conditions: [SpellCostCondition.LegacyFocusHeld],
    },
    {
        name: 'both',
        hand: focusHand,
        stance: preparedStance,
        conditions: [
            SpellCostCondition.Prepared,
            SpellCostCondition.LegacyFocusHeld,
        ],
    },
];
const ruleBlocks = [
    {
        name: 'shipped',
        block: ShippedSpellCostBlock(),
    },
    {
        name: 'every rule on',
        block: everyRuleEnabled(ShippedSpellCostBlock()),
    },
    {
        name: 'saved version 1',
        block: LegacySpellCostBlock(),
    },
];
const legacyBlockVariants = [
    LegacySpellCostBlock(),
    LegacySpellCostBlock({ staminaSurcharge: 0 }),
    LegacySpellCostBlock({
        manaSurcharge: 0,
        preparedStaminaMinimum: 1,
        preparedManaDiscount: 1,
    }),
    withoutField(LegacySpellCostBlock(), 'manaOnlyTag'),
];
const fightCache = new Map();
const cinderDart = 'core.cinderDart';
const frostNip = 'core.frostNip';
const arcaneSpark = 'core.cantrip';
const fireCarrier = {
    cardId: cinderDart,
    instanceId: 'i1',
    combatProfile: {
        camp: 'spell',
        school: 'fire',
        damageType: 'arcane',
        magicShare: 1,
    },
    tags: ['school:fire'],
    magicShare: 1,
};
const frostCarrier = {
    ...fireCarrier,
    combatProfile: {
        ...fireCarrier.combatProfile,
        school: 'frost',
    },
    tags: ['school:frost'],
};
const selfTargetCards = new Set([
    'core.steadyHands',
    'core.mendingTouch',
]);
const fireElement = 'fire';
const frostElement = 'frost';
const fluxFloorExamples = [
    [10, 12],
    [7, 8],
    [3, 3],
    [20, 25],
];
const fluxScaleExamples = [
    [3, 3],
    [4, 5],
    [5, 6],
    [8, 10],
    [10, 12],
];

function everyRuleEnabled(block)
{
    const patches = Object.fromEntries(block.rules.map(rule => [rule.id, { enabled: true }]));
    return WithSpellCostRules(block, patches);
}

function withoutField(block, field)
{
    const copy = { ...block };
    delete copy[field];
    return copy;
}

function patched(object, patch)
{
    return {
        ...object,
        ...patch,
    };
}

function malformedSpellCostBlocks()
{
    const block = ShippedSpellCostBlock();
    const [firstRule] = block.rules;
    const patchFirst = patch => WithSpellCostRules(block, { [firstRule.id]: patch });
    const patchTags = patch => patched(block, { tags: patched(block.tags, patch) });
    return {
        'unknown version': patched(block, { version: 3 }),
        'not an object': [],
        'unknown block key': patched(block, { extra: 1 }),
        'rules not a list': patched(block, { rules: {} }),
        'no cantrip tag': patched(block, { tags: { manaOnly: block.tags.manaOnly } }),
        'unknown tag key': patchTags({ extra: 'x' }),
        'empty mana-only tag': patchTags({ manaOnly: '' }),
        'duplicate rule ids': patched(block, { rules: [firstRule, firstRule] }),
        'unknown rule key': patchFirst({ extra: 1 }),
        'enabled not boolean': patchFirst({ enabled: 1 }),
        'fractional change': patchFirst({ change: 0.5 }),
        'unknown resource': patchFirst({ resource: 'health' }),
        'unknown condition': patchFirst({ when: 'always' }),
        'negative minimum': patchFirst({ minimum: -1 }),
        'keep flag not boolean': patchFirst({ keepAtOrBelowMinimum: 'yes' }),
        'skip not a list': patchFirst({ skip: 'cantrip' }),
        'unknown skip id': patchFirst({ skip: ['weapon'] }),
        'v1 negative surcharge': LegacySpellCostBlock({ manaSurcharge: -1 }),
        'v1 fractional surcharge': LegacySpellCostBlock({ staminaSurcharge: 0.5 }),
        'v1 unknown key': LegacySpellCostBlock({ extra: 1 }),
        'v1 empty mana-only tag': LegacySpellCostBlock({ manaOnlyTag: '' }),
        'v1 no cantrip tag': withoutField(LegacySpellCostBlock(), 'cantripTag'),
        'v1 negative Prepared minimum': LegacySpellCostBlock({ preparedStaminaMinimum: -1 }),
        'v1 fractional Prepared Mana': LegacySpellCostBlock({ preparedManaDiscount: 0.5 }),
    };
}

function priceGrid()
{
    const values = Array.from({ length: parityPriceLimit + 1 }, (_, value) => value);
    return values.flatMap(stamina => values.map(mana => ({ stamina, mana })));
}

function legacyPreparedStamina(block, stamina, prepared)
{
    const base = Math.max(0, stamina);
    const floor = block.preparedStaminaMinimum ?? 0;
    if (!prepared || base <= floor)
    {
        return base;
    }
    return Math.max(floor, base - block.preparedStaminaDiscount);
}

// The version 1 formula as it shipped before the rule list; frozen as the parity reference.
function legacyFormulaPrice(block, card, conditions, price)
{
    const isVariable = card.cost === variableCost;
    const isManaOnly = !!block.manaOnlyTag && card.tags.includes(block.manaOnlyTag);
    const skipsSurcharge = isVariable || card.tags.includes(block.cantripTag) || isManaOnly;
    const prepared = conditions.includes(SpellCostCondition.Prepared);
    const focus = conditions.includes(SpellCostCondition.LegacyFocusHeld);
    const preparedMana = prepared
        ? block.preparedManaDiscount ?? 0
        : 0;
    const focusMana = focus
        ? block.focusManaDiscount
        : 0;
    const surcharge = skipsSurcharge
        ? 0
        : block.staminaSurcharge;
    const stamina = isVariable
        ? price.stamina
        : legacyPreparedStamina(block, price.stamina + surcharge, prepared);
    const mana = price.mana + block.manaSurcharge - preparedMana - focusMana;
    return {
        stamina,
        mana: Math.max(0, mana),
    };
}

function setSpellCostBlock(combat, block)
{
    if (block === null)
    {
        delete combat.fixCoreRules.spellCosts;
        return;
    }
    combat.fixCoreRules.spellCosts = structuredClone(block);
}

// One fight per hand, stance and block serves every card: pricing never changes the fight.
function pricingFight({ hand, stance, block })
{
    const key = JSON.stringify([
        hand,
        stance,
        block,
    ]);
    if (fightCache.has(key))
    {
        return fightCache.get(key);
    }
    const { combat } = fight({ registries: printedCostRegistries });
    setSpellCostBlock(combat, block);
    combat.loadout.sets.rightHand[0] = hand;
    combat.player.energy = deepPool;
    combat.player.mana = deepPool;
    if (stance)
    {
        combat.player.combatStance = { ...stance };
    }
    fightCache.set(key, combat);
    return combat;
}

function quoteCard(combat, cardId)
{
    const card = combat.piles.hand[0];
    card.cardId = cardId;
    return {
        card,
        costs: cardPlayCosts(combat, card.instanceId),
        preview: previewCard(combat, card.instanceId),
    };
}

function playTarget(combat, card)
{
    return cardNeedsEnemyTargetNow(combat, card.instanceId)
        ? combat.enemies[0]
        : null;
}

// Plays the card on a detached copy of the fight; null when the card cannot be played here.
function paidPrice(combat, card)
{
    const target = playTarget(combat, card);
    if (!PlayConditionMet(combat, resolveCombatCard(combat, card), target ?? combat.enemies[0]))
    {
        return null;
    }
    const candidate = candidateState(combat, { detached: true });
    const result = dispatch(candidate, {
        type: 'playCard',
        cardInstanceId: card.instanceId,
        targetId: target?.id,
    });
    const played = result.events.find(event => event.type === cardPlayedEvent);
    return {
        stamina: played.staminaSpent,
        mana: played.manaSpent,
    };
}

function expectedQuote(spell, context, block)
{
    const beforeFight = pricingFight({
        hand: plainHand,
        stance: context.stance,
        block: null,
    });
    return ExpectedSpellPrice({
        block,
        conditions: context.conditions,
        exceptions: CardSpellCostExceptions(block, spell),
        price: quoteCard(beforeFight, spell.id).costs,
    });
}

function assertSpellPriceAgrees(spell, context, ruleBlock)
{
    const label = `${spell.id} ${context.name} (${ruleBlock.name})`;
    const expected = expectedQuote(spell, context, ruleBlock.block);
    const combat = pricingFight({
        ...context,
        block: ruleBlock.block,
    });
    const { card, costs, preview } = quoteCard(combat, spell.id);
    const quoted = {
        stamina: costs.stamina,
        mana: costs.mana,
    };
    assert.deepEqual(quoted, expected, `${label}: quote follows the rules`);
    assert.equal(costs.energy, costs.stamina, `${label}: Stamina paid is the Action cost`);
    assert.deepEqual([preview.staminaCost, preview.manaCost], [quoted.stamina, quoted.mana], label);
    const paid = paidPrice(combat, card);
    if (paid)
    {
        assert.deepEqual(paid, quoted, `${label}: payment equals the quote`);
    }
}

function assertLegacyParity(block, spell)
{
    const rules = NormalizeSpellCostRules(block);
    const exceptions = CardSpellCostExceptions(rules, spell);
    for (const { conditions } of priceContexts)
    {
        for (const price of priceGrid())
        {
            const label = `${spell.id} ${conditions.join('+')} ${JSON.stringify(price)}`;
            const actual = ExpectedSpellPrice({
                block: rules,
                conditions,
                exceptions,
                price,
            });
            assert.deepEqual(actual, legacyFormulaPrice(block, spell, conditions, price), label);
        }
    }
}

function assertPaysQuote(combat, card, target)
{
    const quote = cardPlayCosts(combat, card.instanceId);
    const before = {
        stamina: combat.player.energy,
        mana: combat.player.mana,
    };
    dispatch(combat, {
        type: 'playCard',
        cardInstanceId: card.instanceId,
        targetId: target?.id,
    });
    assert.equal(before.stamina - combat.player.energy, quote.stamina, `${card.cardId} SP`);
    assert.equal(before.mana - combat.player.mana, quote.mana, `${card.cardId} MP`);
}

// The printed base is doubled because Core halves card base damage (ceil), so flux meets `base`.
function fluxQuote(combat, carrier, base)
{
    return profileDamageReceipt(
        combat,
        combat.player,
        combat.enemies[0],
        base * 2,
        {
            ...carrier,
            skipRatingBonus: true,
        },
        { roll: 0 },
    );
}

function fluxStage(receipt)
{
    return receipt.damageReceipt.hits[0].sources.find(row => row.id === 'element-flux');
}

function previewFaces(combat, card, target)
{
    const view = previewCard(combat, card.instanceId, target);
    const faceOf = op => view.values.find(value => value.op === op);
    return {
        face: faceOf('damage')?.faceValue ?? null,
        blockFace: faceOf('block')?.value ?? null,
        healFace: faceOf('heal')?.value ?? null,
    };
}

function playSequenceCard(combat, enemy, card)
{
    const target = selfTargetCards.has(card.cardId)
        ? undefined
        : enemy.id;
    primeAccuracyRolls(combat);
    const before = {
        hp: enemy.hp,
        block: combat.player.block,
    };
    const faces = previewFaces(combat, card, target);
    dispatch(combat, {
        type: 'playCard',
        cardInstanceId: card.instanceId,
        targetId: target,
    });
    return {
        id: card.cardId,
        ...faces,
        lost: before.hp - enemy.hp,
        block: combat.player.block - before.block,
        flux: combat.player.elementFlux ?? null,
    };
}

function sequence(ids, { legacy = false, attributes = { strength: 2 } } = {})
{
    const { combat, enemy } = fight({ attributes });
    if (legacy)
    {
        delete combat.fixCoreRules.elementFlux;
    }
    combat.player.energy = deepPool;
    combat.player.mana = deepPool;
    const cards = ids.map((cardId, index) => ({
        instanceId: `flux-${index}`,
        cardId,
        upgraded: false,
    }));
    combat.piles.hand.unshift(...cards);
    const rows = cards.map(card => playSequenceCard(combat, enemy, card));
    return { combat, rows };
}

test('rule mechanism cases price as the fixture says', () =>
{
    for (const ruleCase of ruleCases)
    {
        const block = {
            version: 2,
            tags: shipped.spellCosts.tags,
            rules: ruleCase.rules,
        };
        assert.doesNotThrow(() => ValidateSpellCostRules(block), ruleCase.name);
        const active = ActiveSpellCostRules(
            ruleCase.rules,
            new Set(ruleCase.conditions),
            new Set(ruleCase.exceptions),
        );
        const price = {
            stamina: ApplySpellCostRules(active, SpellCostResource.Stamina, ruleCase.price.stamina),
            mana: ApplySpellCostRules(active, SpellCostResource.Mana, ruleCase.price.mana),
        };
        assert.deepEqual(price, ruleCase.expected, ruleCase.name);
    }
});

test('the shipped rules validate and an absent block stays valid', () =>
{
    assert.doesNotThrow(() => ValidateSpellCostRules(shipped.spellCosts));
    assert.doesNotThrow(() => validateFixCoreRules(shipped));
    const { spellCosts, elementFlux, ...saved } = shipped;
    assert.doesNotThrow(() => validateFixCoreRules(saved), 'a fight saved before the rules');
    for (const block of legacyBlockVariants)
    {
        assert.doesNotThrow(() => ValidateSpellCostRules(block), JSON.stringify(block));
    }
});

test('malformed spell cost blocks of either version are refused', () =>
{
    const malformed = malformedSpellCostBlocks();
    for (const [name, malformedBlock] of Object.entries(malformed))
    {
        assert.throws(() => ValidateSpellCostRules(malformedBlock), /spellCosts/, name);
        const rules = {
            ...shipped,
            spellCosts: malformedBlock,
        };
        assert.throws(() => validateFixCoreRules(rules), /spellCosts/, name);
    }
});

test('a version 1 block prices every shipped spell as the version 1 formula did', () =>
{
    for (const block of legacyBlockVariants)
    {
        for (const spell of shippedSpells)
        {
            assertLegacyParity(block, spell);
        }
    }
});

test('every shipped spell and cantrip: quote, preview and payment follow the rules', () =>
{
    const cantripTag = shipped.spellCosts.tags.cantrip;
    assert.ok(shippedSpells.length >= minimumSpellCount, 'the table covers the shipped spells');
    assert.ok(shippedSpells.some(spell => spell.tags.includes(cantripTag)));
    assert.ok(shippedSpells.some(spell => !spell.tags.includes(cantripTag)));
    for (const ruleBlock of ruleBlocks)
    {
        for (const spell of shippedSpells)
        {
            for (const context of priceContexts)
            {
                assertSpellPriceAgrees(spell, context, ruleBlock);
            }
        }
    }
});

test('after a first cast enters Prepared, a cantrip pays the face the Prepared rules give', () =>
{
    const { combat } = fight();
    combat.loadout.sets.rightHand[0] = focusHand;
    const block = combat.fixCoreRules.spellCosts;
    const [first, second] = combat.piles.hand;
    first.cardId = zeroStaminaSpell;
    second.cardId = freeCantrip;
    const authored = id => profile.content.cards.find(card => card.id === id);
    const open = cardPlayCosts(combat, second.instanceId);
    assert.equal(open.stamina, authored(freeCantrip).staminaCost, 'before the first cast');
    const firstCost = cardPlayCosts(combat, first.instanceId);
    assert.equal(firstCost.stamina, authored(zeroStaminaSpell).staminaCost, 'authored zero SP');
    assertPaysQuote(combat, first, combat.enemies[0]);
    assert.ok(preparedManeuvers.includes(combat.player.combatStance?.maneuver), 'now Prepared');
    const prepared = ExpectedSpellPrice({
        block,
        conditions: [SpellCostCondition.Prepared],
        exceptions: CardSpellCostExceptions(block, authored(freeCantrip)),
        price: open,
    });
    const after = cardPlayCosts(combat, second.instanceId);
    assert.equal(after.stamina, prepared.stamina, 'the Prepared rules price its Stamina');
    assert.equal(previewCard(combat, second.instanceId).manaCost, after.mana);
    assertPaysQuote(combat, second, combat.player);
});

test('a basic attack is no spell: no spell cost rule changes its price', () =>
{
    const plain = quoteCard(
        pricingFight({ hand: plainHand, stance: preparedStance, block: null }),
        basicAttack,
    );
    for (const ruleBlock of ruleBlocks)
    {
        const combat = pricingFight({
            hand: plainHand,
            stance: preparedStance,
            block: ruleBlock.block,
        });
        assert.deepEqual(quoteCard(combat, basicAttack).costs, plain.costs, ruleBlock.name);
    }
});

test('a fight saved without spellCosts keeps printed costs and the Prepared-only Focus rule', () =>
{
    const quote = (hand, stance, id) => quoteCard(pricingFight({ hand, stance, block: null }), id);
    for (const spell of shippedSpells)
    {
        const isVariable = spell.cost === variableCost;
        const plain = quote(plainHand, null, spell.id).costs;
        const focusOff = quote(focusHand, null, spell.id).costs;
        const prepared = quote(plainHand, preparedStance, spell.id).costs;
        const focusOn = quote(focusHand, preparedStance, spell.id).costs;
        assert.equal(plain.mana, spell.manaCost, `${spell.id} MP as printed`);
        assert.equal(focusOff.mana, spell.manaCost, `${spell.id}: no Focus cut outside Prepared`);
        const focusMana = Math.max(0, prepared.mana - legacyFocusManaDiscount);
        assert.equal(focusOn.mana, focusMana, `${spell.id}: the Focus cut in Prepared`);
        if (!isVariable)
        {
            assert.equal(plain.stamina, spell.staminaCost, `${spell.id} SP as printed`);
            assert.equal(prepared.stamina, spell.staminaCost, `${spell.id}: Prepared cut no SP`);
        }
    }
});

test('shipped flux rules and the validator guard them', () =>
{
    assert.deepEqual(shipped.elementFlux, { version: 1, multiplier: 1.25 });
    const flux = patch =>
        validateFixCoreRules({
            ...shipped,
            elementFlux: {
                ...shipped.elementFlux,
                ...patch,
            },
        });
    assert.throws(() => flux({ multiplier: 0.5 }), /elementFlux/);
    assert.throws(() => flux({ extra: 1 }), /elementFlux/);
});

test('a flux card is lifted x1.25 and floored; other elements and old fights are not', () =>
{
    const { combat } = fight();
    combat.player.elementFlux = 'fire';
    for (const [base, want] of fluxFloorExamples)
    {
        const stage = fluxStage(fluxQuote(combat, fireCarrier, base));
        assert.equal(stage.multiplier, 1.25, `the quote lists the flux stage for ${base}`);
        assert.equal(stage.effective, want, `floor(${base} x 1.25)`);
    }
    const counterReturn = { ...fireCarrier, counterReturnAttack: true };
    const unplayed = { ...fireCarrier, cardId: undefined, instanceId: undefined };
    assert.equal(fluxStage(fluxQuote(combat, frostCarrier, 10)), undefined, 'Frost under Fire');
    assert.equal(fluxStage(fluxQuote(combat, counterReturn, 10)), undefined, 'a Counter return');
    assert.equal(fluxStage(fluxQuote(combat, unplayed, 10)), undefined, 'only a played card');
    delete combat.player.elementFlux;
    assert.equal(fluxStage(fluxQuote(combat, fireCarrier, 10)), undefined, 'no flux, no lift');
    const old = fight({ legacy: true });
    delete old.combat.fixCoreRules.elementFlux;
    old.combat.player.elementFlux = 'fire';
    assert.equal(fluxStage(fluxQuote(old.combat, fireCarrier, 10)), undefined, 'an old fight');
    assert.equal(FluxMultiplier(old.combat, old.combat.player, fireCarrier), 1);
    assert.equal(FluxElement(old.combat, old.combat.player), null);
});

test('FluxScale floors every number it lifts (Block, healing, status stacks)', () =>
{
    const { combat } = fight();
    combat.player.elementFlux = 'fire';
    const scale = (carrier, value) => FluxScale(combat, combat.player, carrier, value);
    for (const [value, lifted] of fluxScaleExamples)
    {
        assert.equal(scale(fireCarrier, value), lifted, `Fire flux lifts ${value}`);
        assert.equal(scale(frostCarrier, value), value, `Frost is not lifted: ${value}`);
    }
    combat.phase = 'enemy';
    assert.equal(scale(fireCarrier, 4), 4, 'the enemy phase neither reads nor changes the flux');
});

test('flux chain: Fire, Fire, Fire lifts the second and third; face = damage dealt', () =>
{
    const ids = [
        cinderDart,
        cinderDart,
        cinderDart,
    ];
    const live = sequence(ids).rows;
    const control = sequence(ids, { legacy: true }).rows;
    assert.deepEqual(live.map(row => row.flux), ids.map(() => fireElement), 'the flux stays');
    assert.deepEqual(control.map(row => row.flux), ids.map(() => null), 'an old fight sets none');
    assert.equal(live[0].face, control[0].face, 'the first cast is not lifted by its own flux');
    for (const index of [1, 2])
    {
        const lifted = control[index].face * 1.25;
        assert.ok(live[index].face > control[index].face, `cast ${index + 1} is lifted`);
        assert.ok(
            Math.abs(live[index].face - lifted) < 1.25 + 1e-9,
            `cast ${index + 1} is about x1.25: ${live[index].face} vs ${control[index].face}`,
        );
    }
    for (const row of live)
    {
        assert.equal(row.lost, row.face, `${row.id}: shown = dealt`);
    }
});

test('flux chain: Frost replaces Fire, a non-element spell clears it, a non-spell leaves it', () =>
{
    const ids = [
        cinderDart,
        frostNip,
        cinderDart,
        basicAttack,
        arcaneSpark,
        cinderDart,
    ];
    const live = sequence(ids).rows;
    const control = sequence(ids, { legacy: true }).rows;
    assert.deepEqual(live.map(row => row.flux), [
        fireElement,
        frostElement,
        fireElement,
        fireElement,
        null,
        fireElement,
    ]);
    assert.equal(live[1].face, control[1].face, 'Frost after Fire is not lifted');
    assert.equal(live[2].face, control[2].face, 'Fire after Frost is not lifted');
    assert.equal(live[5].face, control[5].face, 'Fire after a non-element spell is not lifted');
});

test('flux lifts Block and healing too, floored; the face shows the lifted number', () =>
{
    const wardIds = [
        cinderDart,
        'core.cinderWard',
    ];
    const healIds = [
        'core.steadyHands',
        'core.mendingTouch',
    ];
    const ward = sequence(wardIds).rows;
    const wardControl = sequence(wardIds, { legacy: true }).rows;
    assert.ok(ward[1].block > wardControl[1].block, 'Cinder Ward after Fire gains more Block');
    assert.equal(ward[1].blockFace, ward[1].block, 'Block face = Block gained');
    const heal = sequence(healIds).rows;
    const healControl = sequence(healIds, { legacy: true }).rows;
    assert.deepEqual(heal.map(row => row.flux), ['divine', 'divine']);
    assert.ok(heal[1].healFace > healControl[1].healFace, 'Mending Touch after Steady Hands');
    assert.equal(heal[0].healFace, healControl[0].healFace, 'the first cast is not lifted');
});

test('flux ends at the end of the turn and with the fight', () =>
{
    const { combat } = sequence([cinderDart, cinderDart]);
    assert.equal(combat.player.elementFlux, 'fire');
    dispatch(combat, { type: 'endTurn' });
    assert.equal(combat.player.elementFlux, undefined, 'the player turn ended');
    const { combat: other } = sequence([cinderDart]);
    assert.equal(other.player.elementFlux, 'fire');
    for (const enemy of other.enemies)
    {
        enemy.hp = 1;
    }
    other.piles.hand[0].cardId = cinderDart;
    primeAccuracyRolls(other);
    dispatch(other, {
        type: 'playCard',
        cardInstanceId: other.piles.hand[0].instanceId,
        targetId: other.enemies[0].id,
    });
    assert.equal(other.result, 'victory');
    assert.equal(other.player.elementFlux, undefined, 'the fight is over: no flux');
});

test('the second stance icon shows the flux element or the magic mark; hidden without rules', () =>
{
    const { combat } = fight();
    const rules = ElementFluxRules(combat);
    const fire = { element: 'fire', multiplier: 1.25 };
    assert.equal(rules.multiplier, 1.25);
    assert.deepEqual(PlayerFluxView(rules, { elementFlux: 'fire' }, true), fire);
    assert.deepEqual(PlayerFluxView(rules, {}, true), { ...fire, element: null }, 'magic mark');
    assert.deepEqual(PlayerFluxView(rules, { elementFlux: 'frost' }, false), {
        ...fire,
        element: 'frost',
    });
    assert.equal(PlayerFluxView(rules, {}, false), null, 'no stance and no flux: hidden');
    assert.equal(PlayerFluxView(null, { elementFlux: 'fire' }, true), null, 'no rule: hidden');
    const old = fight().combat;
    delete old.fixCoreRules.elementFlux;
    assert.equal(ElementFluxRules(old), null);
});

test('the flux tooltip names the element, the multiplier and the rounding', () =>
{
    const tip = element => FluxTip({ element, multiplier: 1.25 });
    assert.deepEqual(tip('fire').title, 'Fire flux');
    assert.match(tip('fire').body, /Next Fire cards ×1\.25 \(rounded down\)/);
    assert.match(tip('necrotic').title, /Necrotic flux/);
    assert.equal(tip(null).title, 'Magic');
    assert.match(tip(null).body, /only the stance bonus/);
});

test('a change of flux is announced once: set, replaced, cleared, and not when unchanged', () =>
{
    const { combat } = sequence([
        cinderDart,
        cinderDart,
        frostNip,
        arcaneSpark,
    ]);
    const events = combat.eventLog
        .filter(row => row.type === 'elementFluxChanged')
        .map(row => row.element);
    assert.deepEqual(events, [
        fireElement,
        frostElement,
        null,
    ]);
});
