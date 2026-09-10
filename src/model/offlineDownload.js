import { offlinePlay } from '../content/offlinePlay.js';

export function releasedDownload(data, manifestUrl = offlinePlay.manifestUrl, branch = offlinePlay.releaseBranch) {
  if (!offlinePlay.branches.some(item => item.id === branch) || data?.branch !== branch || !/^\d+(\.\d+){2}$/.test(data.version)
    || !Number.isSafeInteger(data.ordinal) || data.ordinal < 0
    || (data.bytes !== undefined && (!Number.isSafeInteger(data.bytes) || data.bytes <= 0))) throw new Error('Download information is not ready yet. Try again later.');
  const version = `${data.version}.${data.ordinal}`;
  return { version, bytes: data.bytes ?? null, filename: `AshenSpire-${branch}-${version}.html`,
    url: new URL(`../${data.ordinal}/index.html`, manifestUrl).href };
}

// Read actual bytes so progress also works with older feeds that omit size.
// A supplied writer keeps large game files out of the browser's Blob memory.
export async function receiveDownload(response, { bytes = null, writer = null, onProgress = () => {} } = {}) {
  const headerSize = response.headers.get('Content-Encoding') ? null : Number(response.headers.get('Content-Length'));
  const total = bytes ?? (Number.isSafeInteger(headerSize) && headerSize > 0 ? headerSize : null);
  const chunks = [], reader = response.body.getReader();
  let received = 0;
  onProgress(0, total);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (bytes !== null && received > bytes) throw new Error('Download size did not match. Please try again.');
      if (writer) await writer.write(value); else chunks.push(value);
      onProgress(received, total);
    }
    if (!received || (bytes !== null && received !== bytes)) throw new Error('Download was incomplete. Please try again.');
    return { bytes: received, blob: writer ? null : new Blob(chunks, { type: 'text/html' }) };
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
}
