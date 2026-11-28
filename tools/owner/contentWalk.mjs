// Walks two versions of a content value and lists each change with the entry it belongs to.
import { OWNER_DIFF } from './ownerConfig.mjs';

const ENTRY_KEYS = OWNER_DIFF.entryKeys;
const LABEL_KEYS = OWNER_DIFF.labelKeys;
const QUIET_SEGMENTS = new Set(OWNER_DIFF.quietSegments);
const NAME_KEY = OWNER_DIFF.nameKey;
const POSITION_PREFIX = OWNER_DIFF.positionPrefix;
const SEGMENT_SEPARATOR = OWNER_DIFF.segmentJoiner;
export const CHANGE_KIND = Object.freeze({
    set: 'set',
    add: 'add',
    remove: 'remove',
    list: 'list',
});

function isPlainObject(value)
{
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function firstStringKey(value, keys)
{
    if (!isPlainObject(value))
    {
        return null;
    }
    return keys.find((key) => typeof value[key] === 'string') || null;
}

function entryKeyOf(value)
{
    const key = firstStringKey(value, ENTRY_KEYS);
    if (!key)
    {
        return null;
    }
    return `${key}:${value[key]}`;
}

function segmentLabel(value, index)
{
    const key = firstStringKey(value, LABEL_KEYS);
    if (!key)
    {
        return `${POSITION_PREFIX}${index + 1}`;
    }
    return value[key];
}

function sameValue(left, right)
{
    return JSON.stringify(left) === JSON.stringify(right);
}

function fieldLabel(segments)
{
    const shown = segments.filter((segment) => !QUIET_SEGMENTS.has(segment));
    const chosen = shown.length
        ? shown
        : segments;
    return chosen.join(SEGMENT_SEPARATOR);
}

function isEntryList(list)
{
    const keys = list.map(entryKeyOf);
    const allKeyed = list.length > 0 && keys.every((key) => key !== null);
    return allKeyed && new Set(keys).size === keys.length;
}

function isPrimitiveList(list)
{
    return list.every((item) => !isPlainObject(item) && !Array.isArray(item));
}

function keyedMap(list)
{
    return new Map(list.map((item) => [
        entryKeyOf(item),
        item,
    ]));
}

/** Collects changes; `place` is { entity, segments } for where a value sits. */
class ChangeWalker
{
    constructor()
    {
        this.changes = [];
    }

    Record(
        kind,
        place,
        values,
    )
    {
        this.changes.push({
            entity: place.entity,
            field: fieldLabel(place.segments),
            before: values.before,
            after: values.after,
            kind,
        });
    }

    Visit(values, place)
    {
        if (sameValue(values.before, values.after))
        {
            return;
        }
        const bothLists = Array.isArray(values.before) && Array.isArray(values.after);
        if (bothLists)
        {
            this.VisitList(values, place);
            return;
        }
        const bothObjects = isPlainObject(values.before) && isPlainObject(values.after);
        if (bothObjects)
        {
            this.VisitObject(values, place);
            return;
        }
        this.Record(
            CHANGE_KIND.set,
            place,
            values,
        );
    }

    VisitObject(values, place)
    {
        const keys = new Set([
            ...Object.keys(values.before),
            ...Object.keys(values.after),
        ]);
        for (const key of keys)
        {
            const inner = {
                before: values.before[key],
                after: values.after[key],
            };
            this.Visit(inner, this.Deeper(place, key));
        }
    }

    VisitList(values, place)
    {
        if (isEntryList(values.before) && isEntryList(values.after))
        {
            this.VisitEntries(values, place);
            return;
        }
        if (isPrimitiveList(values.before) && isPrimitiveList(values.after))
        {
            this.Record(
                CHANGE_KIND.list,
                place,
                values,
            );
            return;
        }
        this.VisitPositions(values, place);
    }

    VisitPositions(values, place)
    {
        const longest = Math.max(values.before.length, values.after.length);
        for (let index = 0; index < longest; index++)
        {
            const inner = {
                before: values.before[index],
                after: values.after[index],
            };
            const label = segmentLabel(inner.after ?? inner.before, index);
            this.Visit(inner, this.Deeper(place, label));
        }
    }

    VisitEntries(values, place)
    {
        const beforeByKey = keyedMap(values.before);
        const afterByKey = keyedMap(values.after);
        for (const [key, item] of afterByKey)
        {
            const entryPlace = this.EntryPlace(
                place,
                item,
                key,
            );
            const previous = beforeByKey.get(key);
            if (previous === undefined)
            {
                this.Record(
                    CHANGE_KIND.add,
                    entryPlace,
                    { after: item },
                );
                continue;
            }
            this.Visit({ before: previous, after: item }, entryPlace);
        }
        for (const [key, item] of beforeByKey)
        {
            if (afterByKey.has(key))
            {
                continue;
            }
            this.Record(
                CHANGE_KIND.remove,
                this.EntryPlace(
                    place,
                    item,
                    key,
                ),
                { before: item },
            );
        }
    }

    EntryPlace(
        place,
        item,
        key,
    )
    {
        const name = DisplayNameOf(item, key);
        const isTopLevel = place.segments.length === 0;
        if (isTopLevel)
        {
            return {
                entity: name,
                segments: [],
            };
        }
        return this.Deeper(place, name);
    }

    Deeper(place, segment)
    {
        return {
            entity: place.entity,
            segments: [
                ...place.segments,
                segment,
            ],
        };
    }
}

/** An entry's name for people: its name, else its id-like key, else the fallback. */
export function DisplayNameOf(value, fallback)
{
    if (isPlainObject(value) && typeof value[NAME_KEY] === 'string')
    {
        return value[NAME_KEY];
    }
    const key = firstStringKey(value, ENTRY_KEYS);
    if (!key)
    {
        return fallback;
    }
    return value[key];
}

/** Every change between two parsed values, named from `entity` downwards. */
export function WalkChanges(
    before,
    after,
    entity,
)
{
    const walker = new ChangeWalker();
    const place = {
        entity,
        segments: [],
    };
    walker.Visit({ before, after }, place);
    return walker.changes;
}
