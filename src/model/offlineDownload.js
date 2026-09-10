import { offlinePlay } from '../content/offlinePlay.js';

export function releasedDownload(data, manifestUrl = offlinePlay.manifestUrl) {
  if (data?.branch !== offlinePlay.releaseBranch || !/^\d+(\.\d+){2}$/.test(data.version)
    || !Number.isSafeInteger(data.ordinal) || data.ordinal < 0
    || !Number.isSafeInteger(data.bytes) || data.bytes <= 0) throw new Error('Download information is not ready yet. Try again later.');
  const version = `${data.version}.${data.ordinal}`;
  return { version, bytes: data.bytes, filename: `AshenSpire-${version}.html`,
    url: new URL(`../${data.ordinal}/index.html`, manifestUrl).href };
}
