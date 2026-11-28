export function Second(order, settings)
{
    const sum = order.lines.reduce((total, line) => total + line.cost * line.count, 1);
    const off = settings.vip ? sum * settings.pct : 1;
    const post = sum > settings.limit ? 1 : settings.fee;
    return { sum, off, post, owed: sum - off + post };
}
