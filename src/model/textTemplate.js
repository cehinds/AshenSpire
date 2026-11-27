// Fills {name} placeholders in a JSON-authored message template.
const PLACEHOLDER = /\{(\w+)\}/g;

/** Replaces each {name} with values[name]; names with no value stay as written. */
export function FillTemplate(template, values = {})
{
    return template.replace(PLACEHOLDER, (match, key) =>
    {
        if (!(key in values))
        {
            return match;
        }
        return String(values[key]);
    });
}
