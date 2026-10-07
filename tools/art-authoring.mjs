// tools/art-authoring.mjs — the authoring tools that still live here, and why
// they stop by name in a checkout without the art.
//
// docs/EXTERNAL-ASSETS-PLAN.md step 13 (with ART-REPO-PLAN step 6) removed
// art/ (the authoring sources) and assets/ (the shipped high tier) from this
// repository; they live in cehinds/AshenSpire-art, and builds read the pinned
// release (tools/fetch-art.mjs, tools/art-source.mjs). The ship, build and
// check tools that READ art/ or WRITE the shipped trees are authoring tools
// that ART-REPO-PLAN step 5 moves to that repository; until they move, each
// calls authoringNeeds() first, so running one here says what is missing and
// where the work now happens, instead of failing on a bare ENOENT or writing
// into a tree that is ignored and never ships. Nothing in CI runs them.
import { existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * authoringNeeds(url, dirs) — when the module at `url` is the process's entry
 * point and any of `dirs` (repository-relative: 'art', 'assets') is absent,
 * print why and exit 2. Imported as a library, it does nothing.
 */
export function authoringNeeds(url, dirs = ['art'], { root = ROOT } = {}) {
  const self = fileURLToPath(url);
  if (!process.argv[1] || resolve(process.argv[1]) !== self) return;
  const missing = dirs.filter((d) => !existsSync(resolve(root, d)));
  if (!missing.length) return;
  console.error(`${basename(self)}: an authoring tool that needs ${missing.map((d) => `${d}/`).join(' and ')}, which left this repository at docs/EXTERNAL-ASSETS-PLAN.md step 13 (the art lives in cehinds/AshenSpire-art, and builds read its pinned release). Run it where the art is (a checkout of a commit before step 13, or with that repository's tree in place), or move it to cehinds/AshenSpire-art (docs/ART-REPO-PLAN.md step 5).`);
  process.exit(2);
}
