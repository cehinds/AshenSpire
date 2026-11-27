// One renderer per field type, all with the same Control(field, value, context) interface.
// context: { onChange(value), refresh(), listId(suggest) }.
// Words, classes and sizes come from the `ui` config (contentEditorUi.json).
import { Button, El, TextInput } from './dom.js';
import { FormatFieldInput, ParseFieldInput, SetFieldValue } from './fieldPaths.js';

const NUMBER_TYPE = 'number';
const TEXT_TYPE = 'text';
const NEWLINE = '\n';
const ARIA_LABEL = 'aria-label';

/** The parts every renderer shares: config, a datalist hookup, rows with add and remove. */
class FieldRenderer
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

class ScalarRenderer extends FieldRenderer
{
    constructor(ui, registry, valueType)
    {
        super(ui, registry);
        this.valueType = valueType;
    }

    Control(field, value, context)
    {
        const options = {
            ...this.InputOptions(field, context),
            type: this.valueType,
        };
        const input = TextInput(FormatFieldInput(value), (text) =>
        {
            this.Accept(field, input, text, context);
        }, options);
        input.placeholder = field.compact
            ? field.label
            : '';
        return input;
    }

    Accept(field, input, text, context)
    {
        const parsed = ParseFieldInput(this.valueType, text);
        const isBlank = String(text).trim() === '';
        const isBadNumber = this.valueType === NUMBER_TYPE
            && parsed === undefined
            && !(isBlank && field.omitEmpty);
        input.classList.toggle(this.classes.invalid, isBadNumber);
        if (isBadNumber)
        {
            return;
        }
        const keepBlankText = parsed === undefined && !field.omitEmpty;
        context.onChange(keepBlankText
            ? String(text)
            : parsed);
    }
}

class TextRenderer extends ScalarRenderer
{
    constructor(ui, registry)
    {
        super(ui, registry, TEXT_TYPE);
    }

    Control(field, value, context)
    {
        if (!field.multiline)
        {
            return super.Control(field, value, context);
        }
        const text = FormatFieldInput(value);
        const area = El('textarea', {
            className: this.classes.control,
            attributes: {
                rows: String(this.TextRows(text)),
            },
            on: {
                input: () => this.Accept(field, area, area.value, context),
            },
        });
        area.value = text;
        return area;
    }
}

class SelectRenderer extends FieldRenderer
{
    Control(field, value, context)
    {
        const current = FormatFieldInput(value);
        const known = field.options.includes(current) || current === '';
        const choices = known
            ? field.options
            : [
                current,
                ...field.options,
            ];
        const optionElements = choices.map((choice) =>
        {
            return El('option', { text: choice, attributes: { value: choice } });
        });
        const select = El('select', {
            className: this.classes.control,
            on: {
                change: () => context.onChange(select.value),
            },
        }, optionElements);
        select.value = current;
        return select;
    }
}

/** A list of plain values (strings or numbers), one input per line. */
class ListRenderer extends FieldRenderer
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
class ObjectsRenderer extends FieldRenderer
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

/** An object of name to value pairs, such as room odds; renaming keeps the line in place. */
class MapRenderer extends FieldRenderer
{
    Control(field, value, context)
    {
        const current = value && typeof value === 'object'
            ? value
            : {};
        const rows = Object.keys(current).map((key) => this.PairRow(field, current, key, context));
        return this.RowList(rows, () => this.Change(context, current, () =>
        {
            current[this.ui.newMapKey] = '';
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

/** Any value as JSON text; only valid JSON is applied. */
class JsonRenderer extends FieldRenderer
{
    Control(field, value, context)
    {
        const text = value === undefined
            ? ''
            : JSON.stringify(value, null, this.ui.sizes.jsonIndent);
        const area = El('textarea', {
            className: `${this.classes.control} ${this.classes.json}`,
            attributes: {
                rows: String(this.TextRows(text)),
                spellcheck: 'false',
            },
            on: {
                input: () => this.Accept(area, context),
            },
        });
        area.value = text;
        return area;
    }

    Accept(area, context)
    {
        try
        {
            const parsed = JSON.parse(area.value);
            area.classList.remove(this.classes.invalid);
            area.title = '';
            context.onChange(parsed);
        }
        catch (error)
        {
            area.classList.add(this.classes.invalid);
            area.title = error.message;
        }
    }
}

const RENDERER_TYPES = {
    text: TextRenderer,
    select: SelectRenderer,
    list: ListRenderer,
    objects: ObjectsRenderer,
    map: MapRenderer,
    json: JsonRenderer,
};

/** The renderer registry, keyed by the `type` a field names in contentEditor.json. */
export function CreateFieldRenderers(ui)
{
    const registry = {};
    registry[NUMBER_TYPE] = new ScalarRenderer(ui, registry, NUMBER_TYPE);
    for (const [type, RendererClass] of Object.entries(RENDERER_TYPES))
    {
        registry[type] = new RendererClass(ui, registry);
    }
    return registry;
}

/** One labelled form line for a configured field. */
export function RenderField(registry, ui, field, value, context)
{
    const control = registry[field.type].Control(field, value, context);
    control.setAttribute(ARIA_LABEL, field.label);
    const label = El('label', {
        className: ui.classes.label,
        text: field.label,
        title: field.hint || field.path,
    });
    const className = `${ui.classes.field} ${ui.classes.fieldTypePrefix}${field.type}`;
    return El('div', { className }, [
        label,
        control,
    ]);
}
