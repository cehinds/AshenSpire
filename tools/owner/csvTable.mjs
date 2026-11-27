// Reads a content CSV into rows keyed by its header; the CSV rules live in ownerDiff.json.
import { OWNER_DIFF } from './ownerConfig.mjs';

const CSV = OWNER_DIFF.csv;
const LINE_BREAK = /\r?\n/;

function isDataLine(line)
{
    return line.trim() && !line.startsWith(CSV.commentPrefix);
}

function readCell(state, line)
{
    const character = line[state.index];
    const escapedQuote = state.quoted
        && character === CSV.quote
        && line[state.index + 1] === CSV.quote;
    if (escapedQuote)
    {
        state.current += CSV.quote;
        state.index++;
        return;
    }
    if (character === CSV.quote)
    {
        state.quoted = !state.quoted;
        return;
    }
    if (character === CSV.separator && !state.quoted)
    {
        state.cells.push(state.current);
        state.current = '';
        return;
    }
    state.current += character;
}

function splitLine(line)
{
    const state = {
        cells: [],
        current: '',
        quoted: false,
        index: 0,
    };
    for (; state.index < line.length; state.index++)
    {
        readCell(state, line);
    }
    state.cells.push(state.current);
    return state.cells;
}

function rowOf(header, line)
{
    const cells = splitLine(line);
    const row = {};
    header.forEach((column, index) =>
    {
        row[column] = cells[index] ?? '';
    });
    if (!(CSV.idColumn in row))
    {
        row[CSV.idColumn] = cells[0];
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
