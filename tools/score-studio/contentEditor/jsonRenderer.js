// The renderer for any value as JSON text.
import { El } from './dom.js';
import { FieldRenderer } from './fieldRenderer.js';

/** Any value as JSON text; only valid JSON is applied. */
export class JsonRenderer extends FieldRenderer
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
