export function First(record, options)
{
    const total = record.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = options.member ? total * options.rate : 0;
    const shipping = total > options.freeAbove ? 0 : options.shippingCost;
    return { total, discount, shipping, due: total - discount + shipping };
}
