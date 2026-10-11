// Round-trip check: can the proposed tag model (tables/tags.csv) stand in for
// the live tag vocabulary (content/source/nodes.csv) without loss?
//
// Usage: node docs/tag-model/tools/compile.mjs
// Writes the report to stdout and to docs/tag-model/compile-report.md.
// Exit 0 whenever the report is produced; a NOT lossless verdict is a finding.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, '..', '..', '..');
export const TAGS_PATH = join(here, '..', 'tables', 'tags.csv');
export const NODES_PATH = join(REPO, 'content', 'source', 'nodes.csv');
export const TAGGING_PATH = join(REPO, 'content', 'source', 'tagging.csv');
export const REPORT_PATH = join(here, '..', 'compile-report.md');

// Parses a CSV that may start with '#' comment lines. Returns row objects keyed
// by the header. Blank rows are dropped.
export function readRows(text) {
  const body = text.split('\n').filter(l => !l.startsWith('#')).join('\n');
  const [header, ...rows] = parseCsv(body);
  return rows
    .filter(r => !(r.length === 1 && r[0] === ''))
    .map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

// The root of a node's tree: walk parentId until the parent is empty or unknown.
export function rootOf(id, byId) {
  let cur = byId.get(id);
  let guard = 0;
  while (cur && cur.parentId && byId.has(cur.parentId) && guard++ < 100) {
    cur = byId.get(cur.parentId);
  }
  return cur ? cur.id : id;
}

// Live ids that no tag maps to, and mapped/unmapped counts per root domain.
export function coverage(tags, nodes) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const mapped = new Set(tags.filter(t => t.liveId).map(t => t.liveId));
  const domains = new Map();
  const unmappedIds = [];
  for (const n of nodes) {
    const domain = rootOf(n.id, byId);
    const e = domains.get(domain) || { domain, mapped: 0, unmapped: 0 };
    if (mapped.has(n.id)) e.mapped++;
    else { e.unmapped++; unmappedIds.push(n.id); }
    domains.set(domain, e);
  }
  return {
    liveTotal: nodes.length,
    mappedCount: nodes.length - unmappedIds.length,
    unmappedIds,
    domains: [...domains.values()].sort((a, b) => a.domain.localeCompare(b.domain)),
  };
}

// Number of distinct carriers (family, scope, objectId) per tagId in tagging.csv.
export function usageByNode(tagging) {
  const carriers = new Map();
  for (const r of tagging) {
    if (!carriers.has(r.tagId)) carriers.set(r.tagId, new Set());
    carriers.get(r.tagId).add(`${r.family}\u0001${r.scope}\u0001${r.objectId}`);
  }
  return new Map([...carriers].map(([id, set]) => [id, set.size]));
}

// Live ids mapped by more than one tag: [{ liveId, tagIds }], sorted by liveId.
export function collisions(tags) {
  const byLive = new Map();
  for (const t of tags) {
    if (!t.liveId) continue;
    if (!byLive.has(t.liveId)) byLive.set(t.liveId, []);
    byLive.get(t.liveId).push(t.id);
  }
  return [...byLive]
    .filter(([, ids]) => ids.length > 1)
    .map(([liveId, tagIds]) => ({ liveId, tagIds }))
    .sort((a, b) => a.liveId.localeCompare(b.liveId));
}

// Field parity for each mapped pair (model tag, live node). A difference is a
// label, glyph or color that differs, or a live parent whose mapped tag is not
// the model tag's parent or an ancestor of it. Returns [{ tagId, liveId, field,
// model, live }].
export function parity(tags, nodes) {
  const byLive = new Map(nodes.map(n => [n.id, n]));
  const tagById = new Map(tags.map(t => [t.id, t]));
  const tagForLive = new Map();
  for (const t of tags) if (t.liveId && !tagForLive.has(t.liveId)) tagForLive.set(t.liveId, t);

  const isAncestorOrSelf = (ancestorId, t) => {
    let cur = t;
    let guard = 0;
    while (cur && guard++ < 100) {
      if (cur.id === ancestorId) return true;
      cur = cur.parent ? tagById.get(cur.parent) : undefined;
    }
    return false;
  };

  const diffs = [];
  for (const t of tags) {
    if (!t.liveId || !byLive.has(t.liveId)) continue;
    const n = byLive.get(t.liveId);
    const pair = (field, model, live) => diffs.push({ tagId: t.id, liveId: t.liveId, field, model, live });
    if (t.label !== n.label) pair('label', t.label, n.label);
    if (t.glyph !== n.glyph) pair('glyph', t.glyph, n.glyph);
    if (t.color !== n.color) pair('color', t.color, n.color);
    if (n.parentId) {
      const livePt = tagForLive.get(n.parentId);
      if (!livePt) pair('parent', t.parent, `${n.parentId} (live parent unmapped)`);
      else if (!isAncestorOrSelf(livePt.id, t) || livePt.id === t.id) {
        pair('parent', t.parent, `${n.parentId} (mapped to ${livePt.id})`);
      }
    }
  }
  return diffs;
}

// Model tags with status live-tag whose liveId is not a live node (an empty
// liveId counts as missing). Returns [{ tagId, liveId }].
export function reverseMissing(tags, nodes) {
  const live = new Set(nodes.map(n => n.id));
  return tags
    .filter(t => t.status === 'live-tag' && !live.has(t.liveId))
    .map(t => ({ tagId: t.id, liveId: t.liveId }));
}

export function analyze({ tags, nodes, tagging }) {
  const usage = usageByNode(tagging);
  const cov = coverage(tags, nodes);
  const unmapped = cov.unmappedIds
    .map(id => ({ id, usage: usage.get(id) || 0 }))
    .sort((a, b) => b.usage - a.usage || a.id.localeCompare(b.id));
  return {
    ...cov,
    unmapped,
    collisions: collisions(tags),
    parity: parity(tags, nodes),
    reverse: reverseMissing(tags, nodes),
  };
}

export function render(res) {
  const out = [];
  out.push('# Tag model round-trip report', '');
  out.push('Generated by `docs/tag-model/tools/compile.mjs`. Do not edit by hand.', '');
  out.push('## 1. Coverage', '');
  out.push(`Live nodes (content/source/nodes.csv): ${res.liveTotal}`);
  out.push(`Mapped by a tag liveId: ${res.mappedCount}`);
  out.push(`UNMAPPED: ${res.unmapped.length}`, '');
  out.push('| Root domain | Mapped | Unmapped |', '|---|---:|---:|');
  for (const d of res.domains) out.push(`| ${d.domain} | ${d.mapped} | ${d.unmapped} |`);
  out.push('');
  out.push('### Unmapped live ids (most used first)', '');
  out.push('| Live id | Carriers using it |', '|---|---:|');
  for (const u of res.unmapped) out.push(`| ${u.id} | ${u.usage} |`);
  out.push('');
  out.push('## 2. Collisions', '');
  if (res.collisions.length === 0) out.push('None: every live id is mapped by at most one tag.', '');
  else {
    out.push('| Live id | Tags mapping it |', '|---|---|');
    for (const c of res.collisions) out.push(`| ${c.liveId} | ${c.tagIds.join(', ')} |`);
    out.push('');
  }
  out.push('## 3. Field parity', '');
  if (res.parity.length === 0) out.push('None: every mapped pair agrees on label, parent, glyph and color.', '');
  else {
    out.push(`${res.parity.length} differences.`, '');
    out.push('| Model tag | Live id | Field | Model | Live |', '|---|---|---|---|---|');
    for (const d of res.parity) {
      out.push(`| ${d.tagId} | ${d.liveId} | ${d.field} | ${d.model || '(empty)'} | ${d.live || '(empty)'} |`);
    }
    out.push('');
  }
  out.push('## 4. Reverse: live-tag with no live node', '');
  if (res.reverse.length === 0) out.push('None: every live-tag points at a live node.', '');
  else {
    out.push('| Model tag | liveId |', '|---|---|');
    for (const r of res.reverse) out.push(`| ${r.tagId} | ${r.liveId || '(empty)'} |`);
    out.push('');
  }
  return out.join('\n');
}

export function main() {
  const tags = readRows(readFileSync(TAGS_PATH, 'utf8'));
  const nodes = readRows(readFileSync(NODES_PATH, 'utf8'));
  const tagging = readRows(readFileSync(TAGGING_PATH, 'utf8'));
  const res = analyze({ tags, nodes, tagging });
  const text = render(res);
  writeFileSync(REPORT_PATH, text);
  process.stdout.write(text);
  return res;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
