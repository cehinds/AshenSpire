// Turns one configured section into the entries the list shows, each reading its file lazily.
import { GetFieldValue, SetFieldValue } from './fieldPaths.js';

const FOLDER_SEPARATOR = '/';

function fieldsFor(section, group, fieldSets)
{
    const setName = group.fieldSet || section.fieldSet;
    return setName
        ? fieldSets[setName]
        : section.fields;
}

/** One entry: how to name it, read it and write it back through the store. */
function makeEntry({ key, file, store, path, fields, labelOf, lockedKeys })
{
    const entry = {
        key,
        file,
        fields,
        lockedKeys: lockedKeys || [],
        Read: () => GetFieldValue(store.Root(file), path),
        Label: () => labelOf(entry.Read()),
        Write: (value) =>
        {
            if (!path)
            {
                store.SetRoot(file, value);
                return;
            }
            SetFieldValue(store.Root(file), path, value);
            store.MarkChanged(file);
        },
    };
    return entry;
}

function childPath(parentPath, key)
{
    return parentPath
        ? `${parentPath}.${key}`
        : String(key);
}

function eachEntries(section, group, base)
{
    const container = GetFieldValue(base.store.Root(base.file), group.each) || {};
    const keys = Array.isArray(container)
        ? container.map((item, index) => index)
        : Object.keys(container);
    return keys.map((key) =>
    {
        const item = container[key];
        const itemKey = Array.isArray(container)
            ? item?.[section.keyField] ?? String(key)
            : key;
        const labelOf = (value) => value?.[section.labelField] ?? itemKey;
        return makeEntry({
            ...base,
            key: itemKey,
            path: childPath(group.each, key),
            labelOf,
        });
    });
}

async function fileEntries(section, fieldSets, store)
{
    await store.Load(section.file);
    const entries = [];
    for (const group of section.entries)
    {
        const base = {
            file: section.file,
            store,
            fields: fieldsFor(section, group, fieldSets),
            lockedKeys: section.lockedKeys,
        };
        if (group.each !== undefined)
        {
            entries.push(...eachEntries(section, group, base));
            continue;
        }
        const labelOf = () => group.label;
        entries.push(makeEntry({
            ...base,
            key: group.path || group.label,
            path: group.path,
            labelOf,
        }));
    }
    return entries;
}

async function folderEntries(section, fieldSets, store)
{
    const names = await store.api.ListFolder(section.folder);
    const files = names.map((name) => `${section.folder}${FOLDER_SEPARATOR}${name}`);
    await Promise.all(files.map((file) => store.Load(file)));
    return files.map((file, index) =>
    {
        const fallback = names[index];
        return makeEntry({
            key: fallback,
            file,
            store,
            path: '',
            fields: fieldsFor(section, {}, fieldSets),
            lockedKeys: section.lockedKeys,
            labelOf: (value) => value?.[section.labelField] ?? fallback,
        });
    });
}

/** Every entry of a section, in file or folder order. */
export async function LoadEntries(section, fieldSets, store)
{
    return section.folder
        ? folderEntries(section, fieldSets, store)
        : fileEntries(section, fieldSets, store);
}
