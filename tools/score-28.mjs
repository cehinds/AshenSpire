#!/usr/bin/env node
// Bjorn's independent scorer for the balance.js:491 citation.
//
// The sentence at src/content/balance.js makes FOUR claims about the test it
// cites. This scores every test in tests/engine.test.js against those four,
// mechanically, and prints the evidence for each point. It does not read
// Saga's scoring and does not know which test is supposed to win.
//
//   C1  declares the fourth cell: an object literal with base:'category' AND gear:true
//   C2  prices all four cells of the base x gear product (4 distinct pairs constructed)
//   C3  claims the fourth is ONE ROW of data and needs NO CODE
//   C4  names Law 0 (the sentence says "Law 0's falsifier")
//
// Usage: node tools/score-28.mjs [path-to-test-file]
// Exit 0 always; this prints, it does not gate. The gate is the caller reading it.

import fs from 'node:fs';

const FILE = process.argv[2] || 'tests/engine.test.js';
const src = fs.readFileSync(FILE, 'utf8');
const lines = src.split('\n');

// ---- split into test blocks --------------------------------------------
// A declaration is `  test('ID. ` or `  test("ID. ` at any indent. The block
// runs to the line before the next declaration (last one runs to EOF).
const DECL = /^\s*test\((['"])([0-9][0-9a-z]*)\.\s/;
const decls = [];
lines.forEach((l, i) => {
  const m = DECL.exec(l);
  if (m) decls.push({ id: m[2], line: i + 1, start: i });
});
const blocks = decls.map((d, k) => ({
  ...d,
  end: k + 1 < decls.length ? decls[k + 1].start : lines.length,
}));
blocks.forEach((b) => { b.text = lines.slice(b.start, b.end).join('\n'); });

// ---- C1: the fourth cell, declared as one object literal ----------------
// Both field orders. Bounded by `}` so the two fields must share a literal.
const C1_A = /base:\s*'category'[^{}]*gear:\s*true/;
const C1_B = /gear:\s*true[^{}]*base:\s*'category'/;
const c1 = (t) => {
  const m = C1_A.exec(t) || C1_B.exec(t);
  return m ? { ok: true, why: m[0].replace(/\s+/g, ' ').slice(0, 70) } : { ok: false, why: '' };
};

// ---- C2: all four cells of the base x gear product ----------------------
// Pairs are constructed two ways in this file: as object literals
// `{ ... base: 'X', gear: B ... }` and as array pairs `['X', B]` fed to a
// `.map(([base, gear]) => ...)`. Collect both, count DISTINCT pairs.
//
// PER SITE, not pooled. Pooling across the block let a known-bad through: with
// one cell deleted from the enumeration, the separate fourth-cell DECLARATION
// topped the union back up to four and the check stayed green. A declaration is
// not a pricing. So each construction site is counted on its own and the block
// scores on its best site. (Bjorn, known-bad D, 2026-08-15.)
const pairsOf = (t) => {
  const sites = [];
  // site 1: the enumerated pair list feeding `.map(([base, gear]) => ...)`.
  if (/\.map\(\(\[\s*base\s*,\s*gear\s*\]/.test(t)) {
    const s = new Set(); const ev = [];
    for (const m of t.matchAll(/\[\s*'(\w+)'\s*,\s*(true|false)\s*\]/g)) { s.add(`${m[1]}/${m[2]}`); ev.push(m[0]); }
    sites.push({ name: 'enumerated pair list', set: s, ev });
  }
  // site 2: object literals naming both fields.
  {
    const s = new Set(); const ev = [];
    for (const m of t.matchAll(/base:\s*'(\w+)'\s*,\s*gear:\s*(true|false)/g)) { s.add(`${m[1]}/${m[2]}`); ev.push(m[0].replace(/\s+/g, ' ')); }
    for (const m of t.matchAll(/gear:\s*(true|false)\s*,\s*base:\s*'(\w+)'/g)) { s.add(`${m[2]}/${m[1]}`); ev.push(m[0].replace(/\s+/g, ' ')); }
    if (s.size) sites.push({ name: 'object literals', set: s, ev });
  }
  return sites;
};
const c2 = (t) => {
  const sites = pairsOf(t);
  // "PRICES all four" — the block must actually put a price on them.
  const prices = /swapCostFor\s*\(/.test(t);
  const best = sites.reduce((a, s) => (s.set.size > (a ? a.set.size : 0) ? s : a), null);
  const n = best ? best.set.size : 0;
  return {
    ok: n >= 4 && prices,
    why: `${sites.length ? sites.map((s) => `${s.name}=${s.set.size} [${[...s.set].sort().join(' ')}]`).join('; ') : 'no site'}` +
      `; swapCostFor:${prices ? 'yes' : 'NO'}`,
  };
};

// ---- C3: one row of data, no code ---------------------------------------
const NOCODE = /(zero code|no code|needs no code|zero engine changes|no engine changes|without (?:any )?code)/i;
const ROW = /\b(one row|a row|row of|one (?:fictional )?entry|csv row|row's worth)\b/i;
const c3 = (t) => {
  const a = NOCODE.exec(t); const b = ROW.exec(t);
  return { ok: !!(a && b), why: a && b ? `'${a[0]}' + '${b[0]}'` : `${a ? "'" + a[0] + "'" : 'no-code:NONE'} / ${b ? "'" + b[0] + "'" : 'row:NONE'}` };
};

// ---- C4: Law 0 ----------------------------------------------------------
const c4 = (t) => {
  const m = /Law 0/.exec(t);
  const other = [...t.matchAll(/Law \d+/g)].map((x) => x[0]);
  return { ok: !!m, why: m ? 'Law 0' : (other.length ? `names ${[...new Set(other)].join(',')} — NOT Law 0` : 'no law named') };
};

// ---- score ---------------------------------------------------------------
const rows = blocks.map((b) => {
  const r = { id: b.id, line: b.line, C1: c1(b.text), C2: c2(b.text), C3: c3(b.text), C4: c4(b.text) };
  r.score = ['C1', 'C2', 'C3', 'C4'].filter((k) => r[k].ok).length;
  return r;
});

console.log(`file: ${FILE}`);
console.log(`BOUNDARY: ${blocks.length} test block(s), lines ${blocks[0].line}..${lines.length}, ${src.length} bytes.`);
console.log(`ids: ${rows.map((r) => r.id).join(' ')}`);
console.log('');
const scored = rows.filter((r) => r.score > 0).sort((a, b) => b.score - a.score || a.line - b.line);
console.log('EVERY TEST SCORING > 0:');
for (const r of scored) {
  console.log(`  ${r.score}/4  ${r.id.padEnd(5)} L${String(r.line).padStart(4)}  ` +
    `C1:${r.C1.ok ? 'Y' : 'n'} C2:${r.C2.ok ? 'Y' : 'n'} C3:${r.C3.ok ? 'Y' : 'n'} C4:${r.C4.ok ? 'Y' : 'n'}`);
}
console.log(`  (${rows.length - scored.length} test(s) scored 0/4)`);
console.log('');
const winners = rows.filter((r) => r.score === 4);
console.log(`WINNERS (4/4): ${winners.length === 0 ? 'NONE' : winners.map((r) => r.id).join(', ')}`);
console.log(`UNIQUE: ${winners.length === 1 ? 'YES — ' + winners[0].id : 'NO (' + winners.length + ' selected)'}`);
console.log('');
console.log('EVIDENCE FOR THE 28-FAMILY AND EVERY 3/4-OR-BETTER:');
const interesting = rows.filter((r) => /^28/.test(r.id) || r.score >= 3);
for (const r of interesting) {
  console.log(`  ${r.id} (L${r.line}) ${r.score}/4`);
  console.log(`     C1 ${r.C1.ok ? 'YES' : 'no '} ${r.C1.why || '(no {base:category,gear:true} literal)'}`);
  console.log(`     C2 ${r.C2.ok ? 'YES' : 'no '} ${r.C2.why}`);
  console.log(`     C3 ${r.C3.ok ? 'YES' : 'no '} ${r.C3.why}`);
  console.log(`     C4 ${r.C4.ok ? 'YES' : 'no '} ${r.C4.why}`);
}
