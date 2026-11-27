// Runs tasks for the same file one after another, so a read, compare and write cannot interleave.
const tails = new Map();

/** Runs `task` after every earlier task for `key` has settled; resolves with its result. */
export function WithPathLock(key, task)
{
    const previous = tails.get(key) ?? Promise.resolve();
    const run = previous.then(task, task);
    const tail = run.catch(() => {});
    tails.set(key, tail);
    tail.then(() =>
    {
        if (tails.get(key) === tail)
        {
            tails.delete(key);
        }
    });
    return run;
}
