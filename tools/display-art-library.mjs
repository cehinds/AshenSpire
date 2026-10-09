// Organize existing, hash-verified exports without repainting or re-encoding them.
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const base = resolve(root, 'assets-display');
const organize = process.argv.includes('--organize');
const write = organize || process.argv.includes('--write');
const specs = [
  ['src/ui/alternativeArtCatalog.js', 'alternativeArtCatalog'],
  ['src/content/alternativeCardAnimations.js', 'alternativeCardAnimations'],
  ['src/content/alternativeSelectedStances.js', 'alternativeSelectedStances'],
];
const catalogs = specs.map(([file, name]) => {
  const source = readFileSync(resolve(root, file), 'utf8');
  const match = source.match(new RegExp(`^export const ${name} = (.+);\\r?$`, 'm'));
  if (!match) throw new Error(`Missing export catalog: ${file}`);
  return { file, name, source, value: JSON.parse(match[1]) };
});
const sharedFiles = new Set(Object.values(catalogs[0].value.sprites)
  .filter(sprite => sprite.family === 'companion')
  .flatMap(sprite => [basename(sprite.path), basename(sprite.mobilePath)]));
const paths = {};
for (const catalog of catalogs) for (const file of Object.keys(catalog.value.hashes)) {
  if (!/^(?:stances\/[a-z]+\/)?[a-zA-Z0-9-]+\.webp$/.test(file)) throw new Error(`Invalid export name: ${file}`);
  paths[file] = `assets-display/${sharedFiles.has(file) ? 'shared' : 'alternative'}/${file}`;
}

function workspacePath(path) {
  const full = resolve(root, path);
  if (!full.startsWith(root + sep)) throw new Error(`Path escapes workspace: ${path}`);
  return full;
}
if (organize) {
  for (const name of ['classic', 'alternative', 'shared']) mkdirSync(resolve(base, name), { recursive: true });
  const old = workspacePath('assets-alternative');
  // Verify resolved source and destination before moving any directory contents.
  if (!realpathSync(base).startsWith(realpathSync(root) + sep)) throw new Error('Display directory escapes workspace');
  if (existsSync(old)) {
    if (!realpathSync(old).startsWith(realpathSync(root) + sep)) throw new Error('Export directory escapes workspace');
    // Move files individually into the pre-created directory; unknown files stay put.
    for (const [file, id] of Object.entries(paths)) {
      const from = workspacePath(`assets-alternative/${file}`), to = workspacePath(id);
      if (!existsSync(from) && existsSync(to)) continue; // Already organized; verified below.
      if (!existsSync(from)) throw new Error(`Missing original export: ${file}`);
      if (existsSync(to)) throw new Error(`Destination already exists: ${id}`);
      mkdirSync(dirname(to), { recursive: true });
      renameSync(from, to);
    }
  }
  function relocate(value) {
    if (typeof value === 'string' && value.startsWith('assets-alternative/')) {
      const id = paths[value.slice('assets-alternative/'.length)];
      if (!id) throw new Error(`Unregistered export path: ${value}`);
      return id;
    }
    if (Array.isArray(value)) return value.map(relocate);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, relocate(item)]));
    return value;
  }
  for (const catalog of catalogs) {
    catalog.value = relocate(catalog.value);
    catalog.value.filePaths = Object.fromEntries(Object.keys(catalog.value.hashes).map(file => [file, paths[file]]));
    const source = catalog.source.replace(new RegExp(`^export const ${catalog.name} = (.+);\\r?$`, 'm'),
      `export const ${catalog.name} = ${JSON.stringify(catalog.value)};`);
    writeFileSync(resolve(root, catalog.file), source);
  }
}
const exports = {};
for (const catalog of catalogs) for (const [file, expected] of Object.entries(catalog.value.hashes)) {
  const id = catalog.value.filePaths?.[file] || paths[file];
  if (id !== paths[file]) throw new Error(`Export in wrong display library: ${id}`);
  const bytes = readFileSync(workspacePath(id));
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Changed export: ${id}`);
  if (exports[id]) throw new Error(`Duplicate export: ${id}`);
  exports[id] = { sha256: expected, bytes: bytes.length };
}
const pinned = JSON.parse(readFileSync(resolve(root, 'art-manifest.json'), 'utf8'));
const release = JSON.parse(readFileSync(resolve(root, 'art-release.json'), 'utf8'));
const classic = {}, shared = {};
const classicId = /^assets\/(?:sprites\/|painted-outfits\/|animations\/|poses\/|enemy-poses\/|enemy-states\/|bg\/|equipment\/(?:reaver|rogue|starseer|herald)[_-])|^assets\/environments\/(?:legacy\/|[^/]+-combat\.webp$)/;
for (const [id, record] of Object.entries(pinned.assets).sort(([a], [b]) => a.localeCompare(b))) {
  (classicId.test(id) ? classic : shared)[id] = { source: 'pinned-art-pack', tiers: record };
}
const alternative = {};
for (const [id, record] of Object.entries(exports).sort(([a], [b]) => a.localeCompare(b))) {
  (id.startsWith('assets-display/shared/') ? shared : alternative)[id] = { source: 'reviewed-export', ...record };
}
const outputs = { classic, alternative, shared };
for (const [name, assets] of Object.entries(outputs)) {
  const content = JSON.stringify({ schema: 1, library: name, pinnedRelease: release.tag,
    note: name === 'alternative' ? 'Display-specific exports stored beside this index.' :
      'Canonical packed IDs retain their existing byte home; this index groups them without duplication.', assets }, null, 2) + '\n';
  const file = resolve(base, name, 'library.json');
  if (write) { mkdirSync(resolve(base, name), { recursive: true }); writeFileSync(file, content); }
  else if (!existsSync(file) || readFileSync(file, 'utf8') !== content) throw new Error(`Stale display library: ${name}; run node tools/display-art-library.mjs --write`);
}
console.log(`Display libraries verified: ${Object.keys(classic).length} classic, ${Object.keys(alternative).length} alternative, ${Object.keys(shared).length} shared; ${Object.keys(exports).length} unchanged exports.`);
