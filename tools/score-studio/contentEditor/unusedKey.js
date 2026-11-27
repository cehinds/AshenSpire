// A key not yet used in an object: the configured base, then the base with 2, 3, ... appended.
const FIRST_SUFFIX = 2;

/** `base` when `object` lacks it, otherwise the first free `${base}${n}`. */
export function UnusedKey(object, base)
{
    if (!(base in object))
    {
        return base;
    }
    let suffix = FIRST_SUFFIX;
    while (`${base}${suffix}` in object)
    {
        suffix += 1;
    }
    return `${base}${suffix}`;
}
