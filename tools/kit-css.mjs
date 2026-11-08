// tools/kit-css.mjs — the kit stylesheet is several files; this is the one door.
//
// styles/kit.css was 6,800 lines. It is cut into styles/kit-<section>.css
// files, linked from index.html in this order at kit.css's old place in the
// cascade. index.html is the ONE record of that order; nothing else lists the
// parts. A tool or test that wants "the kit's CSS as text" reads it here, and
// gets the parts concatenated in cascade order — the same bytes the single
// file held. Before the split (or in a tree that still has styles/kit.css)
// the list is just ['styles/kit.css'], so callers work on both sides of it.
//
// Plant tools (tools/doorplant.mjs, tools/plantsites.mjs) still NAME
// 'styles/kit.css' as a plant target; resolveKitTarget() maps that name to the
// part that holds the plant's find-string, so the plant corpus is unchanged.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT_CSS_NAME = 'styles/kit.css';
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const KIT_HREF = /^styles\/kit(\.css|-[a-z0-9]+(-[a-z0-9]+)*\.css)$/;

// The stylesheet hrefs of an HTML page, in document order.
export function stylesheetHrefs(html) {
  const out = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (!/\brel=["']stylesheet["']/i.test(tag)) continue;
    const m = /\bhref=["']([^"']+)["']/i.exec(tag);
    if (m) out.push(m[1].replace(/^\.?\//, '').replace(/^\//, ''));
  }
  return out;
}

// The kit parts, as repo-relative paths, in index.html order.
export function kitCssPaths(root = ROOT) {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  return stylesheetHrefs(html).filter((href) => KIT_HREF.test(href));
}

// The kit's CSS as one string: the parts joined in cascade order.
export function readKitCss(root = ROOT) {
  return kitCssPaths(root).map((p) => readFileSync(resolve(root, p), 'utf8')).join('');
}

// Which real file does a plant aimed at 'styles/kit.css' edit? The old name
// stays when that file exists. Otherwise: the part that contains `find`, or,
// for an append (no find), the last part — appended there it lands where it
// landed at the end of kit.css. Returns a repo-relative path.
export function resolveKitTarget(root, file, find) {
  if (file !== KIT_CSS_NAME || existsSync(resolve(root, file))) return file;
  const parts = kitCssPaths(root);
  if (find == null) return parts[parts.length - 1];
  const norm = (s) => s.replace(/\r\n/g, '\n');
  const needle = norm(find);
  return parts.find((p) => norm(readFileSync(resolve(root, p), 'utf8')).includes(needle)) || parts[0];
}
