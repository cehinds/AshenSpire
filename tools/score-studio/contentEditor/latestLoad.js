// Shows only the newest load: a load that finishes after a later one started is dropped, not drawn.
export class LatestLoad
{
    constructor()
    {
        this.generation = 0;
    }

    /** Awaits `load()`, then `show(result)` unless a later Run began; returns whether it showed. */
    async Run(load, show)
    {
        this.generation += 1;
        const ticket = this.generation;
        const result = await load();
        if (ticket !== this.generation)
        {
            return false;
        }
        show(result);
        return true;
    }
}
