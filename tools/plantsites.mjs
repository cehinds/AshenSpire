#!/usr/bin/env node
// Issue #498: 28 plant sites across 9 gates had drifted — their find-strings no
// longer appeared in the files they patch — and only one of the nine gates went
// red for it. The other eight stayed green while unable to fail: the assertion
// still matched, the plant patched nothing, and the only detector was each
// gate's own --selftest, which runs in the dispatch-only lane. This is the
// cheap detector: a static scan of every { file:, find: } pair in tools/*.mjs,
// no execution, no browser, under a second, fit for the always-on lane.
//
//   node tools/plantsites.mjs                  report every site
//   node tools/plantsites.mjs --check          verify against the baseline; exit 1 on ANY difference
//   node tools/plantsites.mjs --write-baseline rewrite tools/plantsites-baseline.json from the tree
//
// The baseline records the sites known to be drifted (issue #498's backlog) and
// the sites this scan cannot read (non-literal or interpolated find-strings).
// --check fails in BOTH directions: a new drifted site is a regression, and a
// baseline entry that resolves again is an improvement the baseline must record
// — a baseline that overstates the debt hides the next regression inside the
// slack. Unreadable sites are held to their count per tool for the same reason:
// a scanner that quietly ignores what it cannot parse is the drift defect one
// level up.

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const BASELINE = resolve(ROOT, 'tools/plantsites-baseline.json');

// Parse the JS string literal starting at src[i] (a quote). Handles ' " ` and
// backslash escapes; template interpolation is reported, not guessed at.
function readString(src, i) {
  const q = src[i];
  if (q !== "'" && q !== '"' && q !== '`') return null;
  let out = '', j = i + 1;
  while (j < src.length) {
    const ch = src[j];
    if (ch === '\\') {
      const n = src[j + 1];
      if (n === 'n') out += '\n';
      else if (n === 't') out += '\t';
      else if (n === 'r') out += '\r';
      else if (n === '\n') { /* line continuation adds nothing */ }
      else out += n;
      j += 2; continue;
    }
    if (ch === q) return { value: out, end: j };
    if (q === '`' && ch === '$' && src[j + 1] === '{') return { value: out, end: j, interpolated: true };
    out += ch; j++;
  }
  return null;
}

export function scanPlantSites(root = ROOT) {
  const sites = [], unreadable = [];
  const toolsDir = resolve(root, 'tools');
  for (const name of readdirSync(toolsDir).sort()) {
    if (!name.endsWith('.mjs') || name === 'plantsites.mjs') continue;
    const tool = `tools/${name}`;
    const src = readFileSync(resolve(root, tool), 'utf8');
    // Any value after `file:`, not only a quote. Requiring a quote meant a
    // plant whose file is an expression (`file: TOOL_PATH`) was not merely
    // unreadable — it was invisible: outside the site set AND outside the
    // unreadable counts, so nothing pinned its existence at all.
    const re = /\bfile:\s*/g;
    let m;
    while ((m = re.exec(src))) {
      const at = m.index + m[0].length;
      const quoted = src[at] === "'" || src[at] === '"' || src[at] === '`';
      const fileStr = quoted ? readString(src, at) : null;
      if (quoted && !fileStr) { unreadable.push({ tool, why: 'file: literal could not be read' }); continue; }
      // `find:` must sit in the SAME object literal as `file:`. Pairing by
      // nearest match crossed object boundaries and reported JS strings as
      // drifted against .css targets, so this walks brace depth instead and
      // stops at the `}` closing this object or at the next `file:`.
      // A `file:` with no `find:` beside it is not a plant site — that is also
      // what keeps ordinary `{ file: f, line: n }` objects out of the counts.
      let depth = 0, k = fileStr ? fileStr.end + 1 : at, abs = -1, nonLiteral = false, sawFind = false;
      while (k < src.length) {
        const ch = src[k];
        // Comments first: they are prose, and prose carries apostrophes,
        // backticks and brackets that are not syntax. Skipping strings before
        // skipping comments turned `#294's` inside a comment into a phantom
        // string that swallowed the real find: below it, and the site was
        // silently not a plant any more.
        if (ch === '/' && src[k + 1] === '/') { const nl = src.indexOf('\n', k); k = nl < 0 ? src.length : nl + 1; continue; }
        if (ch === '/' && src[k + 1] === '*') { const end = src.indexOf('*/', k + 2); k = end < 0 ? src.length : end + 2; continue; }
        if (ch === "'" || ch === '"' || ch === '`') {
          // Skip strings at ANY depth: a brace inside a nested string would
          // corrupt the depth count.
          const skip = readString(src, k);
          if (skip) { k = skip.end + 1; continue; }
        }
        if (ch === '{' || ch === '[' || ch === '(') depth++;
        else if (ch === '}' || ch === ']' || ch === ')') { if (depth === 0) break; depth--; }
        else if (depth === 0 && src.startsWith('file:', k) && k !== m.index) break;
        else if (depth === 0 && src.startsWith('find:', k)) {
          sawFind = true;
          // The quote must IMMEDIATELY follow. Unanchored, `find: someVar`
          // matched the next property's quote and reported that property's
          // text as the find-string.
          const q = /^\s*(['"`])/.exec(src.slice(k + 5));
          if (q) abs = k + 5 + q[0].length - 1; else nonLiteral = true;
          break;
        }
        k++;
      }
      if (!sawFind) continue; // a file: with no find: beside it is not a plant site
      if (!fileStr || fileStr.interpolated) { unreadable.push({ tool, why: 'file: is a variable or expression — the target cannot be known statically' }); continue; }
      if (nonLiteral) { unreadable.push({ tool, why: 'find: is a variable or expression' }); continue; }
      if (abs < 0) { unreadable.push({ tool, why: 'find: literal could not be read' }); continue; }
      const findStr = readString(src, abs);
      if (!findStr) { unreadable.push({ tool, why: 'find: literal could not be read' }); continue; }
      if (findStr.interpolated) { unreadable.push({ tool, why: 'find: is an interpolated template' }); continue; }
      sites.push({ tool, target: fileStr.value, find: findStr.value });
    }
  }
  for (const s of sites) {
    s.id = createHash('sha256').update(`${s.tool}\0${s.target}\0${s.find}`).digest('hex').slice(0, 16);
    const targetPath = resolve(root, s.target);
    s.state = !existsSync(targetPath) ? 'missing-target'
      : readFileSync(targetPath, 'utf8').includes(s.find) ? 'resolves' : 'drifted';
  }
  return { sites, unreadable };
}

function unreadableCounts(unreadable) {
  const byTool = {};
  for (const u of unreadable) byTool[u.tool] = (byTool[u.tool] || 0) + 1;
  return byTool;
}

function main() {
  const args = process.argv.slice(2);
  const { sites, unreadable } = scanPlantSites();
  const bad = sites.filter((s) => s.state !== 'resolves');

  if (args.includes('--write-baseline')) {
    const baseline = {
      note: 'Known-drifted plant sites (the #498 backlog) and sites the static scan cannot read. plantsites.mjs --check fails on any difference from the live tree, in either direction — regenerate with --write-baseline only alongside the change that explains it.',
      drifted: bad.map(({ tool, target, id }) => ({ tool, target, id })).sort((a, b) => (a.tool + a.id).localeCompare(b.tool + b.id)),
      unreadable: unreadableCounts(unreadable),
    };
    writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n');
    console.log(`plantsites: baseline written — ${baseline.drifted.length} drifted site(s), ${unreadable.length} unreadable site(s) across ${Object.keys(baseline.unreadable).length} tool(s)`);
    return 0;
  }

  if (args.includes('--check')) {
    let baseline;
    try { baseline = JSON.parse(readFileSync(BASELINE, 'utf8')); }
    catch (e) { console.error(`plantsites: cannot read ${BASELINE}: ${e.message}`); return 1; }
    const errors = [];
    // Occurrence COUNTS per id, not membership. An id is a hash of
    // tool+target+find, and identical plants produce identical ids — the live
    // baseline carries two such pairs. A set collapsed them, so re-arming one
    // of a pair while its twin stayed drifted left both sides containing the
    // id and --check passed without the baseline update it promises; a new
    // drift identical to a baselined one was likewise absorbed as known.
    const knownCount = new Map();
    for (const d of baseline.drifted) knownCount.set(d.id, (knownCount.get(d.id) || 0) + 1);
    const liveCount = new Map();
    for (const s of bad) liveCount.set(s.id, (liveCount.get(s.id) || 0) + 1);
    for (const [id, n] of liveCount) {
      const k = knownCount.get(id) || 0;
      if (n > k) {
        const s = bad.find((x) => x.id === id);
        errors.push(`NEW ${s.state.toUpperCase()}: ${s.tool} -> ${s.target} (${n} site(s) live, ${k} in baseline)\n  find ${JSON.stringify(s.find.slice(0, 100))}\n  The file no longer contains this plant's find-string, so the plant patches nothing and the check it proves can no longer be shown to fail. Fix the plant (and its paired assertion) to match the refactored source.`);
      }
    }
    for (const [id, k] of knownCount) {
      const n = liveCount.get(id) || 0;
      if (k > n) {
        const d = baseline.drifted.find((x) => x.id === id);
        errors.push(`STALE BASELINE: ${d.tool} -> ${d.target} (${d.id}: ${k} in baseline, ${n} still drifted).\n  Good — but the baseline must say so, or the freed slack hides the next regression. Re-run with --write-baseline in the same change.`);
      }
    }
    const liveCounts = unreadableCounts(unreadable);
    const baseCounts = baseline.unreadable || {};
    for (const tool of new Set([...Object.keys(liveCounts), ...Object.keys(baseCounts)])) {
      const a = liveCounts[tool] || 0, b = baseCounts[tool] || 0;
      if (a !== b) errors.push(`UNREADABLE COUNT CHANGED: ${tool} has ${a} site(s) this scan cannot read; the baseline says ${b}. A site the scanner cannot read is a site nothing watches — prefer a literal find-string, or record the new count with --write-baseline and say why.`);
    }
    if (errors.length) {
      for (const e of errors) console.error(e + '\n');
      console.error(`plantsites: FAIL — ${errors.length} difference(s) from baseline (${sites.length} sites scanned, ${bad.length} drifted, ${unreadable.length} unreadable)`);
      return 1;
    }
    console.log(`plantsites: OK — ${sites.length} sites scanned, ${bad.length} known-drifted (all in baseline), ${unreadable.length} unreadable (counts match baseline)`);
    return 0;
  }

  for (const s of bad) console.log(`${s.state.toUpperCase()}  ${s.tool}\n  target ${s.target}\n  find   ${JSON.stringify(s.find.slice(0, 110))}\n  id     ${s.id}`);
  const byTool = {};
  for (const s of bad) byTool[s.tool] = (byTool[s.tool] || 0) + 1;
  if (bad.length) { console.log('\nper tool:'); for (const [t, n] of Object.entries(byTool).sort((x, y) => y[1] - x[1])) console.log(`  ${String(n).padStart(3)}  ${t}`); }
  console.log(`\nplantsites: ${sites.length} sites — ${sites.length - bad.length} resolve, ${bad.length} drifted/missing, ${unreadable.length} unreadable`);
  if (unreadable.length) { console.log('unreadable (reported, never silently skipped):'); for (const u of unreadable) console.log(`  ${u.tool} — ${u.why}`); }
  return 0;
}

process.exit(main());
