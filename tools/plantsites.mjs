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
    const re = /\bfile:\s*(['"`])/g;
    let m;
    while ((m = re.exec(src))) {
      const fileStr = readString(src, m.index + m[0].length - 1);
      if (!fileStr || fileStr.interpolated) { unreadable.push({ tool, why: 'file: is not a plain string literal' }); continue; }
      // `find:` must sit in the SAME object literal as `file:`. Pairing by
      // nearest match crossed object boundaries and reported JS strings as
      // drifted against .css targets, so this walks brace depth instead and
      // stops at the `}` closing this object or at the next `file:`.
      let depth = 0, k = fileStr.end + 1, abs = -1, nonLiteral = false;
      while (k < src.length) {
        const ch = src[k];
        if (ch === '{' || ch === '[' || ch === '(') depth++;
        else if (ch === '}' || ch === ']' || ch === ')') { if (depth === 0) break; depth--; }
        else if (depth === 0 && (ch === "'" || ch === '"' || ch === '`')) {
          const skip = readString(src, k);
          if (skip) { k = skip.end + 1; continue; }
        } else if (depth === 0 && src.startsWith('file:', k)) break;
        else if (depth === 0 && src.startsWith('find:', k)) {
          // The quote must IMMEDIATELY follow. Unanchored, `find: someVar`
          // matched the next property's quote and reported that property's
          // text as the find-string.
          const q = /^\s*(['"`])/.exec(src.slice(k + 5));
          if (q) abs = k + 5 + q[0].length - 1; else nonLiteral = true;
          break;
        }
        k++;
      }
      if (nonLiteral) { unreadable.push({ tool, why: 'find: is a variable or expression' }); continue; }
      if (abs < 0) continue; // a bare file: with no find: is not a plant site
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
    const known = new Set(baseline.drifted.map((d) => d.id));
    const live = new Map(bad.map((s) => [s.id, s]));
    for (const s of bad) {
      if (!known.has(s.id)) {
        errors.push(`NEW ${s.state.toUpperCase()}: ${s.tool} -> ${s.target}\n  find ${JSON.stringify(s.find.slice(0, 100))}\n  The file no longer contains this plant's find-string, so the plant patches nothing and the check it proves can no longer be shown to fail. Fix the plant (and its paired assertion) to match the refactored source.`);
      }
    }
    for (const d of baseline.drifted) {
      if (!live.has(d.id)) {
        errors.push(`STALE BASELINE: ${d.tool} -> ${d.target} (${d.id}) no longer scans as drifted.\n  Good — but the baseline must say so, or the freed slack hides the next regression. Re-run with --write-baseline in the same change.`);
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
