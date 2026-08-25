// Known-bad for issue #11. Each line mixes one converted local-space write
// with one unconverted visual-space write. Both orders must report the latter.
const rect = card.getBoundingClientRect();
const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;

leftMarker.style.left = `${rect.left / zoom}px`; topMarker.style.top = `${rect.top}px`;
rightMarker.style.left = `${rect.right}px`; localMarker.style.top = `${rect.top / zoom}px`;
