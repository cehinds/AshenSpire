// The one filler for JSON-authored templates, in the game and the tools: {name}, {a.b} dot paths,
// {count:path} for a list's length and {sum:path} to add up a field over a list of items.
import { LookUpPath, ValueAtPath } from './valuePath.js';

const PLACEHOLDER = /\{((?:count:|sum:)?[\w.]+)\}/g;
const COUNT_PREFIX = 'count:';
const SUM_PREFIX = 'sum:';

function listAt(values, path)
{
    const { found, value } = LookUpPath(values, path);
    return found && Array.isArray(value)
        ? value
        : null;
}

function sumOf(items, path)
{
    return items.reduce((total, item) => total + (Number(ValueAtPath(item, path)) || 0), 0);
}

/** The text for one token, or null when `values` has nothing for it. */
function tokenText(values, token)
{
    if (token.startsWith(COUNT_PREFIX))
    {
        const items = listAt(values, token.slice(COUNT_PREFIX.length));
        return items && String(items.length);
    }
    if (token.startsWith(SUM_PREFIX))
    {
        const items = Array.isArray(values)
            ? values
            : null;
        return items && String(sumOf(items, token.slice(SUM_PREFIX.length)));
    }
    const { found, value } = LookUpPath(values, token);
    return found
        ? String(value)
        : null;
}

/**
 * Replaces each token from `values`; a token with no value stays as written,
 * or becomes `options.missing` when that is given (list rows pass '').
 */
export function FillTemplate(template, values = {}, options = {})
{
    return template.replace(PLACEHOLDER, (match, token) =>
    {
        const text = tokenText(values, token);
        if (text !== null)
        {
            return text;
        }
        return options.missing ?? match;
    });
}
