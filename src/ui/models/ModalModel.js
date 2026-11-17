// @ts-check
import { uiConfig } from '../../config/generated/ui.js';

const MODAL_KINDS = uiConfig.components.modal.components;

const UNIT_SUFFIXES = [
    ['Px', 'px'],
    ['Rem', 'rem'],
];

const ROOT_KIND = 'base';

const CHOICE_KIND = 'choice';

const SELECTION_MODES = [
    'single',
    'multi',
];

// What a multi-select pick past its limit does: nothing (the default), or swap out the earliest pick (the hand
// discard, playtest 2026-11-17 item 26).
const AT_LIMIT_MODES = [
    'ignore',
    'swapOldest',
];

const OPTION_CHOICE_TEXT_KEYS = [
    'size',
    'footSize',
    'className',
    'bodyClassName',
    'selection',
    'idAttribute',
    'rowClassName',
    'commitLabelKey',
    'cancelLabelKey',
    'closeLabelKey',
    'emptyTextKey',
    'atLimit',
];

const OPTION_CHOICE_REQUIRED_KEYS = [
    'size',
    'footSize',
    'className',
    'selection',
    'idAttribute',
    'commitLabelKey',
    'cancelLabelKey',
];

const ID_ATTRIBUTE_PREFIX = 'data-';

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

function findOptionChoiceProblems(kind, config, table)
{
    const choiceKeys = Object.keys(ResolveModalConfig(
        CHOICE_KIND,
        table,
    ));
    const knownKeys = [
        ...choiceKeys,
        ...OPTION_CHOICE_TEXT_KEYS,
        'hasCancelButton',
        'columns',
    ];
    const problems = [];

    for (const configKey of Object.keys(config))
    {
        if (!knownKeys.includes(configKey))
        {
            problems.push(`unknown key "${configKey}"`);
        }
    }

    for (const requiredKey of OPTION_CHOICE_REQUIRED_KEYS)
    {
        if (!Object.hasOwn(config, requiredKey))
        {
            problems.push(`missing "${requiredKey}"`);
        }
    }

    for (const textKey of OPTION_CHOICE_TEXT_KEYS)
    {
        if (
            Object.hasOwn(config, textKey)
            && typeof config[textKey] !== 'string'
        )
        {
            problems.push(`"${textKey}" must be a string`);
        }
    }

    if (!SELECTION_MODES.includes(config.selection))
    {
        problems.push(`"selection" must be one of ${SELECTION_MODES.join(', ')}`);
    }

    if (Object.hasOwn(config, 'atLimit') && !AT_LIMIT_MODES.includes(config.atLimit))
    {
        problems.push(`"atLimit" must be one of ${AT_LIMIT_MODES.join(', ')}`);
    }

    if (!String(config.idAttribute).startsWith(ID_ATTRIBUTE_PREFIX))
    {
        problems.push(`"idAttribute" must start with "${ID_ATTRIBUTE_PREFIX}"`);
    }

    if (typeof config.hasCancelButton !== 'boolean')
    {
        problems.push('"hasCancelButton" must be true or false');
    }

    if (
        Object.hasOwn(config, 'columns')
        && !(Number.isInteger(config.columns) && config.columns > 0)
    )
    {
        problems.push('"columns" must be a positive whole number');
    }

    return problems.map((problem) => `modal kind "${kind}": ${problem}`);
}

export class OptionChoiceModalModel extends ChoiceModalModel
{
    constructor(kind, config, table = MODAL_KINDS)
    {
        super(
            kind,
            config,
        );

        const problems = findOptionChoiceProblems(
            kind,
            config,
            table,
        );

        if (problems.length)
        {
            throw new Error(problems.join('; '));
        }
    }

    get size()
    {
        return this.config.size;
    }

    get footSize()
    {
        return this.config.footSize;
    }

    get className()
    {
        return this.config.className;
    }

    get bodyClassName()
    {
        return this.config.bodyClassName || '';
    }

    get idAttribute()
    {
        return this.config.idAttribute;
    }

    get rowClassName()
    {
        return this.config.rowClassName || '';
    }

    get isMultiSelect()
    {
        return this.config.selection === 'multi';
    }

    get swapsAtLimit()
    {
        return this.config.atLimit === 'swapOldest';
    }

    get columns()
    {
        return this.config.columns ?? null;
    }

    get commitLabelKey()
    {
        return this.config.commitLabelKey;
    }

    get hasCancelButton()
    {
        return this.config.hasCancelButton;
    }

    get cancelLabelKey()
    {
        return this.config.cancelLabelKey;
    }

    get closeLabelKey()
    {
        return this.config.closeLabelKey || this.config.cancelLabelKey;
    }

    get emptyTextKey()
    {
        return this.config.emptyTextKey || '';
    }
}

const MODEL_CLASSES = {
    base: ModalModel,
    choice: ChoiceModalModel,
    reward: RewardModalModel,
    optionChoice: OptionChoiceModalModel,
};

export function ModalModelFor(kind = ROOT_KIND, table = MODAL_KINDS)
{
    const ownerKind = findKindLineage(kind, table).find(
        (kindName) => Object.hasOwn(MODEL_CLASSES, kindName),
    );
    const ModelClass = MODEL_CLASSES[ownerKind];
    const resolvedConfig = ResolveModalConfig(kind, table);
    return new ModelClass(
        kind,
        resolvedConfig,
        table,
    );
}
