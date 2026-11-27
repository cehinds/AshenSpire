/**
 * Spell cost rules: the `spellCosts` data shape, its validation and the rule arithmetic.
 * A rule changes one resource of a spell's price, optionally only under a condition,
 * with an optional minimum, and can skip cards by exception tag.
 * Version 1 blocks, kept in older saved fights, are read as the equivalent rule list.
 */

export const SpellCostRulesVersion = 2;

export const SpellCostResource = Object.freeze({
    Stamina: 'stamina',
    Mana: 'mana',
});

export const SpellCostCondition = Object.freeze({
    Prepared: 'prepared',
    LegacyFocusHeld: 'legacyFocusHeld',
});

export const SpellCostException = Object.freeze({
    Cantrip: 'cantrip',
    ManaOnly: 'manaOnly',
    XCost: 'xCost',
});

const legacyVersion = 1;
const blockKeys = Object.freeze([
    'version',
    'tags',
    'rules',
]);
const ruleKeys = Object.freeze([
    'id',
    'enabled',
    'resource',
    'change',
    'when',
    'minimum',
    'keepAtOrBelowMinimum',
    'skip',
]);
const tagKeys = Object.freeze([
    SpellCostException.Cantrip,
    SpellCostException.ManaOnly,
]);
const legacyRequiredNumbers = Object.freeze([
    'manaSurcharge',
    'staminaSurcharge',
    'preparedStaminaDiscount',
    'focusManaDiscount',
]);
const legacyOptionalNumbers = Object.freeze([
    'preparedStaminaMinimum',
    'preparedManaDiscount',
]);
const legacyKeys = Object.freeze([
    'version',
    'cantripTag',
    'manaOnlyTag',
    ...legacyRequiredNumbers,
    ...legacyOptionalNumbers,
]);
const normalizedBlocks = new WeakMap();

function isPlainObject(value)
{
    return typeof value === 'object'
        && value !== null
        && !Array.isArray(value);
}

function isWholeNumber(value)
{
    return Number.isInteger(value)
        && value >= 0;
}

function isNonEmptyText(value)
{
    return typeof value === 'string'
        && value.length > 0;
}

function fail(message)
{
    throw new Error(`FixCore spellCosts: ${message}`);
}

function validateLegacyBlock(block)
{
    if (Object.keys(block).some(key => !legacyKeys.includes(key)))
    {
        fail(`version 1 accepts only ${legacyKeys.join(', ')}`);
    }
    if (legacyRequiredNumbers.some(key => !isWholeNumber(block[key])))
    {
        fail(`version 1 needs whole numbers >= 0 for ${legacyRequiredNumbers.join(', ')}`);
    }
    if (legacyOptionalNumbers.some(key => block[key] !== undefined && !isWholeNumber(block[key])))
    {
        fail(`${legacyOptionalNumbers.join(', ')} must be whole numbers >= 0 when present`);
    }
    if (!isNonEmptyText(block.cantripTag))
    {
        fail('version 1 needs a cantripTag');
    }
    if (block.manaOnlyTag !== undefined && !isNonEmptyText(block.manaOnlyTag))
    {
        fail('manaOnlyTag must be a tag id when present');
    }
}

function validateTags(tags)
{
    if (!isPlainObject(tags) || Object.keys(tags).some(key => !tagKeys.includes(key)))
    {
        fail(`tags accepts only ${tagKeys.join(', ')}`);
    }
    if (!isNonEmptyText(tags[SpellCostException.Cantrip]))
    {
        fail('tags.cantrip must be a tag id');
    }
    if (
        tags[SpellCostException.ManaOnly] !== undefined
        && !isNonEmptyText(tags[SpellCostException.ManaOnly])
    )
    {
        fail('tags.manaOnly must be a tag id when present');
    }
}

function validateRule(rule)
{
    const label = `rule ${rule?.id ?? '?'}`;
    if (!isPlainObject(rule) || Object.keys(rule).some(key => !ruleKeys.includes(key)))
    {
        fail(`${label} accepts only ${ruleKeys.join(', ')}`);
    }
    if (
        !isNonEmptyText(rule.id) || typeof rule.enabled !== 'boolean'
        || !Number.isInteger(rule.change)
    )
    {
        fail(`${label} needs an id, enabled true or false, and a whole-number change`);
    }
    if (!Object.values(SpellCostResource).includes(rule.resource))
    {
        fail(`${label} resource must be one of ${Object.values(SpellCostResource).join(', ')}`);
    }
    if (rule.when !== undefined && !Object.values(SpellCostCondition).includes(rule.when))
    {
        fail(`${label} when must be one of ${Object.values(SpellCostCondition).join(', ')}`);
    }
    if (rule.minimum !== undefined && !isWholeNumber(rule.minimum))
    {
        fail(`${label} minimum must be a whole number >= 0`);
    }
    if (rule.keepAtOrBelowMinimum !== undefined && typeof rule.keepAtOrBelowMinimum !== 'boolean')
    {
        fail(`${label} keepAtOrBelowMinimum must be true or false`);
    }
    const exceptions = Object.values(SpellCostException);
    if (
        rule.skip !== undefined
        && (!Array.isArray(rule.skip) || rule.skip.some(id => !exceptions.includes(id)))
    )
    {
        fail(`${label} skip must list ${exceptions.join(', ')}`);
    }
}

function validateRuleBlock(block)
{
    if (Object.keys(block).some(key => !blockKeys.includes(key)) || !Array.isArray(block.rules))
    {
        fail(
            `version ${SpellCostRulesVersion} accepts only ${
                blockKeys.join(', ')
            }, with a rules list`,
        );
    }
    validateTags(block.tags);
    block.rules.forEach(validateRule);
    const ids = block.rules.map(rule => rule.id);
    if (new Set(ids).size !== ids.length)
    {
        fail('rule ids must be unique');
    }
}

function legacyRule(id, resource, change, extra = {})
{
    return {
        id,
        enabled: true,
        resource,
        change,
        ...extra,
    };
}

function legacyRuleBlock(block)
{
    return {
        version: SpellCostRulesVersion,
        tags: {
            [SpellCostException.Cantrip]: block.cantripTag,
            [SpellCostException.ManaOnly]: block.manaOnlyTag,
        },
        rules: [
            legacyRule('manaSurcharge', SpellCostResource.Mana, block.manaSurcharge),
            legacyRule('staminaSurcharge', SpellCostResource.Stamina, block.staminaSurcharge, {
                skip: [
                    SpellCostException.Cantrip,
                    SpellCostException.ManaOnly,
                    SpellCostException.XCost,
                ],
            }),
            legacyRule(
                'preparedStamina',
                SpellCostResource.Stamina,
                -block.preparedStaminaDiscount,
                {
                    when: SpellCostCondition.Prepared,
                    minimum: block.preparedStaminaMinimum ?? 0,
                    keepAtOrBelowMinimum: true,
                    skip: [SpellCostException.XCost],
                },
            ),
            legacyRule('preparedMana', SpellCostResource.Mana, -(block.preparedManaDiscount ?? 0), {
                when: SpellCostCondition.Prepared,
            }),
            legacyRule('legacyFocus', SpellCostResource.Mana, -block.focusManaDiscount, {
                when: SpellCostCondition.LegacyFocusHeld,
            }),
        ],
    };
}

/**
 * @summary Throws when a `spellCosts` block is malformed; an absent block is allowed.
 * @param {object | undefined} block The block from a fight's rules (version 1 or 2).
 */
export function ValidateSpellCostRules(block)
{
    if (block === undefined)
    {
        return;
    }
    if (!isPlainObject(block))
    {
        fail('must be an object');
    }
    if (block.version === legacyVersion)
    {
        validateLegacyBlock(block);
        return;
    }
    if (block.version !== SpellCostRulesVersion)
    {
        fail(`version must be ${legacyVersion} or ${SpellCostRulesVersion}`);
    }
    validateRuleBlock(block);
}

/**
 * @summary Reads any supported `spellCosts` block as a rule list.
 * @param {object | null | undefined} block The block from a fight's rules.
 * @returns {{ tags: object, rules: object[] } | null} The rule block, or null when absent or unknown.
 */
export function NormalizeSpellCostRules(block)
{
    if (!isPlainObject(block))
    {
        return null;
    }
    if (block.version === SpellCostRulesVersion)
    {
        return block;
    }
    if (block.version !== legacyVersion)
    {
        return null;
    }
    if (!normalizedBlocks.has(block))
    {
        normalizedBlocks.set(block, legacyRuleBlock(block));
    }
    return normalizedBlocks.get(block);
}

/**
 * @summary Applies one rule's change to a resource value.
 * @param {number} value The current value of the rule's resource.
 * @param {object} rule The rule: change, and optional minimum and keepAtOrBelowMinimum.
 * @returns {number} The new value.
 */
export function ApplySpellCostRule(value, rule)
{
    const hasMinimum = rule.minimum !== undefined;
    if (hasMinimum && rule.keepAtOrBelowMinimum && value <= rule.minimum)
    {
        return value;
    }
    const changed = value + rule.change;
    return hasMinimum
        ? Math.max(rule.minimum, changed)
        : changed;
}

/**
 * @summary Picks the rules that apply to one card in one situation.
 * @param {object[]} rules The rule list.
 * @param {Set<string>} conditions The conditions that hold now (SpellCostCondition values).
 * @param {Set<string>} exceptions The exceptions the card carries (SpellCostException values).
 * @returns {object[]} The enabled rules whose condition holds and that the card does not skip.
 */
export function ActiveSpellCostRules(rules, conditions, exceptions)
{
    return rules.filter(rule =>
        rule.enabled
        && (rule.when === undefined || conditions.has(rule.when))
        && !(rule.skip ?? []).some(id => exceptions.has(id))
    );
}

/**
 * @summary Applies the active rules for one resource, in list order.
 * @param {object[]} rules The active rules.
 * @param {string} resource A SpellCostResource value.
 * @param {number} value The resource's price before the rules.
 * @returns {number} The resource's price after the rules (not floored).
 */
export function ApplySpellCostRules(rules, resource, value)
{
    return rules
        .filter(rule => rule.resource === resource)
        .reduce(ApplySpellCostRule, value);
}
