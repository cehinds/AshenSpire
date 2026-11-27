// The renderer for name to value pairs, such as room odds.
import { El } from './dom.js';
import { FieldRenderer, TEXT_TYPE } from './fieldRenderer.js';
import { UnusedKey } from './unusedKey.js';

/** An object of name to value pairs, such as room odds; renaming keeps the line in place. */
export class MapRenderer extends FieldRenderer
{
    Control(field, value, context)
    {
        const current = value && typeof value === 'object'
            ? value
            : {};
        const rows = Object.keys(current).map((key) => this.PairRow(field, current, key, context));
        return this.RowList(rows, () => this.Change(context, current, () =>
        {
            current[UnusedKey(current, this.ui.newMapKey)] = '';
        }));
    }

    PairRow(field, current, key, context)
    {
        const keyInput = this.KeyInput(key, (newKey) =>
        {
            context.onChange(this.Rename(current, key, newKey));
            context.refresh();
        });
        const valueField = {
            ...field,
            type: field.valueType,
        };
        const valueContext = {
            ...context,
            onChange: (entryValue) =>
            {
                current[key] = entryValue;
                context.onChange(current);
            },
        };
        const valueRenderer = this.registry[field.valueType];
        const valueInput = valueRenderer.Control(valueField, current[key], valueContext);
        const remove = () => this.Change(context, current, () =>
        {
            delete current[key];
        });
        return this.Row([keyInput, valueInput], remove);
    }

    KeyInput(key, onRename)
    {
        const input = El('input', {
            className: `${this.classes.control} ${this.classes.key}`,
            attributes: { type: TEXT_TYPE },
            on: {
                change: () => onRename(input.value.trim()),
            },
        });
        input.value = key;
        return input;
    }

    Rename(object, oldKey, newKey)
    {
        if (!newKey || newKey === oldKey || newKey in object)
        {
            return object;
        }
        const pairs = Object.entries(object).map(([key, entryValue]) =>
        {
            return key === oldKey
                ? [newKey, entryValue]
                : [key, entryValue];
        });
        return Object.fromEntries(pairs);
    }
}
