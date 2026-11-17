// The chrome every modal wears: close control, header, footer order, dismissal.
import { engravedIcon, engravedIconHtml } from './engravedIcon.js';
import { ModalModelFor } from '../models/ModalModel.js';
import { esc as escapeHtml } from './tooltip.js';
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

const DEFAULT_CLOSE_LABEL = 'Close';
const DEFAULT_ROW_SIZE = 'medium';
const DEFAULT_MODAL_SIZE = 'md';
const DEFAULT_MODAL_ROLE = 'dialog';
const DEFAULT_MODAL_KIND = 'base';
const ROLE_ALERT_DIALOG = 'alertdialog';
const FALLBACK_DELAY_MS = 250;
const CONTROL_ROLE_EXIT = 'exit';
const WIREFRAME_MODAL_WIDTH = 'wireframeModalWidth';
const WIREFRAME_MODAL_FOOTER = 'wireframeModalFooter';
const LONG_HEIGHT = 'long';
const SCROLL_SLACK_PX = 2;

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

const TAB_NAVIGATION_KEYS = Object.freeze([
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
]);

function withExtraClass(base, extraClass)
{
    const suffix = extraClass
        ? ` ${extraClass}`
        : '';
    return `${base}${suffix}`;
}

function mintTitleId()
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

function currentDocument()
{
    return typeof document === 'undefined'
        ? null
        : document;
}

function topModalPanel()
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

    button.className = withExtraClass(
        CLASS_CLOSE,
        className,
    );
    button.dataset.controlRole = CONTROL_ROLE_EXIT;
    // An automatic focus hint would consume Escape before the modal can close.
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
    const closeClass = withExtraClass(
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

function buildFootNote(note)
{
    const wrapper = createElementWithClass('span', 'modal-foot-note');
    const text = document.createElement('span');
    text.textContent = note;
    wrapper.appendChild(text);
    return wrapper;
}

function markFooterPrimary(primary)
{
    // `className`, not `classList`: tests mount this in a minimal DOM.
    const role = primary.dataset?.controlRole
        ?? primary.getAttribute?.('data-control-role');
    const hasPrimaryClass = ` ${primary.className} `.includes(' primary ');

    if (role !== CONTROL_ROLE_EXIT && !hasPrimaryClass)
    {
        primary.className = `${primary.className} primary`.trim();
    }
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
    const footerClass = withExtraClass('modal-foot', className);
    const footer = createElementWithClass('footer', footerClass);

    if (note)
    {
        footer.appendChild(buildFootNote(note));
    }

    const actions = document.createElement('div');
    actions.className = 'modal-foot-actions modal-btnrow';
    actions.dataset.authoredSize = size;
    actions.dataset.size = step;

    const visibleSecondary = secondary.filter(
        (button) => button && !button.hidden,
    );
    const visiblePrimary = primary && !primary.hidden
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

    footer.appendChild(actions);
    return footer;
}

function trapTabFocus(event, panel)
{
    if (event.key !== 'Tab')
    {
        return false;
    }

    if (topModalPanel() !== panel)
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

    if (focusIsOutside || focusIsAtEdge)
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

export function BindModalDismiss({
    veil,
    panel,
    close,
    opener = document.activeElement,
    escape = true,
} = {})
{
    // Promote once per opening; shrinking back would oscillate.
    const promoteLongPanel = () =>
    {
        if (!panel.isConnected || panel.dataset.height === LONG_HEIGHT)
        {
            return;
        }

        const bodies = [...panel.querySelectorAll(OVERFLOW_BODIES)];
        const overflows = bodies.some(
            (body) => body.scrollHeight > body.clientHeight + SCROLL_SLACK_PX,
        );

        if (overflows)
        {
            panel.dataset.height = LONG_HEIGHT;
        }
    };

    const resizeObserver = typeof ResizeObserver === 'function'
        ? new ResizeObserver(promoteLongPanel)
        : null;
    resizeObserver?.observe(panel);

    const mutationObserver = typeof MutationObserver === 'function'
        ? new MutationObserver(promoteLongPanel)
        : null;
    mutationObserver?.observe(panel, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    const onKeydown = (event) =>
    {
        if (event.defaultPrevented)
        {
            return;
        }

        if (trapTabFocus(event, panel))
        {
            return;
        }

        if (!escape || event.key !== 'Escape' || event.repeat)
        {
            return;
        }

        if (topModalPanel() !== panel)
        {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        close();
    };

    // A click closes only if the press began on the veil: touch trailing clicks must not.
    let veilPressed = false;

    const onPointerDown = (event) =>
    {
        veilPressed = event.target === veil;
    };

    const onClick = (event) =>
    {
        const pressedHere = veilPressed;
        veilPressed = false;

        if (event.target === veil && pressedHere)
        {
            close();
        }
    };

    document.addEventListener('keydown', onKeydown, true);
    veil.addEventListener('pointerdown', onPointerDown);
    veil.addEventListener('click', onClick);

    return function release({ restoreFocus = true } = {})
    {
        resizeObserver?.disconnect();
        mutationObserver?.disconnect();
        document.removeEventListener('keydown', onKeydown, true);
        veil.removeEventListener('pointerdown', onPointerDown);
        veil.removeEventListener('click', onClick);

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

    const rowClass = withExtraClass(CLASS_BUTTON_ROW, className);
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

function nextTabIndex(pressedKey, currentIndex, tabCount)
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

function buildTabStrip(tabList, onTab, head)
{
    const tabStrip = createElementWithClass('div', CLASS_TABS);
    tabStrip.setAttribute('role', 'tablist');

    const selectedTab = tabList.find((tabItem) => tabItem.selected)
        || tabList[0];

    for (const tabItem of tabList)
    {
        const tabId = tabItem.id || tabItem.label;
        const isSelected = tabItem === selectedTab;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = CLASS_TAB;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(isSelected));
        button.tabIndex = isSelected
            ? 0
            : -1;
        button.dataset.modalTab = tabId;
        button.dataset.focusable = 'true';
        button.textContent = tabItem.label;

        button.addEventListener('click', () =>
        {
            for (const sibling of tabStrip.querySelectorAll(SELECTOR.tab))
            {
                const selected = sibling === button;
                sibling.setAttribute('aria-selected', String(selected));
                sibling.tabIndex = selected
                    ? 0
                    : -1;
            }

            onTab?.(tabId);
        });

        tabStrip.appendChild(button);
    }

    tabStrip.addEventListener('keydown', (event) =>
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

        const targetIndex = nextTabIndex(
            event.key,
            currentIndex,
            tabButtons.length,
        );
        const targetTab = tabButtons[targetIndex];
        targetTab.focus();
        targetTab.click();

        const searchRoot = head.isConnected
            ? head
            : document;
        const targetId = targetTab.dataset.modalTab;
        const candidates = [...searchRoot.querySelectorAll(`.${CLASS_TAB}`)];
        const replacement = candidates.find(
            (candidate) =>
                candidate.dataset.modalTab === targetId
                && candidate.isConnected,
        );
        replacement?.focus({ preventScroll: true });
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

    if (!tabList.length && !title)
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

    const actions = createElementWithClass('div', 'modal-head-actions');

    if (extras)
    {
        actions.appendChild(extras);
    }

    // A tabbed door wants the menu, a question must not offer a way out; the flag overrides.
    const wantsMenu = showMenuButton == null
        ? tabList.length > 0
        : Boolean(showMenuButton);

    if (wantsMenu)
    {
        actions.appendChild(buildMenuButton({ menuLabel, onMenu }));
    }

    const close = ModalCloseButton({
        label: closeLabel,
        onClick: onClose,
    });
    close.dataset.size = 'square';
    close.dataset.focusable = 'true';
    actions.appendChild(close);
    head.appendChild(actions);
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

function afterFrames(callback)
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

export function RestampModalWireframes(targetDocument = currentDocument())
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
    const titleId = givenTitleId || mintTitleId();
    const veil = createElementWithClass('div', 'modal-veil');

    const panel = document.createElement('section');
    panel.className = withExtraClass('modal', className);
    StampModalSize(panel, size);
    ModalModelFor(kind).apply(panel);
    panel.dataset.wireframe = role === ROLE_ALERT_DIALOG
        ? 'W2'
        : 'W1';
    panel.setAttribute('role', role);
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', titleId);
    panel.tabIndex = -1;

    let release = null;
    let unregisterModal = null;

    const close = (closeOptions) =>
    {
        if (!veil.isConnected)
        {
            unregisterModal?.();
            unregisterModal = null;
            return;
        }

        const releaseDismiss = release;
        const unregister = unregisterModal;
        release = null;
        unregisterModal = null;

        const deferTheLift = deferLift
            && closeOptions?.liftNow !== true
            && hasAnimationFrames();

        if (deferTheLift)
        {
            veil.remove();
            onClose?.();
            afterFrames(() =>
            {
                unregister?.unlock?.();
                releaseDismiss?.();
                unregister?.();
            });
            return;
        }

        // Lift the page lock before focus returns: an inert element cannot take focus.
        unregister?.unlock?.();
        releaseDismiss?.();
        veil.remove();
        onClose?.();
        unregister?.();
    };

    const titledCloseLabel = title
        ? `${DEFAULT_CLOSE_LABEL} ${title}`
        : DEFAULT_CLOSE_LABEL;
    const head = ModalHead({
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

    if (!head.querySelector(`#${titleId}`))
    {
        head.querySelector(`.${CLASS_TABS}`)?.setAttribute('id', titleId);
    }

    const bodyClass = withExtraClass('modal-body', bodyClassName);
    const bodyElement = createElementWithClass('div', bodyClass);

    if (typeof body === 'function')
    {
        body(bodyElement);
    }
    else if (body)
    {
        bodyElement.appendChild(body);
    }

    panel.append(head, bodyElement);

    const secondaryList = Array.isArray(secondary)
        ? secondary
        : [secondary];
    const secondaryButtons = secondaryList.filter(Boolean);
    let foot = null;

    if (note || secondaryButtons.length || primary)
    {
        foot = ModalFooter({
            note,
            secondary: secondaryButtons,
            primary,
            size: footSize,
        });
        foot.querySelector(SELECTOR.footActions)?.classList.add(CLASS_BUTTON_ROW);
        panel.appendChild(foot);
    }

    veil.appendChild(panel);
    host.appendChild(veil);

    const deferInert = deferLift && hasAnimationFrames();
    unregisterModal = registerModal(name || title || 'modal', panel, {
        dismiss: () => close(),
        back: true,
        deferInert,
    });
    release = BindModalDismiss({
        veil,
        panel,
        close,
        opener,
        escape: false,
    });

    // A footer exit outranks the head's small close.
    const focusFirst = () =>
    {
        const requested = typeof initialFocus === 'function'
            ? initialFocus()
            : null;
        const target = requested
            || panel.querySelector(SELECTOR.footPrimary)
            || panel.querySelector(SELECTOR.footExit)
            || panel.querySelector(SELECTOR.focusable)
            || panel.querySelector(SELECTOR.headClose);
        target?.focus?.({ preventScroll: true });
    };

    let pageLockArmed = false;

    const armPageLock = () =>
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
    };

    if (deferFocus && hasAnimationFrames())
    {
        requestAnimationFrame(() =>
        {
            if (veil.isConnected)
            {
                focusFirst();
            }

            requestAnimationFrame(armPageLock);
        });
        setTimeout(armPageLock, FALLBACK_DELAY_MS)?.unref?.();
    }
    else
    {
        focusFirst();

        if (deferInert)
        {
            afterFrames(armPageLock);
        }
    }

    return Object.freeze({
        veil,
        panel,
        head,
        body: bodyElement,
        foot,
        close,
    });
}
