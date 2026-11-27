// An enemy's authored HP (sheet stats.hp, row hpOverride) replaces the HP its attributes and
// level give. The fight's HP multipliers still apply on top of it.

/** The characters.json row field that holds the override. */
export const EnemyHpOverrideField = 'hpOverride';
/** The smallest usable override. */
export const EnemyHpOverrideMinimum = 1;

function overriddenDefinition(definition, hp)
{
    if (hp === undefined)
    {
        return definition;
    }
    return {
        ...definition,
        hp: [hp, hp],
    };
}

/** The enemy row's HP override, or null when it has none (or an unusable one). */
export function EnemyHpOverride(row)
{
    const value = row?.[EnemyHpOverrideField];
    if (!Number.isSafeInteger(value) || value < EnemyHpOverrideMinimum)
    {
        return null;
    }
    return value;
}

/** Pin each overridden enemy's rolled HP range to its override, so the roll draws the same. */
export function ApplyEnemyHpOverrides(definitions, authoredRows)
{
    const overrides = new Map();
    for (const row of authoredRows || [])
    {
        const hp = EnemyHpOverride(row);
        if (hp !== null)
        {
            overrides.set(row.id, hp);
        }
    }
    if (!overrides.size)
    {
        return definitions;
    }
    return definitions.map(definition =>
    {
        const hp = overrides.get(definition.id);
        return overriddenDefinition(definition, hp);
    });
}
