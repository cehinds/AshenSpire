// Generates docs/tag-model/tag-tree.txt from tables/tags.csv.
//
// Format: one line per tag, two spaces of indent per level of its parent chain,
// roots first in row order, children in row order. A line is the tag's label,
// then " [n]" when status is new, then " [m]" when the description carries the
// "Moved: re-homed" note (tag-tree.txt [m]), then " {note}" with the rest of the
// description. Output is deterministic: the same tags.csv always gives the same
// text. build.mjs writes the file, and check.mjs fails when it is stale.
//
//   node docs/tag-model/tools/tree.mjs          (prints the tree)

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readTable } from './csv.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const TAGS_PATH = join(HERE, '..', 'tables', 'tags.csv');
export const TREE_PATH = join(HERE, '..', 'tag-tree.txt');

const MOVED_PREFIX = /^(Moved: re-homed in the proposal \(tag-tree\.txt \[m\]\)\.\s*)+/;

// t: a readTable() result for tags.csv. Returns the tree text (ends with a newline).
export function renderTree(t) {
  const col = name => t.header.indexOf(name);
  const idI = col('id');
  const parentI = col('parent');
  const labelI = col('label');
  const descI = col('description');
  const statusI = col('status');

  const children = new Map();
  const roots = [];
  for (const r of t.rows) {
    const parent = r[parentI] || '';
    if (parent) {
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(r);
    } else {
      roots.push(r);
    }
  }

  const lines = [];
  const visit = (r, depth) => {
    const desc = String(r[descI] ?? '');
    const moved = MOVED_PREFIX.test(desc);
    const note = desc.replace(MOVED_PREFIX, '').trim();
    let line = '  '.repeat(depth) + String(r[labelI]);
    if (r[statusI] === 'new') line += ' [n]';
    if (moved) line += ' [m]';
    if (note) line += ` {${note}}`;
    lines.push(line);
    for (const c of children.get(r[idI]) || []) visit(c, depth + 1);
  };
  for (const r of roots) visit(r, 0);

  // Every row must be reachable from a root, or the tree would silently drop it.
  if (lines.length !== t.rows.length) {
    throw new Error(`tag-tree: ${t.rows.length - lines.length} tag(s) are not under a root (parent cycle or missing parent)`);
  }
  return lines.join('\n') + '\n';
}

// Reads tags.csv from its default place and renders the tree.
export function renderTreeFromFile(path = TAGS_PATH) {
  return renderTree(readTable(path));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.stdout.write(renderTreeFromFile());
}
