// Renderers for one value: a number, a line or block of text, or a choice from a list.
import { El, TextInput } from './dom.js';
import { FormatFieldInput, ParseFieldInput } from './fieldPaths.js';
import { FieldRenderer, NUMBER_TYPE, TEXT_TYPE } from './fieldRenderer.js';

export class ScalarRenderer extends FieldRenderer
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

export class TextRenderer extends ScalarRenderer
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

export class SelectRenderer extends FieldRenderer
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
