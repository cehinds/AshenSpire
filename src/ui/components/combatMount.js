/** Checks whether this combat still owns its reused app root. */
export function IsCurrentCombatMount(app, combatEl)
{
    return combatEl.isConnected && app.querySelector('.combat') === combatEl;
}

function touchesVeil(record)
{
    return [...record.addedNodes, ...record.removedNodes].some(node =>
        node.nodeType === 1
        && (node.classList.contains('modal-veil') || !!node.querySelector?.('.modal-veil'))
    );
}

/** Watches the body for veil changes and releases the exact combat mount once. */
export function ObserveCombatMount(
    app,
    combatEl,
    { onVeilChange, onDetach, Observer = globalThis.MutationObserver },
)
{
    const body = combatEl.ownerDocument?.body;
    if (!body || typeof Observer !== 'function')
    {
        return;
    }
    let detached = false;
    const observer = new Observer(records =>
    {
        if (detached)
        {
            return;
        }
        if (!IsCurrentCombatMount(app, combatEl))
        {
            detached = true;
            try
            {
                onDetach();
            }
            finally
            {
                observer.disconnect();
                delete combatEl.dataset.handPagerOwner;
            }
            return;
        }
        if (records.some(touchesVeil))
        {
            onVeilChange();
        }
    });
    combatEl.dataset.handPagerOwner = 'active';
    observer.observe(body, { childList: true, subtree: true });
}
