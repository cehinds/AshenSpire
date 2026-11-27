// Writes a JSON document back in its file's own layout so a save changes only the edited entries.
const NEWLINE = '\n';
const SPACE = ' ';
const LINE_BREAKS = /\r\n?/g;
const NESTED_LINE = /\n/g;
const WHITESPACE = /\s/;
const QUOTE = '"';
const ESCAPE = '\\';
const COMMA = ',';
const COLON = ':';
const OPENERS = '[{';
const CLOSERS = ']}';
const ARRAY_OPEN = '[';

function isContainer(value)
{
    return value !== null && typeof value === 'object';
}

function canonicalText(value, indent)
{
    return `${JSON.stringify(value, null, indent)}${NEWLINE}`;
}

function skipWhitespace(text, index)
{
    let position = index;
    while (position < text.length && WHITESPACE.test(text[position]))
    {
        position++;
    }
    return position;
}

function stringEnd(text, start)
{
    let position = start + 1;
    while (position < text.length && text[position] !== QUOTE)
    {
        position += text[position] === ESCAPE
            ? 2
            : 1;
    }
    return position + 1;
}

/** The index just past the value that starts at `start`, at depth zero. */
function valueEnd(text, start)
{
    let depth = 0;
    let position = start;
    while (position < text.length)
    {
        const character = text[position];
        const closesValue = depth === 0 && (character === COMMA || CLOSERS.includes(character));
        if (closesValue)
        {
            break;
        }
        if (character === QUOTE)
        {
            position = stringEnd(text, position);
            continue;
        }
        depth += OPENERS.includes(character)
            ? 1
            : 0;
        depth -= CLOSERS.includes(character)
            ? 1
            : 0;
        position++;
    }
    return text.slice(start, position).trimEnd().length + start;
}

function readMember(text, position, isArray)
{
    let start = position;
    let key = null;
    if (!isArray)
    {
        const keyEnd = stringEnd(text, position);
        key = JSON.parse(text.slice(position, keyEnd));
        start = skipWhitespace(text, text.indexOf(COLON, keyEnd) + 1);
    }
    const end = valueEnd(text, start);
    return {
        key,
        raw: text.slice(start, end),
        next: skipWhitespace(text, end),
    };
}

/** The raw text of each top-level item or member, in file order. */
export function TopLevelItems(text)
{
    let position = skipWhitespace(text, 0);
    const isArray = text[position] === ARRAY_OPEN;
    const items = [];
    position = skipWhitespace(text, position + 1);
    while (position < text.length && !CLOSERS.includes(text[position]))
    {
        const member = readMember(text, position, isArray);
        items.push(member);
        position = member.next === text.length || text[member.next] !== COMMA
            ? member.next
            : skipWhitespace(text, member.next + 1);
    }
    return {
        isArray,
        items,
    };
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
