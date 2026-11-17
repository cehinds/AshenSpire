// The Core card-upgrade picker, shared by the rest site and the Blacksmith.
// It renders and routes; the host owns the run mutation. Facts come from CardUpgradeModel.js,
// whose plan is the one commitCardUpgrade applies, so the preview matches the commit.
import {
    el as buildElement,
    eyebrow,
    statRow,
    button,
} from '../kit/index.js';
import { OpenModal } from './modalShell.js';
import { optionRowList } from './optionRowList.js';
import { renderCard } from './card.js';
import {
    upgradeFacesNode,
    upgradeConfirmNodes,
} from './upgradeConfirm.js';
import { changeSummary, economyNode } from './smithPaneParts.js';
import {
    pushModalParent,
    dropModalParent,
    returnToModalParent,
    modalParentLabel,
} from '../modalReturn.js';
import { armOptionDecision } from '../../framework/optionDecision.js';
import { t as translate } from '../strings.js';
import {
    UI_COMPONENTS,
    markUiComponent,
} from './uiComponents.js';

const INSTANCE_ID_ATTRIBUTE = 'data-instance-id';
const FOCUS_OPTIONS = Object.freeze({ preventScroll: true });
const ANY_ROW_SELECTOR = `[${INSTANCE_ID_ATTRIBUTE}]`;
const ENABLED_ROW_SELECTOR = `[${INSTANCE_ID_ATTRIBUTE}]:not([disabled])`;
const FACE_SIDES = Object.freeze([
    'before',
    'after',
]);
const CLASS = Object.freeze({
    row: 'card-upgrade-row smith-candidate-card',
    locked: 'locked',
    selected: 'selected',
    details: 'card-upgrade-modal-details',
    option: 'card-upgrade-option',
    cinders: 'card-upgrade-cinders',
    stonesStatus: 'smith-header-stones',
    list: 'card-upgrade-list',
    options: 'card-upgrade-options',
    optionList: 'card-upgrade-option-list',
    optionBody: 'card-upgrade-option-body',
    optionTitle: 'card-upgrade-option-title',
    optionFace: 'card-upgrade-option-face',
    optionChanges: 'card-upgrade-option-changes',
    note: 'card-upgrade-note',
    changeName: 'sr-name',
});
// How an arrow key moves the chosen option: forward or back, wrapping at the ends.
const ARROW_STEP = Object.freeze({
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1,
});

function classWhen(baseClass, condition, extraClass)
{
    return condition ? `${baseClass} ${extraClass}` : baseClass;
}

function rowSelector(instanceId)
{
    return `[${INSTANCE_ID_ATTRIBUTE}="${instanceId}"]`;
}

function hasChoice(selected)
{
    return selected.options?.length > 1;
}

function upgradeStateOf(row)
{
    if (row.disabled)
    {
        return 'blocked';
    }
    return row.cost === 0 ? 'free' : 'stone';
}

export function MountCardUpgradeModal(host, initialModel, {
    registries,
    meta,
    title = translate('cardUpgrade.title'),
    backLabel: backLabelOverride,
    decisionConsequence = '',
    onSelect,
    onBack,
    onConfirm,
    returnFocusElement,
    focusInstanceId = null,
    // The list's return record (see modalReturn.js): a confirmed upgrade lands back on a refreshed list.
    parent = null,
})
{
    const parentRecord = parent ? pushModalParent(parent) : null;
    const backLabel = backLabelOverride || modalParentLabel(parentRecord);
    const isHtmlElement = (candidate) => candidate instanceof HTMLElement;
    const activeElement = isHtmlElement(document.activeElement) ? document.activeElement : null;
    const returnFocus = isHtmlElement(returnFocusElement) ? returnFocusElement : activeElement;

    let currentModel = initialModel;
    // Index into the selected row's `options`; resets with the card.
    let chosenOptionIndex = 0;
    let chosenForInstanceId = null;
    let closed = false;
    let committing = false;
    let disarmDecision = null;
    let bodyHost = null;
    let listHost = null;
    let detailHost = null;
    let rowList = null;

    // The permanent-change review is armed on this button; it stays disabled until a card is selected.
    const confirmButton = button({
        label: translate('cardUpgrade.confirmIdle'),
        weight: 'primary',
        className: 'smith-confirm card-upgrade-confirm',
        disabled: true,
    });
    const backButton = button({
        label: backLabel,
        role: 'exit',
        className: 'smith-back',
    });
    const initialFocusTarget = () => (
        (focusInstanceId && rowList?.querySelector(rowSelector(focusInstanceId)))
        || rowList?.querySelector(ENABLED_ROW_SELECTOR)
        || null
    );
    const shell = OpenModal({
        title,
        eyebrow: '',
        size: 'md',
        className: 'option-choice smith-upgrade-modal card-upgrade-modal',
        kind: 'cardUpgrade',
        host,
        opener: returnFocus,
        closeLabel: backLabel,
        secondary: [backButton],
        primary: confirmButton,
        bodyClassName: 'as-pane',
        deferFocus: true,
        initialFocus: initialFocusTarget,
        body(bodyElement)
        {
            bodyHost = bodyElement;
        },
        onClose: () =>
        {
            if (closed)
            {
                return;
            }
            closed = true;
            disarmDecision?.();
            disarmDecision = null;
            // Any exit but a confirmed upgrade forgets the parent.
            if (!committing)
            {
                if (parentRecord)
                {
                    dropModalParent(parentRecord);
                }
                onBack();
            }
        },
    });
    backButton.addEventListener('click', () => shell.close());
    markUiComponent(shell.panel, UI_COMPONENTS.smithUpgradeModal, 'cards');
    const stonesStatus = buildElement('p', {
        class: CLASS.stonesStatus,
        role: 'status',
        'aria-live': 'polite',
    });
    bodyHost.append(stonesStatus);
    listHost = buildElement('div', {
        class: CLASS.list,
        role: 'listbox',
        'aria-label': translate('cardUpgrade.items'),
    });
    bodyHost.append(listHost);

    const isRowSelected = (model, row) => (
        Boolean(model.selected) && model.selected.instanceId === row.instanceId
    );

    /** The row's chip line: the rank and upgrade price, whether it is in the deck. */
    const candidateRowOf = (row, model) =>
    {
        const upgradeStatus = row.weaponBound
            ? ''
            : translate('cardUpgrade.row.status', {
                from: row.levelFrom,
                to: row.levelTo,
                cost: row.costLabel,
            });
        const inDeckLabel = row.inDeck ? translate('cardUpgrade.row.inDeck') : '';
        return {
            id: row.instanceId,
            name: row.name,
            className: classWhen(`${CLASS.row} rarity-${row.rarity}`, row.disabled, CLASS.locked),
            costs: [upgradeStatus, inDeckLabel].filter(Boolean),
            text: row.blockedReason || '',
            line: [],
            disabled: row.disabled,
            chip: translate('cardUpgrade.row.copies', { n: row.copies }),
            artAsset: row.artAsset || null,
            artGlyph: row.artAsset ? null : row.artGlyph,
            detail: isRowSelected(model, row) ? detailHost : null,
        };
    };

    // Smithing Stones (the rest site), plus cinders when a quote names them (the Blacksmith).
    const priceNode = (model) =>
    {
        const { selected } = model;
        const stonesEconomyNode = () => economyNode({
            cost: selected.cost,
            stones: model.stones,
        });
        if (!(selected.cinders > 0))
        {
            return stonesEconomyNode();
        }
        const cindersNode = buildElement('b', {
            text: translate('cardUpgrade.cinders', { n: selected.cinders }),
        });
        return buildElement(
            'span',
            {
                class: CLASS.cinders,
            },
            [
                selected.cost > 0 ? stonesEconomyNode() : null,
                cindersNode,
            ].filter(Boolean),
        );
    };
    const confirmLabelFor = (selected) => (
        selected.cinders > 0
            ? translate('cardUpgrade.confirmCinders', { n: selected.cinders })
            : translate('smith.upgrade.confirm', { cost: selected.cost })
    );
    /** The plan's own before and after faces as small cards, side by side. */
    const faceCardOf = (model, faceSide) =>
    {
        const cardReference = { cardId: model.selected.cardId };
        return renderCard(registries, cardReference, {
            small: true,
            tooltip: false,
            inspectReadOnly: true,
            definition: model.faces[faceSide],
        });
    };
    const facesNode = (model) =>
    {
        const faceEntries = FACE_SIDES.map((faceSide) => [faceSide, faceCardOf(model, faceSide)]);
        return upgradeFacesNode(Object.fromEntries(faceEntries));
    };

    /** The row's chosen option (the first when there is no choice). */
    const chosenOptionOf = (model) => (
        model.selected.options?.[chosenOptionIndex] || model.selected.options?.[0] || null
    );
    /** The model as the pane shows it: the chosen option's after face and change rows. */
    const paneModelOf = (model) =>
    {
        const option = model.selected && model.faces ? chosenOptionOf(model) : null;
        if (!option || !hasChoice(model.selected))
        {
            return model;
        }
        return {
            ...model,
            selected: {
                ...model.selected,
                changes: option.changes,
            },
            faces: {
                before: model.faces.before,
                after: option.after,
            },
        };
    };
    const changeAriaText = (change) => `${change.label} ${change.before} to ${change.after}`;
    const changeVisibleText = (change) => `${change.label} ${change.before} → ${change.after}`;
    const optionBodyNode = (option, selected) =>
    {
        const titleNode = buildElement('b', {
            class: CLASS.optionTitle,
            text: translate('cardUpgrade.option.n', { n: option.index + 1 }),
        });
        // Not inspectReadOnly (it would swallow the click); actionOwnsTouch lets the first touch tap through.
        const faceCard = renderCard(registries, { cardId: selected.cardId }, {
            small: true,
            tooltip: false,
            actionOwnsTouch: true,
            definition: option.after,
        });
        const changeItems = option.changes.map((change) => buildElement('li', {
            text: changeVisibleText(change),
        }));
        return buildElement(
            'span',
            {
                class: CLASS.optionBody,
            },
            [
                titleNode,
                buildElement('div', { class: CLASS.optionFace }, faceCard),
                buildElement('ul', { class: CLASS.optionChanges }, changeItems),
            ],
        );
    };
    const optionButtonNode = (option, selected) =>
    {
        const isChosen = option.index === chosenOptionIndex;
        const optionButton = buildElement(
            'button',
            {
                type: 'button',
                class: classWhen(CLASS.option, isChosen, CLASS.selected),
                role: 'radio',
                'aria-checked': String(isChosen),
                tabindex: isChosen ? '0' : '-1',
                'aria-label': translate('cardUpgrade.option.aria', {
                    n: option.index + 1,
                    total: selected.options.length,
                    summary: option.changes.map(changeAriaText).join(', '),
                }),
                dataset: {
                    cardUpgradeOption: String(option.index),
                },
            },
            optionBodyNode(option, selected),
        );
        optionButton.addEventListener('click', () => pickOption(option.index));
        return optionButton;
    };
    /** Two or three after-faces side by side (stacked on a phone); the picked one is highlighted. */
    const optionsNode = (model) =>
    {
        const { selected } = model;
        if (!hasChoice(selected))
        {
            return null;
        }
        const optionCount = selected.options.length;
        const optionsGroup = buildElement(
            'div',
            {
                class: CLASS.options,
                role: 'radiogroup',
                'aria-label': translate('cardUpgrade.options.label'),
                dataset: {
                    cardUpgradeOptions: String(optionCount),
                },
            },
            [
                eyebrow(translate('cardUpgrade.options.label')),
                buildElement(
                    'div',
                    { class: CLASS.optionList },
                    selected.options.map((option) => optionButtonNode(option, selected)),
                ),
            ],
        );
        optionsGroup.addEventListener('keydown', (event) =>
        {
            const arrowStep = ARROW_STEP[event.key];
            if (!arrowStep)
            {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            pickOption((chosenOptionIndex + arrowStep + optionCount) % optionCount);
        });
        return optionsGroup;
    };
    function pickOption(optionIndex)
    {
        chosenOptionIndex = optionIndex;
        fillDetails();
        const optionSelector = `[data-card-upgrade-option="${optionIndex}"]`;
        detailHost?.querySelector(optionSelector)?.focus(FOCUS_OPTIONS);
    }

    /** The details (the shared body, upgradeConfirm.js): cost, both faces, then the change rows under them. */
    const detailNodes = (rawModel) =>
    {
        const model = paneModelOf(rawModel);
        const shortOnStones = model.selected.shortStones ?? model.selected.plan.code === 'stones';
        const unaffordable = shortOnStones || !model.selected.ok;
        const affordability = unaffordable ? 'unaffordable' : 'affordable';
        const costNode = buildElement(
            'div',
            {
                class: `confirmation-cost as-statrow flat ${affordability}`,
            },
            priceNode(model),
        );
        const changeRows = model.selected.changes.map((change) => statRow({
            flat: true,
            nameNode: buildElement('b', {
                class: CLASS.changeName,
                text: change.label,
            }),
            values: changeSummary({ values: [change] }),
        }));
        const nodes = upgradeConfirmNodes({
            cost: costNode,
            faces: model.faces ? facesNode(model) : null,
            rows: changeRows,
        });
        if (model.selected.nextDiffers)
        {
            const noteNode = buildElement('p', {
                class: CLASS.note,
                text: translate('cardUpgrade.row.nextDiffers'),
            });
            return [noteNode, ...nodes];
        }
        return nodes;
    };
    const confirmationNode = (rawModel) => buildElement(
        'div',
        {
            class: CLASS.details,
        },
        detailNodes(rawModel),
    );
    // The live node under the selected row; with options it holds them too, and they redraw in place.
    function fillDetails()
    {
        if (!detailHost)
        {
            return;
        }
        const detailChildren = [optionsNode(currentModel), ...detailNodes(currentModel)];
        detailHost.replaceChildren(...detailChildren.filter(Boolean));
    }
    function fillDetailsIfSelected(selected)
    {
        if (selected && currentModel.faces)
        {
            fillDetails();
        }
    }

    function canCommitSelection(selected)
    {
        const optionIsPicked = Boolean(selected.options?.[chosenOptionIndex]);
        const hasPickedOption = !hasChoice(selected) || optionIsPicked;
        return Boolean(currentModel.canConfirm) && hasPickedOption;
    }

    function commitSelected()
    {
        if (!currentModel.canConfirm)
        {
            return;
        }
        const { selected } = currentModel;
        const option = hasChoice(selected) ? selected.options[chosenOptionIndex] : null;
        // With a choice, a pick that no longer names an option commits nothing.
        if (hasChoice(selected) && !option)
        {
            return;
        }
        committing = true;
        shell.close();
        // With a choice, the quote carries the picked step; the service re-plans and checks it is on the list.
        // `false` from onConfirm (or a throw) is a refusal: the list stays closed so the refusal text is visible.
        let committed = false;
        try
        {
            const plan = option
                ? {
                    ...selected.plan,
                    step: option.step,
                    after: option.after,
                }
                : selected.plan;
            committed = onConfirm(selected.instanceId, plan) !== false;
        }
        finally
        {
            if (parentRecord)
            {
                if (committed)
                {
                    returnToModalParent(selected.instanceId);
                }
                else
                {
                    dropModalParent(parentRecord);
                }
            }
        }
    }

    function draw(model)
    {
        const focusWasInList = rowList?.contains?.(document.activeElement);
        const focusedInstanceId = focusWasInList
            ? document.activeElement.getAttribute?.(INSTANCE_ID_ATTRIBUTE)
            : null;
        currentModel = model;
        const { selected } = model;
        const selectedInstanceId = selected ? selected.instanceId : null;
        if (selectedInstanceId !== chosenForInstanceId)
        {
            chosenForInstanceId = selectedInstanceId;
            chosenOptionIndex = 0;
        }
        // The option list can shrink under a redraw (a changed quote); keep the chosen index in range.
        if (selected?.options?.length)
        {
            const lastOptionIndex = selected.options.length - 1;
            chosenOptionIndex = Math.min(Math.max(chosenOptionIndex, 0), lastOptionIndex);
        }
        detailHost = selected ? buildElement('div', { class: CLASS.details }) : null;
        fillDetailsIfSelected(selected);
        rowList = optionRowList(model.rows.map((row) => candidateRowOf(row, model)), {
            idAttr: INSTANCE_ID_ATTRIBUTE,
            selectedId: selectedInstanceId,
            columns: 1,
            onSelect: (instanceId) =>
            {
                onSelect(instanceId);
            },
        });
        for (const rowElement of rowList.querySelectorAll(ANY_ROW_SELECTOR))
        {
            const rowInstanceId = rowElement.getAttribute(INSTANCE_ID_ATTRIBUTE);
            const row = model.rows.find((candidate) => candidate.instanceId === rowInstanceId);
            if (!row)
            {
                continue;
            }
            const rowIsSelected = isRowSelected(model, row);
            rowElement.dataset.cardId = row.cardId;
            rowElement.dataset.upgradeState = upgradeStateOf(row);
            rowElement.setAttribute('role', 'option');
            rowElement.setAttribute('aria-disabled', String(row.disabled));
            rowElement.setAttribute('aria-selected', String(rowIsSelected));
            rowElement.classList.toggle(CLASS.selected, rowIsSelected);
            const cardTypeLabel = row.tags[0] || '';
            const ariaLabelKey = row.inDeck ? 'cardUpgrade.row.aria' : 'cardUpgrade.row.ariaSide';
            const rowLabel = translate(ariaLabelKey, {
                name: row.name,
                type: cardTypeLabel,
                n: row.copies,
                from: row.levelFrom,
                to: row.levelTo,
                cost: row.costLabel,
            });
            const rowLabelParts = [rowLabel, row.blockedReason].filter(Boolean);
            rowElement.setAttribute('aria-label', rowLabelParts.join(' '));
            markUiComponent(
                rowElement,
                UI_COMPONENTS.smithCandidateCard,
                rowIsSelected ? 'selected' : 'available',
            );
        }
        listHost.replaceChildren(rowList);
        stonesStatus.textContent = translate('cardUpgrade.stones', { n: model.stones });
        disarmDecision?.();
        disarmDecision = null;
        confirmButton.disabled = !selected;
        if (selected)
        {
            confirmButton.textContent = confirmLabelFor(selected);
            const blockedMessageText = model.blockedReasons.join(' ')
                || translate('cardUpgrade.unavailable');
            const selectedRowElement = rowList.querySelector(rowSelector(selected.instanceId));
            disarmDecision = armOptionDecision(confirmButton, {
                meta,
                registries,
                id: 'smithUpgrade',
                title: translate('smith.upgrade.title', { name: selected.name }),
                message: translate('cardUpgrade.decision.message', {
                    from: selected.levelFrom,
                    to: selected.levelTo,
                    then: decisionConsequence,
                }),
                consequence: translate('cardUpgrade.permanent'),
                detailsNode: () => confirmationNode(currentModel),
                confirmLabel: confirmLabelFor(selected),
                cancelLabel: translate('common.back'),
                onCommit: commitSelected,
                canCommit: () => canCommitSelection(selected),
                blockedTitle: translate('cardUpgrade.blocked', { name: selected.name }),
                blockedMessage: blockedMessageText,
                blockedDetailsNode: () => confirmationNode(currentModel),
                returnFocusElement: selectedRowElement || confirmButton,
            });
        }
        if (focusedInstanceId)
        {
            const refocusTarget = rowList.querySelector(rowSelector(focusedInstanceId))
                || rowList.querySelector(ANY_ROW_SELECTOR);
            refocusTarget?.focus?.(FOCUS_OPTIONS);
        }
    }

    draw(initialModel);
    queueMicrotask(() =>
    {
        const row = rowList?.querySelector(rowSelector(focusInstanceId));
        if (row)
        {
            // Refocused by the return, not the player: no card tooltip over the list.
            row.dataset.quietFocus = 'true';
        }
    });
    return {
        update(model)
        {
            draw(model);
        },
        close()
        {
            shell.close();
        },
    };
}
