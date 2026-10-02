// src/model/zipStream.js — the in-game zip writer (docs/EXTERNAL-ASSETS-PLAN.md
// §5 B, step 7): a store-only zip written ENTRY BY ENTRY to a sink, so the
// game can save its own folder copy without holding the archive twice.
//
// THE SAME BYTES AS tools/zip.mjs writeZip. Every entry is stored (method 0:
// WebP, MP3 and WOFF2 are already compressed), dated 1980-01-01 00:00, flagged
// UTF-8, with no extra fields; the central directory follows the last entry.
// Given the same entries in the same (byte-sorted) order, this writer and
// writeZip produce identical archives, and tests/offline-zip.test.mjs holds
// them to that, so tools/zip.mjs readZip (and every unzip tool) reads what the
// game writes. Unlike writeZip it does not sort: the caller adds entries in
// the order it wants them, and sorts first if it wants writeZip's bytes.
//
// LIMITS, refused by name rather than written wrong: no zip64 (65,535 entries
// or 4 GiB), no directory entries, and no name that is absolute, holds a `\`,
// an empty segment or a `..` segment.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** The zip CRC-32 of `bytes` (a Uint8Array). */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
const UTF8_FLAG = 0x0800;
const MAX_ENTRIES = 0xfffe;
const MAX_OFFSET = 0xfffffffe;

/** True when `name` is a plain relative file path a zip may carry. */
export function zipNameOk(name) {
  return typeof name === 'string' && name !== '' && !name.startsWith('/') && !name.includes('\\')
    && !name.split('/').some((part) => part === '..' || part === '' || part === '.');
}

/**
 * createZipWriter(sink) → { add(name, bytes), finish(), bytes, count }.
 * `sink(chunk)` receives each Uint8Array in archive order and may return a
 * promise (a file writer's write); add() and finish() wait for it, so a sink
 * that throws (a full disk) fails the add that wrote to it.
 */
export function createZipWriter(sink) {
  const encoder = new TextEncoder();
  const central = [];
  const seen = new Set();
  let offset = 0;
  let finished = false;
  const put = async (chunk) => { await sink(chunk); offset += chunk.length; };
  return {
    get bytes() { return offset; },
    get count() { return central.length; },
    async add(name, bytes) {
      if (finished) throw new Error('zip: add after finish');
      if (!zipNameOk(name)) throw new Error(`zip: refusing entry name ${JSON.stringify(name)}`);
      const folded = name.toLowerCase();
      if (seen.has(folded)) throw new Error(`zip: ${name} appears twice`);
      if (central.length >= MAX_ENTRIES) throw new Error('zip: 65535 or more entries needs zip64, which this writer does not do');
      const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const nameBytes = encoder.encode(name);
      if (offset + 30 + nameBytes.length + data.length > MAX_OFFSET) throw new Error('zip: archive over 4 GiB needs zip64');
      seen.add(folded);
      const crc = crc32(data);
      const local = new Uint8Array(30);
      const view = new DataView(local.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 10, true);            // version needed
      view.setUint16(6, UTF8_FLAG, true);
      view.setUint16(8, 0, true);             // stored
      view.setUint16(10, 0, true);            // 00:00:00
      view.setUint16(12, DOS_DATE, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);
      central.push({ name: nameBytes, crc, size: data.length, offset });
      await put(local); await put(nameBytes); if (data.length) await put(data);
    },
    async finish() {
      if (finished) throw new Error('zip: finished twice');
      finished = true;
      const start = offset;
      const cdBytes = central.reduce((n, c) => n + 46 + c.name.length, 0);
      if (start + cdBytes + 22 > MAX_OFFSET) throw new Error('zip: archive over 4 GiB needs zip64');
      for (const c of central) {
        const head = new Uint8Array(46);
        const view = new DataView(head.buffer);
        view.setUint32(0, 0x02014b50, true);
        view.setUint16(4, 20, true);          // made by MS-DOS, 2.0
        view.setUint16(6, 10, true);
        view.setUint16(8, UTF8_FLAG, true);
        view.setUint16(10, 0, true);
        view.setUint16(12, 0, true);
        view.setUint16(14, DOS_DATE, true);
        view.setUint32(16, c.crc, true);
        view.setUint32(20, c.size, true);
        view.setUint32(24, c.size, true);
        view.setUint16(28, c.name.length, true);
        view.setUint32(42, c.offset, true);
        await put(head); await put(c.name);
      }
      const end = new Uint8Array(22);
      const view = new DataView(end.buffer);
      view.setUint32(0, 0x06054b50, true);
      view.setUint16(8, central.length, true);
      view.setUint16(10, central.length, true);
      view.setUint32(12, offset - start, true);
      view.setUint32(16, start, true);
      await put(end);
      return { bytes: offset, count: central.length };
    },
  };
}
