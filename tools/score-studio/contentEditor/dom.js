// Small render helpers for the content editor: build elements from options, never HTML strings.

/** One element: { className, text, title, attributes, on: { event: handler } } plus children. */
export function El(tag, options = {}, children = [])
{
    const element = document.createElement(tag);
    if (options.className)
    {
        element.className = options.className;
    }
    if (options.text !== undefined)
    {
        element.textContent = options.text;
    }
    if (options.title)
    {
        element.title = options.title;
    }
    for (const [name, value] of Object.entries(options.attributes || {}))
    {
        element.setAttribute(name, value);
    }
    for (const [eventName, handler] of Object.entries(options.on || {}))
    {
        element.addEventListener(eventName, handler);
    }
    element.append(...children.filter(Boolean));
    return element;
}

/** A plain button with a click handler. */
export function Button(text, className, onClick, title = '')
{
    const attributes = {
        type: 'button',
    };
    return El('button', {
        className,
        text,
        title,
        attributes,
        on: {
            click: onClick,
        },
    });
}

/** An input whose `input` event hands its text to `onText`. */
export function TextInput(value, onText, { className = '', type = 'text', list = '' } = {})
{
    const input = El('input', {
        className,
        attributes: {
            type,
            spellcheck: 'false',
        },
        on: {
            input: () => onText(input.value),
        },
    });
    if (list)
    {
        input.setAttribute('list', list);
    }
    input.value = value;
    return input;
}

/** A datalist of suggestions with a stable id. */
export function DataList(id, options)
{
    const children = options.map((option) => El('option', { attributes: { value: option } }));
    return El('datalist', { attributes: { id } }, children);
}
