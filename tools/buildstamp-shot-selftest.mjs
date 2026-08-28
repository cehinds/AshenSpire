// tools/buildstamp-shot-selftest.mjs — the known-bad corpus for the INK gate.
//
// A fresh instrument's first green is worth nothing (development.md's base
// rate: eleven instruments ran dead in one session and every one printed a
// plausible number). tools/buildstamp-shot.mjs is a fresh instrument. Until
// this file ran it was `unknown`, not green.
//
// ── THE DOOR ────────────────────────────────────────────────────────────────
//
// Every plant is a REAL EDIT to a real stylesheet or a real screen module, in a
// real tree, which is then SERVED and rendered in a real browser and driven by
// the whole program. Nothing is handed to a predicate: the defect enters where
// a defect of its class actually enters — a hand editing styles/ui.css — and
// travels the server, the module graph, the layout and the compositor before
// anything is asserted.
//
// ── WHY THESE SIX ───────────────────────────────────────────────────────────
//
// Four of them are Vira's list from 2026-08-15, the CSS routes that leave an
// element in the DOM and take its ink away. They are here BECAUSE a presence
// check passes all of them: `opacity: 0` and a stamp painted in the panel's own
// colour are invisible to every DOM predicate that could be written, and they
// are the two most ordinary ways this feature dies quietly. If the two crops
// were ever compared with the tolerance turned off, or the freeze forgotten,
// these are the plants that go green and tell us.
//
// The other two are the coarse failures — the placement deleted, and the stamp
// printing something it typed itself instead of what the tree derives.
//
// Usage:  node tools/buildstamp-shot.mjs --selftest

import { cpSync, mkdtempSync, rmSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { run } from './buildstamp-shot.mjs';

const HERE = resolve(new URL('.', import.meta.url).pathname);
const REPO_ROOT = resolve(HERE, '..');
const COPY = ['index.html', 'styles', 'src', 'assets', 'buildordinal.json'];

const css = (root, text) => appendFileSync(resolve(root, 'styles/ui.css'), `\n${text}\n`, 'utf8');
const edit = (root, rel, fn) => {
  const p = resolve(root, rel);
  writeFileSync(p, fn(readFileSync(p, 'utf8')), 'utf8');
};

const PLANTS = [
  {
    name: 'opacity: 0 — in the DOM, in the viewport, in the layout, and NOT ON THE SCREEN',
    expect: /LETTERS ARE NOT/i,
    plant: (root) => css(root, '.build-stamp { opacity: 0; }'),
  },
  {
    // MY FIRST VERSION OF THIS PLANT WAS WRONG AND THE CORPUS SAID SO, which is
    // the corpus doing its job on its author. It set `color: var(--panel)` and
    // called that "painted in the background" — but the title screen's ground
    // is `--bg`, not `--panel`, so the stamp stayed perfectly visible and the
    // gate was RIGHT to see ink. The plant had not reproduced the defect. A
    // known-bad that is not bad is the same lie as a check that cannot fail,
    // pointed the other way, so it is written down rather than quietly fixed.
    // The honest form makes the glyphs and their own box one colour, which is
    // invisible whatever is behind it.
    name: 'the glyphs painted in their own background — one colour, no ink',
    expect: /LETTERS ARE NOT/i,
    plant: (root) => css(root, '.build-stamp { color: var(--bg); background: var(--bg); }'),
  },
  {
    name: 'display: none at the narrow layout — an ordinary mobile edit',
    expect: /box is 0x0|outside the|no \[data-role/i,
    plant: (root) => css(root, "@media all { :root[data-layout='narrow'] .build-stamp { display: none; } }"),
  },
  {
    name: 'parked off-screen at left: -9999px',
    expect: /outside the/i,
    plant: (root) => css(root, '.build-stamp { position: absolute; left: -9999px; }'),
  },
  {
    name: 'the combat placement deleted outright',
    expect: /no \[data-role/i,
    plant: (root) => edit(root, 'src/ui/screens/combat.js', (t) => t.replace(/^.*buildStampHtml.*$/gm, '')),
  },
  {
    name: 'the stamp TYPES a version instead of deriving one',
    expect: /reads "BUILD 9\.9\.9/i,
    plant: (root) => edit(root, 'src/ui/components/buildstamp.js',
      (t) => t.replace('${esc(BUILD_STAMP_TEXT)}', 'BUILD 9.9.9+deadbeef01')),
  },
];

function fresh() {
  const dir = mkdtempSync(join(tmpdir(), 'buildstamp-known-bad-'));
  for (const c of COPY) cpSync(resolve(REPO_ROOT, c), resolve(dir, c), { recursive: true });
  return dir;
}

export async function selftest() {
  console.log('buildstamp-shot --selftest: real edits to a real tree, served and rendered, run as a whole program.');
  console.log('');
  let failures = 0;
  const outDir = mkdtempSync(join(tmpdir(), 'buildstamp-shots-'));

  // The negative control. A gate that is red anyway catches everything below
  // and means nothing.
  {
    const root = fresh();
    try {
      const { misses, rows } = await run({ root, out: outDir, quiet: true });
      if (misses.length) {
        console.log('  FAIL  [control] the untouched copy is already RED — nothing below could mean anything:');
        for (const m of misses) console.log(`          ${m}`);
        return 1;
      }
      console.log(`  ok    [control] the untouched copy photographs ${rows.length}/${rows.length} placements with ink`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  for (const p of PLANTS) {
    const root = fresh();
    try {
      p.plant(root);
      const { misses } = await run({ root, out: outDir, quiet: true });
      const hit = misses.find((m) => p.expect.test(m));
      if (!hit) {
        failures += 1;
        console.log(`  FAIL  NOT CAUGHT — ${p.name}`);
        console.log(`          ${misses.length ? `red, but for the wrong reason: ${misses[0]}` : 'the gate stayed GREEN on a tree that carries this defect'}`);
      } else {
        console.log(`  RED   caught — ${p.name}`);
        console.log(`          ${hit.slice(0, 150)}`);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  rmSync(outDir, { recursive: true, force: true });
  console.log('');
  if (failures) {
    console.log(`buildstamp-shot --selftest: RED — ${failures} of ${PLANTS.length} known-bads walked through the gate.`);
    return 1;
  }
  console.log(`buildstamp-shot --selftest: OK — ${PLANTS.length}/${PLANTS.length} observed red, each named by the failure it should`);
  console.log('  produce, planted as real stylesheet and module edits in a real served tree.');
  console.log('');
  console.log('BOUNDARY: four of these six are invisible to any DOM-presence predicate, which is the');
  console.log('  point of the corpus. It still proves only that THESE routes cannot pass — a seventh');
  console.log('  way to lose the ink is not covered by having thought of six.');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  process.exit(await selftest());
}
