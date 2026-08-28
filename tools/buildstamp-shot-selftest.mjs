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

import { cpSync, mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, win32 } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { run } from './buildstamp-shot.mjs';
import { INPUT_ROOTS, BUILD_IDENTITY_FILES } from './buildversion.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const COPY = [...INPUT_ROOTS, 'buildordinal.json', ...BUILD_IDENTITY_FILES];

const css = (root, text) => appendFileSync(resolve(root, 'styles/ui.css'), `\n${text}\n`, 'utf8');
const edit = (root, rel, fn) => {
  const p = resolve(root, rel);
  writeFileSync(p, fn(readFileSync(p, 'utf8')), 'utf8');
};

const OWNER_PLACEMENT = '          ${buildStampHtml(place)}';
const COMBAT_REMOVAL = "          ${place === 'combat' ? '' : buildStampHtml(place)}";

function sourceFindingsFrom(owner, combat) {
  const findings = [];
  if (!/^import \{ buildStampHtml \} from '\.\/buildstamp\.js';$/m.test(owner)
      || !owner.split(/\r?\n/).includes(OWNER_PLACEMENT)) {
    findings.push('owner-placement: hudmeta does not unconditionally emit buildStampHtml(place)');
  }
  if (!/^import \{ hudShellHtml \} from '\.\.\/components\/hudmeta\.js';$/m.test(combat)
      || !/\$\{hudShellHtml\(\{/.test(combat)) {
    findings.push('combat-consumer: combat does not import and mount hudShellHtml');
  }
  return findings;
}

function sourceFindings(root) {
  return sourceFindingsFrom(
    readFileSync(resolve(root, 'src/ui/components/hudmeta.js'), 'utf8'),
    readFileSync(resolve(root, 'src/ui/screens/combat.js'), 'utf8'),
  );
}

export function sourceSelftest() {
  const owner = readFileSync(resolve(REPO_ROOT, 'src/ui/components/hudmeta.js'), 'utf8');
  const combat = readFileSync(resolve(REPO_ROOT, 'src/ui/screens/combat.js'), 'utf8');
  const cases = [
    ['clean shared owner + combat consumer', [], owner, combat],
    ['combat-visible placement removed at shared owner', ['owner-placement'], owner.replace(OWNER_PLACEMENT, COMBAT_REMOVAL), combat],
    ['combat stops mounting the shared owner', ['combat-consumer'], owner, combat.replace("import { hudShellHtml } from '../components/hudmeta.js';", '')],
  ];
  let failures = 0;
  for (const [name, expected, ownerText, combatText] of cases) {
    const findings = sourceFindingsFrom(ownerText, combatText);
    const exact = findings.length === expected.length && expected.every((code) => findings.some((finding) => finding.startsWith(code)));
    if (!exact) {
      failures++;
      console.log(`  FAIL ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(findings)}`);
    } else console.log(`  ${expected.length ? 'RED ' : 'PASS'} ${name}${findings.length ? ` — ${findings.join('; ')}` : ''}`);
  }
  console.log(failures
    ? `buildstamp-shot --source-selftest: RED — ${failures}/${cases.length} cases failed`
    : `buildstamp-shot --source-selftest: OK — ${cases.length}/${cases.length} clean/plant cases discriminated`);
  return failures ? 1 : 0;
}

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
    expect: /combat @ .*: no \[data-role/i,
    expectSource: 'owner-placement',
    plant: (root) => edit(root, 'src/ui/components/hudmeta.js', (t) => t.replace(OWNER_PLACEMENT, COMBAT_REMOVAL)),
  },
  {
    name: 'the stamp TYPES a version instead of deriving one',
    expect: /reads "BUILD 9\.9\.9/i,
    plant: (root) => edit(root, 'src/ui/components/buildstamp.js',
      (t) => t.replace('${esc(BUILD_STAMP_TEXT)}', 'BUILD 9.9.9+deadbeef01')),
  },
];

function fresh({ omit = new Set() } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'buildstamp-known-bad-'));
  for (const c of COPY) {
    if (omit.has(c)) continue;
    const dest = resolve(dir, c);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(resolve(REPO_ROOT, c), dest, { recursive: true });
  }
  return dir;
}

export async function selftest() {
  console.log('buildstamp-shot --selftest: real edits to a real tree, served and rendered, run as a whole program.');
  console.log('');
  let failures = 0;
  const outDir = mkdtempSync(join(tmpdir(), 'buildstamp-shots-'));

  // The retired conversion fails two ways on Windows: it prefixes the drive
  // with the current drive and leaves URL escapes encoded. Prove the platform
  // API resolves both before relying on REPO_ROOT for any fixture copy.
  {
    const samplePath = 'C:\\repo with space\\tools\\fixture.mjs';
    const sampleUrl = pathToFileURL(samplePath, { windows: true });
    const expected = win32.dirname(samplePath);
    const canonical = win32.dirname(fileURLToPath(sampleUrl, { windows: true }));
    const handRolled = win32.resolve(new URL('.', sampleUrl).pathname);
    if (canonical !== expected || handRolled === expected) {
      console.log(`  FAIL  [Windows path] canonical=${canonical} retired=${handRolled} expected=${expected}`);
      return 1;
    }
    console.log(`  RED   [Windows path] caught — retired conversion resolves ${handRolled}; platform API resolves ${canonical}`);
  }

  // The fixture list must remain joined to the production identity authority.
  // Omitting one of those inputs must fail through run(), before a browser can
  // paint a plausible stamp from an incomplete source identity.
  {
    const missing = BUILD_IDENTITY_FILES[0];
    const root = fresh({ omit: new Set([missing]) });
    try {
      let caught = null;
      try {
        await run({ root, out: outDir, quiet: true });
      } catch (error) {
        caught = error;
      }
      const detail = String(caught?.message || caught || 'no error');
      if (!caught || !detail.includes(`build identity input is missing: ${missing}`)) {
        console.log(`  FAIL  [fixture omission] missing ${missing} did not fail by name — ${detail}`);
        return 1;
      }
      console.log(`  RED   [fixture omission] caught — missing ${missing} fails by name`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

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
      if (p.expectSource) {
        const sourceHit = sourceFindings(root).find((finding) => finding.startsWith(p.expectSource));
        if (!sourceHit) {
          failures += 1;
          console.log(`  FAIL  SOURCE NOT ARMED — ${p.name}`);
          console.log(`          expected source discriminator ${p.expectSource}`);
          continue;
        }
        console.log(`  RED   [source] armed — ${sourceHit}`);
      }
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

  // A final clean copy proves the omission control and six plants never leak a
  // mutation into the fixture source or leave the instrument permanently red.
  {
    const root = fresh();
    try {
      const { misses, rows } = await run({ root, out: outDir, quiet: true });
      if (misses.length) {
        failures += 1;
        console.log('  FAIL  [final clean] the untouched copy is RED after the plants:');
        for (const m of misses) console.log(`          ${m}`);
      } else {
        console.log(`  ok    [final clean] the untouched copy photographs ${rows.length}/${rows.length} placements with ink`);
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
  // #12: counted claim, terminated; the sentence about naming goes below.
  console.log(`buildstamp-shot --selftest: OK — ${PLANTS.length}/${PLANTS.length} plants observed red`);
  console.log('  each named by the failure it should have caught.');
  console.log('  produce, planted as real stylesheet and module edits in a real served tree.');
  console.log('');
  console.log('BOUNDARY: four of these six are invisible to any DOM-presence predicate, which is the');
  console.log('  point of the corpus. It still proves only that THESE routes cannot pass — a seventh');
  console.log('  way to lose the ink is not covered by having thought of six.');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  process.exit(process.argv.includes('--source-selftest') ? sourceSelftest() : await selftest());
}
