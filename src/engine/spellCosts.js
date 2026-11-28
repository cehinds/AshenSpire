/**
 * Spell prices: applies the fight's `spellCosts` rules (model/spellCostRules.js) to a card's price,
 * so the face, affordability checks, the bot and the payment all read the same number.
 * Headless: no document, window, timers or RNG.
 */
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';
import { fixCoreRules } from '../model/fixCoreRulesCache.js';
import { cardManaCategory } from '../model/cardManaPolicy.js';
import { GearTypeEffectsEnabled, GearManaCost } from '../model/gearEffects.js';
import { FocusHeld, inPreparedStance } from '../model/focusMana.js';
import { SameStanceDiscountEnabled } from '../model/simpleCombatFlags.js';
import {
    ActiveSpellCostRules,
    ApplySpellCostRules,
    NormalizeSpellCostRules,
    SpellCostCondition,
    SpellCostException,
    SpellCostResource,
} from '../model/spellCostRules.js';

const spellCategory = 'spell';
const variableCost = 'X';

const conditionChecks = Object.freeze({
    [SpellCostCondition.Prepared]: context =>
        SameStanceDiscountEnabled(context)
        && inPreparedStance(context.player),
    [SpellCostCondition.LegacyFocusHeld]: context =>
        !GearTypeEffectsEnabled(context)
        && FocusHeld(context.registries, context.loadout, context.player?.classId),
});

function tagIds(definition)
{
    const tags = definition?.cardTags ?? definition?.tags ?? [];
    return tags.map(tag =>
        typeof tag === 'string'
            ? tag
            : tag?.id
    );
}

function cardExceptions(tags, definition)
{
    const cardTags = tagIds(definition);
    const exceptions = new Set();
    for (const [exception, tag] of Object.entries(tags))
    {
        if (tag && cardTags.includes(tag))
        {
            exceptions.add(exception);
        }
    }
    if (definition.cost === variableCost)
    {
        exceptions.add(SpellCostException.XCost);
    }
    return exceptions;
}

function activeConditions(context)
{
    const conditions = new Set();
    for (const [condition, holds] of Object.entries(conditionChecks))
    {
        if (holds(context))
        {
            conditions.add(condition);
        }
    }
    return conditions;
}

/**
 * @summary The spell cost rules this fight plays under.
 * @param {object} context The fight.
 * @returns {{ tags: object, rules: object[] } | null} The rule block,
 *     or null without Core 2 or `spellCosts`.
 */
export function SpellCostRules(context)
{
    if (!fixCoreEnabled(context))
    {
        return null;
    }
    return NormalizeSpellCostRules(fixCoreRules(context)?.spellCosts);
}

/**
 * @summary Whether the card is a spell under the card Mana policy.
 * @param {object} context The fight.
 * @param {object} definition The card definition.
 * @returns {boolean}
 */
export function IsSpellForCost(context, definition)
{
    return !!definition
        && cardManaCategory(context.registries, definition) === spellCategory;
}

/**
 * @summary A card's price with the spell cost rules and gear Mana rules applied.
 * @param {object} context The fight.
 * @param {object} definition The card definition.
 * @param {{ stamina: number, mana: number }} price The price before the spell cost rules.
 * @returns {{ stamina: number, mana: number }} The price to show and pay.
 */
export function SpellCostAdjust(context, definition, price)
{
    const block = SpellCostRules(context);
    if (!block || !IsSpellForCost(context, definition))
    {
        return {
            ...price,
            mana: GearManaCost(definition, price.mana),
        };
    }
    const rules = ActiveSpellCostRules(
        block.rules,
        activeConditions(context),
        cardExceptions(block.tags, definition),
    );
    const stamina = ApplySpellCostRules(rules, SpellCostResource.Stamina, price.stamina);
    const mana = ApplySpellCostRules(rules, SpellCostResource.Mana, price.mana);
    return {
        stamina: Math.max(0, stamina),
        mana: GearManaCost(definition, mana),
    };
}
