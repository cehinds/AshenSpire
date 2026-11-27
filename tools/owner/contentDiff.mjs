// Turns a before/after content file into plain change lines and a commit subject.
const SUBJECT_LIMIT = 72;
const ARROW = '→';
const ENTRY_KEYS = [
    'id',
    'card',
    'ref',
    'slot',
];
const LABEL_KEYS = [
    'op',
    'id',
    'card',
    'slot',
    'status',
    'tag',
];
const QUIET_SEGMENTS = new Set([
    'effects',
    'stats',
    'passives',
    'shared',
]);
const CSV_EXTENSION = '.csv';
const CSV_SEPARATOR = ',';
const COMMENT_PREFIX = '#';
const ELLIPSIS = '...';
const NUMERIC_TEXT = /^-?\d+(\.\d+)?$/;
const FILE_EXTENSION = /\.(json|csv)$/;

function isPlainObject(value)
{
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function entryKeyOf(value)
{
    if (!isPlainObject(value))
    {
        return null;
    }
    const key = ENTRY_KEYS.find((candidate) => typeof value[candidate] === 'string');
    return key
        ? `${key}:${value[key]}`
        : null;
}

function displayNameOf(value, fallback)
{
    if (isPlainObject(value) && typeof value.name === 'string')
    {
        return value.name;
    }
    if (isPlainObject(value))
    {
        const key = ENTRY_KEYS.find((candidate) => typeof value[candidate] === 'string');
        if (key)
        {
            return value[key];
        }
    }
    return fallback;
}

function segmentLabel(value, index)
{
    if (isPlainObject(value))
    {
        const key = LABEL_KEYS.find((candidate) => typeof value[candidate] === 'string');
        if (key)
        {
            return value[key];
        }
    }
    return `#${index + 1}`;
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

function sameValue(left, right)
{
    return JSON.stringify(left) === JSON.stringify(right);
}

function fieldLabel(segments)
{
    const shown = segments.filter((segment) => !QUIET_SEGMENTS.has(segment));
    return shown.length
        ? shown.join(' ')
        : segments.join(' ');
}

function isEntryList(list)
{
    return list.length > 0 && list.every((item) => entryKeyOf(item) !== null);
}

function isPrimitiveList(list)
{
    return list.every((item) => !isPlainObject(item) && !Array.isArray(item));
}

/** One change: { entity, field, before, after, kind } with kind 'set' | 'add' | 'remove' | 'list'. */
function walk(before, after, entity, segments, changes)
{
    if (sameValue(before, after))
    {
        return;
    }
    if (Array.isArray(before) && Array.isArray(after))
    {
        walkList(before, after, entity, segments, changes);
        return;
    }
    if (isPlainObject(before) && isPlainObject(after))
    {
        const keys = new Set([
            ...Object.keys(before),
            ...Object.keys(after),
        ]);
        for (const key of keys)
        {
            walk(before[key], after[key], entity, [...segments, key], changes);
        }
        return;
    }
    changes.push({
        entity,
        field: fieldLabel(segments),
        before,
        after,
        kind: 'set',
    });
}

function walkList(before, after, entity, segments, changes)
{
    if (isEntryList(before) && isEntryList(after))
    {
        walkEntryList(before, after, entity, segments, changes);
        return;
    }
    if (isPrimitiveList(before) && isPrimitiveList(after))
    {
        changes.push({
            entity,
            field: fieldLabel(segments),
            before,
            after,
            kind: 'list',
        });
        return;
    }
    const longest = Math.max(before.length, after.length);
    for (let index = 0; index < longest; index++)
    {
        const label = segmentLabel(after[index] ?? before[index], index);
        walk(before[index], after[index], entity, [...segments, label], changes);
    }
}

function walkEntryList(before, after, entity, segments, changes)
{
    const beforeByKey = new Map(before.map((item) => [entryKeyOf(item), item]));
    const afterByKey = new Map(after.map((item) => [entryKeyOf(item), item]));
    const isTopLevel = segments.length === 0;
    for (const [key, item] of afterByKey)
    {
        const name = displayNameOf(item, key);
        const owner = isTopLevel
            ? name
            : entity;
        const nested = isTopLevel
            ? []
            : [...segments, name];
        if (!beforeByKey.has(key))
        {
            changes.push({
                entity: owner,
                field: fieldLabel(nested),
                before: undefined,
                after: item,
                kind: 'add',
            });
            continue;
        }
        walk(beforeByKey.get(key), item, owner, nested, changes);
    }
    for (const [key, item] of beforeByKey)
    {
        if (afterByKey.has(key))
        {
            continue;
        }
        changes.push({
            entity: isTopLevel
                ? displayNameOf(item, key)
                : entity,
            field: fieldLabel(isTopLevel
                ? []
                : [...segments, displayNameOf(item, key)]),
            before: item,
            after: undefined,
            kind: 'remove',
        });
    }
}

function listPhrase(change)
{
    const added = change.after.filter((item) => !change.before.includes(item));
    const removed = change.before.filter((item) => !change.after.includes(item));
    const parts = [];
    if (added.length)
    {
        parts.push(`add ${added.map(formatValue).join(', ')}`);
    }
    if (removed.length)
    {
        parts.push(`remove ${removed.map(formatValue).join(', ')}`);
    }
    if (!parts.length)
    {
        parts.push('reorder');
    }
    return `${change.entity} ${change.field}: ${parts.join('; ')}`;
}

/** One readable line for one change, such as "Raise Husk Brute poiseMax 5→6". */
export function DescribeChange(change)
{
    const where = change.field
        ? `${change.entity} ${change.field}`
        : change.entity;
    if (change.kind === 'add')
    {
        return `Add ${where}`;
    }
    if (change.kind === 'remove')
    {
        return `Remove ${where}`;
    }
    if (change.kind === 'list')
    {
        return listPhrase(change);
    }
    const beforeNumber = asNumber(change.before);
    const afterNumber = asNumber(change.after);
    if (beforeNumber !== null && afterNumber !== null)
    {
        const verb = afterNumber > beforeNumber
            ? 'Raise'
            : 'Lower';
        return `${verb} ${where} ${beforeNumber}${ARROW}${afterNumber}`;
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

function parseCsv(text)
{
    const lines = text
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.startsWith(COMMENT_PREFIX));
    if (!lines.length)
    {
        return [];
    }
    const header = splitCsvLine(lines[0]);
    return lines.slice(1).map((line) =>
    {
        const cells = splitCsvLine(line);
        const row = {};
        header.forEach((column, index) =>
        {
            row[column] = cells[index] ?? '';
        });
        if (!('id' in row))
        {
            row.id = cells[0];
        }
        return row;
    });
}

function splitCsvLine(line)
{
    const cells = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index++)
    {
        const character = line[index];
        if (character === '"' && line[index + 1] === '"' && quoted)
        {
            current += '"';
            index++;
        }
        else if (character === '"')
        {
            quoted = !quoted;
        }
        else if (character === CSV_SEPARATOR && !quoted)
        {
            cells.push(current);
            current = '';
        }
        else
        {
            current += character;
        }
    }
    cells.push(current);
    return cells;
}

function parseContent(path, text)
{
    if (text === null || text === undefined)
    {
        return undefined;
    }
    return path.endsWith(CSV_EXTENSION)
        ? parseCsv(text)
        : JSON.parse(text);
}

function fileLabel(path)
{
    return path.split('/').pop().replace(FILE_EXTENSION, '');
}

function documentName(path, value)
{
    return displayNameOf(value, fileLabel(path));
}

/** Lists every change between two versions of one content file (text or null when absent). */
export function CollectChanges(path, beforeText, afterText)
{
    const before = parseContent(path, beforeText);
    const after = parseContent(path, afterText);
    const label = fileLabel(path);
    if (before === undefined)
    {
        return [{
            entity: label,
            field: '',
            before: undefined,
            after,
            kind: 'add',
        }];
    }
    if (after === undefined)
    {
        return [{
            entity: label,
            field: '',
            before,
            after: undefined,
            kind: 'remove',
        }];
    }
    const changes = [];
    walk(before, after, documentName(path, after), [], changes);
    return changes;
}

function clip(text)
{
    return text.length > SUBJECT_LIMIT
        ? `${text.slice(0, SUBJECT_LIMIT - ELLIPSIS.length)}${ELLIPSIS}`
        : text;
}

/** A commit subject (at most 72 characters) and one line per change. */
export function DescribeFileChange(path, beforeText, afterText)
{
    const changes = CollectChanges(path, beforeText, afterText);
    const lines = changes.map(DescribeChange);
    const entities = new Set(changes.map((change) => change.entity));
    let subject;
    if (lines.length === 1)
    {
        subject = lines[0];
    }
    else if (entities.size === 1)
    {
        subject = `Edit ${[...entities][0]} (${lines.length} changes)`;
    }
    else if (lines.length === 0)
    {
        subject = `Reformat ${fileLabel(path)}`;
    }
    else
    {
        subject = `Edit ${entities.size} entries in ${fileLabel(path)}`;
    }
    return {
        subject: clip(subject),
        lines,
    };
}
