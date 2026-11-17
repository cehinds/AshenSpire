import { uiConfig } from '../../config/generated/ui.js';

const MODAL_KINDS = uiConfig.components.modal.components;

const UNIT_SUFFIXES = [
    ['Px', 'px'],
    ['Rem', 'rem'],
];

const ROOT_KIND = 'base';

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
            const message = kindName === kind
                ? `unknown modal kind "${kind}"`
                : `modal kind "${kind}": unknown parent "${kindName}"`;
            throw new Error(message);
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
    return name.replace(
        /[A-Z]/g,
        (letter) => `-${letter.toLowerCase()}`,
    );
}

export class ModalModel
{
    constructor(kind, config)
    {
        this.kind = kind;
        this.config = config;
    }

    cssProperties()
    {
        const properties = {};

        for (const [key, value] of Object.entries(this.config))
        {
            const unit = UNIT_SUFFIXES.find(([suffix]) => key.endsWith(suffix));

            if (!unit || typeof value !== 'number')
            {
                continue;
            }

            const [suffix, cssUnit] = unit;
            const propertyName = kebab(key.slice(0, -suffix.length));
            properties[`--modal-${propertyName}`] = `${value}${cssUnit}`;
        }

        return properties;
    }

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

export class ChoiceModalModel extends ModalModel
{
    get showNameButton()
    {
        return this.config.showNameButton !== false;
    }

    apply(panel)
    {
        super.apply(panel);
        panel.dataset.nameButton = this.showNameButton
            ? 'shown'
            : 'hidden';
        return panel;
    }
}

export class RewardModalModel extends ChoiceModalModel
{
}

const MODEL_CLASSES = {
    base: ModalModel,
    choice: ChoiceModalModel,
    reward: RewardModalModel,
};

export function ModalModelFor(kind = ROOT_KIND, table = MODAL_KINDS)
{
    const owner = lineage(kind, table).find(
        (kindName) => Object.hasOwn(MODEL_CLASSES, kindName),
    );
    const ModelClass = MODEL_CLASSES[owner];
    const config = ResolveModalConfig(kind, table);
    return new ModelClass(kind, config);
}
