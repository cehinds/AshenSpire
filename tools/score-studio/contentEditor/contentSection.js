// One configured section: its entry list on the left and the selected entry's form on the right.
import { RenderCardLimits } from './cardLimitsBadge.js';
import { LoadEntries } from './contentEntries.js';
import { DataList, El } from './dom.js';
import { EntryList } from './entryList.js';
import { CloneJson, GetFieldValue, SetFieldValue } from './fieldPaths.js';
import { RenderField } from './fieldRenderers.js';
import { WithLockedKeys, WithoutLockedKeys } from './lockedKeys.js';

const CHECKBOX_TYPE = 'checkbox';
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

export class ContentSection
{
    /** `config` is one resolved section; `panes` holds list, form, scroller and suggestions. */
    constructor({ config, fieldSets, store, panes, ui, renderers })
    {
        this.config = config;
        this.fieldSets = fieldSets;
        this.store = store;
        this.panes = panes;
        this.ui = ui;
        this.classes = ui.classes;
        this.renderers = renderers;
        this.entries = [];
        this.selected = null;
        this.showJson = false;
        this.listIds = new Map();
        this.list = new EntryList({
            host: panes.list,
            section: config,
            ui,
            onSelect: (entry) => this.Select(entry),
        });
    }

    get filterText()
    {
        return this.list.filterText;
    }

    /** Loads the section's files (again, after a revert) and draws it. */
    async Open()
    {
        const selectedKey = this.selected?.key;
        this.entries = await LoadEntries(this.config, this.fieldSets, this.store);
        const fields = this.entries.flatMap((entry) => entry.fields);
        const files = [...new Set(suggestFiles(fields))];
        await Promise.all(files.map((file) => this.store.Load(file)));
        const previous = this.entries.find((entry) => entry.key === selectedKey);
        this.selected = previous || this.entries[0] || null;
        this.list.Render(this.entries, this.selected);
        this.RenderForm();
    }

    Filter(text)
    {
        this.list.Filter(text, this.entries, this.selected);
    }

    Select(entry)
    {
        this.selected = entry;
        this.list.MarkSelected(entry);
        this.RenderForm();
    }

    ListId(suggest)
    {
        const cacheKey = JSON.stringify(suggest);
        if (!this.listIds.has(cacheKey))
        {
            const idParts = [
                this.ui.suggestListPrefix,
                this.config.id,
                this.listIds.size,
            ];
            const id = idParts.join(LIST_ID_JOIN);
            this.listIds.set(cacheKey, id);
            this.panes.suggestions.append(DataList(id, this.SuggestOptions(suggest)));
        }
        return this.listIds.get(cacheKey);
    }

    SuggestOptions(suggest)
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

    FieldContext(onChange)
    {
        return {
            onChange,
            refresh: () => this.RenderForm(),
            listId: (suggest) => this.ListId(suggest),
        };
    }

    ApplyField(field, value)
    {
        const entry = this.selected;
        if (!field.path)
        {
            entry.Write(value);
            this.AfterChange();
            return;
        }
        SetFieldValue(entry.Read(), field.path, value);
        this.store.MarkChanged(entry.file);
        this.AfterChange();
    }

    ApplyJson(edited)
    {
        const entry = this.selected;
        entry.Write(WithLockedKeys(entry.Read(), edited, entry.lockedKeys));
        this.AfterChange();
    }

    AfterChange()
    {
        this.list.Update(this.selected);
        if (this.limitsHost)
        {
            RenderCardLimits(this.limitsHost, this.selected.Read(), this.ui);
        }
    }

    JsonToggle()
    {
        const checkbox = El('input', {
            attributes: { type: CHECKBOX_TYPE },
            on: {
                change: () =>
                {
                    this.showJson = checkbox.checked;
                    this.RenderForm();
                },
            },
        });
        checkbox.checked = this.showJson;
        const { jsonToggle, jsonToggleTitle } = this.ui.text;
        return El('label', { className: this.classes.jsonToggle, title: jsonToggleTitle }, [
            checkbox,
            jsonToggle,
        ]);
    }

    FormHead(entry)
    {
        this.limitsHost = this.config.cardLimits
            ? El('div', { className: this.classes.limitsHost })
            : null;
        return El('div', { className: this.classes.formHead }, [
            El('span', { className: this.classes.formTitle, text: entry.Label() }),
            El('span', { className: this.classes.formKey, text: entry.key }),
            this.limitsHost,
            this.JsonToggle(),
        ]);
    }

    FormFields(entry)
    {
        if (this.showJson)
        {
            const visible = CloneJson(WithoutLockedKeys(entry.Read(), entry.lockedKeys));
            const context = this.FieldContext((edited) => this.ApplyJson(edited));
            return [RenderField(this.renderers, this.ui, this.ui.jsonField, visible, context)];
        }
        return entry.fields.map((field) =>
        {
            const context = this.FieldContext((value) => this.ApplyField(field, value));
            const value = GetFieldValue(entry.Read(), field.path);
            return RenderField(this.renderers, this.ui, field, value, context);
        });
    }

    RenderForm()
    {
        const entry = this.selected;
        if (!entry)
        {
            this.panes.form.replaceChildren();
            return;
        }
        const scrollTop = this.panes.scroller.scrollTop;
        const body = El('div', { className: this.classes.formBody }, this.FormFields(entry));
        this.panes.form.replaceChildren(this.FormHead(entry), body);
        this.panes.scroller.scrollTop = scrollTop;
        this.AfterChange();
    }
}
