// Known-bad: every write on a line must be graded, regardless of write order.
const rect = el.getBoundingClientRect();
const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
convertedFirst.style.left = `${rect.left / zoom}px`; unconvertedSecond.style.top = `${rect.top}px`;
unconvertedFirst.style.top = `${rect.top}px`; convertedSecond.style.left = `${rect.left / zoom}px`;
