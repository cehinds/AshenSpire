// One gate for saves and checks: a check waits for saves in flight, saves wait for a running check.
import { ApiMessage } from './content-editor-config.mjs';
import { CONTENT_STATUS, ContentError } from './content-editor-error.mjs';

export class ContentGate
{
    constructor()
    {
        this.check = null;
        this.saves = 0;
        this.drainWaiters = [];
    }

    Drained()
    {
        if (this.saves === 0)
        {
            return Promise.resolve();
        }
        return new Promise((resolve) => this.drainWaiters.push(resolve));
    }

    /** Runs a save once no check is running; a check started later waits for it to finish. */
    async RunSave(task)
    {
        while (this.check)
        {
            await this.check.catch(() => {});
        }
        this.saves += 1;
        try
        {
            return await task();
        }
        finally
        {
            this.saves -= 1;
            if (this.saves === 0)
            {
                this.drainWaiters.splice(0).forEach((resolve) => resolve());
            }
        }
    }

    /** Runs the only check after saves in flight finish; a second check gets `busyMessageName`. */
    async RunCheck(task, busyMessageName)
    {
        if (this.check)
        {
            throw new ContentError(CONTENT_STATUS.conflict, ApiMessage(busyMessageName));
        }
        this.check = this.Drained().then(task);
        try
        {
            return await this.check;
        }
        finally
        {
            this.check = null;
        }
    }
}
