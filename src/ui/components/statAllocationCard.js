import { primaryStatCards } from './creationCards.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import {
    el as buildElement,
    eyebrow,
    titleS,
    flavour,
    hairline,
    statPair,
    row as buildSettingRow,
    button,
    buttonRow,
    openModal,
} from '../kit/index.js';
import { t as translate } from '../strings.js';
import { attributeGainSummary } from '../../model/attributePointPreview.js';

const CLICK_EVENT = 'click';
const ARIA_DISABLED = 'aria-disabled';
const ATTRIBUTES_LABEL_KEY = 'progression.attributes';
const TITLE_ID = 'cc-stat-title';
const DISC_FACE_SELECTOR = '.disc-face';
const EXPANDED_FACE_SELECTOR = `${DISC_FACE_SELECTOR}[aria-expanded="true"]`;
const STEPPER_HOST_SELECTOR = `${DISC_FACE_SELECTOR} > .as-row`;
const STEP_ACTION = Object.freeze({
    decrease: 'decrease',
    increase: 'increase',
});

const ariaFlag = (isOn) => (isOn
    ? 'true'
    : 'false');

function buildStepButton(
    statRowModel,
    {
        onDecrease,
        onIncrease,
    },
    {
        glyph,
        action,
        isAllowed,
        verbLabel,
    },
)
{
    const stepButton = buildElement('button', {
        type: 'button',
        class: 'se-step',
        text: glyph,
        dataset: {
            statId: statRowModel.id,
            statAction: action,
        },
        'aria-label': `${verbLabel} ${statRowModel.label}`,
        [ARIA_DISABLED]: ariaFlag(!isAllowed),
    });

    function spendPointWithoutTogglingSummary(event)
    {
        event.preventDefault();
        event.stopPropagation();
        if (isAllowed)
        {
            const applyStep = action === STEP_ACTION.decrease
                ? onDecrease
                : onIncrease;
            applyStep?.(statRowModel.id);
        }
    }

    stepButton.addEventListener(CLICK_EVENT, spendPointWithoutTogglingSummary);
    return stepButton;
}

function buildStepper(statRowModel, stepHandlers)
{
    const valueLabel = buildElement('span', {
        class: 'seg-value se-value',
        text: String(statRowModel.value),
    });
    const decreaseButton = buildStepButton(
        statRowModel,
        stepHandlers,
        {
            glyph: '−',
            action: STEP_ACTION.decrease,
            isAllowed: statRowModel.canDecrease,
            verbLabel: 'Decrease',
        },
    );
    const increaseButton = buildStepButton(
        statRowModel,
        stepHandlers,
        {
            glyph: '+',
            action: STEP_ACTION.increase,
            isAllowed: statRowModel.canIncrease,
            verbLabel: 'Increase',
        },
    );
    return buildElement(
        'span',
        { class: 'as-seg stepper se-controls' },
        [
            decreaseButton,
            valueLabel,
            increaseButton,
        ],
    );
}

function readExpandedFaceIds(rowsHost)
{
    const expandedFaces = rowsHost.querySelectorAll(EXPANDED_FACE_SELECTOR);
    return new Set(
        [...expandedFaces].map((face) => face.dataset.face),
    );
}

function buildAttributeCardModels(statRowModels)
{
    return statRowModels.map((statRowModel) => ({
        ...statRowModel.card,
        face: {
            ...statRowModel.card.face,
            value: '',
        },
    }));
}

function appendMainGain(attributeCard, statRowModel)
{
    const mainGain = statRowModel.card?.mainGain;
    const labelHost = attributeCard.querySelector('.ls-label');
    if (
        mainGain
        && labelHost
    )
    {
        const gainLabel = buildElement('span', {
            class: 'se-gain',
            text: mainGain.text,
            title: attributeGainSummary(statRowModel.card.gains),
        });
        labelHost.appendChild(gainLabel);
    }
}

function buildStatRow(attributeCard, statRowModel, stepHandlers)
{
    attributeCard.classList.add('se-attribute-card');

    const stepperHost = attributeCard.querySelector(STEPPER_HOST_SELECTOR);
    stepperHost.appendChild(buildStepper(statRowModel, stepHandlers));

    appendMainGain(attributeCard, statRowModel);

    const settingRow = buildSettingRow({
        tag: 'div',
        setting: true,
        className: 'se-row',
        labelNode: attributeCard,
    });
    return markUiComponent(
        settingRow,
        UI.statAllocationRow,
    );
}

function reopenExpandedFaces(rowsHost, expandedFaceIds)
{
    for (const face of rowsHost.querySelectorAll(DISC_FACE_SELECTOR))
    {
        if (expandedFaceIds.has(face.dataset.face))
        {
            face.click();
        }
    }
}

function renderStatRows(rowsHost, statRowModels, stepHandlers)
{
    const expandedFaceIds = readExpandedFaceIds(rowsHost);
    const cardModels = buildAttributeCardModels(statRowModels);
    const attributeCards = primaryStatCards(cardModels);
    const statRows = statRowModels.map(
        (statRowModel, rowIndex) =>
            buildStatRow(
                attributeCards[rowIndex],
                statRowModel,
                stepHandlers,
            ),
    );
    rowsHost.replaceChildren(...statRows);

    reopenExpandedFaces(rowsHost, expandedFaceIds);
}

function openAllocationModal(
    host,
    {
        title,
        bodyNodes,
        cancelButton,
        doneButton,
        onClose,
    },
)
{
    const door = openModal({
        size: 'md',
        className: 'cc-stat-modal',
        kind: 'statUpgrade',
        eyebrow: translate(ATTRIBUTES_LABEL_KEY),
        title,
        titleId: TITLE_ID,
        body: buildElement(
            'div',
            { class: 'as-pane stat-allocation-card' },
            bodyNodes,
        ),
        secondary: [cancelButton],
        primary: doneButton,
        footSize: 'medium',
        host,
        onClose,
    });
    door.veil.classList.add('cc-stat-overlay');
    return door;
}

function renderInlineCard(
    host,
    {
        title,
        bodyNodes,
        cancelButton,
        doneButton,
    },
)
{
    const actionRow = buttonRow({
        size: 'medium',
        buttons: [
            cancelButton,
            doneButton,
        ],
        className: 'cc-stat-actions',
    });
    const card = buildElement(
        'section',
        {
            class: 'as-pane flush stat-allocation-card',
            tabindex: '-1',
        },
        [
            eyebrow(translate(ATTRIBUTES_LABEL_KEY)),
            titleS(title, {
                tag: 'h3',
                id: TITLE_ID,
            }),
            ...bodyNodes,
            actionRow,
        ],
    );
    host.innerHTML = '';
    host.appendChild(card);
    return card;
}

export function RenderStatAllocationCard(
    host,
    {
        title = 'Assign points',
        remaining = 0,
        remainingLabel = 'Points to assign',
        note = '',
        rows = [],
        modal = false,
        cancelLabel = translate('common.cancel'),
        doneLabel = 'Done',
        doneDisabled = false,
        onDecrease = null,
        onIncrease = null,
        onCancel = null,
        onDone = null,
        onClose = null,
    } = {},
)
{
    let isDoneDisabled = doneDisabled;

    const remainingPool = statPair({
        key: remainingLabel,
        value: String(remaining),
        attrs: { class: 'se-pool' },
    });
    const rowsHost = buildElement('div', { class: 'as-stack tight cc-allocation-rows' });
    renderStatRows(rowsHost, rows, { onDecrease, onIncrease });
    const cancelButton = button({
        label: cancelLabel,
        attrs: { 'data-stat-cancel': '' },
    });
    const doneButton = button({
        label: doneLabel,
        weight: 'primary',
        attrs: {
            'data-stat-done': '',
            [ARIA_DISABLED]: ariaFlag(isDoneDisabled),
        },
    });
    cancelButton.addEventListener(CLICK_EVENT, () => onCancel?.());
    doneButton.addEventListener(CLICK_EVENT, () =>
    {
        if (
            !isDoneDisabled
            && onDone
        )
        {
            onDone();
        }
    });

    const noteNode = note
        ? flavour(note, { class: 'stat-allocation-note' })
        : null;
    const cardParts = {
        title,
        bodyNodes: [
            remainingPool,
            noteNode,
            hairline(),
            rowsHost,
        ],
        cancelButton,
        doneButton,
    };
    let card;
    let closeCard = () =>
    {};

    if (modal)
    {
        const door = openAllocationModal(host, {
            ...cardParts,
            onClose,
        });
        card = door.panel;
        closeCard = door.close;
    }
    else
    {
        card = renderInlineCard(host, cardParts);
    }

    function update({
        remaining: nextRemaining = remaining,
        rows: nextRows = rows,
        doneDisabled: nextDoneDisabled = isDoneDisabled,
    } = {})
    {
        const poolValue = remainingPool.querySelector('.sp-v');
        poolValue.textContent = String(nextRemaining);
        renderStatRows(rowsHost, nextRows, { onDecrease, onIncrease });
        isDoneDisabled = nextDoneDisabled;
        doneButton.setAttribute(ARIA_DISABLED, ariaFlag(isDoneDisabled));
    }

    return {
        card,
        rowsHost,
        cancel: cancelButton,
        done: doneButton,
        close: closeCard,
        update,
    };
}
