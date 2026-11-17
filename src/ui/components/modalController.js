import { registerModal } from '../modalState.js';
import {
    BindVeilDismiss,
    WatchLongPanel,
} from './modalShell.js';

export const NO_SCROLL = Object.freeze({ preventScroll: true });

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
        this.unbindVeilDismiss = null;
    }

    Open()
    {
        this.unregisterModal = registerModal(this.name, this.panel, {
            dismiss: () => this.BackOut(),
            back: this.back,
        });
        this.unbindVeilDismiss = BindVeilDismiss(
            this.veil,
            () => this.BackOut(),
        );

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
        this.unbindVeilDismiss?.();
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
}
