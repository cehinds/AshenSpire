import { registerModal } from '../modalState.js';
import { WatchLongPanel } from './modalShell.js';

const NO_SCROLL = Object.freeze({ preventScroll: true });

function isFocusableElement(candidate)
{
    return typeof HTMLElement !== 'undefined'
        && candidate instanceof HTMLElement;
}

export function ReadReturnFocus(returnFocusElement)
{
    if (isFocusableElement(returnFocusElement))
    {
        return returnFocusElement;
    }

    const activeElement = document.activeElement;
    return isFocusableElement(activeElement)
        ? activeElement
        : null;
}

export class ModalController
{
    constructor({
        name,
        veil,
        panel,
        returnFocus = null,
        onBack = null,
        onClosing = null,
        back = true,
        growsWhenLong = false,
    })
    {
        this.name = name;
        this.veil = veil;
        this.panel = panel;
        this.returnFocus = returnFocus;
        this.onBack = onBack;
        this.onClosing = onClosing;
        this.back = back;
        this.growsWhenLong = growsWhenLong;
        this.closed = false;
        this.unregisterModal = null;
        this.stopWatchingHeight = null;
        this.pressBeganOnVeil = false;
        this.rememberVeilPress = (event) => this.recordVeilPress(event);
        this.backOutOnVeilClick = (event) => this.answerVeilClick(event);
    }

    Open()
    {
        this.unregisterModal = registerModal(this.name, this.panel, {
            dismiss: () => this.BackOut(),
            back: this.back,
        });
        this.veil.addEventListener('pointerdown', this.rememberVeilPress);
        this.veil.addEventListener('click', this.backOutOnVeilClick);

        if (this.growsWhenLong)
        {
            this.stopWatchingHeight = WatchLongPanel(this.panel);
        }

        return this;
    }

    Close(closeOptions = {})
    {
        if (this.closed)
        {
            return;
        }

        this.closed = true;
        this.onClosing?.(closeOptions);
        this.unregisterModal?.unlock?.();
        this.stopWatchingHeight?.();
        this.veil.removeEventListener('pointerdown', this.rememberVeilPress);
        this.veil.removeEventListener('click', this.backOutOnVeilClick);
        this.veil.remove();
        this.restoreFocus(closeOptions);
        this.unregisterModal?.();
    }

    BackOut()
    {
        if (this.closed)
        {
            return;
        }

        this.Close();
        this.onBack?.();
    }

    IsClosed()
    {
        return this.closed;
    }

    restoreFocus({ restoreFocus = true } = {})
    {
        if (
            restoreFocus
            && this.returnFocus?.isConnected
        )
        {
            this.returnFocus.focus(NO_SCROLL);
        }
    }

    recordVeilPress(event)
    {
        this.pressBeganOnVeil = event.target === this.veil;
    }

    answerVeilClick(event)
    {
        const pressStartedOnVeil = this.pressBeganOnVeil;
        this.pressBeganOnVeil = false;

        if (
            event.target === this.veil
            && pressStartedOnVeil
        )
        {
            this.BackOut();
        }
    }
}
