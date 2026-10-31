/** Destination rectangle (centred on the origin) for an image drawn like CSS object-fit: contain
 * into a box of boxW x boxH, so PNG export matches the previews instead of stretching. */
export function containRect(boxW, boxH, imgW, imgH) {
  if (!(imgW > 0) || !(imgH > 0)) return {x: -boxW / 2, y: -boxH / 2, width: boxW, height: boxH};
  const scale = Math.min(boxW / imgW, boxH / imgH), width = imgW * scale, height = imgH * scale;
  return {x: -width / 2, y: -height / 2, width, height};
}
