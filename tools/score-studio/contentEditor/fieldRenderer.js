// Base field renderer: Control(field, value, context) with context { onChange, refresh, listId }.
import { Button, El } from './dom.js';

export const NUMBER_TYPE = 'number';
export const TEXT_TYPE = 'text';
export const ARIA_LABEL = 'aria-label';
const NEWLINE = '\n';

/** The parts every renderer shares: config, a datalist hookup, rows with add and remove. */
export class FieldRenderer
{
    constructor(ui, registry)
    {
        this.ui = ui;
        this.classes = ui.classes;
        this.registry = registry;
    }

    Control()
    {
        throw new Error('Each field type renders its own control.');
    }

    TextRows(text)
    {
        return Math.min(this.ui.sizes.maxTextRows, String(text).split(NEWLINE).length + 1);
    }

    InputOptions(field, context)
    {
        return {
            className: this.classes.control,
            list: field.suggest
                ? context.listId(field.suggest)
                : '',
        };
    }

    /** Applies a structural edit (add, remove, rename), reports it, and redraws the form. */
    Change(context, current, edit)
    {
        edit();
        context.onChange(current);
        context.refresh();
    }

    RowList(rows, onAdd)
    {
        const addButton = Button(this.ui.text.add, this.classes.add, onAdd);
        return El('div', { className: this.classes.rows }, [
            ...rows,
            addButton,
        ]);
    }

    Row(children, onRemove, title = '')
    {
        const { remove, removeTitle } = this.ui.text;
        const removeButton = Button(remove, this.classes.remove, onRemove, removeTitle);
        return El('div', { className: this.classes.row, title }, [
            ...children,
            removeButton,
        ]);
    }
}
