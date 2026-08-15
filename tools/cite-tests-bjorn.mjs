#!/usr/bin/env node
// Bjorn's citation probe: does every test this tree CITES actually exist?
//
// Written for the gate on saga/the-far-end-of-28c. It is deliberately NOT her
// probe: she did not land hers, and a gate that runs the author's instrument
// measures the author's blind spots too.
//
// TWO DOORS. This suite declares a numbered test in two places and a resolver
// that knows one of them reports false reds:
//   door 1  tests/engine.test.js   test('NN. …')
//   door 2  tests/run-node.mjs     PASS/FAIL line literals  `… 'PASS' : 'FAIL'}  NN. …`
// The resolver reads both, and prints its boundary so the next reader can see
// which doors it knew about.
//
// SCOPE is an argument, not a constant — my last sweep scoped src/ and tools/
// and was right for its question, and the same question asked of the shipped
// artifacts has a different answer. Default scope is everything that ships.
//
// exit 0 = green, 1 = unresolvable citation(s), 2 = unknown (could not read a door)

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCOPE = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const scopes = SCOPE.length ? SCOPE : ['src', 'tools', 'tests', 'build', 'dist'];

// ---- the two doors -------------------------------------------------------
const doors = [];
const declared = new Map(); // id -> [{door, blurb}]
const addDoor = (name, file, re, idIdx, blurbIdx) => {
  if (!fs.existsSync(path.join(ROOT, file))) {
    console.error(`UNKNOWN: declaration door '${name}' missing at ${file}`);
    process.exit(2);
  }
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  let n = 0;
  for (const m of text.matchAll(re)) {
    n += 1;
    const id = m[idIdx];
    if (!declared.has(id)) declared.set(id, []);
    declared.get(id).push({ door: name, blurb: (m[blurbIdx] || '').trim().slice(0, 48) });
  }
  doors.push({ name, file, count: n });
};
addDoor('engine.test.js  test(\'NN. …\')', 'tests/engine.test.js',
  /test\(['"]([0-9][0-9a-z]*)\.\s+([^'"]{0,60})/g, 1, 2);
addDoor('run-node.mjs    PASS/FAIL literal', 'tests/run-node.mjs',
  /(?:PASS|FAIL)['"]\}\s+([0-9][0-9a-z]*)\.\s+([^`'"]{0,60})/g, 1, 2);

// ---- the citations -------------------------------------------------------
// A citation is a prose reference to a numbered test. Both the wordy form and
// the bare backticked id, because the sentence this gate exists for used one
// and the fix that corrects it uses the other.
// The bare-backticked door needs a guard: `44px`, `1fr`, `13px` and a short SHA
// are all id-shaped and none of them is a test. The discriminator that costs
// nothing and reads honestly is that a TEST citation says the word "test" on
// its own line. Without it this probe reported 11 false reds on its first run
// — my own item 1, inside two minutes. (Bjorn, 2026-08-15.)
const CITE = /(?:(?:engine\s+|suite\s+)?tests?\s+`?([0-9][0-9a-z]*)`?)|(?:`([0-9]{1,2}[a-z][0-9a-z]*)`)/gi;
const UNIT = /^\d+(px|fr|rem|em|vh|vw|ch|pt|deg|ms|s|x)$/i;
const looksLikeTestId = (id, line) => !UNIT.test(id)
  && !(id.length >= 7 && /^[0-9a-f]+$/i.test(id))
  && /\btests?\b/i.test(line);
// A mention is DELIBERATE when the same line says the name is not real.
const EXEMPT = /(has never existed|never existed|no test of that name|returns nothing|does not exist)/i;

const EXT = new Set(['.js', '.mjs', '.html', '.md', '.json', '.css']);
const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXT.has(path.extname(e.name))) out.push(p);
  }
  return out;
};
const files = scopes.flatMap((s) => {
  const p = path.join(ROOT, s);
  return fs.statSync(p).isDirectory() ? walk(p) : [p];
});

const hits = [];
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.length > 400) return; // an inlined base64 asset is not prose
    for (const m of line.matchAll(CITE)) {
      const id = m[1] || m[2];
      if (!id) continue;
      if (!looksLikeTestId(id, line)) continue;
      hits.push({
        file: path.relative(ROOT, f), line: i + 1, id, token: m[0].trim(),
        resolved: declared.has(id), exempt: EXEMPT.test(line),
        ambiguous: (declared.get(id) || []).length > 1,
        text: line.trim().slice(0, 90),
      });
    }
  });
}

// ---- report --------------------------------------------------------------
console.log('BOUNDARY');
for (const d of doors) console.log(`  door: ${d.name.padEnd(34)} ${d.count} declaration(s)  (${d.file})`);
console.log(`  ids declared: ${declared.size}`);
console.log(`  scope: ${scopes.join(' ')} — ${files.length} file(s) read`);
console.log(`  citations found: ${hits.length}`);
console.log('');

const ambiguous = [...declared.entries()].filter(([, v]) => v.length > 1);
if (ambiguous.length) {
  console.log('AMBIGUOUS IDS — declared by more than one door, so a citation of this number identifies nothing:');
  for (const [id, v] of ambiguous) for (const d of v) console.log(`  ${id}.  ${d.door}  "${d.blurb}"`);
  console.log('');
}

const bad = hits.filter((h) => !h.resolved && !h.exempt);
const exempted = hits.filter((h) => !h.resolved && h.exempt);
const citedAmbig = hits.filter((h) => h.ambiguous);

if (exempted.length) {
  console.log(`DELIBERATE MENTIONS EXEMPTED (${exempted.length}) — the line itself says the name is not real:`);
  for (const h of exempted) console.log(`  ${h.file}:${h.line}  '${h.token}'  ${h.text}`);
  console.log('');
}
if (citedAmbig.length) {
  console.log(`CITATIONS OF AN AMBIGUOUS ID (${citedAmbig.length}):`);
  for (const h of citedAmbig) console.log(`  ${h.file}:${h.line}  '${h.token}'  ${h.text}`);
  console.log('');
}
if (bad.length) {
  console.log(`UNRESOLVABLE (${bad.length}):`);
  for (const h of bad) console.log(`  ${h.file}:${h.line}  cites '${h.id}' — no such test in either door`);
  for (const h of bad) console.log(`     ${h.file}:${h.line}  ${h.text}`);
  console.log('');
  console.log(`RED — ${bad.length} unresolvable citation(s).`);
  process.exit(1);
}
console.log(`GREEN — 0 unresolvable, ${exempted.length} deliberate mention(s) exempted.`);
process.exit(0);
