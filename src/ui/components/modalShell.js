// src/ui/components/modalShell.js
// The chrome every modal wears: close control, header, footer order, dismissal.
// It owns the chrome only; each modal's body stays its own.
import { engravedIcon, engravedIconHtml } from './engravedIcon.js';
import { ModalModelFor } from '../models/ModalModel.js';
import { esc as escapeHtml } from './tooltip.js';
import { t as translate } from '../strings.js';
import { planButtonGroup } from '../models/ButtonSizeModel.js';
import { resolveModalRung, resolveFooterSize } from '../models/WireframeChoiceModel.js';
import { activeWireframeChoice } from '../wireframeChoices.js';
import { registerModal } from '../modalState.js';
import { focusableControls } from '../modalManager.js';

/** The shared close icon uses its named asset, with a plain-text fallback. */
export const MODAL_CLOSE_GLYPH = 'close';

/** Button widths come off a four-step ladder; the widest label in a row picks the step. */
export const BUTTON_ROW_SIZES = Object.freeze([
    'short',
    'medium',
    'long',
    'fill',
]);

/** The four modal widths; a body picks the smallest that holds it. */
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

const CLASS_TABS = 'modal-tabs';
const CLASS_TAB = 'modal-tab';
const CLASS_BUTTON_ROW = 'modal-btnrow';

const SELECTOR = Object.freeze({
    topModals: '[aria-modal="true"]',
    tab: '[role="tab"]',
    footActions: '.modal-foot-actions',
    authoredFootRows: '.modal-foot-actions[data-authored-size]',
    authoredPanels: '.modal[data-authored-size]',
    footPrimary: '.modal-foot-actions .primary',
    footExit: `.modal-foot-actions [data-control-role="${CONTROL_ROLE_EXIT}"]`,
    focusable: '[data-focusable="true"]',
    headClose: '.modal-close',
});

const TAB_NAVIGATION_KEYS = Object.freeze([
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
]);

/** `base`, plus the caller's extra class when there is one. */
function withExtraClass(base, extraClass)
{
    return `${base}${extraClass ? ` ${extraClass}` : ''}`;
}

/** A new element that wears `className` before anything else is set on it. */
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
    return typeof document === 'undefined' ? null : document;
}

function topModalPanel()
{
    return [...document.querySelectorAll(SELECTOR.topModals)].at(-1);
}

function assertKnownSize(size, allowedSizes, subject)
{
    if (!allowedSizes.includes(size))
    {
        throw new Error(`Unknown ${subject} '${size}'`);
    }
}

/** The close control: one markup, one accessible name, one tap-floor hit box. */
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
    button.className = withExtraClass('subtle modal-close', className);
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

/** The same close control as an HTML string, for hosts that build chrome as markup. */
export function ModalCloseButtonHtml({
    label = DEFAULT_CLOSE_LABEL,
    className = '',
    id: elementId = '',
} = {})
{
    const idAttribute = elementId ? ` id="${escapeHtml(elementId)}"` : '';
    const closeClass = withExtraClass('subtle modal-close', className && escapeHtml(className));
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

/** The footer note; its text sits in an inner span so the note is whole or absent (ui.css). */
function buildFootNote(note)
{
    const wrapper = createElementWithClass('span', 'modal-foot-note');
    const text = document.createElement('span');
    text.textContent = note;
    wrapper.appendChild(text);
    return wrapper;
}

/** The primary button gets the primary class unless it is an exit, which keeps its role. */
function markFooterPrimary(primary)
{
    // `className`, not `classList`: tests mount this in a minimal DOM.
    const role = primary.dataset?.controlRole ?? primary.getAttribute?.('data-control-role');
    if (role !== CONTROL_ROLE_EXIT && !` ${primary.className} `.includes(' primary '))
    {
        primary.className = `${primary.className} primary`.trim();
    }
}

/**
 * A <footer> in the house order: secondary buttons left, the one primary right.
 * Passing two primaries is not prevented here.
 */
export function ModalFooter({
    note = '',
    secondary = [],
    primary = null,
    className = '',
    size = DEFAULT_ROW_SIZE,
} = {})
{
    assertKnownSize(size, BUTTON_ROW_SIZES, 'footer size');
    // The caller's size is the authored step; the player's Wireframes choice moves it.
    // The authored step stays on the row so an open modal can be re-resolved.
    const step = resolveFooterSize(size, activeWireframeChoice('wireframeModalFooter'), BUTTON_ROW_SIZES);
    const footer = createElementWithClass('footer', withExtraClass('modal-foot', className));
    if (note)
    {
        footer.appendChild(buildFootNote(note));
    }
    // The row wears both classes so the button-size ladder (written for .modal-btnrow) applies.
    const actions = document.createElement('div');
    actions.className = 'modal-foot-actions modal-btnrow';
    actions.dataset.authoredSize = size;
    actions.dataset.size = step;
    const visibleSecondary = secondary.filter(button => button && !button.hidden);
    const visiblePrimary = primary && !primary.hidden ? primary : null;
    actions.dataset.actionCount = String(visibleSecondary.length + (visiblePrimary ? 1 : 0));
    // Footer buttons take equal shares of the foot; a sole action fills it.
    const plan = planButtonGroup({ kind: 'footer', count: Number(actions.dataset.actionCount) });
    actions.dataset.buttonGroup = plan.kind;
    actions.dataset.buttonLayout = plan.layout;
    for (const button of [...visibleSecondary, visiblePrimary])
    {
        if (button?.dataset)
        {
            button.dataset.buttonSize = plan.size;
        }
    }
    // One line on purpose: tools/modal-shell-contract.mjs matches this exact text.
    for (const button of visibleSecondary) actions.appendChild(button);
    if (visiblePrimary)
    {
        markFooterPrimary(primary);
        actions.appendChild(primary);
    }
    footer.appendChild(actions);
    return footer;
}

/** Wraps focus inside the topmost modal on Tab; returns true when the key was a Tab. */
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
    const focusIsAtEdge = event.shiftKey
        ? activeElement === firstControl
        : activeElement === lastControl;
    if (focusIsOutside || focusIsAtEdge)
    {
        event.preventDefault();
        (event.shiftKey ? lastControl : firstControl)?.focus();
        if (!firstControl)
        {
            panel.focus();
        }
    }
    return true;
}

/**
 * Binds Escape, veil click and focus return for a modal; returns release().
 * Escape closes only the topmost modal; a veil click counts only if it is on the veil itself.
 * `escape: false` leaves Escape to the modal manager.
 */
export function BindModalDismiss({
    veil,
    panel,
    close,
    opener = document.activeElement,
    escape = true,
} = {})
{
    // Promote overflowing dialogs once per opening; shrinking back would oscillate.
    const promoteLongPanel = () =>
    {
        if (!panel.isConnected || panel.dataset.height === 'long')
        {
            return;
        }
        const bodies = panel.querySelectorAll('.modal-body, .as-body, .as-pane');
        if ([...bodies].some(body => body.scrollHeight > body.clientHeight + 2))
        {
            panel.dataset.height = 'long';
        }
    };
    const resizeObserver = typeof ResizeObserver === 'function'
        ? new ResizeObserver(promoteLongPanel)
        : null;
    resizeObserver?.observe(panel);
    const mutationObserver = typeof MutationObserver === 'function'
        ? new MutationObserver(promoteLongPanel)
        : null;
    mutationObserver?.observe(panel, { childList: true, subtree: true, characterData: true });
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
    // A scrim click cancels only when the press began on the scrim: a trailing
    // click from the touch that opened the door must not close it.
    let scrimPressed = false;
    const onPointerDown = (event) =>
    {
        scrimPressed = event.target === veil;
    };
    const onClick = (event) =>
    {
        const pressedHere = scrimPressed;
        scrimPressed = false;
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
        if (restoreFocus && opener?.isConnected && typeof opener.focus === 'function')
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
    const buttonRow = createElementWithClass('div', withExtraClass(CLASS_BUTTON_ROW, className));
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

/** The index the arrow, Home or End key moves the tab focus to. */
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
    const direction = pressedKey === 'ArrowRight' ? 1 : -1;
    return (currentIndex + direction + tabCount) % tabCount;
}

/** The tab strip: one button per tab, roving tabindex, arrow-key movement. */
function buildTabStrip(tabList, onTab, head)
{
    const tabStrip = createElementWithClass('div', CLASS_TABS);
    tabStrip.setAttribute('role', 'tablist');
    const selectedTab = tabList.find(tabItem => tabItem.selected) || tabList[0];
    for (const tabItem of tabList)
    {
        const tabId = tabItem.id || tabItem.label;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = CLASS_TAB;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(tabItem === selectedTab));
        button.tabIndex = tabItem === selectedTab ? 0 : -1;
        button.dataset.modalTab = tabId;
        button.dataset.focusable = 'true';
        button.textContent = tabItem.label;
        button.addEventListener('click', () =>
        {
            for (const sibling of tabStrip.querySelectorAll(SELECTOR.tab))
            {
                const selected = sibling === button;
                sibling.setAttribute('aria-selected', String(selected));
                sibling.tabIndex = selected ? 0 : -1;
            }
            onTab?.(tabId);
        });
        tabStrip.appendChild(button);
    }
    tabStrip.addEventListener('keydown', event =>
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
        const targetTab = tabButtons[nextTabIndex(event.key, currentIndex, tabButtons.length)];
        targetTab.focus();
        targetTab.click();
        // Hosts may rebuild the header when activating a tab.
        const searchRoot = head.isConnected ? head : document;
        const targetId = targetTab.dataset.modalTab;
        const replacement = [...searchRoot.querySelectorAll(`.${CLASS_TAB}`)]
            .find(candidate => candidate.dataset.modalTab === targetId && candidate.isConnected);
        replacement?.focus({ preventScroll: true });
    });
    return tabStrip;
}

/** The eyebrow and title pair that names a modal with no tabs. */
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

/**
 * A <header class="modal-head">: identity left, actions right.
 * Identity is either an eyebrow + title pair or a tab strip; `tabs` replaces the pair.
 * The close control is always present.
 */
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
    const tabList = Array.isArray(tabs) ? tabs.filter(Boolean) : [];
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
    // The menu button follows the tab strip: a tabbed door is a place and wants
    // the quick menu; a door that asks a question must not offer a way to leave.
    // `showMenuButton` overrides in either direction.
    const wantsMenu = showMenuButton == null ? tabList.length > 0 : !!showMenuButton;
    if (wantsMenu)
    {
        actions.appendChild(buildMenuButton({ menuLabel, onMenu }));
    }
    const close = ModalCloseButton({ label: closeLabel, onClick: onClose });
    close.dataset.size = 'square';
    close.dataset.focusable = 'true';
    actions.appendChild(close);
    head.appendChild(actions);
    return head;
}

/**
 * The one place a modal's width rung is written.
 * `data-authored-size` is what the surface asked for; `data-size` is that rung after
 * the player's Wireframes choice, and is what kit.css reads.
 */
export function StampModalSize(panel, size)
{
    assertKnownSize(size, MODAL_SIZES, 'modal size');
    const widthChoice = activeWireframeChoice(WIREFRAME_MODAL_WIDTH);
    panel.dataset.authoredSize = size;
    panel.dataset.size = resolveModalRung(size, widthChoice, MODAL_SIZES);
    return panel;
}

/** Run `callback` once, two animation frames from now, or after 250 ms if frames are paused. */
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

/**
 * Re-resolve the Wireframes choices on every open modal and footer; returns the count.
 * Idempotent: it re-resolves from the authored values, so it never compounds.
 */
export function RestampModalWireframes(targetDocument = currentDocument())
{
    if (!targetDocument)
    {
        return 0;
    }
    const rootElement = targetDocument.documentElement;
    const widthChoice = activeWireframeChoice(WIREFRAME_MODAL_WIDTH, rootElement);
    const footerChoice = activeWireframeChoice('wireframeModalFooter', rootElement);
    let restampedCount = 0;
    for (const panel of targetDocument.querySelectorAll(SELECTOR.authoredPanels))
    {
        const authoredSize = panel.dataset.authoredSize;
        panel.dataset.size = resolveModalRung(authoredSize, widthChoice, MODAL_SIZES);
        restampedCount += 1;
    }
    for (const footRow of targetDocument.querySelectorAll(SELECTOR.authoredFootRows))
    {
        const authoredSize = footRow.dataset.authoredSize;
        footRow.dataset.size = resolveFooterSize(authoredSize, footerChoice, BUTTON_ROW_SIZES);
        restampedCount += 1;
    }
    return restampedCount;
}

/**
 * OpenModal(spec) -> { veil, panel, head, body, foot, close }
 * The one door-opener: the caller supplies content and intent; head, footer order and
 * dismissal come from here. `body` is an element, or a function that receives the body element.
 */
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
    // Focus waits for the next frame; `initialFocus()` may name the element to land on.
    deferFocus = false,
    deferLift = false,
    initialFocus = null,
    // The modal.json kind whose layout settings the panel takes.
    kind = DEFAULT_MODAL_KIND,
} = {})
{
    // A caller may name the heading; otherwise the id is minted so aria-labelledby resolves.
    const titleId = givenTitleId || `modal-title-${Math.random().toString(36).slice(2, 8)}`;
    const veil = createElementWithClass('div', 'modal-veil');

    const panel = document.createElement('section');
    panel.className = withExtraClass('modal', className);
    StampModalSize(panel, size);
    ModalModelFor(kind).apply(panel);
    panel.dataset.wireframe = role === ROLE_ALERT_DIALOG ? 'W2' : 'W1';
    panel.setAttribute('role', role);
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', titleId);
    panel.tabIndex = -1;

    let release = null;
    let unregisterModal = null;
    // close({ liftNow: true }) lifts the page lock and returns focus synchronously,
    // for a caller that acts the moment the door closes.
    const close = (closeOptions) =>
    {
        // Every close path comes through here. Capture and clear the handles first
        // so an onClose callback cannot run cleanup twice.
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
        if (deferLift && closeOptions?.liftNow !== true && hasAnimationFrames())
        {
            // Lifting inert restyles the whole app, so lift, focus restore and
            // registry release wait for a later frame.
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

    const titledCloseLabel = title ? `${DEFAULT_CLOSE_LABEL} ${title}` : DEFAULT_CLOSE_LABEL;
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
    // A tab strip has no <h2>, so the strip itself names the dialog.
    if (!head.querySelector(`#${titleId}`))
    {
        head.querySelector(`.${CLASS_TABS}`)?.setAttribute('id', titleId);
    }

    const bodyElement = createElementWithClass('div', withExtraClass('modal-body', bodyClassName));
    if (typeof body === 'function')
    {
        body(bodyElement);
    }
    else if (body)
    {
        bodyElement.appendChild(body);
    }

    panel.append(head, bodyElement);

    const secondaryList = Array.isArray(secondary) ? secondary : [secondary];
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
    // The modal manager owns Escape for this door; close() is idempotent.
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

    // Focus the way forward when there is one, else the way out. A footer exit
    // outranks the head's small close.
    const focusFirst = () =>
    {
        const target = (typeof initialFocus === 'function' ? initialFocus() : null)
            || panel.querySelector(SELECTOR.footPrimary)
            || panel.querySelector(SELECTOR.footExit)
            || panel.querySelector(SELECTOR.focusable)
            || panel.querySelector(SELECTOR.headClose);
        target?.focus?.({ preventScroll: true });
    };
    // The page lock is armed a frame after mount whenever the door defers it (deferLift).
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
        // Focus a frame after mount, and the page lock a frame later still.
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
