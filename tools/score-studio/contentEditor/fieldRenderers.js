// The field renderer registry and one labelled form line built from a configured field.
import { El } from './dom.js';
import { ARIA_LABEL, NUMBER_TYPE } from './fieldRenderer.js';
import { JsonRenderer } from './jsonRenderer.js';
import { ListRenderer, ObjectsRenderer } from './listRenderers.js';
import { MapRenderer } from './mapRenderer.js';
import {
    BooleanRenderer,
    ScalarRenderer,
    SelectRenderer,
    TextRenderer,
} from './scalarRenderers.js';

const RENDERER_TYPES = {
    text: TextRenderer,
    select: SelectRenderer,
    list: ListRenderer,
    objects: ObjectsRenderer,
    map: MapRenderer,
    json: JsonRenderer,
    boolean: BooleanRenderer,
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
