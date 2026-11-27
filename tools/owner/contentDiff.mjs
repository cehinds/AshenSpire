// Turns a before/after content file into plain change lines and a commit subject.
// The wording lives in ownerDiff.json.
import { FormatText, OWNER_DIFF } from './ownerConfig.mjs';
import { ParseCsv } from './csvTable.mjs';
import { CHANGE_KIND, DisplayNameOf, WalkChanges } from './contentWalk.mjs';

const PHRASES = OWNER_DIFF.phrases;
const FILE_EXTENSION = /\.(json|csv)$/;
const NUMERIC_TEXT = /^-?\d+(\.\d+)?$/;
const PATH_SEPARATOR = '/';

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
    return path.endsWith(OWNER_DIFF.csv.extension)
        ? ParseCsv(text)
        : JSON.parse(text);
}

function phrase(key, values)
{
    return FormatText(PHRASES[key], {
        arrow: OWNER_DIFF.arrow,
        ...values,
    });
}

function wholeFileChange(
    kind,
    path,
    values,
)
{
    const change = {
        entity: fileLabel(path),
        field: '',
        before: values.before,
        after: values.after,
        kind,
    };
    return [change];
}

function listItems(key, items)
{
    if (!items.length)
    {
        return null;
    }
    const listed = items
        .map(formatValue)
        .join(OWNER_DIFF.listJoiner);
    return phrase(key, { items: listed });
}

function listPhrase(change)
{
    const added = change.after.filter((item) => !change.before.includes(item));
    const removed = change.before.filter((item) => !change.after.includes(item));
    const parts = [
        listItems('listAdd', added),
        listItems('listRemove', removed),
    ].filter(Boolean);
    const shown = parts.length
        ? parts
        : [PHRASES.reorder];
    return phrase('list', {
        entity: change.entity,
        field: change.field,
        parts: shown.join(OWNER_DIFF.partJoiner),
    });
}

function setPhraseKey(change, numbers)
{
    const numbersDiffer = numbers.before !== null
        && numbers.after !== null
        && numbers.before !== numbers.after;
    if (numbersDiffer)
    {
        return numbers.after > numbers.before
            ? 'raise'
            : 'lower';
    }
    if (change.before === undefined)
    {
        return 'set';
    }
    if (change.after === undefined)
    {
        return 'clear';
    }
    return 'change';
}

function setPhrase(where, change)
{
    const numbers = {
        before: asNumber(change.before),
        after: asNumber(change.after),
    };
    const key = setPhraseKey(change, numbers);
    const isNumeric = key === 'raise' || key === 'lower';
    const shown = isNumeric
        ? numbers
        : change;
    return phrase(key, {
        where,
        before: formatValue(shown.before),
        after: formatValue(shown.after),
    });
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
        return phrase('reformat', { file: fileLabel(path) });
    }
    if (entities.size === 1)
    {
        return phrase('editOne', {
            entity: [...entities][0],
            count: lines.length,
        });
    }
    return phrase('editMany', {
        count: entities.size,
        file: fileLabel(path),
    });
}

function clip(text)
{
    const { subjectLimit, ellipsis } = OWNER_DIFF;
    if (text.length <= subjectLimit)
    {
        return text;
    }
    return `${text.slice(0, subjectLimit - ellipsis.length)}${ellipsis}`;
}

/** One readable line for one change, such as "Raise Husk Brute poiseMax 5→6". */
export function DescribeChange(change)
{
    const where = change.field
        ? `${change.entity}${OWNER_DIFF.segmentJoiner}${change.field}`
        : change.entity;
    if (change.kind === CHANGE_KIND.add)
    {
        return phrase('add', { where });
    }
    if (change.kind === CHANGE_KIND.remove)
    {
        return phrase('remove', { where });
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
    const entity = DisplayNameOf(after, fileLabel(path));
    return WalkChanges(
        before,
        after,
        entity,
    );
}

/** A commit subject (clipped to the configured limit) and one line per change. */
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
    const subject = subjectFor(
        path,
        changes,
        lines,
    );
    return {
        subject: clip(subject),
        lines,
    };
}
