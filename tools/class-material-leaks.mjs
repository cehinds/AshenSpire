#!/usr/bin/env node
// tools/class-material-leaks.mjs — catch cross-class material leaks statically.
//
// THE BUG THIS EXISTS FOR, twice now.
//
// equipment-blender.py repaints a class's body materials in place, then renders,
// then moves to the next class. CLASS_BODY_MATS may therefore only name
// materials UNIQUE to one class: if a builder paints geometry with a material
// some OTHER class repaints, that geometry silently inherits the last set's
// colours, because the classes share one Blender session.
//
// It shipped once already — the comment above CLASS_BODY_MATS records eight of
// twelve armour sets rendering pixel-identical to their class default at dE 0.0,
// because repaint() named materials only the reaver's builder used.
//
// It very nearly shipped again in this same change: build_rogue was written
// borrowing HOOD_DARK and CLOTH_DARK from the herald, which herald repaints and
// which renders first. Every rogue equipment body would have worn the last
// herald armour set's colours on its cowl.
//
// Neither is visible to py_compile, to an import, or to any test that does not
// actually render. It is visible here, in a second, from the source alone.
//
// Usage: node tools/class-material-leaks.mjs     (exit 1 on any leak)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = readFileSync(join(root, 'tools', 'sprites-blender.py'), 'utf8');
const eq = readFileSync(join(root, 'tools', 'equipment-blender.py'), 'utf8');

const CONST = /\b([A-Z][A-Z_0-9]{2,})\b/g;

// Materials each builder paints geometry with.
function buildersOf(src) {
  const out = new Map();
  const re = /^def (build_\w+)\(\):\n([\s\S]*?)(?=\n^def |\n^# ---- )/gm;
  for (const m of src.matchAll(re)) {
    out.set(m[1], new Set(m[2].match(CONST) || []));
  }
  return out;
}

// Materials each class repaints, and which builder each class renders with.
function repaintsOf(src) {
  const block = src.match(/CLASS_BODY_MATS = \{([\s\S]*?)\n\}/);
  if (!block) throw new Error('CLASS_BODY_MATS not found in equipment-blender.py');
  const out = new Map();
  for (const m of block[1].matchAll(/"(\w+)":\s*\{([^}]*)\}/g)) {
    out.set(m[1], new Set([...m[2].matchAll(/"([A-Z][A-Z_0-9]+)"/g)].map((x) => x[1])));
  }
  return out;
}

const builders = buildersOf(lib);
const repaints = repaintsOf(eq);
const classBuild = new Map([...eq.matchAll(/"(\w+)":\s*lib\["(\w+)"\]/g)].map((m) => [m[1], m[2]]));

const leaks = [];
const missing = [];
for (const [cls, builder] of classBuild) {
  if (!builders.has(builder)) { missing.push(`${cls} -> ${builder} (no such builder)`); continue; }
  const used = builders.get(builder);
  for (const [other, mats] of repaints) {
    if (other === cls) continue;
    for (const mat of mats) {
      if (used.has(mat)) leaks.push({ cls, builder, mat, other });
    }
  }
}

// Every material a class repaints must also exist as a module-level material.
for (const [cls, mats] of repaints) {
  for (const mat of mats) {
    if (!lib.includes(`${mat} = make_mat`)) missing.push(`${cls} repaints ${mat}, which is not defined`);
  }
}

for (const [cls, builder] of classBuild) {
  console.log(`${cls.padEnd(9)} ${builder.padEnd(16)} repaints ${[...(repaints.get(cls) || [])].sort().join(', ') || '(none)'}`);
}

if (missing.length) {
  console.log('\nUNRESOLVED:');
  for (const m of missing) console.log(`  ${m}`);
}
if (leaks.length) {
  console.log('\nLEAKS:');
  for (const l of leaks) {
    console.log(`  ${l.cls} paints geometry with ${l.mat}, which '${l.other}' repaints`);
    console.log(`    -> give ${l.cls} its own material; they share one Blender session`);
  }
}

const bad = leaks.length + missing.length;
console.log(`\n${bad === 0 ? 'NO LEAKS: every builder owns the materials its class repaints.' : `${bad} problem(s).`}`);
process.exit(bad === 0 ? 0 : 1);
