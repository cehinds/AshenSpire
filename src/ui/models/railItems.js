export function BuildRailItems(itemIds, selectedId, describeItem)
{
    return Object.freeze(itemIds.map((itemId) =>
    {
        return Object.freeze({
            id: itemId,
            ...describeItem(itemId),
            selected: itemId === selectedId,
        });
    }));
}
