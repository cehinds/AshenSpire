/**
 * Spell cost rule fixtures: the frozen version 1 block an older saved fight holds, patched copies
 * of a version 2 block, and the model's rule functions as the price oracle for integration tests.
 */
import { fixCoreMechanics } from '../../src/content/generated/fixCoreMechanics.js';
import {
    ActiveSpellCostRules,
    ApplySpellCostRules,
    NormalizeSpellCostRules,
    SpellCostCondition,
    SpellCostException,
    SpellCostResource,
} from '../../src/model/spellCostRules.js';

const lowestPrice = 0;
const variableCost = 'X';

// Key order is part of the saved snapshot, so state hashes depend on it.
const legacySpellCostBlock = Object.freeze({
    version: 1,
    manaSurcharge: 1,
    staminaSurcharge: 1,
    cantripTag: 'rank.cantrip',
    manaOnlyTag: 'cost.manaOnly',
    preparedStaminaDiscount: 1,
    focusManaDiscount: 1,
});

function cardTagIds(card)
{
    const tags = card?.cardTags ?? card?.tags ?? [];
    return tags.map(tag =>
        typeof tag === 'string'
            ? tag
            : tag?.id
    );
}

function patchedRule(rule, patches)
{
    const patch = patches[rule.id];
    if (!patch)
    {
        return rule;
    }
    return {
        ...rule,
        ...patch,
    };
}

export { SpellCostCondition, SpellCostException };

/**
 * @summary A deep copy of the shipped `spellCosts` block.
 * @returns {object} The version 2 block from fixCoreMechanics.json.
 */
export function ShippedSpellCostBlock()
{
    return structuredClone(fixCoreMechanics.spellCosts);
}

/**
 * @summary The version 1 `spellCosts` block a fight saved before the rule list holds.
 * @param {object} [overrides] Fields to replace or add; existing keys keep their order.
 * @returns {object} A fresh version 1 block.
 */
export function LegacySpellCostBlock(overrides = {})
{
    return {
        ...legacySpellCostBlock,
        ...overrides,
    };
}

/**
 * @summary A deep copy of a version 2 block with some rules patched by id.
 * @param {object} block A version 2 `spellCosts` block.
 * @param {Record<string, object>} patches Rule fields to merge, keyed by rule id.
 * @returns {object} The patched copy; the input is unchanged.
 */
export function WithSpellCostRules(block, patches)
{
    const copy = structuredClone(block);
    const knownIds = new Set(copy.rules.map(rule => rule.id));
    const unknownIds = Object.keys(patches).filter(id => !knownIds.has(id));
    if (unknownIds.length > 0)
    {
        throw new Error(`WithSpellCostRules: no rule ${unknownIds.join(', ')}`);
    }
    copy.rules = copy.rules.map(rule => patchedRule(rule, patches));
    return copy;
}

/**
 * @summary The spell cost exceptions a card carries under a block's tags.
 * @param {object} block A `spellCosts` block (version 1 or 2).
 * @param {object} card A card definition (`tags` or `cardTags`, `cost`).
 * @returns {Set<string>} SpellCostException values.
 */
export function CardSpellCostExceptions(block, card)
{
    const tags = NormalizeSpellCostRules(block).tags;
    const cardTags = cardTagIds(card);
    const exceptions = new Set(
        Object.keys(tags).filter(exception =>
            tags[exception] && cardTags.includes(tags[exception])
        ),
    );
    if (card.cost === variableCost)
    {
        exceptions.add(SpellCostException.XCost);
    }
    return exceptions;
}

/**
 * @summary The price the spell cost rules give, computed by the model's rule functions.
 * @param {object} options
 * @param {object} options.block A `spellCosts` block (version 1 or 2).
 * @param {Iterable<string>} [options.conditions] SpellCostCondition values that hold.
 * @param {Iterable<string>} [options.exceptions] SpellCostException values the card carries.
 * @param {{ stamina: number, mana: number }} options.price The price before the rules.
 * @returns {{ stamina: number, mana: number }} The price after the rules, each floored at 0.
 */
export function ExpectedSpellPrice({ block, conditions = [], exceptions = [], price })
{
    const rules = ActiveSpellCostRules(
        NormalizeSpellCostRules(block).rules,
        new Set(conditions),
        new Set(exceptions),
    );
    const stamina = ApplySpellCostRules(rules, SpellCostResource.Stamina, price.stamina);
    const mana = ApplySpellCostRules(rules, SpellCostResource.Mana, price.mana);
    return {
        stamina: Math.max(lowestPrice, stamina),
        mana: Math.max(lowestPrice, mana),
    };
}
