// tools/zip.mjs — a deterministic zip writer and a small reader, no dependencies.
//
// The SAME FILE lives in cehinds/AshenSpire (tools/zip.mjs) and in
// cehinds/AshenSpire-art (tools/zip.mjs): the art repo packs a release with
// writeZip, and AshenSpire's tools/fetch-art.mjs unpacks it with readZip. Keep
// them byte-identical; each repo's test pins the other's known-good vector.
//
// DETERMINISTIC: entries are sorted by name, stored (method 0 — WebP, PNG and
// the rest are already compressed), with a fixed 1980-01-01 timestamp and no
// extra fields, so the same tree always packs to the same bytes and the
// release's sha256 is reproducible by anyone with the tree.
//
// The reader accepts stored and deflated entries (a zip re-saved by another tool
// still reads), takes sizes and CRCs from the central directory (so a data
// descriptor is harmless), refuses zip64, encryption, duplicate names (exact or
// differing only in case, which collide on Windows and macOS) and a deflated
// entry that inflates past its declared size, and never writes outside the
// target directory.

import { closeSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const DOS_TIME = 0;          // 00:00:00
const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
const UTF8_FLAG = 0x0800;

function checkName(name) {
  if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').some((p) => p === '..' || p === '')) {
    throw new Error(`zip: refusing entry name ${JSON.stringify(name)}`);
  }
}

/**
 * writeZip(outPath, entries) — entries is [{ name, data: Buffer }] (or a
 * function returning the Buffer, so a large tree need not sit in memory at once).
 * Returns { bytes, count }.
 */
export function writeZip(outPath, entries) {
  const list = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  // 0xffff itself is the zip64 sentinel in the end record, so 65534 is the most.
  if (list.length >= 0xffff) throw new Error('zip: 65535 or more entries needs zip64, which this writer does not do');
  const fd = openSync(outPath, 'w');
  let offset = 0;
  const central = [];
  const write = (buf) => { writeSync(fd, buf); offset += buf.length; };
  try {
    for (const entry of list) {
      checkName(entry.name);
      const data = typeof entry.data === 'function' ? entry.data() : entry.data;
      const name = Buffer.from(entry.name, 'utf8');
      const crc = crc32(data);
      if (offset + 30 + name.length + data.length > 0xfffffffe) throw new Error('zip: archive over 4 GiB needs zip64');
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(10, 4);          // version needed
      local.writeUInt16LE(UTF8_FLAG, 6);
      local.writeUInt16LE(0, 8);           // stored
      local.writeUInt16LE(DOS_TIME, 10);
      local.writeUInt16LE(DOS_DATE, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(data.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(0, 28);
      central.push({ name, crc, size: data.length, offset });
      write(local); write(name); write(data);
    }
    const cdStart = offset;
    const cdBytes = central.reduce((n, c) => n + 46 + c.name.length, 0);
    if (cdStart + cdBytes + 22 > 0xfffffffe) throw new Error('zip: archive over 4 GiB needs zip64');
    for (const c of central) {
      const h = Buffer.alloc(46);
      h.writeUInt32LE(0x02014b50, 0);
      h.writeUInt16LE(20, 4);              // version made by (MS-DOS, 2.0)
      h.writeUInt16LE(10, 6);
      h.writeUInt16LE(UTF8_FLAG, 8);
      h.writeUInt16LE(0, 10);
      h.writeUInt16LE(DOS_TIME, 12);
      h.writeUInt16LE(DOS_DATE, 14);
      h.writeUInt32LE(c.crc, 16);
      h.writeUInt32LE(c.size, 20);
      h.writeUInt32LE(c.size, 24);
      h.writeUInt16LE(c.name.length, 28);
      // extra, comment, disk start, internal attrs, external attrs: all 0
      h.writeUInt32LE(c.offset, 42);
      write(h); write(c.name);
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(central.length, 8);
    end.writeUInt16LE(central.length, 10);
    end.writeUInt32LE(offset - cdStart, 12);
    end.writeUInt32LE(cdStart, 16);
    write(end);
  } finally {
    closeSync(fd);
  }
  return { bytes: offset, count: list.length };
}

/**
 * readZip(buf) → [{ name, data }] in archive order, every entry's CRC checked.
 * Throws on anything it does not understand rather than guessing.
 */
export function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip: no end-of-central-directory record (not a zip, or truncated)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || p === 0xffffffff) throw new Error('zip: zip64 archives are not supported');
  const out = [];
  const seen = new Set();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`zip: bad central directory entry ${n}`);
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const xlen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const loff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    p += 46 + nlen + xlen + clen;
    if (flags & 0x1) throw new Error(`zip: ${name} is encrypted`);
    if (name.endsWith('/')) continue; // a directory entry
    checkName(name);
    const folded = name.toLowerCase();
    if (seen.has(folded)) throw new Error(`zip: ${name} appears twice (names are compared case-insensitively)`);
    seen.add(folded);
    if (buf.readUInt32LE(loff) !== 0x04034b50) throw new Error(`zip: bad local header for ${name}`);
    const start = loff + 30 + buf.readUInt16LE(loff + 26) + buf.readUInt16LE(loff + 28);
    const raw = buf.subarray(start, start + csize);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) {
      try { data = inflateRawSync(raw, { maxOutputLength: Math.max(usize, 1) }); }
      catch { throw new Error(`zip: ${name} does not inflate to its declared ${usize} bytes`); }
    }
    else throw new Error(`zip: ${name} uses compression method ${method}`);
    if (data.length !== usize) throw new Error(`zip: ${name} is ${data.length} bytes, header says ${usize}`);
    if (crc32(data) !== crc) throw new Error(`zip: ${name} fails its CRC`);
    out.push({ name, data });
  }
  return out;
}

/** extractZip(zipPath, dir) — unpack every entry under dir; returns the entries' names. */
export function extractZip(zipPath, dir) {
  const root = resolve(dir);
  const names = [];
  for (const { name, data } of readZip(readFileSync(zipPath))) {
    const target = resolve(root, name);
    if (!target.startsWith(root + sep)) throw new Error(`zip: ${name} escapes the target directory`);
    mkdirSync(dirname(target), { recursive: true });
    const fd = openSync(target, 'w');
    try { writeSync(fd, data); } finally { closeSync(fd); }
    names.push(name);
  }
  return names;
}
