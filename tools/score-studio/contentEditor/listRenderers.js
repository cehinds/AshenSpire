// Renderers for lists: plain values one per line, or objects with configured sub-fields.
import { SetFieldValue } from './fieldPaths.js';
import { ARIA_LABEL, FieldRenderer, NUMBER_TYPE } from './fieldRenderer.js';

/** A list of plain values (strings or numbers), one input per line. */
export class ListRenderer extends FieldRenderer
{
    Control(field, value, context)
    {
        const items = Array.isArray(value)
            ? value
            : [];
        const itemField = {
            ...field,
            type: field.itemType,
        };
        const rows = items.map((item, index) =>
        {
            const itemContext = {
                ...context,
                onChange: (itemValue) =>
                {
                    items[index] = itemValue;
                    context.onChange(items);
                },
            };
            const input = this.registry[field.itemType].Control(itemField, item, itemContext);
            const remove = () => this.Change(context, items, () => items.splice(index, 1));
            return this.Row([input], remove);
        });
        const blank = field.itemType === NUMBER_TYPE
            ? 0
            : '';
        return this.RowList(rows, () => this.Change(context, items, () => items.push(blank)));
    }
}

/** A list of objects; each line shows the configured sub-fields and keeps any other keys. */
export class ObjectsRenderer extends FieldRenderer
{
    Control(field, value, context)
    {
        const items = Array.isArray(value)
            ? value
            : [];
        const rows = items.map((item, index) =>
        {
            const inputs = field.fields.map((subField) =>
            {
                return this.SubControl(subField, item, items, context);
            });
            const remove = () => this.Change(context, items, () => items.splice(index, 1));
            return this.Row(inputs, remove, JSON.stringify(item));
        });
        return this.RowList(rows, () => this.Change(context, items, () => items.push({})));
    }

    SubControl(subField, item, items, context)
    {
        const compactField = {
            ...subField,
            compact: true,
            omitEmpty: true,
        };
        const subContext = {
            ...context,
            onChange: (subValue) =>
            {
                SetFieldValue(item, subField.path, subValue);
                context.onChange(items);
            },
        };
        const renderer = this.registry[subField.type];
        const control = renderer.Control(compactField, item[subField.path], subContext);
        control.title = subField.label;
        control.setAttribute(ARIA_LABEL, subField.label);
        return control;
    }
}
