import { engravedIcon, engravedIconHtml } from './engravedIcon.js';
import { ModalModelFor } from '../models/ModalModel.js';
import { esc as escapeHtml, hideTooltip } from './tooltip.js';
import { t as translate } from '../strings.js';
import { planButtonGroup } from '../models/ButtonSizeModel.js';
import { resolveModalRung, resolveFooterSize } from '../models/WireframeChoiceModel.js';
import { activeWireframeChoice } from '../wireframeChoices.js';
import { registerModal } from '../modalState.js';
import { focusableControls } from '../modalManager.js';

export const MODAL_CLOSE_GLYPH = 'close';

export const BUTTON_ROW_SIZES = Object.freeze([
    'short',
    'medium',
    'long',
    'fill',
]);

export const MODAL_SIZES = Object.freeze([
    'sm',
    'md',
    'lg',
    'xl',
]);

const FALLBACK_DELAY_MS = 250;
const SCROLL_SLACK_PX = 2;

const DEFAULT_CLOSE_LABEL = 'Close';
const DEFAULT_ROW_SIZE = 'medium';
const DEFAULT_MODAL_SIZE = 'md';
const DEFAULT_MODAL_ROLE = 'dialog';
const DEFAULT_MODAL_KIND = 'base';
const ROLE_ALERT_DIALOG = 'alertdialog';
const CONTROL_ROLE_EXIT = 'exit';
const WIREFRAME_MODAL_WIDTH = 'wireframeModalWidth';
const WIREFRAME_MODAL_FOOTER = 'wireframeModalFooter';
const LONG_HEIGHT = 'long';

const CLASS_TABS = 'modal-tabs';
const CLASS_TAB = 'modal-tab';
const CLASS_BUTTON_ROW = 'modal-btnrow';
const CLASS_CLOSE = 'subtle modal-close';
const CLASS_FOOT_ACTIONS = 'modal-foot-actions';
const OVERFLOW_BODIES = '.modal-body, .as-body, .as-pane';

const SELECTOR = Object.freeze({
    topModals: '[aria-modal="true"]',
    tab: '[role="tab"]',
    footActions: `.${CLASS_FOOT_ACTIONS}`,
    authoredFootRows: `.${CLASS_FOOT_ACTIONS}[data-authored-size]`,
    authoredPanels: '.modal[data-authored-size]',
    footPrimary: `.${CLASS_FOOT_ACTIONS} .primary`,
    footExit: `.${CLASS_FOOT_ACTIONS} [data-control-role="${CONTROL_ROLE_EXIT}"]`,
    focusable: '[data-focusable="true"]',
    headClose: '.modal-close',
});

const PANEL_MUTATIONS_TO_WATCH = Object.freeze({
    childList: true,
    subtree: true,
    characterData: true,
});

const TAB_NAVIGATION_KEYS = Object.freeze([
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
]);

function joinClassNames(baseClass, extraClass)
{
    const suffix = extraClass
        ? ` ${extraClass}`
        : '';
    return `${baseClass}${suffix}`;
}

function createTitleId()
{
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    return `modal-title-${randomSuffix}`;
}

function createElementWithClass(tagName, className)
{
    const element = document.createElement(tagName);
    element.className = className;
    return element;
}

function hasAnimationFrames()
{
    return typeof requestAnimationFrame === 'function';
}

function findCurrentDocument()
{
    return typeof document === 'undefined'
        ? null
        : document;
}

function findTopModalPanel()
{
    const modals = document.querySelectorAll(SELECTOR.topModals);
    return [...modals].at(-1);
}

function assertKnownSize(size, allowedSizes, subject)
{
    if (!allowedSizes.includes(size))
    {
        throw new Error(`Unknown ${subject} '${size}'`);
    }
}

function runAfterTwoFrames(callback)
{
    let hasRun = false;

    const runOnce = () =>
    {
        if (hasRun)
        {
            return;
        }

        hasRun = true;
        callback();
    };

    requestAnimationFrame(() => requestAnimationFrame(runOnce));
    setTimeout(runOnce, FALLBACK_DELAY_MS)?.unref?.();
}

function buildFootNote(note)
{
    const noteWrapper = createElementWithClass('span', 'modal-foot-note');
    const text = document.createElement('span');
    text.textContent = note;
    noteWrapper.appendChild(text);
    return noteWrapper;
}

function markFooterPrimary(primaryButton)
{
    const controlRole = primaryButton.dataset?.controlRole
        ?? primaryButton.getAttribute?.('data-control-role');
    const hasPrimaryClass = ` ${primaryButton.className} `.includes(' primary ');

    if (
        controlRole !== CONTROL_ROLE_EXIT
        && !hasPrimaryClass
    )
    {
        primaryButton.className = `${primaryButton.className} primary`.trim();
    }
}

function buildFooterActions({
    secondary,
    primary,
    size,
    step,
})
{
    const actions = document.createElement('div');
    actions.className = 'modal-foot-actions modal-btnrow';
    actions.dataset.authoredSize = size;
    actions.dataset.size = step;

    const visibleSecondary = secondary.filter(
        (button) => button && !button.hidden,
    );
    const isPrimaryVisible = primary
        && !primary.hidden;
    const visiblePrimary = isPrimaryVisible
        ? primary
        : null;
    const primaryCount = visiblePrimary
        ? 1
        : 0;
    actions.dataset.actionCount = String(visibleSecondary.length + primaryCount);

    const plan = planButtonGroup({
        kind: 'footer',
        count: Number(actions.dataset.actionCount),
    });
    actions.dataset.buttonGroup = plan.kind;
    actions.dataset.buttonLayout = plan.layout;

    for (const button of [...visibleSecondary, visiblePrimary])
    {
        if (button?.dataset)
        {
            button.dataset.buttonSize = plan.size;
        }
    }

    for (const button of visibleSecondary)
    {
        actions.appendChild(button);
    }

    if (visiblePrimary)
    {
        markFooterPrimary(primary);
        actions.appendChild(primary);
    }

    return actions;
}

function trapTabFocus(event, panel)
{
    if (event.key !== 'Tab')
    {
        return false;
    }

    if (findTopModalPanel() !== panel)
    {
        return true;
    }

    const controls = focusableControls(panel);
    const firstControl = controls[0];
    const lastControl = controls.at(-1);
    const activeElement = document.activeElement;
    const focusIsOutside = !firstControl
        || !panel.contains(activeElement)
        || activeElement === panel;
    const edgeControl = event.shiftKey
        ? firstControl
        : lastControl;
    const focusIsAtEdge = activeElement === edgeControl;

    if (
        focusIsOutside
        || focusIsAtEdge
    )
    {
        event.preventDefault();

        const wrapTarget = event.shiftKey
            ? lastControl
            : firstControl;
        wrapTarget?.focus();

        if (!firstControl)
        {
            panel.focus();
        }
    }

    return true;
}

function hasOverflowingBody(panel)
{
    const bodies = [...panel.querySelectorAll(OVERFLOW_BODIES)];
    return bodies.some(
        (body) => body.scrollHeight > body.clientHeight + SCROLL_SLACK_PX,
    );
}

function createResizeObserver(onResize)
{
    return typeof ResizeObserver === 'function'
        ? new ResizeObserver(onResize)
        : null;
}

function createMutationObserver(onMutation)
{
    return typeof MutationObserver === 'function'
        ? new MutationObserver(onMutation)
        : null;
}

function findNextTabIndex(pressedKey, currentIndex, tabCount)
{
    if (pressedKey === 'Home')
    {
        return 0;
    }

    if (pressedKey === 'End')
    {
        return tabCount - 1;
    }

    const direction = pressedKey === 'ArrowRight'
        ? 1
        : -1;
    return (currentIndex + direction + tabCount) % tabCount;
}

function buildTabButton(tab, tabId, isSelected)
{
    const tabButton = document.createElement('button');
    tabButton.type = 'button';
    tabButton.className = CLASS_TAB;
    tabButton.setAttribute('role', 'tab');
    tabButton.setAttribute('aria-selected', String(isSelected));
    tabButton.tabIndex = isSelected
        ? 0
        : -1;
    tabButton.dataset.modalTab = tabId;
    tabButton.dataset.focusable = 'true';
    tabButton.textContent = tab.label;
    return tabButton;
}

function selectTabButton(tabStrip, chosenButton)
{
    for (const tabButton of tabStrip.querySelectorAll(SELECTOR.tab))
    {
        const isSelected = tabButton === chosenButton;
        tabButton.setAttribute('aria-selected', String(isSelected));
        tabButton.tabIndex = isSelected
            ? 0
            : -1;
    }
}

function focusRebuiltTab(head, targetId)
{
    const searchRoot = head.isConnected
        ? head
        : document;
    const candidates = [...searchRoot.querySelectorAll(`.${CLASS_TAB}`)];
    const replacement = candidates.find(
        (candidate) =>
            candidate.dataset.modalTab === targetId
            && candidate.isConnected,
    );
    replacement?.focus({ preventScroll: true });
}

function moveTabFocusByKey(event, tabStrip, head)
{
    if (!TAB_NAVIGATION_KEYS.includes(event.key))
    {
        return;
    }

    const tabButtons = [...tabStrip.querySelectorAll(SELECTOR.tab)];
    const currentIndex = tabButtons.indexOf(document.activeElement);

    if (currentIndex < 0)
    {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    const targetIndex = findNextTabIndex(
        event.key,
        currentIndex,
        tabButtons.length,
    );
    const targetTab = tabButtons[targetIndex];
    targetTab.focus();
    targetTab.click();

    focusRebuiltTab(head, targetTab.dataset.modalTab);
}

function buildTabStrip(tabList, onTab, head)
{
    const tabStrip = createElementWithClass('div', CLASS_TABS);
    tabStrip.setAttribute('role', 'tablist');

    const selectedTab = tabList.find((tab) => tab.selected)
        || tabList[0];

    for (const tab of tabList)
    {
        const tabId = tab.id || tab.label;
        const tabButton = buildTabButton(
            tab,
            tabId,
            tab === selectedTab,
        );

        tabButton.addEventListener('click', () =>
        {
            selectTabButton(tabStrip, tabButton);
            onTab?.(tabId);
        });

        tabStrip.appendChild(tabButton);
    }

    tabStrip.addEventListener('keydown', (event) =>
    {
        moveTabFocusByKey(event, tabStrip, head);
    });

    return tabStrip;
}

function buildHeadIdentity({ eyebrow, title, titleId })
{
    const identity = createElementWithClass('div', 'modal-head-id');

    if (eyebrow)
    {
        const eyebrowSpan = createElementWithClass('span', 'modal-eyebrow');
        eyebrowSpan.textContent = eyebrow;
        identity.appendChild(eyebrowSpan);
    }

    const heading = document.createElement('h2');

    if (titleId)
    {
        heading.id = titleId;
    }

    heading.textContent = title;
    identity.appendChild(heading);
    return identity;
}

function buildMenuButton({ menuLabel, onMenu })
{
    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'subtle modal-iconbtn';
    menuButton.dataset.size = 'square';
    menuButton.dataset.focusable = 'true';
    menuButton.title = menuLabel;
    menuButton.setAttribute('aria-label', menuLabel);
    menuButton.replaceChildren(engravedIcon('menu') || translate('common.menu'));

    if (onMenu)
    {
        menuButton.addEventListener('click', onMenu);
    }

    return menuButton;
}

function buildHeadActions({
    extras,
    shouldShowMenu,
    menuLabel,
    onMenu,
    closeLabel,
    onClose,
})
{
    const headActions = createElementWithClass('div', 'modal-head-actions');

    if (extras)
    {
        headActions.appendChild(extras);
    }

    if (shouldShowMenu)
    {
        headActions.appendChild(buildMenuButton({ menuLabel, onMenu }));
    }

    const close = ModalCloseButton({
        label: closeLabel,
        onClick: onClose,
    });
    close.dataset.size = 'square';
    close.dataset.focusable = 'true';
    headActions.appendChild(close);
    return headActions;
}

function buildModalPanel({
    className,
    size,
    kind,
    role,
    titleId,
})
{
    const panel = document.createElement('section');
    panel.className = joinClassNames('modal', className);
    StampModalSize(panel, size);
    ModalModelFor(kind).apply(panel);
    panel.dataset.wireframe = role === ROLE_ALERT_DIALOG
        ? 'W2'
        : 'W1';
    panel.setAttribute('role', role);
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', titleId);
    panel.tabIndex = -1;
    return panel;
}

function buildModalBody(body, bodyClassName)
{
    const bodyClass = joinClassNames('modal-body', bodyClassName);
    const bodyElement = createElementWithClass('div', bodyClass);

    if (typeof body === 'function')
    {
        body(bodyElement);
    }
    else if (body)
    {
        bodyElement.appendChild(body);
    }

    return bodyElement;
}

function buildModalFoot({
    note,
    secondary,
    primary,
    footSize,
})
{
    const secondaryList = Array.isArray(secondary)
        ? secondary
        : [secondary];
    const secondaryButtons = secondaryList.filter(Boolean);

    if (
        !note
        && !secondaryButtons.length
        && !primary
    )
    {
        return null;
    }

    const foot = ModalFooter({
        note,
        secondary: secondaryButtons,
        primary,
        size: footSize,
    });
    foot.querySelector(SELECTOR.footActions)?.classList.add(CLASS_BUTTON_ROW);
    return foot;
}

function detachThenLiftAfterFrames({
    veil,
    onClose,
    releaseDismiss,
    unregister,
})
{
    veil.remove();
    onClose?.();
    runAfterTwoFrames(() =>
    {
        unregister?.unlock?.();
        releaseDismiss?.();
        unregister?.();
    });
}

function liftThenDetach({
    veil,
    onClose,
    releaseDismiss,
    unregister,
})
{
    unregister?.unlock?.();
    releaseDismiss?.();
    veil.remove();
    onClose?.();
    unregister?.();
}

export function ModalCloseButton({
    label = DEFAULT_CLOSE_LABEL,
    onClick = null,
    className = '',
    id: elementId = '',
} = {})
{
    const button = document.createElement('button');
    button.type = 'button';

    if (elementId)
    {
        button.id = elementId;
    }

    button.className = joinClassNames(
        CLASS_CLOSE,
        className,
    );
    button.dataset.controlRole = CONTROL_ROLE_EXIT;
    button.dataset.tip = 'off';
    button.title = `${label} (Esc)`;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-keyshortcuts', 'Escape');

    const face = document.createElement('span');
    face.className = 'modal-close-face';
    face.setAttribute('aria-hidden', 'true');
    face.append(engravedIcon(MODAL_CLOSE_GLYPH) || 'X');
    button.appendChild(face);

    if (onClick)
    {
        button.addEventListener('click', onClick);
    }

    return button;
}

export function ModalCloseButtonHtml({
    label = DEFAULT_CLOSE_LABEL,
    className = '',
    id: elementId = '',
} = {})
{
    const idAttribute = elementId
        ? ` id="${escapeHtml(elementId)}"`
        : '';
    const escapedClassName = className && escapeHtml(className);
    const closeClass = joinClassNames(
        CLASS_CLOSE,
        escapedClassName,
    );
    const safeLabel = escapeHtml(label);

    return [
        `<button type="button"${idAttribute} class="${closeClass}"`,
        ` data-control-role="${CONTROL_ROLE_EXIT}"`,
        ` data-tip="off" title="${safeLabel} (Esc)" aria-label="${safeLabel}"`,
        ' aria-keyshortcuts="Escape">',
        '<span class="modal-close-face" aria-hidden="true">',
        engravedIconHtml(MODAL_CLOSE_GLYPH),
        '</span></button>',
    ].join('');
}

export function ModalFooter({
    note = '',
    secondary = [],
    primary = null,
    className = '',
    size = DEFAULT_ROW_SIZE,
} = {})
{
    assertKnownSize(size, BUTTON_ROW_SIZES, 'footer size');

    const footerChoice = activeWireframeChoice(WIREFRAME_MODAL_FOOTER);
    const step = resolveFooterSize(
        size,
        footerChoice,
        BUTTON_ROW_SIZES,
    );
    const footerClass = joinClassNames('modal-foot', className);
    const footer = createElementWithClass('footer', footerClass);

    if (note)
    {
        footer.appendChild(buildFootNote(note));
    }

    const actions = buildFooterActions({
        secondary,
        primary,
        size,
        step,
    });
    footer.appendChild(actions);
    return footer;
}

export function WatchLongPanel(panel)
{
    function promoteLongPanel()
    {
        if (
            !panel.isConnected
            || panel.dataset.height === LONG_HEIGHT
        )
        {
            return;
        }

        if (hasOverflowingBody(panel))
        {
            panel.dataset.height = LONG_HEIGHT;
        }
    }

    const resizeObserver = createResizeObserver(promoteLongPanel);
    resizeObserver?.observe(panel);

    const mutationObserver = createMutationObserver(promoteLongPanel);
    mutationObserver?.observe(panel, PANEL_MUTATIONS_TO_WATCH);

    return function stopWatchingLongPanel()
    {
        resizeObserver?.disconnect();
        mutationObserver?.disconnect();
    };
}

export function BindVeilDismiss(veil, onDismiss)
{
    let pressBeganOnVeil = false;

    function rememberVeilPress(event)
    {
        pressBeganOnVeil = event.target === veil;
    }

    function dismissOnVeilClick(event)
    {
        const pressStartedOnVeil = pressBeganOnVeil;
        pressBeganOnVeil = false;

        if (
            event.target === veil
            && pressStartedOnVeil
        )
        {
            onDismiss();
        }
    }

    veil.addEventListener('pointerdown', rememberVeilPress);
    veil.addEventListener('click', dismissOnVeilClick);

    return function unbindVeilDismiss()
    {
        veil.removeEventListener('pointerdown', rememberVeilPress);
        veil.removeEventListener('click', dismissOnVeilClick);
    };
}

export function BindModalDismiss({
    veil,
    panel,
    close,
    opener = document.activeElement,
    escape = true,
} = {})
{
    function handleKeydown(event)
    {
        if (event.defaultPrevented)
        {
            return;
        }

        if (trapTabFocus(event, panel))
        {
            return;
        }

        if (
            !escape
            || event.key !== 'Escape'
            || event.repeat
        )
        {
            return;
        }

        if (findTopModalPanel() !== panel)
        {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        close();
    }

    const stopWatchingLongPanel = WatchLongPanel(panel);

    document.addEventListener('keydown', handleKeydown, true);
    const unbindVeilDismiss = BindVeilDismiss(veil, close);

    return function release({ restoreFocus = true } = {})
    {
        stopWatchingLongPanel();
        document.removeEventListener('keydown', handleKeydown, true);
        unbindVeilDismiss();

        const canRestoreFocus = restoreFocus
            && opener?.isConnected
            && typeof opener.focus === 'function';

        if (canRestoreFocus)
        {
            opener.focus({ preventScroll: true });
        }
    };
}

export function ButtonRow({
    size = DEFAULT_ROW_SIZE,
    buttons = [],
    className = '',
} = {})
{
    assertKnownSize(size, BUTTON_ROW_SIZES, 'button row size');

    const rowClass = joinClassNames(CLASS_BUTTON_ROW, className);
    const buttonRow = createElementWithClass('div', rowClass);
    buttonRow.dataset.size = size;

    for (const button of buttons)
    {
        if (button)
        {
            buttonRow.appendChild(button);
        }
    }

    return buttonRow;
}

export function ModalHead({
    eyebrow = '',
    title = '',
    titleId = '',
    tabs = null,
    onTab = null,
    extras = null,
    showMenuButton = null,
    onMenu = null,
    menuLabel = translate('common.menu'),
    closeLabel = DEFAULT_CLOSE_LABEL,
    onClose = null,
} = {})
{
    const tabList = Array.isArray(tabs)
        ? tabs.filter(Boolean)
        : [];

    if (
        !tabList.length
        && !title
    )
    {
        throw new Error('modalHead requires a title, or tabs to stand in for one');
    }

    const head = createElementWithClass('header', 'modal-head');

    if (tabList.length)
    {
        head.appendChild(buildTabStrip(tabList, onTab, head));
    }
    else
    {
        head.appendChild(buildHeadIdentity({ eyebrow, title, titleId }));
    }

    const shouldShowMenu = showMenuButton == null
        ? tabList.length > 0
        : Boolean(showMenuButton);
    const headActions = buildHeadActions({
        extras,
        shouldShowMenu,
        menuLabel,
        onMenu,
        closeLabel,
        onClose,
    });
    head.appendChild(headActions);
    return head;
}

export function StampModalSize(panel, size)
{
    assertKnownSize(size, MODAL_SIZES, 'modal size');

    const widthChoice = activeWireframeChoice(WIREFRAME_MODAL_WIDTH);
    panel.dataset.authoredSize = size;
    panel.dataset.size = resolveModalRung(
        size,
        widthChoice,
        MODAL_SIZES,
    );
    return panel;
}

export function RestampModalWireframes(targetDocument = findCurrentDocument())
{
    if (!targetDocument)
    {
        return 0;
    }

    const rootElement = targetDocument.documentElement;
    const widthChoice = activeWireframeChoice(WIREFRAME_MODAL_WIDTH, rootElement);
    const footerChoice = activeWireframeChoice(WIREFRAME_MODAL_FOOTER, rootElement);
    let restampedCount = 0;

    for (const panel of targetDocument.querySelectorAll(SELECTOR.authoredPanels))
    {
        const authoredSize = panel.dataset.authoredSize;
        panel.dataset.size = resolveModalRung(
            authoredSize,
            widthChoice,
            MODAL_SIZES,
        );
        restampedCount += 1;
    }

    for (const footRow of targetDocument.querySelectorAll(SELECTOR.authoredFootRows))
    {
        const authoredSize = footRow.dataset.authoredSize;
        footRow.dataset.size = resolveFooterSize(
            authoredSize,
            footerChoice,
            BUTTON_ROW_SIZES,
        );
        restampedCount += 1;
    }

    return restampedCount;
}

export function OpenModal({
    name = '',
    size = DEFAULT_MODAL_SIZE,
    className = '',
    eyebrow = '',
    title = '',
    tabs = null,
    onTab = null,
    headExtras = null,
    showMenuButton = null,
    onMenu = null,
    closeLabel = '',
    body = null,
    bodyClassName = '',
    note = '',
    secondary = [],
    primary = null,
    footSize = DEFAULT_ROW_SIZE,
    onClose = null,
    onDismiss = null,
    onBackdrop = null,
    opener = document.activeElement,
    host = document.body,
    role = DEFAULT_MODAL_ROLE,
    titleId: givenTitleId = '',
    deferFocus = false,
    deferLift = false,
    initialFocus = null,
    kind = DEFAULT_MODAL_KIND,
} = {})
{
    hideTooltip();
    const titleId = givenTitleId || createTitleId();
    const veil = createElementWithClass('div', 'modal-veil');
    const panel = buildModalPanel({
        className,
        size,
        kind,
        role,
        titleId,
    });

    let release = null;
    let unregisterModal = null;
    let pageLockArmed = false;

    const close = (closeOptions) =>
    {
        if (!veil.isConnected)
        {
            unregisterModal?.();
            unregisterModal = null;
            return;
        }

        const closing = {
            veil,
            onClose,
            releaseDismiss: release,
            unregister: unregisterModal,
        };
        release = null;
        unregisterModal = null;

        const shouldDeferLift = deferLift
            && closeOptions?.liftNow !== true
            && hasAnimationFrames();

        if (shouldDeferLift)
        {
            detachThenLiftAfterFrames(closing);
            return;
        }

        liftThenDetach(closing);
    };

    function buildHead()
    {
        const titledCloseLabel = title
            ? `${DEFAULT_CLOSE_LABEL} ${title}`
            : DEFAULT_CLOSE_LABEL;
        const modalHead = ModalHead({
            eyebrow,
            title,
            titleId,
            tabs,
            onTab,
            extras: headExtras,
            showMenuButton,
            onMenu,
            closeLabel: closeLabel || titledCloseLabel,
            onClose: close,
        });

        if (!modalHead.querySelector(`#${titleId}`))
        {
            modalHead.querySelector(`.${CLASS_TABS}`)?.setAttribute('id', titleId);
        }

        return modalHead;
    }

    function focusFirstControl()
    {
        const requestedTarget = typeof initialFocus === 'function'
            ? initialFocus()
            : null;
        const focusTarget = requestedTarget
            || panel.querySelector(SELECTOR.footPrimary)
            || panel.querySelector(SELECTOR.footExit)
            || panel.querySelector(SELECTOR.focusable)
            || panel.querySelector(SELECTOR.headClose);
        focusTarget?.focus?.({ preventScroll: true });
    }

    function armPageLock()
    {
        if (pageLockArmed)
        {
            return;
        }

        pageLockArmed = true;

        if (veil.isConnected)
        {
            unregisterModal?.arm?.();
        }
    }

    function scheduleInitialFocus(deferInert)
    {
        if (
            deferFocus
            && hasAnimationFrames()
        )
        {
            requestAnimationFrame(() =>
            {
                if (veil.isConnected)
                {
                    focusFirstControl();
                }

                requestAnimationFrame(armPageLock);
            });
            setTimeout(armPageLock, FALLBACK_DELAY_MS)?.unref?.();
            return;
        }

        focusFirstControl();

        if (deferInert)
        {
            runAfterTwoFrames(armPageLock);
        }
    }

    const head = buildHead();
    const bodyElement = buildModalBody(body, bodyClassName);
    panel.append(head, bodyElement);

    const foot = buildModalFoot({
        note,
        secondary,
        primary,
        footSize,
    });

    if (foot)
    {
        panel.appendChild(foot);
    }

    veil.appendChild(panel);
    host.appendChild(veil);

    const deferInert = deferLift && hasAnimationFrames();
    unregisterModal = registerModal(name || title || 'modal', panel, {
        dismiss: () => (onDismiss ?? close)(),
        back: true,
        deferInert,
    });
    release = BindModalDismiss({
        veil,
        panel,
        close: () => (onBackdrop ?? close)(),
        opener,
        escape: false,
    });

    scheduleInitialFocus(deferInert);

    return Object.freeze({
        veil,
        panel,
        head,
        body: bodyElement,
        foot,
        close,
    });
}
