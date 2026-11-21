import { el as buildElement, eyebrow, statRow, button } from '../kit/index.js';
import { OpenModal } from './modalShell.js';
import { optionRowList } from './optionRowList.js';
import { renderCard } from './card.js';
import { openBoundCardInspection } from './cardInspection.js';
import { upgradeFacesNode, upgradeConfirmNodes } from './upgradeConfirm.js';
import { deltaNode, economyNode } from './smithPaneParts.js';
import {
    pushModalParent,
    dropModalParent,
    returnToModalParent,
    modalParentLabel,
} from '../modalReturn.js';
import { t as translate } from '../strings.js';
import { UI_COMPONENTS, markUiComponent } from './uiComponents.js';
import { MarkSelected } from '../selection.js';

const INSTANCE_ID_ATTRIBUTE = 'data-instance-id';
const FOCUS_WITHOUT_SCROLL = Object.freeze({ preventScroll: true });
const ANY_ROW_SELECTOR = `[${INSTANCE_ID_ATTRIBUTE}]`;
const ENABLED_ROW_SELECTOR = `[${INSTANCE_ID_ATTRIBUTE}]:not([disabled])`;
// The face the (i) reads: the upgraded card, else the current one.
const INSPECT_FACE_SELECTORS = Object.freeze([
    '[data-card-upgrade-face="after"] .upgrade-confirm-face-holder > *',
    '[data-card-upgrade-face="before"] .upgrade-confirm-face-holder > *',
]);
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
    confirm: 'smith-confirm card-upgrade-confirm',
    back: 'smith-back',
    modal: 'option-choice smith-upgrade-modal card-upgrade-modal',
    detailModal: 'smith-upgrade-modal card-upgrade-detail-modal',
    detailConfirm: 'smith-confirm card-upgrade-detail-confirm',
    detailBack: 'smith-back card-upgrade-detail-back',
    inspect: 'card-upgrade-inspect',
    cost: 'confirmation-cost as-statrow flat',
});
const ARROW_STEP = Object.freeze({
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1,
});

function appendClassWhen(baseClass, condition, extraClass)
{
    return condition
        ? `${baseClass} ${extraClass}`
        : baseClass;
}

function selectorForRow(instanceId)
{
    return `[${INSTANCE_ID_ATTRIBUTE}="${instanceId}"]`;
}

function hasOptionChoice(selected)
{
    return selected.options?.length > 1;
}

function readUpgradeState(row)
{
    if (row.disabled)
    {
        return 'blocked';
    }
    return row.cost === 0
        ? 'free'
        : 'stone';
}

function isHtmlElement(candidate)
{
    return typeof HTMLElement === 'function'
        ? candidate instanceof HTMLElement
        : candidate?.nodeType === 1;
}

function readReturnFocus(returnFocusElement)
{
    const activeElement = isHtmlElement(document.activeElement)
        ? document.activeElement
        : null;
    return isHtmlElement(returnFocusElement)
        ? returnFocusElement
        : activeElement;
}

function isRowSelected(model, row)
{
    return (
        Boolean(model.selected)
        && model.selected.instanceId === row.instanceId
    );
}

// An added effect has no before: it reads "Also hits another enemy" (owner, 2026-11-17).
function describeAddedEffects(change)
{
    const effects = change.after.charAt(0).toLowerCase() + change.after.slice(1);
    return translate('cardUpgrade.change.alsoLine', { effects });
}

function describeChangeForScreenReader(change)
{
    return change.adds
        ? describeAddedEffects(change)
        : `${change.label} ${change.before} to ${change.after}`;
}

function describeChange(change)
{
    return change.adds
        ? describeAddedEffects(change)
        : `${change.label} ${change.before} → ${change.after}`;
}

// The value side of a change row: the delta, or for added effects the words alone (no "None →").
function buildChangeValue(change)
{
    if (!change.adds)
    {
        return deltaNode(change.before, change.after);
    }
    return buildElement(
        'span',
        {
            class: 'sp-v as-delta card-upgrade-gain',
            dataset: { dir: 'up' },
        },
        buildElement('strong', { class: 'd-to', text: change.after }),
    );
}

function readConfirmLabel(selected)
{
    return selected.cinders > 0
        ? translate('cardUpgrade.confirmCinders', { n: selected.cinders })
        : translate('smith.upgrade.confirm', { cost: selected.cost });
}

function buildConfirmButton(className = CLASS.confirm)
{
    return button({
        label: translate('cardUpgrade.confirmIdle'),
        weight: 'primary',
        className,
        disabled: true,
    });
}

function buildBackButton(backLabel, className = CLASS.back)
{
    return button({
        label: backLabel,
        role: 'exit',
        className,
    });
}

function buildInspectButton(cardName)
{
    const label = translate('cardUpgrade.inspect', { name: cardName });
    return buildElement('button', {
        type: 'button',
        class: CLASS.inspect,
        text: 'i',
        title: label,
        'aria-label': label,
    });
}

function findInspectFace(detailsElement)
{
    for (const selector of INSPECT_FACE_SELECTORS)
    {
        const face = detailsElement?.querySelector(selector);
        if (face)
        {
            return face;
        }
    }
    return null;
}

function buildStonesStatus()
{
    return buildElement('p', {
        class: CLASS.stonesStatus,
        role: 'status',
        'aria-live': 'polite',
    });
}

function buildListHost()
{
    return buildElement('div', {
        class: CLASS.list,
        role: 'listbox',
        'aria-label': translate('cardUpgrade.items'),
    });
}

function buildPriceNode(model)
{
    const { selected } = model;
    const buildStonesEconomy = () => economyNode({
        cost: selected.cost,
        stones: model.stones,
    });
    if (!(selected.cinders > 0))
    {
        return buildStonesEconomy();
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
            selected.cost > 0 ? buildStonesEconomy() : null,
            cindersNode,
        ].filter(Boolean),
    );
}

function buildCostNode(model)
{
    const shortOnStones = model.selected.shortStones
        ?? model.selected.plan.code === 'stones';
    const unaffordable = shortOnStones || !model.selected.ok;
    const affordability = unaffordable
        ? 'unaffordable'
        : 'affordable';
    return buildElement(
        'div',
        {
            class: `${CLASS.cost} ${affordability}`,
        },
        buildPriceNode(model),
    );
}

function buildChangeRows(changes)
{
    return changes.map((change) => statRow({
        flat: true,
        nameNode: buildElement('b', {
            class: CLASS.changeName,
            text: change.label,
        }),
        // The row's name already says the label, so the value is the delta alone (EFFECTS once, owner 2026-11-17).
        values: buildElement(
            'span',
            { class: 'smith-fold-values' },
            buildChangeValue(change),
        ),
    }));
}

function buildCommitPlan(selected, option)
{
    if (!option)
    {
        return selected.plan;
    }
    return {
        ...selected.plan,
        step: option.step,
        after: option.after,
    };
}

function buildRowAriaLabel(row)
{
    const cardTypeLabel = row.tags[0] || '';
    const ariaLabelKey = row.inDeck
        ? 'cardUpgrade.row.aria'
        : 'cardUpgrade.row.ariaSide';
    const rowLabel = translate(ariaLabelKey, {
        name: row.name,
        type: cardTypeLabel,
        n: row.copies,
        from: row.levelFrom,
        to: row.levelTo,
        cost: row.costLabel,
    });
    const rowLabelParts = [
        rowLabel,
        row.blockedReason,
    ].filter(Boolean);
    return rowLabelParts.join(' ');
}

export function MountCardUpgradeModal(
    host,
    initialModel,
    {
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
        parent = null,
        confirmLabel = null,
    },
)
{
    const parentRecord = parent
        ? pushModalParent(parent)
        : null;
    const backLabel = backLabelOverride || modalParentLabel(parentRecord);
    const returnFocus = readReturnFocus(returnFocusElement);

    let currentModel = initialModel;
    let chosenOptionIndex = 0;
    let chosenForInstanceId = null;
    let closed = false;
    let committing = false;
    let bodyHost = null;
    let listHost = null;
    let detailsHost = null;
    let candidateList = null;
    let detailShell = null;
    let detailConfirmButton = null;
    let detailInstanceId = null;
    let listSignature = '';
    let detailOptionsSignature = '';

    const confirmButton = buildConfirmButton();
    const backButton = buildBackButton(backLabel);
    const shell = openShell();
    backButton.addEventListener('click', () => shell.close());
    confirmButton.addEventListener('click', commitSelectedUpgrade);
    markUiComponent(shell.panel, UI_COMPONENTS.smithUpgradeModal, 'cards');
    const stonesStatus = buildStonesStatus();
    bodyHost.append(stonesStatus);
    listHost = buildListHost();
    bodyHost.append(listHost);

    renderModel(initialModel);
    openDetailModal();
    queueMicrotask(markReturnedRowAsQuietFocus);
    return {
        update(model)
        {
            renderModel(model);
        },
        close()
        {
            shell.close();
        },
    };

    function findInitialFocusRow()
    {
        return (
            (focusInstanceId && candidateList?.querySelector(selectorForRow(focusInstanceId)))
            || candidateList?.querySelector(ENABLED_ROW_SELECTOR)
            || null
        );
    }

    function openShell()
    {
        return OpenModal({
            title,
            eyebrow: '',
            size: 'md',
            className: CLASS.modal,
            kind: 'cardUpgrade',
            host,
            opener: returnFocus,
            closeLabel: backLabel,
            secondary: [backButton],
            primary: confirmButton,
            bodyClassName: 'as-pane',
            deferFocus: true,
            initialFocus: findInitialFocusRow,
            body(bodyElement)
            {
                bodyHost = bodyElement;
            },
            onClose: handleShellClose,
        });
    }

    function handleShellClose()
    {
        if (closed)
        {
            return;
        }
        closed = true;
        detailShell?.close();
        if (!committing)
        {
            if (parentRecord)
            {
                dropModalParent(parentRecord);
            }
            onBack();
        }
    }

    // The upgrade and its price are two chips (owner, 2026-11-17), so on a phone the price wraps under the step
    // instead of one long chip being cut off. A rank-up names its own step and is free, so it has one chip.
    function readRowChips(row)
    {
        if (row.weaponBound)
        {
            return [];
        }
        if (row.status)
        {
            return [row.status];
        }
        const upgradeStatus = translate('cardUpgrade.row.status', {
            from: row.levelFrom,
            to: row.levelTo,
        });
        return [
            upgradeStatus,
            row.costLabel,
        ].filter(Boolean);
    }

    function buildCandidateRow(row)
    {
        const rowClassName = appendClassWhen(
            `${CLASS.row} rarity-${row.rarity}`,
            row.disabled,
            CLASS.locked,
        );
        const costs = readRowChips(row);
        return {
            id: row.instanceId,
            name: row.name,
            className: rowClassName,
            costs,
            text: row.blockedReason || '',
            line: [],
            disabled: row.disabled,
            chip: translate('cardUpgrade.row.copies', { n: row.copies }),
            artAsset: row.artAsset || null,
            artGlyph: row.artAsset ? null : row.artGlyph,
        };
    }

    function buildFaceCard(model, faceSide)
    {
        const cardReference = { cardId: model.selected.cardId };
        return renderCard(registries, cardReference, {
            small: true,
            tooltip: false,
            inspectReadOnly: true,
            definition: model.faces[faceSide],
        });
    }

    function buildFaces(model)
    {
        const faceEntries = FACE_SIDES.map((faceSide) => [
            faceSide,
            buildFaceCard(model, faceSide),
        ]);
        return upgradeFacesNode(Object.fromEntries(faceEntries));
    }

    function findChosenOption(model)
    {
        return (
            model.selected.options?.[chosenOptionIndex]
            || model.selected.options?.[0]
            || null
        );
    }

    function readPaneModel(model)
    {
        const hasFaces = model.selected && model.faces;
        const option = hasFaces
            ? findChosenOption(model)
            : null;
        if (
            !option
            || !hasOptionChoice(model.selected)
        )
        {
            return model;
        }
        return {
            ...model,
            selected: {
                ...model.selected,
                changes: option.changes,
                look: option.look,
            },
            faces: {
                before: model.faces.before,
                after: option.after,
            },
        };
    }

    // The rarity (a coloured chip) and the exact size of an upgrade, read from the card the step makes (owner, 2026-11-19).
    function buildLookNode(look)
    {
        if (!look)
        {
            return null;
        }
        return buildElement(
            'span',
            {
                class: `card-upgrade-look card-upgrade-look-${look.rarity}`,
                dataset: { upgradeRarity: look.rarity },
            },
            [
                buildElement('b', { class: 'card-upgrade-look-rarity', text: look.rarityLabel }),
                ...(look.size ? [buildElement('span', { class: 'card-upgrade-look-size', text: look.size })] : []),
            ],
        );
    }

    function buildOptionBody(option, selected)
    {
        const titleNode = buildElement('b', {
            class: CLASS.optionTitle,
            text: translate('cardUpgrade.option.n', { n: option.index + 1 }),
        });
        const cardReference = { cardId: selected.cardId };
        const faceCard = renderCard(registries, cardReference, {
            small: true,
            tooltip: false,
            actionOwnsTouch: true,
            definition: option.after,
        });
        const changeItems = option.changes.map((change) => buildElement('li', {
            text: describeChange(change),
        }));
        const faceNode = buildElement(
            'div',
            { class: CLASS.optionFace },
            faceCard,
        );
        const lookNode = buildLookNode(option.look);
        const changeList = buildElement(
            'ul',
            { class: CLASS.optionChanges },
            changeItems,
        );
        return buildElement(
            'span',
            {
                class: CLASS.optionBody,
            },
            [
                titleNode,
                ...(lookNode ? [lookNode] : []),
                faceNode,
                changeList,
            ],
        );
    }

    function buildOptionButton(option, selected)
    {
        const isChosen = option.index === chosenOptionIndex;
        const optionButton = buildElement(
            'button',
            {
                type: 'button',
                class: appendClassWhen(CLASS.option, isChosen, CLASS.selected),
                role: 'radio',
                'aria-checked': String(isChosen),
                tabindex: isChosen ? '0' : '-1',
                'aria-label': translate('cardUpgrade.option.aria', {
                    n: option.index + 1,
                    total: selected.options.length,
                    summary: option.changes.map(describeChangeForScreenReader).join(', '),
                }),
                dataset: {
                    cardUpgradeOption: String(option.index),
                },
            },
            buildOptionBody(option, selected),
        );
        optionButton.addEventListener('click', () => chooseOption(option.index));
        return optionButton;
    }

    function stepChosenOptionByArrow(event, optionCount)
    {
        const arrowStep = ARROW_STEP[event.key];
        if (!arrowStep)
        {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        chooseOption((chosenOptionIndex + arrowStep + optionCount) % optionCount);
    }

    function buildOptionsGroup(model)
    {
        const { selected } = model;
        if (!hasOptionChoice(selected))
        {
            return null;
        }
        const optionCount = selected.options.length;
        const optionsLabel = translate('cardUpgrade.options.label');
        const optionButtons = selected.options.map((option) => buildOptionButton(option, selected));
        const optionList = buildElement(
            'div',
            { class: CLASS.optionList },
            optionButtons,
        );
        const optionsGroup = buildElement(
            'div',
            {
                class: CLASS.options,
                role: 'radiogroup',
                'aria-label': optionsLabel,
                dataset: {
                    cardUpgradeOptions: String(optionCount),
                },
            },
            [
                eyebrow(optionsLabel),
                optionList,
            ],
        );
        optionsGroup.addEventListener('keydown', (event) =>
        {
            stepChosenOptionByArrow(event, optionCount);
        });
        return optionsGroup;
    }

    function chooseOption(optionIndex)
    {
        chosenOptionIndex = optionIndex;
        renderDetails({ keepOptions: true });
        const optionSelector = `[data-card-upgrade-option="${optionIndex}"]`;
        detailsHost?.querySelector(optionSelector)?.focus(FOCUS_WITHOUT_SCROLL);
    }

    function buildDetailNodes(rawModel)
    {
        const model = readPaneModel(rawModel);
        const costNode = model.purse === false
            ? null
            : buildCostNode(model);
        const changeRows = buildChangeRows(model.selected.changes);
        const nodes = upgradeConfirmNodes({
            cost: costNode,
            faces: model.faces ? buildFaces(model) : null,
            rows: changeRows,
        });
        const lookNode = hasOptionChoice(model.selected) ? null : buildLookNode(model.selected.look);
        if (lookNode)
        {
            nodes.unshift(lookNode);
        }
        if (model.selected.nextDiffers)
        {
            const noteNode = buildElement('p', {
                class: CLASS.note,
                text: translate('cardUpgrade.row.nextDiffers'),
            });
            return [noteNode, ...nodes];
        }
        return nodes;
    }

    function buildConfirmationDetails(rawModel)
    {
        return buildElement(
            'div',
            {
                class: CLASS.details,
            },
            buildDetailNodes(rawModel),
        );
    }

    // The chosen option is marked in place on the radio buttons (class, aria-checked, tabindex); the pane's change
    // rows and faces after them are the only part that is rebuilt (owner, 2026-11-18: change only what changed).
    function markChosenOption(optionsGroup)
    {
        for (const optionButton of optionsGroup.querySelectorAll('[data-card-upgrade-option]'))
        {
            const isChosen = Number(optionButton.dataset.cardUpgradeOption) === chosenOptionIndex;
            optionButton.classList.toggle(CLASS.selected, isChosen);
            optionButton.setAttribute('aria-checked', String(isChosen));
            optionButton.setAttribute('tabindex', isChosen ? '0' : '-1');
        }
    }

    function readOptionsSignature(selected)
    {
        return hasOptionChoice(selected)
            ? JSON.stringify(selected.options.map((option) => option.changes))
            : '';
    }

    function patchDetailTail(optionsGroup)
    {
        markChosenOption(optionsGroup);
        while (optionsGroup.nextSibling)
        {
            optionsGroup.nextSibling.remove();
        }
        optionsGroup.after(...buildDetailNodes(currentModel).filter(Boolean));
    }

    function renderDetails({ keepOptions = false } = {})
    {
        if (!detailsHost)
        {
            return;
        }
        const optionsSignature = readOptionsSignature(currentModel.selected);
        const optionsGroup = keepOptions && optionsSignature === detailOptionsSignature
            ? detailsHost.querySelector(`.${CLASS.options}`)
            : null;
        if (optionsGroup)
        {
            patchDetailTail(optionsGroup);
            return;
        }
        detailOptionsSignature = optionsSignature;
        const detailChildren = [
            buildOptionsGroup(currentModel),
            ...buildDetailNodes(currentModel),
        ];
        detailsHost.replaceChildren(...detailChildren.filter(Boolean));
    }

    function renderDetailsIfSelected(selected)
    {
        if (
            selected
            && currentModel.faces
        )
        {
            renderDetails({ keepOptions: true });
        }
    }

    function canCommitSelection(selected)
    {
        const optionIsPicked = Boolean(selected.options?.[chosenOptionIndex]);
        const hasPickedOption = !hasOptionChoice(selected) || optionIsPicked;
        return Boolean(currentModel.canConfirm) && hasPickedOption;
    }

    function settleModalParent(committed, instanceId)
    {
        if (!parentRecord)
        {
            return;
        }
        if (committed)
        {
            returnToModalParent(instanceId);
        }
        else
        {
            dropModalParent(parentRecord);
        }
    }

    function commitSelectedUpgrade()
    {
        if (!currentModel.canConfirm)
        {
            return;
        }
        const { selected } = currentModel;
        const option = hasOptionChoice(selected)
            ? selected.options[chosenOptionIndex]
            : null;
        if (
            hasOptionChoice(selected)
            && !option
        )
        {
            return;
        }
        committing = true;
        detailShell?.close({ liftNow: true });
        shell.close();
        let committed = false;
        try
        {
            const plan = buildCommitPlan(selected, option);
            committed = onConfirm(selected.instanceId, plan) !== false;
        }
        finally
        {
            settleModalParent(committed, selected.instanceId);
        }
    }

    function readFocusedInstanceId()
    {
        const focusWasInList = candidateList?.contains?.(document.activeElement);
        return focusWasInList
            ? document.activeElement.getAttribute?.(INSTANCE_ID_ATTRIBUTE)
            : null;
    }

    function resetChosenOptionFor(selected)
    {
        const selectedInstanceId = selected
            ? selected.instanceId
            : null;
        if (selectedInstanceId !== chosenForInstanceId)
        {
            chosenForInstanceId = selectedInstanceId;
            chosenOptionIndex = 0;
        }
        if (selected?.options?.length)
        {
            const lastOptionIndex = selected.options.length - 1;
            const clampedIndex = Math.max(chosenOptionIndex, 0);
            chosenOptionIndex = Math.min(clampedIndex, lastOptionIndex);
        }
        return selectedInstanceId;
    }

    function decorateRowElement(rowElement, model)
    {
        const rowInstanceId = rowElement.getAttribute(INSTANCE_ID_ATTRIBUTE);
        const row = model.rows.find((candidate) => candidate.instanceId === rowInstanceId);
        if (!row)
        {
            return;
        }
        const rowIsSelected = isRowSelected(model, row);
        rowElement.dataset.cardId = row.cardId;
        rowElement.dataset.inDeck = String(Boolean(row.inDeck));
        if (row.inDeck)
        {
            const marker = buildElement('span', {
                class: 'in-deck-badge',
                text: translate('cardUpgrade.row.inDeck'),
            });
            rowElement.querySelector('.option-row-name, .co-name')?.after(marker);
        }
        rowElement.dataset.upgradeState = readUpgradeState(row);
        rowElement.setAttribute('role', 'option');
        rowElement.setAttribute('aria-haspopup', 'dialog');
        rowElement.setAttribute('aria-disabled', String(row.disabled));
        MarkSelected(
            rowElement,
            rowIsSelected,
            {
                className: CLASS.selected,
                ariaAttribute: 'aria-selected',
            },
        );
        rowElement.setAttribute('aria-label', buildRowAriaLabel(row));
        const rowTone = rowIsSelected
            ? 'selected'
            : 'available';
        markUiComponent(
            rowElement,
            UI_COMPONENTS.smithCandidateCard,
            rowTone,
        );
    }

    // Everything on a row except whether it is the selected one. When this is the same as last time only the
    // selection marks move; the list, its rows, the scroll position and the focused row stay as they are.
    function readListSignature(model)
    {
        return JSON.stringify(model.rows.map((row) => [
            buildCandidateRow(row),
            Boolean(row.inDeck),
            readUpgradeState(row),
            buildRowAriaLabel(row),
        ]));
    }

    function patchCandidateSelection(model)
    {
        for (const rowElement of candidateList.querySelectorAll(ANY_ROW_SELECTOR))
        {
            const rowInstanceId = rowElement.getAttribute(INSTANCE_ID_ATTRIBUTE);
            const row = model.rows.find((candidate) => candidate.instanceId === rowInstanceId);
            if (!row)
            {
                continue;
            }
            const rowIsSelected = isRowSelected(model, row);
            rowElement.setAttribute('aria-pressed', String(rowIsSelected));
            MarkSelected(
                rowElement,
                rowIsSelected,
                {
                    className: CLASS.selected,
                    ariaAttribute: 'aria-selected',
                },
            );
            markUiComponent(
                rowElement,
                UI_COMPONENTS.smithCandidateCard,
                rowIsSelected
                    ? 'selected'
                    : 'available',
            );
        }
    }

    function renderCandidateList(model, selectedInstanceId)
    {
        const signature = readListSignature(model);
        if (
            candidateList
            && candidateList.isConnected
            && signature === listSignature
        )
        {
            patchCandidateSelection(model);
            return;
        }
        listSignature = signature;
        const scrollHosts = [listHost, bodyHost, shell.panel].filter(Boolean);
        const scrollTops = scrollHosts.map((scrollHost) => scrollHost.scrollTop);
        const candidateRows = model.rows.map((row) => buildCandidateRow(row));
        candidateList = optionRowList(candidateRows, {
            idAttr: INSTANCE_ID_ATTRIBUTE,
            selectedId: selectedInstanceId,
            columns: 1,
            onSelect: (instanceId) =>
            {
                onSelect(instanceId);
                if (isSelectedInstance(instanceId))
                {
                    openDetailModal();
                }
            },
        });
        for (const rowElement of candidateList.querySelectorAll(ANY_ROW_SELECTOR))
        {
            decorateRowElement(rowElement, model);
        }
        listHost.replaceChildren(candidateList);
        scrollHosts.forEach((scrollHost, index) =>
        {
            scrollHost.scrollTop = scrollTops[index];
        });
    }

    function readBlockedMessage(model)
    {
        return model.blockedReasons.join(' ')
            || translate('cardUpgrade.unavailable');
    }

    function updateConfirmButton(model, selected)
    {
        const disabled = !selected || !canCommitSelection(selected);
        const label = selected
            ? confirmLabel || readConfirmLabel(selected)
            : confirmLabel || translate('cardUpgrade.confirmIdle');
        const blockedTitle = selected && disabled
            ? readBlockedMessage(model)
            : '';
        const commitButtons = [
            confirmButton,
            detailConfirmButton,
        ].filter(Boolean);
        for (const commitButton of commitButtons)
        {
            commitButton.disabled = disabled;
            commitButton.textContent = label;
            commitButton.title = blockedTitle;
        }
    }

    function isSelectedInstance(instanceId)
    {
        const { selected } = currentModel;
        if (!selected)
        {
            return false;
        }
        return selected.instanceId === instanceId
            || Boolean(selected.instanceIds?.includes(instanceId));
    }

    function inspectSelectedFace(inspectButton)
    {
        const face = findInspectFace(detailsHost);
        if (face)
        {
            openBoundCardInspection(face, inspectButton);
        }
    }

    function handleDetailClose()
    {
        detailShell = null;
        detailsHost = null;
        detailConfirmButton = null;
        detailInstanceId = null;
    }

    // Choosing a card opens its own modal (owner, 2026-11-17): before -> after, the options, an (i) that reads the
    // whole card, Back to the list and the one Upgrade. Select, then Upgrade: still two clicks (#2817).
    function openDetailModal()
    {
        const { selected } = currentModel;
        if (closed || detailShell || !selected)
        {
            return;
        }
        const detailBackLabel = translate('common.back');
        const detailBackButton = buildBackButton(detailBackLabel, CLASS.detailBack);
        const inspectButton = buildInspectButton(selected.name);
        const opener = candidateList?.querySelector(selectorForRow(selected.instanceId)) || returnFocus;
        detailConfirmButton = buildConfirmButton(CLASS.detailConfirm);
        detailConfirmButton.addEventListener('click', commitSelectedUpgrade);
        detailInstanceId = selected.instanceId;
        detailShell = OpenModal({
            title: selected.name,
            eyebrow: title,
            size: 'md',
            className: CLASS.detailModal,
            host,
            opener,
            closeLabel: detailBackLabel,
            headExtras: inspectButton,
            secondary: [detailBackButton],
            primary: detailConfirmButton,
            bodyClassName: 'as-pane',
            deferFocus: true,
            initialFocus: () => (detailConfirmButton?.disabled ? detailBackButton : detailConfirmButton),
            body(bodyElement)
            {
                detailsHost = buildElement('div', { class: CLASS.details });
                bodyElement.append(detailsHost);
            },
            onClose: handleDetailClose,
        });
        const openedShell = detailShell;
        detailBackButton.addEventListener('click', () => openedShell.close());
        inspectButton.addEventListener('click', () => inspectSelectedFace(inspectButton));
        markUiComponent(openedShell.panel, UI_COMPONENTS.smithUpgradeModal, 'detail');
        renderDetails();
        updateConfirmButton(currentModel, selected);
    }

    function retargetDetailModal(selected)
    {
        detailInstanceId = selected.instanceId;
        const headingId = detailShell.panel.getAttribute('aria-labelledby');
        const heading = headingId
            ? detailShell.panel.querySelector(`#${headingId}`)
            : null;
        if (heading)
        {
            heading.textContent = selected.name;
        }
        const inspectButton = detailShell.panel.querySelector(`.${CLASS.inspect}`);
        if (inspectButton)
        {
            const label = translate('cardUpgrade.inspect', { name: selected.name });
            inspectButton.title = label;
            inspectButton.setAttribute('aria-label', label);
        }
        renderDetails();
    }

    function syncDetailModal(selected)
    {
        if (!detailShell)
        {
            return;
        }
        if (!selected)
        {
            detailShell.close();
            return;
        }
        // Another card chosen under an open modal: the same modal keeps its place and takes that card's title,
        // (i) and faces, instead of closing and opening afresh.
        if (selected.instanceId !== detailInstanceId)
        {
            retargetDetailModal(selected);
            return;
        }
        renderDetailsIfSelected(selected);
    }

    function restoreRowFocus(focusedInstanceId)
    {
        if (!focusedInstanceId)
        {
            return;
        }
        const focusedRowSelector = selectorForRow(focusedInstanceId);
        const refocusTarget = candidateList.querySelector(focusedRowSelector)
            || candidateList.querySelector(ANY_ROW_SELECTOR);
        refocusTarget?.focus?.(FOCUS_WITHOUT_SCROLL);
    }

    function renderModel(model)
    {
        const focusedInstanceId = readFocusedInstanceId();
        currentModel = model;
        const { selected } = model;
        const selectedInstanceId = resetChosenOptionFor(selected);

        renderCandidateList(model, selectedInstanceId);
        stonesStatus.textContent = translate('cardUpgrade.stones', { n: model.stones });
        stonesStatus.hidden = model.purse === false;
        syncDetailModal(selected);
        updateConfirmButton(model, selected);
        restoreRowFocus(focusedInstanceId);
    }

    function markReturnedRowAsQuietFocus()
    {
        const returnedRowSelector = selectorForRow(focusInstanceId);
        const returnedRow = candidateList?.querySelector(returnedRowSelector);
        if (returnedRow)
        {
            returnedRow.dataset.quietFocus = 'true';
        }
    }
}
