// Original authored layer geometry is the input on every resize: no previous
// transform feeds back into the next pass. Units are SVG canvas coordinates.
export function mobileFloorLayer(layer, { paintStart, maximumPaintTop, minimumBottom = -Infinity }) {
  if (!(paintStart > 0 && paintStart < 1) || !Number.isFinite(maximumPaintTop)) return { ...layer };
  const previousPaintTop = layer.y + layer.height * paintStart;
  const previousBottom = layer.y + layer.height;
  if (previousPaintTop <= maximumPaintTop && previousBottom >= minimumBottom) return { ...layer };
  const bottom = Math.max(previousBottom, minimumBottom);
  const paintTop = Math.min(previousPaintTop, maximumPaintTop);
  const height = (bottom - paintTop) / (1 - paintStart);
  const scale = height / layer.height;
  const width = layer.width * scale;
  return { ...layer, x: layer.x + (layer.width - width) / 2, y: bottom - height, width, height };
}
