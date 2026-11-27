// One configured section: its entry list on the left and the selected entry's form on the right.
import { RenderCardLimits } from './cardLimitsBadge.js';
import { LoadEntries } from './contentEntries.js';
import { El } from './dom.js';
import { EntryList } from './entryList.js';
import { CloneJson, GetFieldValue, SetFieldValue } from './fieldPaths.js';
import { RenderField } from './fieldRenderers.js';
import { WithLockedKeys, WithoutLockedKeys } from './lockedKeys.js';
import { SuggestionLists } from './suggestionLists.js';

const CHECKBOX_TYPE = 'checkbox';

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
        this.suggestions = new SuggestionLists({
            host: panes.suggestions,
            store,
            prefix: ui.suggestListPrefix,
            sectionId: config.id,
        });
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
    Open()
    {
        return this.panes.latestLoad.Run(() => this.Load(), (entries) => this.Show(entries));
    }

    async Load()
    {
        const entries = await LoadEntries(this.config, this.fieldSets, this.store);
        await this.suggestions.LoadFor(entries.flatMap((entry) => entry.fields));
        return entries;
    }

    /** Draws loaded entries into the shared panes; only the newest load gets here. */
    Show(entries)
    {
        const selectedKey = this.selected?.key;
        this.entries = entries;
        const previous = entries.find((entry) => entry.key === selectedKey);
        this.selected = previous || entries[0] || null;
        this.list.Render(entries, this.selected);
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

    FieldContext(onChange)
    {
        return {
            onChange,
            refresh: () => this.RenderForm(),
            listId: (suggest) => this.suggestions.ListId(suggest),
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
