// Datalists of suggested values (fixed options, or ids from another content file) for text inputs.
import { DataList } from './dom.js';

const LIST_ID_JOIN = '-';

function suggestFiles(fields)
{
    return fields.flatMap((field) =>
    {
        const own = field.suggest?.file
            ? [field.suggest.file]
            : [];
        return [
            ...own,
            ...suggestFiles(field.fields || []),
        ];
    });
}

export class SuggestionLists
{
    /** `host` holds the datalists; ids start with `prefix` and the section id. */
    constructor({ host, store, prefix, sectionId })
    {
        this.host = host;
        this.store = store;
        this.idStart = [prefix, sectionId].join(LIST_ID_JOIN);
        this.ids = new Map();
    }

    /** Loads every file the fields suggest ids from. */
    async LoadFor(fields)
    {
        const files = [...new Set(suggestFiles(fields))];
        await Promise.all(files.map((file) => this.store.Load(file)));
    }

    Options(suggest)
    {
        if (!suggest.file)
        {
            return suggest.options || [];
        }
        const prefix = suggest.prefix || '';
        const items = this.store.Root(suggest.file);
        const list = Array.isArray(items)
            ? items
            : [];
        return list.map((item) => `${prefix}${item.id}`);
    }

    /** The datalist id for a field's `suggest` config, created on first use. */
    ListId(suggest)
    {
        const cacheKey = JSON.stringify(suggest);
        if (!this.ids.has(cacheKey))
        {
            const id = [this.idStart, this.ids.size].join(LIST_ID_JOIN);
            this.ids.set(cacheKey, id);
            this.host.append(DataList(id, this.Options(suggest)));
        }
        return this.ids.get(cacheKey);
    }
}
