// The searchable entry list: dense one-line rows, value right-aligned, details on hover.
import { El } from './dom.js';
import { FillTemplate } from './textTemplate.js';

const OPTION_ROLE = 'option';
const FOCUSABLE = '0';

export class EntryList
{
    /** `host` holds the rows; `onSelect(entry)` runs when a row is clicked. */
    constructor({ host, section, ui, onSelect })
    {
        this.host = host;
        this.section = section;
        this.classes = ui.classes;
        this.onSelect = onSelect;
        this.rows = new Map();
        this.filterText = '';
    }

    Value(entry)
    {
        return FillTemplate(this.section.listValue, entry.Read());
    }

    Row(entry, selected)
    {
        const detail = FillTemplate(this.section.listDetail, entry.Read());
        const name = El('span', { className: this.classes.entryName, text: entry.Label() });
        const value = El('span', { className: this.classes.entryValue, text: this.Value(entry) });
        const row = El('div', {
            className: this.classes.entry,
            title: detail || entry.key,
            attributes: {
                role: OPTION_ROLE,
                tabindex: FOCUSABLE,
            },
            on: {
                click: () => this.onSelect(entry),
            },
        }, [
            name,
            value,
        ]);
        row.classList.toggle(this.classes.selected, entry === selected);
        return row;
    }

    Matches(entry)
    {
        const haystack = `${entry.Label()} ${entry.key} ${this.Value(entry)}`.toLowerCase();
        return !this.filterText || haystack.includes(this.filterText);
    }

    Render(entries, selected)
    {
        this.rows.clear();
        const shown = entries.filter((entry) => this.Matches(entry));
        const rows = shown.map((entry) =>
        {
            const row = this.Row(entry, selected);
            this.rows.set(entry, row);
            return row;
        });
        this.host.replaceChildren(...rows);
    }

    Filter(text, entries, selected)
    {
        this.filterText = text.trim().toLowerCase();
        this.Render(entries, selected);
    }

    MarkSelected(selected)
    {
        for (const [entry, row] of this.rows)
        {
            row.classList.toggle(this.classes.selected, entry === selected);
        }
    }

    /** Redraws one row's name and value after an edit. */
    Update(entry)
    {
        const row = this.rows.get(entry);
        if (!row)
        {
            return;
        }
        const fresh = this.Row(entry, entry);
        row.replaceWith(fresh);
        this.rows.set(entry, fresh);
    }
}
