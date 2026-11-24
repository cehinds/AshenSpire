// @ts-check
// An enemy's intent row is one line with room for five actions (playtest 2026-11-17). It is centred over the HP bar, so
// a long row over a fighter at the screen's edge would run off it: the row slides along its own line, just enough to stay
// inside the combat screen, and slides back when it fits again. Every box is read before any is written.

const EDGE_MARGIN_PX = 4;
const NUDGE_VARIABLE = '--intent-nudge';

function RowBounds(intent)
{
    const parts = [...intent.querySelectorAll('.intent-actions > *, .intent-followups > *')]
        .map((part) => part.getBoundingClientRect())
        .filter((rect) => rect.width > 0);
    if (!parts.length)
    {
        return null;
    }
    return {
        left: Math.min(...parts.map((rect) => rect.left)),
        right: Math.max(...parts.map((rect) => rect.right)),
    };
}

/**
 * The nudge, in screen px, that brings a row spanning [left, right] inside [minimum, maximum]; 0 when it fits.
 * A row wider than the space keeps its left edge inside.
 */
export function IntentRowNudge({ left, right }, { minimum, maximum })
{
    if (left < minimum)
    {
        return minimum - left;
    }
    if (right > maximum)
    {
        return Math.max(maximum - right, minimum - left);
    }
    return 0;
}

/** @param {HTMLElement | null} screen */
export function KeepIntentRowsInside(screen)
{
    if (!screen)
    {
        return;
    }
    // The nudge is read only by the target-HUD row (combat-mini-hud.css): elsewhere a written nudge moves nothing, and
    // reading the unmoved row back as moved would grow it every render. Without that HUD no row keeps a nudge.
    if (screen.dataset?.targetHud !== 'true')
    {
        for (const intent of screen.querySelectorAll('.combatant.enemy .intent'))
        {
            /** @type {HTMLElement} */ (intent).style.removeProperty(NUDGE_VARIABLE);
        }
        return;
    }
    const limits = screen.getBoundingClientRect();
    const space = { minimum: limits.left + EDGE_MARGIN_PX, maximum: limits.right - EDGE_MARGIN_PX };
    const writes = [];
    for (const intent of screen.querySelectorAll('.combatant.enemy .intent'))
    {
        const element = /** @type {HTMLElement} */ (intent);
        const row = RowBounds(element);
        const current = parseFloat(element.style.getPropertyValue(NUDGE_VARIABLE)) || 0;
        const scale = element.offsetWidth > 0 ? element.getBoundingClientRect().width / element.offsetWidth : 1;
        const unmoved = row && { left: row.left - current * scale, right: row.right - current * scale };
        const next = unmoved ? Math.round(IntentRowNudge(unmoved, space) / (scale || 1)) : 0;
        if (next !== current)
        {
            writes.push([element, next]);
        }
    }
    for (const [element, next] of writes)
    {
        if (next)
        {
            element.style.setProperty(NUDGE_VARIABLE, `${next}px`);
        }
        else
        {
            element.style.removeProperty(NUDGE_VARIABLE);
        }
    }
}
