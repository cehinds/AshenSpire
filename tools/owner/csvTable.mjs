// Reads a content CSV into rows keyed by its header; comment lines start with #.
const CSV_SEPARATOR = ',';
const QUOTE = '"';
const COMMENT_PREFIX = '#';
const LINE_BREAK = /\r?\n/;
const ID_COLUMN = 'id';

function isDataLine(line)
{
    return line.trim() && !line.startsWith(COMMENT_PREFIX);
}

function splitLine(line)
{
    const cells = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index++)
    {
        const character = line[index];
        const escapedQuote = quoted && character === QUOTE && line[index + 1] === QUOTE;
        if (escapedQuote)
        {
            current += QUOTE;
            index++;
            continue;
        }
        if (character === QUOTE)
        {
            quoted = !quoted;
            continue;
        }
        if (character === CSV_SEPARATOR && !quoted)
        {
            cells.push(current);
            current = '';
            continue;
        }
        current += character;
    }
    cells.push(current);
    return cells;
}

function rowOf(header, line)
{
    const cells = splitLine(line);
    const row = {};
    header.forEach((column, index) =>
    {
        row[column] = cells[index] ?? '';
    });
    if (!(ID_COLUMN in row))
    {
        row[ID_COLUMN] = cells[0];
    }
    return row;
}

/** The data rows of a CSV text, each an object keyed by the header row. */
export function ParseCsv(text)
{
    const lines = text
        .split(LINE_BREAK)
        .filter(isDataLine);
    if (!lines.length)
    {
        return [];
    }
    const header = splitLine(lines[0]);
    return lines
        .slice(1)
        .map((line) => rowOf(header, line));
}
