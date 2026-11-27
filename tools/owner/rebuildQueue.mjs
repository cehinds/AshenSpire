// Debounces enemy sheet rebuilds; a save that arrives during a rebuild queues one more.

/** `rebuild(fileName)` runs after `delayMs` of quiet; returns { Notify(fileName) }. */
export function CreateRebuildQueue({ rebuild, delayMs, timers = globalThis })
{
    let timer = null;
    let running = false;
    let pendingFile = null;
    const schedule = (fileName) =>
    {
        timers.clearTimeout(timer);
        timer = timers.setTimeout(() => run(fileName), delayMs);
    };
    const settle = () =>
    {
        running = false;
        if (pendingFile === null)
        {
            return;
        }
        const queued = pendingFile;
        pendingFile = null;
        schedule(queued);
    };
    const run = (fileName) =>
    {
        running = true;
        rebuild(fileName);
        timers.setTimeout(settle, delayMs);
    };
    return {
        Notify(fileName)
        {
            if (running)
            {
                pendingFile = fileName;
                return;
            }
            schedule(fileName);
        },
    };
}
