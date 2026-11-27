// Writes a JSON document back in its file's own layout so a save changes only the edited entries.
import { TopLevelItems } from './jsonScan.js';

const NEWLINE = '\n';
const SPACE = ' ';
const LINE_BREAKS = /\r\n?/g;
const NESTED_LINE = /\n/g;

function isContainer(value)
{
    return value !== null && typeof value === 'object';
}

function canonicalText(value, indent)
{
    return `${JSON.stringify(value, null, indent)}${NEWLINE}`;
}

function indentedJson(value, indent)
{
    const itemIndent = SPACE.repeat(indent);
    return JSON.stringify(value, null, indent).replace(NESTED_LINE, `${NEWLINE}${itemIndent}`);
}

function reusedText(rawByCanonical, key, value, indent)
{
    return rawByCanonical.get(JSON.stringify([key, value])) ?? indentedJson(value, indent);
}

function joinItems(parts, isArray, indent)
{
    const [open, close] = isArray
        ? ['[', ']']
        : ['{', '}'];
    if (parts.length === 0)
    {
        return `${open}${close}${NEWLINE}`;
    }
    const itemIndent = SPACE.repeat(indent);
    const body = parts.join(`,${NEWLINE}${itemIndent}`);
    return `${open}${NEWLINE}${itemIndent}${body}${NEWLINE}${close}${NEWLINE}`;
}

function spliceTopLevel(original, value, indent)
{
    const { isArray, items } = TopLevelItems(original);
    const rawByCanonical = new Map();
    for (const item of items)
    {
        const canonicalKey = JSON.stringify([item.key, JSON.parse(item.raw)]);
        rawByCanonical.set(canonicalKey, item.raw);
    }
    const parts = isArray
        ? value.map((item) => reusedText(rawByCanonical, null, item, indent))
        : Object.entries(value).map(([key, member]) =>
        {
            return `${JSON.stringify(key)}: ${reusedText(rawByCanonical, key, member, indent)}`;
        });
    return joinItems(parts, isArray, indent);
}

/** `value` as file text in the layout of `originalText`, indented by `indent` spaces. */
export function FormatJsonLike(originalText, value, indent)
{
    const fresh = canonicalText(value, indent);
    const original = String(originalText ?? '').replace(LINE_BREAKS, NEWLINE);
    let parsed;
    try
    {
        parsed = JSON.parse(original);
    }
    catch
    {
        return fresh;
    }
    const bothContainers = isContainer(parsed) && isContainer(value);
    const sameShape = bothContainers && Array.isArray(parsed) === Array.isArray(value);
    if (canonicalText(parsed, indent) === original || !sameShape)
    {
        return fresh;
    }
    return spliceTopLevel(original, value, indent);
}
