// One check at a time: while it runs, saves and a second check are refused.
import { ApiMessage } from './content-editor-config.mjs';
import { CONTENT_STATUS, ContentError } from './content-editor-error.mjs';

export class CheckGate
{
    constructor()
    {
        this.running = false;
    }

    /** Throws a 409 with the configured `messageName` while a check runs. */
    RefuseWhileRunning(messageName)
    {
        if (this.running)
        {
            throw new ContentError(CONTENT_STATUS.conflict, ApiMessage(messageName));
        }
    }

    /** Runs `task` as the only check, refusing with `busyMessageName` if one is already running. */
    async Run(task, busyMessageName)
    {
        this.RefuseWhileRunning(busyMessageName);
        this.running = true;
        try
        {
            return await task();
        }
        finally
        {
            this.running = false;
        }
    }
}
