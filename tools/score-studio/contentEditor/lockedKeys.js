// Keys an entry's JSON view hides and never writes, such as an enemy's generated `derived` block.

function isPlainObject(value)
{
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The entry with locked keys left out, for the JSON view. */
export function WithoutLockedKeys(value, lockedKeys)
{
    if (!isPlainObject(value))
    {
        return value;
    }
    const visible = Object.entries(value).filter(([key]) => !lockedKeys.includes(key));
    return Object.fromEntries(visible);
}

/** Edited JSON with locked keys restored from `original`; existing keys keep their order. */
export function WithLockedKeys(original, edited, lockedKeys)
{
    if (!isPlainObject(original) || !isPlainObject(edited) || lockedKeys.length === 0)
    {
        return edited;
    }
    const merged = {};
    for (const key of Object.keys(original))
    {
        if (lockedKeys.includes(key))
        {
            merged[key] = original[key];
            continue;
        }
        if (key in edited)
        {
            merged[key] = edited[key];
        }
    }
    const added = Object.entries(edited).filter(([key]) => !(key in merged));
    return Object.assign(merged, Object.fromEntries(added));
}
