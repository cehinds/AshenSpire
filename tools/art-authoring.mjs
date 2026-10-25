// Mutable authoring sources in AI-Art/ashenspire. Never use the release cache
// as an export destination; tools/art-source.mjs owns verified runtime reads.
import { existsSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative, sep, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function authoringRoot({ root, assetRoot, env = process.env, required = true } = {}) {
  const value = assetRoot || env.ASHEN_ART_CHECKOUT;
  if (!value) {
    if (!required) return null;
    throw new Error('Set ASHEN_ART_CHECKOUT (or --asset-root) to a writable cehinds/AI-Art checkout on branch ashenspire before authoring/exporting art. Fetch-art caches are read-only runtime inputs.');
  }
  const directory = resolve(value);
  if (!existsSync(directory) || !statSync(directory).isDirectory()) throw new Error('The art authoring checkout directory does not exist: ' + directory);
  const canonical = realpathSync(directory);
  if (canonical.split(sep).includes('.art-cache')) throw new Error('An art release cache cannot be an authoring checkout. Use AI-Art/ashenspire.');
  if (root && canonical === (existsSync(root) ? realpathSync(root) : resolve(root))) throw new Error('The art authoring checkout must be separate from the game code checkout.');
  return directory;
}

export function safeArtRelative(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || value.startsWith('/') || /^[A-Za-z]:/.test(value) || value.split('/').some(p => p === '..' || p.startsWith('.'))) throw new Error(`Unsafe art path: ${value}`);
  return value;
}

// Display indexes and generated game modules stay in AshenSpire. The runtime
// image IDs remain assets-display/*; the art host packages them under common/.
export function authoringPath(value, options = {}) {
  const rel = safeArtRelative(value);
  if (/^assets-display\/.*\.(?:json|md)$/i.test(rel) || /^music\/score\/.*\.m?js$/i.test(rel)) {
    if (!options.root) throw new Error('A game root is required for retained display metadata.');
    return resolve(options.root, rel);
  }
  const directory = authoringRoot(options);
  const mapped = rel.startsWith('assets-display/') ? 'common/' + rel
    : rel.startsWith('assets-mobile/') ? 'light/assets/' + rel.slice(14)
    : rel.startsWith('assets/fonts/') || /^(music|map-detail)\//.test(rel) ? 'common/' + rel
    : rel.startsWith('assets/') ? 'hd/' + rel : rel;
  const target = resolve(directory, mapped);
  if (relative(directory, target).startsWith('..' + sep)) throw new Error('Art path escapes the authoring checkout.');
  let ancestor=target;
  while(!existsSync(ancestor))ancestor=dirname(ancestor);
  const canonical=realpathSync(ancestor),base=realpathSync(directory);
  if(canonical.split(sep).includes('.art-cache') || (canonical!==base&&!canonical.startsWith(base+sep))) throw new Error('Art paths cannot follow links outside the authoring checkout or into a runtime cache.');
  return target;
}

// Only authoring data is overlaid. Executable editor pages/modules, src/,
// engine/, tests and display catalogs keep their game checkout ownership.
export function isAuthoringFile(rel) {
  safeArtRelative(rel);
  if (rel === 'tools/hud-component-studio/reference.png') return true;
  if (/^music\/score\/.*\.m?js$/i.test(rel)) return false;
  if (/^assets-display\//.test(rel)) return !/\.(?:json|md)$/i.test(rel);
  if (/^(assets|assets-mobile|art|music|map-detail)\//.test(rel)) return true;
  if (/^tools\/hud-component-studio\/(?:scene|assets\.manifest|css-bindings)\.json$/.test(rel)) return true;
  return /^(?:pose-studio\/(?:stances|renewal)\/|docs\/(?:design|low-poly-fighters|mockups)\/|tools\/hud-component-studio\/(?:projects|assets)\/)/.test(rel)
    && !/\.(?:m?js|html|css|py|txt)$/i.test(rel);
}

export function compositeSourcePath(rel, options = {}) {
  const safe = safeArtRelative(rel);
  return authoringRoot({ ...options, required: false }) && isAuthoringFile(safe)
    ? authoringPath(safe, options) : resolve(options.root, safe);
}

// Compatibility guard for older ship tools that have not gained split roots.
/**
 * authoringNeeds(url, dirs) — when the module at `url` is the process's entry
 * point and any of `dirs` (repository-relative: 'art', 'assets') is absent,
 * print why and exit 2. Imported as a library, it does nothing.
 */
export function authoringNeeds(url, dirs = ['art'], { root = resolve(dirname(fileURLToPath(import.meta.url)), '..') } = {}) {
  const self = fileURLToPath(url);
  if (!process.argv[1] || resolve(process.argv[1]) !== self) return;
  const missing = dirs.filter((d) => !existsSync(resolve(root, d)));
  if (!missing.length) return;
  console.error(`${basename(self)}: an authoring tool that needs ${missing.map((d) => `${d}/`).join(' and ')}, which left this repository at docs/EXTERNAL-ASSETS-PLAN.md step 13 (the art lives in cehinds/AI-Art (branch ashenspire), and builds read its pinned release). Run it where the art is (a checkout of a commit before step 13, or with that repository's tree in place), or move it to cehinds/AI-Art (branch ashenspire) (docs/ART-REPO-PLAN.md step 5).`);
  process.exit(2);
}
