// Finds the raw text of each top-level item or member in a JSON file without reformatting it.
const WHITESPACE = /\s/;
const QUOTE = '"';
const ESCAPE = '\\';
const COMMA = ',';
const COLON = ':';
const OPENERS = '[{';
const CLOSERS = ']}';
const ARRAY_OPEN = '[';

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
