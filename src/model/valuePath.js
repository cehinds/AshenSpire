// Reads a value inside plain JSON data by a dot path such as "stats.levelProfile.max".
const PATH_SEPARATOR = '.';

function isContainer(value)
{
    return value !== null && typeof value === 'object';
}

/** { found, value } for `path` in `data`; an empty path is `data` itself. */
export function LookUpPath(data, path)
{
    const keys = path
        ? String(path).split(PATH_SEPARATOR)
        : [];
    let value = data;
    for (const key of keys)
    {
        if (!isContainer(value) || !(key in value))
        {
            return {
                found: false,
                value: undefined,
            };
        }
        value = value[key];
    }
    return {
        found: true,
        value,
    };
}

/** The value at `path` in `data`, or undefined when any part is missing. */
export function ValueAtPath(data, path)
{
    return LookUpPath(data, path).value;
}
