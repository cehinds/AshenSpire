// @ts-check
import { uiConfig } from '../../config/generated/ui.js';

const MODAL_KINDS = uiConfig.components.modal.components;

const UNIT_SUFFIXES = [
    ['Px', 'px'],
    ['Rem', 'rem'],
];

const ROOT_KIND = 'base';

function toKebabCase(propertyName)
{
    return propertyName.replace(
        /[A-Z]/g,
        (letter) => `-${letter.toLowerCase()}`,
    );
}

function findKindLineage(kind, table)
{
    const lineageChain = [];
    let kindName = kind;

    while (kindName !== undefined)
    {
        if (lineageChain.includes(kindName))
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

        lineageChain.push(kindName);
        kindName = table[kindName].extends;
    }

    if (lineageChain[lineageChain.length - 1] !== ROOT_KIND)
    {
        throw new Error(`modal kind "${kind}": does not extend "${ROOT_KIND}"`);
    }

    return lineageChain;
}

export function ResolveModalConfig(kind, table = MODAL_KINDS)
{
    const mergedConfig = {};

    for (const kindName of findKindLineage(kind, table).reverse())
    {
        Object.assign(mergedConfig, table[kindName]);
    }

    delete mergedConfig.extends;
    return mergedConfig;
}

/** @import { ModalPresentation } from '../contracts.js' */
/** @implements {ModalPresentation} */
export class ModalModel
{
    constructor(kind, config)
    {
        this.kind = kind;
        this.config = config;
    }

    cssProperties()
    {
        /** @type {Record<string, string>} */
        const customProperties = {};

        for (const [configKey, configValue] of Object.entries(this.config))
        {
            const unitSuffix = UNIT_SUFFIXES.find(([suffix]) => configKey.endsWith(suffix));

            if (
                !unitSuffix
                || typeof configValue !== 'number'
            )
            {
                continue;
            }

            const [suffix, cssUnit] = unitSuffix;
            const propertyName = toKebabCase(configKey.slice(0, -suffix.length));
            customProperties[`--modal-${propertyName}`] = `${configValue}${cssUnit}`;
        }

        return customProperties;
    }

    apply(panel)
    {
        panel.dataset.modalKind = this.kind;

        for (const [propertyName, propertyValue] of Object.entries(this.cssProperties()))
        {
            panel.style?.setProperty?.(propertyName, propertyValue);
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
    const ownerKind = findKindLineage(kind, table).find(
        (kindName) => Object.hasOwn(MODEL_CLASSES, kindName),
    );
    const ModelClass = MODEL_CLASSES[ownerKind];
    const resolvedConfig = ResolveModalConfig(kind, table);
    return new ModelClass(kind, resolvedConfig);
}
