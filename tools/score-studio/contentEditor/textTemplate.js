// Fills `{path}` and `{sum:path}` tokens from a value, for list rows, hovers and messages.
import { GetFieldValue } from './fieldPaths.js';

const TEMPLATE_TOKEN = /\{([^}]+)\}/g;
const SUM_PREFIX = 'sum:';
const EXTRA_SPACES = /\s+/g;
const SPACE = ' ';

function sumText(value, sumPath)
{
    const items = Array.isArray(value)
        ? value
        : [];
    const addItem = (sum, item) => sum + (Number(GetFieldValue(item, sumPath)) || 0);
    return items.length
        ? String(items.reduce(addItem, 0))
        : '';
}

function tokenText(value, token)
{
    if (token.startsWith(SUM_PREFIX))
    {
        return sumText(value, token.slice(SUM_PREFIX.length));
    }
    const found = GetFieldValue(value, token);
    if (Array.isArray(found))
    {
        return String(found.length);
    }
    const isShown = found !== undefined && found !== null && typeof found !== 'object';
    return isShown
        ? String(found)
        : '';
}

/** `template` with each token replaced from `value`; arrays show their length. */
export function FillTemplate(template, value)
{
    if (!template)
    {
        return '';
    }
    return template
        .replace(TEMPLATE_TOKEN, (match, token) => tokenText(value, token))
        .replace(EXTRA_SPACES, SPACE)
        .trim();
}
