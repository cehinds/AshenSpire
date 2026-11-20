import { mechanics } from '../../framework/data/mechanics.js';

/** Percentage points shown for one Counter stack. */
export function CounterStackPercent(stackFraction = mechanics.counter.stackFraction)
{
    return Number((stackFraction * 100).toPrecision(15));
}
