// workbench/modules/review/pixels.mjs — the browser side of the pixel diff: a PNG
// blob decoded to RGBA (the pure diff in model.mjs reads that), and an RGBA picture
// encoded back to a PNG object URL for the grid and the detail view.

/** A PNG (or any image) blob as { width, height, data } with four bytes a pixel. */
export async function rgbaOf(blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx2d = canvas.getContext('2d', { willReadFrequently: true });
    ctx2d.drawImage(bitmap, 0, 0);
    const { data } = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
    return { width: canvas.width, height: canvas.height, data };
  } finally {
    bitmap.close?.();
  }
}

/** An RGBA picture as a PNG object URL; the caller revokes it when it is no longer shown. */
export async function pngUrlOf(rgba) {
  const canvas = document.createElement('canvas');
  canvas.width = rgba.width;
  canvas.height = rgba.height;
  canvas.getContext('2d').putImageData(new ImageData(rgba.data, rgba.width, rgba.height), 0, 0);
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The picture could not be encoded'))), 'image/png'));
  return URL.createObjectURL(blob);
}
