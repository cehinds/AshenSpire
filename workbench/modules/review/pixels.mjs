// workbench/modules/review/pixels.mjs — the browser side of the pixel diff: a PNG
// blob decoded to RGBA (the pure diff in model.mjs reads that), and pictures
// encoded back to PNG data: URLs for the grid and the detail view. The Workbench's
// Content-Security-Policy allows data: images but not blob: ones, so pictures are
// data URLs, which need no revoking.

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

/** A blob as a data: URL, which the page can show as an image. */
export function dataUrlOf(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('The image could not be read'));
    reader.readAsDataURL(blob);
  });
}

/** An RGBA picture as a PNG data: URL. */
export function pngDataUrlOf(rgba) {
  const canvas = document.createElement('canvas');
  canvas.width = rgba.width;
  canvas.height = rgba.height;
  canvas.getContext('2d').putImageData(new ImageData(rgba.data, rgba.width, rgba.height), 0, 0);
  return canvas.toDataURL('image/png');
}
