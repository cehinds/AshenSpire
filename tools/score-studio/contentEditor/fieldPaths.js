// Reads and writes one field of a content entry by its dot path, keeping key order.
// GetFieldValue is the shared dot-path reader; an empty path is the entry itself.
export { ValueAtPath as GetFieldValue } from '../../../src/model/valuePath.js';

const PATH_SEPARATOR = '.';
const NUMBER_FIELD = 'number';

function pathParts(path)
{
    return path
        ? String(path).split(PATH_SEPARATOR)
        : [];
}

function isContainer(value)
{
    return value !== null && typeof value === 'object';
}

/** Sets `path` in place; an existing key keeps its position and undefined removes the key. */
export function SetFieldValue(entry, path, value)
{
    const parts = pathParts(path);
    if (parts.length === 0)
    {
        throw new Error('SetFieldValue needs a path; replace the whole entry instead.');
    }
    const lastKey = parts.pop();
    let parent = entry;
    for (const key of parts)
    {
        if (!isContainer(parent[key]))
        {
            if (value === undefined)
            {
                return entry;
            }
            parent[key] = {};
        }
        parent = parent[key];
    }
    if (value === undefined)
    {
        delete parent[lastKey];
        return entry;
    }
    parent[lastKey] = value;
    return entry;
}

/** What an input's text means for a field: a number, text, or undefined when left empty. */
export function ParseFieldInput(fieldType, text)
{
    const trimmed = String(text ?? '').trim();
    if (trimmed === '')
    {
        return undefined;
    }
    if (fieldType !== NUMBER_FIELD)
    {
        return String(text);
    }
    const number = Number(trimmed);
    return Number.isFinite(number)
        ? number
        : undefined;
}

/** The text an input shows for a stored value. */
export function FormatFieldInput(value)
{
    return value === undefined || value === null
        ? ''
        : String(value);
}

/** A deep copy of plain JSON data. */
export function CloneJson(value)
{
    return value === undefined
        ? undefined
        : JSON.parse(JSON.stringify(value));
}
