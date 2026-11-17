// Shared attribute-allocation card; callers supply the policy.
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

function buildStepper(
    statRowModel,
    {
        onDecrease,
        onIncrease,
    },
)
{
    const buildStepButton = (
        glyph,
        action,
        isAllowed,
        verbLabel,
    ) =>
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
        stepButton.addEventListener(CLICK_EVENT, (event) =>
        {
            // The controls live in a summary; spending a point must not toggle it.
            event.preventDefault();
            event.stopPropagation();
            if (isAllowed)
            {
                const stepHandler = action === STEP_ACTION.decrease
                    ? onDecrease
                    : onIncrease;
                stepHandler?.(statRowModel.id);
            }
        });
        return stepButton;
    };
    const valueNode = buildElement('span', {
        class: 'seg-value se-value',
        text: String(statRowModel.value),
    });
    const decreaseButton = buildStepButton(
        '−',
        STEP_ACTION.decrease,
        statRowModel.canDecrease,
        'Decrease',
    );
    const increaseButton = buildStepButton(
        '+',
        STEP_ACTION.increase,
        statRowModel.canIncrease,
        'Increase',
    );
    return buildElement(
        'span',
        { class: 'as-seg stepper se-controls' },
        [
            decreaseButton,
            valueNode,
            increaseButton,
        ],
    );
}

function drawStatRows(rowsHost, statRowModels, handlers)
{
    const expandedFaces = rowsHost.querySelectorAll(EXPANDED_FACE_SELECTOR);
    const expandedFaceIds = new Set(
        [...expandedFaces].map((face) => face.dataset.face),
    );
    const cardModels = statRowModels.map((statRowModel) => ({
        ...statRowModel.card,
        face: {
            ...statRowModel.card.face,
            value: '',
        },
    }));
    const attributeCards = primaryStatCards(cardModels);
    const statRowNodes = statRowModels.map((statRowModel, index) =>
    {
        const attributeCard = attributeCards[index];
        attributeCard.classList.add('se-attribute-card');

        const stepperHost = attributeCard.querySelector(STEPPER_HOST_SELECTOR);
        stepperHost.appendChild(buildStepper(statRowModel, handlers));

        const mainGain = statRowModel.card?.mainGain;
        const labelHost = attributeCard.querySelector('.ls-label');
        if (mainGain && labelHost)
        {
            const gainNode = buildElement('span', {
                class: 'se-gain',
                text: mainGain.text,
                title: attributeGainSummary(statRowModel.card.gains),
            });
            labelHost.appendChild(gainNode);
        }

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
    });
    rowsHost.replaceChildren(...statRowNodes);

    for (const face of rowsHost.querySelectorAll(DISC_FACE_SELECTOR))
    {
        if (expandedFaceIds.has(face.dataset.face))
        {
            face.click();
        }
    }
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
    drawStatRows(rowsHost, rows, { onDecrease, onIncrease });
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
        if (!isDoneDisabled && onDone)
        {
            onDone();
        }
    });

    const noteNode = note
        ? flavour(note, { class: 'stat-allocation-note' })
        : null;
    const bodyNodes = [
        remainingPool,
        noteNode,
        hairline(),
        rowsHost,
    ];
    let card;
    let closeCard = () =>
    {};

    if (modal)
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
        card = door.panel;
        closeCard = door.close;
    }
    else
    {
        const actionRow = buttonRow({
            size: 'medium',
            buttons: [cancelButton, doneButton],
            className: 'cc-stat-actions',
        });
        card = buildElement(
            'section',
            {
                class: 'as-pane flush stat-allocation-card',
                tabindex: '-1',
            },
            [
                eyebrow(translate(ATTRIBUTES_LABEL_KEY)),
                titleS(title, { tag: 'h3', id: TITLE_ID }),
                ...bodyNodes,
                actionRow,
            ],
        );
        host.innerHTML = '';
        host.appendChild(card);
    }

    return {
        card,
        rowsHost,
        cancel: cancelButton,
        done: doneButton,
        close: closeCard,
        update({
            remaining: nextRemaining = remaining,
            rows: nextRows = rows,
            doneDisabled: nextDoneDisabled = isDoneDisabled,
        } = {})
        {
            const poolValue = remainingPool.querySelector('.sp-v');
            poolValue.textContent = String(nextRemaining);
            drawStatRows(rowsHost, nextRows, { onDecrease, onIncrease });
            isDoneDisabled = nextDoneDisabled;
            doneButton.setAttribute(ARIA_DISABLED, ariaFlag(isDoneDisabled));
        },
    };
}
