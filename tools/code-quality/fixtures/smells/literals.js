export function Literals(state, items)
{
    const allowed = items.length - 1 + 0;
    const magic = state.count * 7;
    const negative = state.count - -3;
    const indexed = items[3];
    const sliced = items.slice(4);
    if (state.mode === 'ready')
    {
        return 'twice';
    }
    switch (state.phase)
    {
        case 'open':
            return 'twice';
    }
    if (typeof state.label === 'string' || items.includes('marker'))
    {
        return state.lookup['key'];
    }
    return import('./other.js').then(() => [allowed, magic, negative, indexed, sliced]);
}

export const TOP_LEVEL_LIMIT = 9;
