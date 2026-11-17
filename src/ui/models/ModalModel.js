import { uiConfig } from '../../config/generated/ui.js';

// Modal layout from content/config/ui/components/modal.json: each kind extends a parent, ending at `base`.
const MODAL_KINDS = uiConfig.components.modal.components;

// A key's unit suffix becomes the CSS unit; the suffix is dropped from the property name.
const UNIT_SUFFIXES = [
    ['Px', 'px'],
    ['Rem', 'rem'],
];

const ROOT_KIND = 'base';

/** The kinds from `kind` up to `base`, child first. Throws on an unknown kind, an unknown parent or a cycle. */
function lineage(kind, table)
{
    const chain = [];
    let kindName = kind;
    while (kindName !== undefined)
    {
        if (chain.includes(kindName))
        {
            throw new Error(`modal kind "${kind}": extends cycle at "${kindName}"`);
        }
        if (!Object.hasOwn(table, kindName))
        {
            throw new Error(kindName === kind ? `unknown modal kind "${kind}"` : `modal kind "${kind}": unknown parent "${kindName}"`);
        }
        chain.push(kindName);
        kindName = table[kindName].extends;
    }
    if (chain[chain.length - 1] !== ROOT_KIND)
    {
        throw new Error(`modal kind "${kind}": does not extend "${ROOT_KIND}"`);
    }
    return chain;
}

/** The merged settings for `kind`: `base` first, each child overriding its parent. */
export function ResolveModalConfig(kind, table = MODAL_KINDS)
{
    const merged = {};
    for (const kindName of lineage(kind, table).reverse())
    {
        Object.assign(merged, table[kindName]);
    }
    delete merged.extends;
    return merged;
}

function kebab(name)
{
    return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** One modal's settings, published to its panel as `--modal-*` custom properties. */
export class ModalModel
{
    constructor(kind, config)
    {
        this.kind = kind;
        this.config = config;
    }

    /** `{ '--modal-grid-gap': '12px', ... }` for every number whose key ends in a unit. */
    cssProperties()
    {
        const out = {};
        for (const [key, value] of Object.entries(this.config))
        {
            const unit = UNIT_SUFFIXES.find(([suffix]) => key.endsWith(suffix));
            if (!unit || typeof value !== 'number')
            {
                continue;
            }
            out[`--modal-${kebab(key.slice(0, -unit[0].length))}`] = `${value}${unit[1]}`;
        }
        return out;
    }

    /** Tags `panel` with its kind and sets its properties. */
    apply(panel)
    {
        panel.dataset.modalKind = this.kind;
        for (const [name, value] of Object.entries(this.cssProperties()))
        {
            panel.style?.setProperty?.(name, value);
        }
        return panel;
    }
}

/** A modal that offers options side by side, each with an optional name button. */
export class ChoiceModalModel extends ModalModel
{
    get showNameButton()
    {
        return this.config.showNameButton !== false;
    }

    apply(panel)
    {
        super.apply(panel);
        panel.dataset.nameButton = this.showNameButton ? 'shown' : 'hidden';
        return panel;
    }
}

/** The victory reward door. */
export class RewardModalModel extends ChoiceModalModel
{
}

// The nearest ancestor listed here picks the class.
const MODEL_CLASSES = {
    base: ModalModel,
    choice: ChoiceModalModel,
    reward: RewardModalModel,
};

/** The model for `kind`, built from the merged JSON. */
export function ModalModelFor(kind = ROOT_KIND, table = MODAL_KINDS)
{
    const owner = lineage(kind, table).find((kindName) => Object.hasOwn(MODEL_CLASSES, kindName));
    const ModelClass = MODEL_CLASSES[owner];
    return new ModelClass(kind, ResolveModalConfig(kind, table));
}
