// Turns a before/after content file into plain change lines and a commit subject.
import { ParseCsv } from './csvTable.mjs';
import { CHANGE_KIND, DisplayNameOf, WalkChanges } from './contentWalk.mjs';

const SUBJECT_LIMIT = 72;
const ARROW = '→';
const ELLIPSIS = '...';
const CSV_EXTENSION = '.csv';
const FILE_EXTENSION = /\.(json|csv)$/;
const NUMERIC_TEXT = /^-?\d+(\.\d+)?$/;
const PATH_SEPARATOR = '/';
const LIST_JOINER = ', ';
const PART_JOINER = '; ';
const REORDER_WORD = 'reorder';

function fileLabel(path)
{
    return path
        .split(PATH_SEPARATOR)
        .pop()
        .replace(FILE_EXTENSION, '');
}

function formatValue(value)
{
    if (typeof value === 'string')
    {
        return value;
    }
    return JSON.stringify(value);
}

function asNumber(value)
{
    if (typeof value === 'number')
    {
        return value;
    }
    const isNumericText = typeof value === 'string' && NUMERIC_TEXT.test(value.trim());
    return isNumericText
        ? Number(value)
        : null;
}

function parseContent(path, text)
{
    if (text === null || text === undefined)
    {
        return undefined;
    }
    return path.endsWith(CSV_EXTENSION)
        ? ParseCsv(text)
        : JSON.parse(text);
}

function wholeFileChange(
    kind,
    path,
    values,
)
{
    return [
        {
            entity: fileLabel(path),
            field: '',
            before: values.before,
            after: values.after,
            kind,
        },
    ];
}

function listPhrase(change)
{
    const added = change.after.filter((item) => !change.before.includes(item));
    const removed = change.before.filter((item) => !change.after.includes(item));
    const parts = [];
    if (added.length)
    {
        parts.push(`add ${added.map(formatValue).join(LIST_JOINER)}`);
    }
    if (removed.length)
    {
        parts.push(`remove ${removed.map(formatValue).join(LIST_JOINER)}`);
    }
    if (!parts.length)
    {
        parts.push(REORDER_WORD);
    }
    return `${change.entity} ${change.field}: ${parts.join(PART_JOINER)}`;
}

function numberPhrase(
    where,
    before,
    after,
)
{
    const verb = after > before
        ? 'Raise'
        : 'Lower';
    return `${verb} ${where} ${before}${ARROW}${after}`;
}

function setPhrase(where, change)
{
    const beforeNumber = asNumber(change.before);
    const afterNumber = asNumber(change.after);
    const numbersDiffer = beforeNumber !== null
        && afterNumber !== null
        && beforeNumber !== afterNumber;
    if (numbersDiffer)
    {
        return numberPhrase(
            where,
            beforeNumber,
            afterNumber,
        );
    }
    if (change.before === undefined)
    {
        return `Set ${where} to ${formatValue(change.after)}`;
    }
    if (change.after === undefined)
    {
        return `Clear ${where}`;
    }
    return `Change ${where} ${formatValue(change.before)}${ARROW}${formatValue(change.after)}`;
}

function subjectFor(
    path,
    changes,
    lines,
)
{
    const entities = new Set(changes.map((change) => change.entity));
    if (lines.length === 1)
    {
        return lines[0];
    }
    if (lines.length === 0)
    {
        return `Reformat ${fileLabel(path)}`;
    }
    if (entities.size === 1)
    {
        return `Edit ${[...entities][0]} (${lines.length} changes)`;
    }
    return `Edit ${entities.size} entries in ${fileLabel(path)}`;
}

function clip(text)
{
    if (text.length <= SUBJECT_LIMIT)
    {
        return text;
    }
    return `${text.slice(0, SUBJECT_LIMIT - ELLIPSIS.length)}${ELLIPSIS}`;
}

/** One readable line for one change, such as "Raise Husk Brute poiseMax 5→6". */
export function DescribeChange(change)
{
    const where = change.field
        ? `${change.entity} ${change.field}`
        : change.entity;
    if (change.kind === CHANGE_KIND.add)
    {
        return `Add ${where}`;
    }
    if (change.kind === CHANGE_KIND.remove)
    {
        return `Remove ${where}`;
    }
    if (change.kind === CHANGE_KIND.list)
    {
        return listPhrase(change);
    }
    return setPhrase(where, change);
}

/** Every change between two versions of one content file (text, or null when absent). */
export function CollectChanges(
    path,
    beforeText,
    afterText,
)
{
    const before = parseContent(path, beforeText);
    const after = parseContent(path, afterText);
    if (before === undefined)
    {
        return wholeFileChange(
            CHANGE_KIND.add,
            path,
            { after },
        );
    }
    if (after === undefined)
    {
        return wholeFileChange(
            CHANGE_KIND.remove,
            path,
            { before },
        );
    }
    return WalkChanges(
        before,
        after,
        DisplayNameOf(after, fileLabel(path)),
    );
}

/** A commit subject (at most 72 characters) and one line per change. */
export function DescribeFileChange(
    path,
    beforeText,
    afterText,
)
{
    const changes = CollectChanges(
        path,
        beforeText,
        afterText,
    );
    const lines = changes.map(DescribeChange);
    return {
        subject: clip(subjectFor(
            path,
            changes,
            lines,
        )),
        lines,
    };
}
