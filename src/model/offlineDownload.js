import { offlinePlay } from '../content/offlinePlay.js';
import { createSha256 } from '../ui/sha256.js';

// THE FILE A BUILD'S DOWNLOAD SAVES. An older (inline) build is its own page,
// `../<ordinal>/index.html`, sized by `bytes`. A pack-shaped build (Pages, step
// 6b of docs/EXTERNAL-ASSETS-PLAN.md) names its light single file in
// `download` ({ path: 'download/AshenSpire.html', bytes, sha256 }); its page is
// a 9.5 MB HTML whose art lives on the site, and its top-level `bytes` is null
// so a copy from before step 6b refuses it rather than saving a game with no
// art. A `download` whose path is not a plain relative file is refused.
const DOWNLOAD_PATH = /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.html$/;
const size = value => Number.isSafeInteger(value) && value > 0;

export function releasedDownload(data, manifestUrl = offlinePlay.manifestUrl, branch = offlinePlay.releaseBranch) {
  const file = data?.download;
  if (!offlinePlay.branches.some(item => item.id === branch) || data?.branch !== branch || !/^\d+(\.\d+){2}$/.test(data.version)
    || !Number.isSafeInteger(data.ordinal) || data.ordinal < 0
    || (file != null && (typeof file.path !== 'string' || !DOWNLOAD_PATH.test(file.path) || file.path.split('/').includes('..') || !size(file.bytes)
      || (file.sha256 !== undefined && !/^[0-9a-f]{64}$/.test(String(file.sha256)))))
    || (file == null && data.bytes !== undefined && !size(data.bytes))) throw new Error('Download information is not ready yet. Try again later.');
  const version = `${data.version}.${data.ordinal}`;
  return { version, bytes: file ? file.bytes : data.bytes ?? null, sha256: file?.sha256 ?? null, filename: `AshenSpire-${branch}-${version}.html`,
    url: new URL(`../${data.ordinal}/${file ? file.path : 'index.html'}`, manifestUrl).href };
}

// Read actual bytes so progress also works with older feeds that omit size.
// A supplied writer keeps large game files out of the browser's Blob memory.
// With `sha256` (a pack build's download names it), every byte is hashed as it
// streams and a file that does not match is refused like a short one.
export async function receiveDownload(response, { bytes = null, sha256 = null, writer = null, onProgress = () => {} } = {}) {
  const hash = sha256 ? createSha256() : null;
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
      hash?.update(value);
      if (bytes !== null && received > bytes) throw new Error('Download size did not match. Please try again.');
      if (writer) await writer.write(value); else chunks.push(value);
      onProgress(received, total);
    }
    if (!received || (bytes !== null && received !== bytes)) throw new Error('Download was incomplete. Please try again.');
    if (hash && hash.digest() !== sha256) throw new Error('Download did not match the published file. Please try again.');
    return { bytes: received, blob: writer ? null : new Blob(chunks, { type: 'text/html' }) };
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
}
