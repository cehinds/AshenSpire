import { offlinePlay } from '../content/offlinePlay.js';
import { createSha256, sha256Hex } from '../ui/sha256.js';
import { createZipWriter } from './zipStream.js';

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

// THE FOLDER COPY: A ZIP THE GAME ASSEMBLES ITSELF (docs/EXTERNAL-ASSETS-PLAN.md
// §5 B, step 7). Beside the light single file above, a pack-shaped build can
// also be saved as its own folder: the build's HTML, its light and common
// pack indexes (with their .js twins and the font sidecar, which a
// double-clicked page reads, step 4) and every object those indexes list,
// zipped as
//
//   AshenSpire-<branch>-<version>/AshenSpire-<branch>-<version>.html
//   AshenSpire-<branch>-<version>/asset-base.json      {"base":"./"}
//   AshenSpire-<branch>-<version>/packs/…
//   AshenSpire-<branch>-<version>/objects/<xx>/<sha256>.<ext>
//
// The HTML keeps the name a download has, so src/ui/buildChannel.js reads the
// same channel from it. High is never packed: a build whose default is high
// shows the packed light art through the loader's tier fallback (§3.5). The
// score is packed (common carries it) but a file:// page keeps the synth
// (SPEC §7.4); the folder plays it when it is served over http.
//
// INTEGRITY (§3 "Integrity"): the page is checked against build.json's size
// and, when the site records it, its sha256; each index against the pin the
// page itself carries; each twin and the font sidecar by the string they hand
// the loader, against that same pin; and every object against its own name
// and size as it streams. Anything off is refused by name, and nothing is
// called saved.

/** A zip refusal: `code` names the uiStrings row (offline.zip.error.<code>) the screen shows. */
export class ZipDownloadError extends Error {
  constructor(code, message) { super(message); this.name = 'ZipDownloadError'; this.code = code; }
}
const zipError = (code, message) => new ZipDownloadError(code, message);
const SHA = /^[0-9a-f]{64}$/;
const PIN_FILE = /^packs\/[a-z]+-[0-9a-f]{12}\.(?:json|js)$/;
const PACK_PIN = /const ASSET_PACKS = (\{.*?\});\n/;

/**
 * The folder copy a branch's latest build offers, or null when that build is
 * one self-contained file (an older build, or a site from before step 6b):
 * its Download is already the whole game, and no zip is offered for it.
 */
export function releasedZip(data, manifestUrl = offlinePlay.manifestUrl, branch = offlinePlay.releaseBranch) {
  const { version } = releasedDownload(data, manifestUrl, branch);
  if (data.shape !== 'pack') return null;
  if (!size(data.pageBytes) || (data.pageSha256 != null && !SHA.test(String(data.pageSha256)))) throw new Error('Download information is not ready yet. Try again later.');
  const name = `AshenSpire-${branch}-${version}`;
  // `packBytes` (tools/pages-site.mjs, from the page's pin) sizes the zip before
  // anything is fetched; a build.json without it leaves the size unknown.
  const packs = offlinePlay.zip.packs.map((pack) => data.packBytes?.[pack]);
  const bytes = packs.every((value) => Number.isSafeInteger(value) && value >= 0) ? data.pageBytes + packs.reduce((n, value) => n + value, 0) : null;
  return { version, folder: name, page: `${name}.html`, filename: `${name}.zip`, bytes, pageBytes: data.pageBytes, pageSha256: data.pageSha256 ?? null,
    pageUrl: new URL(`../${data.ordinal}/index.html`, manifestUrl).href, baseUrl: new URL(`../${data.ordinal}/asset-base.json`, manifestUrl).href };
}

/** The ASSET_PACKS pin a pack-shaped HTML carries (as tools/pages-store.mjs packPinOf reads it), or null. */
export function zipPinOf(htmlText) {
  const m = PACK_PIN.exec(htmlText);
  if (!m) return null;
  try {
    const pin = JSON.parse(m[1]);
    return pin && pin.packs && typeof pin.packs === 'object' && Object.keys(pin.packs).length ? pin : null;
  } catch { return null; }
}

/** The string a .js twin (`<fn>("<id>", "<text>");`) hands the loader, or null. */
export function twinString(text, fn) {
  const head = `${fn}(`;
  if (!text.startsWith(head) || !text.endsWith(');\n')) return null;
  try {
    const args = JSON.parse(`[${text.slice(head.length, -3)}]`);
    return args.length === 2 && typeof args[0] === 'string' && typeof args[1] === 'string' ? args[1] : null;
  } catch { return null; }
}

/** objects/<xx>/<sha256>.<ext>: the name tools/asset-pack.mjs objectPath gives an id's bytes. */
function zipObjectPath(sha, id) {
  const dot = id.lastIndexOf('.');
  const ext = dot > id.lastIndexOf('/') + 1 ? id.slice(dot).toLowerCase() : '';
  return `objects/${sha.slice(0, 2)}/${sha}${ext}`;
}
const byteOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * coalesceSink(write, limit) → { sink, flush }: gathers the zip's many small
 * chunks (each entry is a header, a name and its bytes) into writes of about
 * `limit` bytes, for a file writer whose every write is a round trip.
 */
export function coalesceSink(write, limit = 1 << 20) {
  let parts = [], held = 0;
  const flush = async () => {
    if (!held) return;
    const out = new Uint8Array(held);
    let at = 0;
    for (const part of parts) { out.set(part, at); at += part.length; }
    parts = []; held = 0;
    await write(out);
  };
  return { sink: async (chunk) => { parts.push(chunk); held += chunk.length; if (held >= limit) await flush(); }, flush };
}

/**
 * assembleZip(plan, { sink, fetchImpl, packs, concurrency, onProgress, signal })
 * streams the folder copy `plan` (releasedZip's answer) into `sink(chunk)`,
 * in tools/zip.mjs writeZip's entry order and bytes. `onProgress(files, total,
 * bytes, totalBytes)` counts entries written. Resolves { bytes, count,
 * objects } once the archive's last byte is in the sink.
 */
export async function assembleZip(plan, { sink, fetchImpl = globalThis.fetch, packs = offlinePlay.zip.packs,
  concurrency = offlinePlay.zip.concurrency, onProgress = () => {}, signal, subtle } = {}) {
  const inner = new AbortController();
  const stop = () => inner.abort(signal?.reason);
  if (signal) { if (signal.aborted) stop(); else signal.addEventListener('abort', stop, { once: true }); }
  const decoder = new TextDecoder();
  const get = async (url, what) => {
    let last = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      inner.signal.throwIfAborted();
      try {
        const response = await fetchImpl(url, { signal: inner.signal });
        if (!response?.ok) throw zipError('unreachable', `${what} could not be fetched (${response ? response.status : 'no answer'}).`);
        return new Uint8Array(await response.arrayBuffer());
      } catch (error) {
        if (inner.signal.aborted) throw error;
        last = error instanceof ZipDownloadError ? error : zipError('unreachable', `${what} could not be fetched (${error?.message || error}).`);
      }
    }
    throw last;
  };
  try {
    // 1. The page, and the pin it carries.
    const html = await get(plan.pageUrl, 'The game page');
    if (html.length !== plan.pageBytes || (plan.pageSha256 && await sha256Hex(html, subtle) !== plan.pageSha256)) {
      throw zipError('page', 'The game page did not match the published build.');
    }
    const pin = zipPinOf(decoder.decode(html));
    if (!pin) throw zipError('page', 'The game page names no art packs, so it has no folder copy.');
    // 2. Where its packs/ and objects/ live (asset-base.json beside it).
    let base;
    try { base = JSON.parse(decoder.decode(await get(plan.baseUrl, 'asset-base.json'))).base; } catch (error) {
      if (error instanceof ZipDownloadError || inner.signal.aborted) throw error;
      base = null;
    }
    if (typeof base !== 'string' || !/^(?:\.\.?\/)*(?:[A-Za-z0-9_-]+\/)*$/.test(base)) throw zipError('pack', 'The build does not say where its art is.');
    const root = new URL(base || './', plan.pageUrl);
    // 3. Each pack's index, checked against the pin, and its twin by the string it hands the loader.
    const files = new Map();              // zip-relative name → bytes (already verified)
    const objects = new Map();            // objects/… → { sha, bytes, url }
    const textSha = async (text) => sha256Hex(new TextEncoder().encode(text), subtle);
    for (const pack of packs) {
      const want = pin.packs[pack];
      if (!want || !PIN_FILE.test(String(want.index)) || !SHA.test(String(want.sha256))) throw zipError('pack', `The build does not pin its ${pack} art.`);
      const bytes = await get(new URL(want.index, root).href, want.index);
      if (await sha256Hex(bytes, subtle) !== want.sha256) throw zipError('hash', `${want.index} does not match the build's pin.`);
      const twinName = want.index.replace(/\.json$/, '.js');
      const twin = await get(new URL(twinName, root).href, twinName);
      const carried = twinString(decoder.decode(twin), 'window.__ashenPack');
      if (carried === null || await textSha(carried) !== want.sha256) throw zipError('hash', `${twinName} does not match the build's pin.`);
      files.set(want.index, bytes); files.set(twinName, twin);
      for (const [id, row] of Object.entries(JSON.parse(decoder.decode(bytes)) || {})) {
        if (!Array.isArray(row) || !SHA.test(String(row[0])) || !Number.isSafeInteger(row[1]) || row[1] < 0) throw zipError('pack', `${want.index} lists ${id} without a sha256 and size.`);
        const path = zipObjectPath(row[0], id);
        if (!objects.has(path)) objects.set(path, { sha: row[0], bytes: row[1], url: new URL(path, root).href });
      }
    }
    if (pin.fonts?.file) {
      if (!PIN_FILE.test(String(pin.fonts.file)) || !SHA.test(String(pin.fonts.sha256))) throw zipError('pack', 'The build does not pin its font sidecar.');
      const sidecar = await get(new URL(pin.fonts.file, root).href, pin.fonts.file);
      const carried = twinString(decoder.decode(sidecar), '__ashenFonts');
      if (carried === null || await textSha(carried) !== pin.fonts.sha256) throw zipError('hash', `${pin.fonts.file} does not match the build's pin.`);
      files.set(pin.fonts.file, sidecar);
    }
    files.set(plan.page, html);
    files.set('asset-base.json', new TextEncoder().encode('{"base":"./"}\n'));
    // 4. Write in writeZip's order: every name byte-sorted under the folder.
    const order = [...files.keys(), ...objects.keys()].sort(byteOrder);
    const totalBytes = [...files.values()].reduce((n, b) => n + b.length, 0) + [...objects.values()].reduce((n, o) => n + o.bytes, 0);
    const zip = createZipWriter(sink);
    const pending = new Array(order.length);
    const fetchObject = async (path) => {
      const want = objects.get(path);
      const bytes = await get(want.url, path);
      if (bytes.length !== want.bytes || await sha256Hex(bytes, subtle) !== want.sha) throw zipError('hash', `${path} does not match its name.`);
      return bytes;
    };
    const launch = (i) => {
      if (i >= order.length || pending[i]) return;
      const name = order[i];
      pending[i] = files.has(name) ? Promise.resolve(files.get(name)) : fetchObject(name);
      pending[i].catch(() => {});        // surfaced when its turn comes
    };
    let written = 0;
    onProgress(0, order.length, 0, totalBytes);
    for (let i = 0; i < order.length; i++) {
      for (let k = i; k < i + Math.max(1, concurrency); k++) launch(k);
      const bytes = await pending[i];
      pending[i] = true;                 // release the bytes once written
      inner.signal.throwIfAborted();
      await zip.add(`${plan.folder}/${order[i]}`, bytes);
      written += bytes.length;
      onProgress(i + 1, order.length, written, totalBytes);
    }
    const done = await zip.finish();
    return { ...done, objects: objects.size };
  } catch (error) {
    inner.abort(error);
    throw error;
  } finally { signal?.removeEventListener('abort', stop); }
}
