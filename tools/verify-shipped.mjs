#!/usr/bin/env node
// tools/verify-shipped.mjs — verify the file a PLAYER is handed, not the file the
// bundler just wrote.
//
// WHY THIS EXISTS — the guard that could not see the shipped artifact
// -----------------------------------------------------------------
// tools/bundle.mjs already names this bug in prose ("the art-less-build bug",
// around :141-152) and prints a guard for it:
//
//     if (mapEntries === 0) console.log('  WARNING: no art inlined — …');
//
// Two defects in one line. It reads `mapEntries`, a variable in its own process,
// about the build it is in the middle of writing — so it is structurally
// incapable of seeing the player-facing copies, which the README hands to a player. And it
// is a console.log: bundle.mjs exits 0 either way, so nothing is gated on it.
// At 40c5b21 the guard was green on every run while dist/AshenSpire.html had
// `indexOf('ASSET_MAP')` === -1 — it had never run that bundler at all.
//
// A guard that cannot see the shipped file and cannot fail is not a guard. This
// tool reads files off disk, exits non-zero, and proves it can fail with
// --selftest against a corpus that includes THE REAL STALE ARTIFACT, pulled out
// of this repo's own history by blob id. A synthesized known-bad is my opinion
// about the defect; the blob is the defect.
//
//   node tools/verify-shipped.mjs             verify the working tree
//   node tools/verify-shipped.mjs --selftest  run the known-bad corpus
//
// WHAT IT DOES NOT CHECK, and this is the point of the chain:
//   root + dist carry art  +  both === build  →  the player's files are this source.
// Check B alone would pass on two identically art-less files, so A is what makes
// the chain terminate in a true claim rather than in agreement. Agreement is not
// synchronization (SOP 5).
//
// SINCE 2026-09-26 NONE OF THESE FILES IS TRACKED ON dev. The Git LFS budget ran
// out (every rebuild uploaded ~284 MB), so the built HTML is ignored, CI builds it
// on every push, and dev-preview.yml uploads it as the workflow artifact a player
// or tester downloads. This tool still verifies what that artifact is made of —
// the files tools/launch.mjs just wrote — and check C now also refuses any of them
// being TRACKED again, which is the LFS defect coming back through `git add`.
//
// REMOVAL CONDITION (SOP 1's corollary): deleted if bundle.mjs stops inlining art into a
// single file, because then check A is asserting a property the build no longer
// claims. NOT removed for having passed a long time: --selftest is what keeps it
// honest, and a --selftest that stops failing on the corpus is itself the alarm.
//
// SINCE STEP 8e (docs/EXTERNAL-ASSETS-PLAN.md) ONE FILE STILL INLINES ITS ART: the
// light single file, build/download/AshenSpire.html, which tools/launch.mjs copies to
// dist/download/ and to the root alias (owner answer 3). Check A holds those three.
// build/AshenSpire.html and dist/AshenSpire.html are the PACK-SHAPED game file, and
// check P holds them instead: it pins ASSET_PACKS, carries no inlined media but the
// two SVG masks, and every index it pins is in packs/ beside it with that hash.
// B holds every copy to its build, byte for byte. The mobile file and its budget
// check retired with the edition (owner answer 2).

import { readFileSync, existsSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
// WHAT TREE DID THIS SEE? Naming the file is not naming its freshness — this
// tool measured a two-merge-stale bundle and printed OK once already. One home:
// tools/artifact-provenance.mjs. Facts only; it never fails a run.
import { printArtifactProvenance } from './artifact-provenance.mjs';
import { MOBILE_BUNDLE_BUDGET_BYTES } from './mobileart-policy.mjs';
import { createHash } from 'node:crypto';
printArtifactProvenance(resolve(ROOT, 'dist/AshenSpire.html'), ROOT);
printArtifactProvenance(resolve(ROOT, 'dist/download/AshenSpire.html'), ROOT);
printArtifactProvenance(resolve(ROOT, 'AshenSpire.html'), ROOT);
const args = process.argv.slice(2);
const SELFTEST = args.includes('--selftest');

const BUILD = 'build/AshenSpire.html'; // the pack-shaped game file (step 8e)
const DIST_DIR = 'dist';
const SHIPPED = 'dist/AshenSpire.html'; // its dist copy, with dist/packs/ and dist/objects/ beside it
// THE LIGHT SINGLE FILE, the one inline download kept (owner answer 3): built to
// download/, copied to dist/download/ and to the root alias README gives a player
// (the root has no packs/ beside it, so its alias is the self-contained file).
const SINGLE_BUILD = 'build/download/AshenSpire.html';
const SINGLE_SHIPPED = 'dist/download/AshenSpire.html';
const ROOT_CURRENT = 'AshenSpire.html';
// The retired mobile file's root alias: still a home built HTML must never be tracked in.
const MOBILE_ROOT_CURRENT = 'AshenSpire-mobile.html';

// The stale artifact as committed at 40c5b21: 712667 bytes, no ASSET_MAP token,
// three inlined images instead of 101. Kept as a corpus entry by blob id rather
// than as a checked-in fixture — a 712 KiB fixture to prove a guard works is a
// second copy of the very artifact we are trying to stop tracking.
const STALE_BLOB = '940dd0da11972e7ca378787700aebb84e6566f54';

// The floor check A holds the artifact to, and Vira's condition 2: the fact is a
// COUNT, and the count is of ASSET_MAP ENTRIES — never of `data:` URIs. Today the
// two are 97 and 101, and the four extra URIs belong to CSS, so they drift for
// reasons that are not this defect. She fed the old boolean `ASSET_MAP + 1 image`
// and it passed; the historical blob had exactly 3 images, so the missing token was
// the only thing that ever caught it.
//
// WHERE I DEPART FROM HER NUMBER, and she should rule on it rather than inherit it:
// she specified 97 (98 files under assets/ minus manifest.json). I made it a FLOOR
// of 64, not an equality of 97, because an equality here is two values that must
// stay equal — SOP 5's whole subject — and the day someone legitimately adds or
// removes a sprite, CI goes red for a true reason nobody wants and the fix is to
// retype the number. A floor cannot be fixed by retyping it upward without lying on
// purpose. 64 is far below the real 97 and far above the defect class it has to
// catch: the stale blob had 3, and a sparse checkout or an unfetched LFS pointer
// gives you a handful. If she wants the equality instead, it is one constant.
//
// REMOVAL CONDITION: the floor goes back to a boolean the day an ASSET_MAP cannot be
// partially populated — i.e. if bundle.mjs ever fails hard on a missing asset
// instead of writing a thinner map. It is RAISED only when the real count drops
// below it, never to track the count upward: a floor that follows the population is
// the equality this replaced.
const MIN_ASSET_MAP_ENTRIES = 64;

// dist/'s tracked contents, as an ALLOWLIST off the SHIPPED const — Vira's and
// Bjorn's condition 2, converged on independently. The old check was a denylist
// keyed on `/^AshenSpire-.+\.html$/`, which caught exactly the one shape already
// deleted: she fed it nine twin shapes and it caught one. It is load-bearing rather
// than cosmetic because checks A and B read ONLY dist/AshenSpire.html, so a tracked
// twin under any other name is invisible to the entire chain — which is what
// 40c5b21 shipped. Derived from SHIPPED so the base name still has one home.
//
// REMOVAL CONDITION: this list is deleted with check C, on the day dist/ tracks
// nothing (see the tool's removal condition above). Entries are ADDED only by a
// human who means to track a new file in dist/ — an addition made to turn CI green
// is the denylist's failure mode reintroduced by hand.
// Since 2026-09-26 the built HTML itself is off the list: dist/ tracks its README
// and nothing else, and checkNoTrackedBuild holds the root and build/ copies.
const ALLOWED_TRACKED_IN_DIST = ['README.md'];

// The other homes tools/launch.mjs writes built HTML into. Tracked there, it is
// the ~284 MB-per-rebuild Git LFS upload this repository could no longer pay for.
const BUILD_HOMES = [ROOT_CURRENT, MOBILE_ROOT_CURRENT, 'build'];

// ---------------------------------------------------------------------------
// The checks, as pure functions over bytes, so --selftest can feed them a corpus
// instead of asserting against a mock of myself.
// ---------------------------------------------------------------------------

/**
 * A. Does this HTML actually carry the art inline?
 * `minEntries` is a parameter and not a constant read from scope so the corpus can
 * drive both edges of the threshold instead of only the side it likes.
 */
export function checkCarriesArt(name, bytes, minEntries = MIN_ASSET_MAP_ENTRIES) {
  const text = bytes.toString('utf8');
  const hasMap = text.includes('ASSET_MAP');
  // Entries, not `data:` URIs: an ASSET_MAP key mapped to an inlined image. The URI
  // count includes images CSS owns and is the wrong population to threshold on.
  const entries = (text.match(/"assets\/[^"]+":\s*"data:/g) || []).length;
  const images = (text.match(/data:image\/[a-z+]*;base64/g) || []).length;
  if (!hasMap) {
    return {
      ok: false, code: 'NO_ART',
      detail: `${name} has no ASSET_MAP token (indexOf = -1) — it was not produced by ` +
        `tools/bundle.mjs. ${images} inlined image(s) found; a real build has ~101.`,
    };
  }
  if (entries < minEntries) {
    return {
      ok: false, code: 'NO_ART',
      detail: `${name} has an ASSET_MAP with only ${entries} entr${entries === 1 ? 'y' : 'ies'} ` +
        `(floor is ${minEntries}; a real build has 97, in ${images} total inlined images). ` +
        `A partial assets/ tree, a sparse checkout or an unfetched LFS pointer produces ` +
        `exactly this: the token present and the art absent.`,
    };
  }
  return {
    ok: true, code: 'NO_ART',
    detail: `${name}: ASSET_MAP present, ${entries} entries (floor ${minEntries}), ${images} inlined images`,
  };
}

/** B. Is the shipped file the build, byte for byte? */
export function checkShippedIsBuilt(distName, distBytes, buildBytes, buildName = BUILD) {
  if (distBytes.equals(buildBytes)) {
    return { ok: true, code: 'DRIFT', detail: `${distName} is byte-identical to ${buildName} (${distBytes.length} bytes)` };
  }
  return {
    ok: false, code: 'DRIFT',
    detail: `${distName} (${distBytes.length} bytes) differs from ${buildName} (${buildBytes.length} bytes). ` +
      `Either dist/ is stale — run \`node tools/launch.mjs --build-only\` — or the build is not ` +
      `reproducible on this machine, which tools/dirorder.mjs exists to prevent.`,
  };
}

/**
 * C. Is anything tracked in dist/ that is not the one file a player is handed?
 * An allowlist, not a name pattern: the question "is this the shipped artifact?" has
 * one right answer and infinitely many wrong ones, and the wrong ones are the bug.
 */
export function checkNoStampedTwin(trackedDistFiles, allowed = ALLOWED_TRACKED_IN_DIST) {
  const unexpected = trackedDistFiles.filter((f) => !allowed.includes(f));
  if (unexpected.length) {
    return {
      ok: false, code: 'STAMPED_TWIN',
      detail: `tracked file(s) in dist/ that are not on the allowlist [${allowed.join(', ')}]: ` +
        `${unexpected.join(', ')}. Launcher output is ignored by .gitignore, so a TRACKED one ` +
        `means the ignore rule and tools/launch.mjs have drifted apart again — and checks A ` +
        `and B read only ${SHIPPED}, so a twin under any other name is invisible to them. ` +
        `If a new file genuinely belongs in dist/, add it to the allowlist deliberately.`,
    };
  }
  return {
    ok: true, code: 'STAMPED_TWIN',
    detail: `dist/ tracks only the allowlist [${allowed.join(', ')}] — no twin, stamped or otherwise`,
  };
}

/**
 * C2. Is any built HTML tracked at the root or in build/? It is built by CI and
 * published as a workflow artifact; tracking it again re-arms the LFS cost.
 */
export function checkNoTrackedBuild(trackedPaths) {
  const html = trackedPaths.filter((f) => /\.html?$/i.test(f));
  if (html.length) {
    return {
      ok: false, code: 'TRACKED_BUILD',
      detail: `built HTML is tracked: ${html.join(', ')}. It is generated by tools/launch.mjs, ` +
        `ignored by .gitignore, and published by CI as a workflow artifact — committing it ` +
        `uploads the whole build to Git LFS on every rebuild. \`git rm --cached\` it.`,
    };
  }
  return { ok: true, code: 'TRACKED_BUILD', detail: `no built HTML is tracked in ${BUILD_HOMES.join(', ')}` };
}

/**
 * E. Which edition is this file, and is it one this file may be? Since step 8e
 * the edition is the build's default tier: the pack-shaped game file is `light`
 * (dev/test) or `high` (release/main), and the light single file is `light`,
 * whatever the branch. `full` and `mobile` retired with their single files.
 */
export function checkEdition(name, bytes, allowed = ['light', 'high']) {
  const editions = [...bytes.toString('utf8').matchAll(/const EDITION = '([^']*)'/g)].map((m) => m[1]);
  if (editions.length !== 1) return { ok: false, code: 'EDITION', edition: null, detail: `${name} carries ${editions.length} EDITION literals, expected exactly 1` };
  if (!allowed.includes(editions[0])) return { ok: false, code: 'EDITION', edition: editions[0], detail: `${name} calls itself the '${editions[0]}' edition — it must be ${allowed.map((e) => `'${e}'`).join(' or ')}` };
  return { ok: true, code: 'EDITION', edition: editions[0], detail: `${name} is the '${editions[0]}' edition` };
}

// A data: URI with a real media payload — the same rule verify-external B uses.
// SVG is left out: the two masks stay inline by design (plan §3.7).
const REAL_PAYLOAD = /data:(?:image\/(?!svg\+xml)[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|font\/[a-z0-9.+-]+);base64,[A-Za-z0-9+/]{64,}/g;
const PACK_PIN = /const ASSET_PACKS = (\{.*?\});\n/;

/**
 * P. Is this the pack-shaped game file, with what it pins beside it? It pins
 * ASSET_PACKS (a default tier it carries, and the common pack); it inlines no
 * media but the two SVG masks; and each index it pins, each index's `.js` twin
 * and the font sidecar are in packs/ beside it, the index and the sidecar's
 * text hashing to the pin. `readPacked(rel)` returns that file's bytes or null.
 * verify-external goes further (every object, the CSS template, the tiles and
 * the score); this is the part a copy in dist/ can drift on.
 */
export function checkPackShape(name, bytes, readPacked) {
  const text = bytes.toString('utf8');
  const problems = [];
  const m = PACK_PIN.exec(text);
  let pin = null;
  try { pin = m ? JSON.parse(m[1]) : null; } catch { pin = null; }
  if (!pin || !pin.packs || typeof pin.packs !== 'object' || !Object.keys(pin.packs).length) {
    return { ok: false, code: 'PACKS', detail: `${name} pins no ASSET_PACKS — it is not the pack-shaped game file (tools/bundle.mjs without --single-file)` };
  }
  if (!['light', 'high'].includes(pin.tier) || !pin.packs[pin.tier]) problems.push(`its default tier ${JSON.stringify(pin.tier)} is not a pack it pins`);
  if (!pin.packs.common) problems.push('it pins no common pack');
  // Light is the high tier's fallback (the loader drops to it when the high
  // index fails), so a high-default build that does not pin it has none.
  if (pin.tier === 'high' && !pin.packs.light) problems.push('its default tier is high but it pins no light pack (the high tier\'s fallback)');
  // The rest of the folder the loader reads: asset-base.json (where the packs
  // are) and the objects/ store the indexes name. `readPacked('objects/')` is
  // truthy when that folder exists beside it and is not empty.
  const baseBuf = readPacked('asset-base.json');
  let base = null;
  try { base = baseBuf ? JSON.parse(baseBuf.toString('utf8')) : null; } catch { base = null; }
  if (!baseBuf) problems.push('asset-base.json is not beside it');
  else if (!base || typeof base.base !== 'string') problems.push('asset-base.json beside it names no base');
  if (!readPacked('objects/')) problems.push('no objects/ store is beside it');
  // The EDITION stamp IS the default tier since step 8e (Copilot, #1506): a
  // file that stamps one tier and pins another says the wrong thing in About.
  const editions = [...text.matchAll(/const EDITION = '([^']*)'/g)].map((e) => e[1]);
  if (editions.length === 1 && editions[0] !== pin.tier) problems.push(`its EDITION '${editions[0]}' is not the default tier its pin names (${JSON.stringify(pin.tier)})`);
  // A pinned common pack carries the faces, so the file:// door needs the
  // font sidecar's pin too, as verify-external requires (Copilot, #1506).
  if (pin.packs.common && !pin.fonts) problems.push('it pins the common pack but no font sidecar');
  const inlined = (text.match(REAL_PAYLOAD) || []).length;
  if (inlined) problems.push(`it inlines ${inlined} media payload(s) besides the SVG masks — art travels in the packs, not in this file`);
  const sha = (buf) => createHash('sha256').update(buf).digest('hex');
  let present = 0;
  for (const [pack, p] of Object.entries(pin.packs)) {
    const index = String(p && p.index);
    const buf = readPacked(index);
    if (!buf) { problems.push(`${pack}: ${index} is not beside it`); continue; }
    if (sha(buf) !== p.sha256) { problems.push(`${pack}: ${index} does not hash to its pin (${String(p.sha256).slice(0, 12)})`); continue; }
    // The twin is what the file:// door reads: it must hand the loader exactly
    // this index's text under this index's name, as verify-external checks
    // (Copilot, #1506), or a double-click loads a stale or wrong index.
    const twinPath = index.replace(/\.json$/, '.js');
    const twin = readPacked(twinPath);
    if (!twin) { problems.push(`${pack}: the .js twin of ${index} is not beside it (the file:// door reads it)`); continue; }
    const tm = /^window\.__ashenPack\((".*?"), (".*")\);\n$/s.exec(twin.toString('utf8'));
    let twinName = null; let twinText = null;
    try { if (tm) { twinName = JSON.parse(tm[1]); twinText = JSON.parse(tm[2]); } } catch { twinName = null; twinText = null; }
    const wantName = index.replace(/^.*\//, '').replace(/\.json$/, '');
    if (twinName !== wantName || twinText !== buf.toString('utf8')) { problems.push(`${pack}: ${twinPath} does not hand the loader ${index}'s text under the name ${wantName}`); continue; }
    present += 1;
  }
  if (pin.fonts) {
    const buf = readPacked(String(pin.fonts.file));
    const fm = buf && /^__ashenFonts\("[^"]+", (".*")\);\n$/s.exec(buf.toString('utf8'));
    let inner = null;
    try { inner = fm ? JSON.parse(fm[1]) : null; } catch { inner = null; }
    if (!buf) problems.push(`the font sidecar ${pin.fonts.file} is not beside it`);
    else if (typeof inner !== 'string' || sha(Buffer.from(inner, 'utf8')) !== pin.fonts.sha256) problems.push(`the font sidecar ${pin.fonts.file} does not hash to its pin`);
  }
  if (problems.length) return { ok: false, code: 'PACKS', detail: `${name} is not a whole pack-shaped build: ${problems.join('; ')}. Run node tools/launch.mjs --build-only.` };
  return { ok: true, code: 'PACKS', detail: `${name} pins ${present} pack(s) (default tier ${pin.tier}), each index and twin beside it at its pin${pin.fonts ? ', the font sidecar too' : ''}; no inlined media but the SVG masks` };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
const results = [];
function record(r) {
  results.push(r);
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  [${r.code}] ${r.detail}`);
}

function boundary(lines) {
  console.log('');
  console.log('BOUNDARY — what a green from this tool does NOT mean:');
  // Continuation lines start with a space so they read as wrapped prose, not as
  // extra bullets. A boundary a reader skims wrong is a boundary not delivered.
  for (const l of lines) console.log(l.startsWith(' ') ? '    ' + l.trim() : '  · ' + l);
}

// ---------------------------------------------------------------------------
// --selftest: the known-bad corpus. Every entry must FAIL for its named reason,
// and the positive control must pass. A corpus where nothing fails proves nothing.
// ---------------------------------------------------------------------------
if (SELFTEST) {
  console.log('verify-shipped --selftest: every case below must land on its expected verdict.\n');
  const bad = [];

  // THE ZERO-CHECK PLANT (#12), and it enters by the SAME DOOR the real tool
  // does: a COPY of this file's own bytes with the recorder neutered, written
  // beside it so its imports resolve, executed as a child process. Nothing is
  // handed to an inner function; the thing proven is the exit path.
  {
    const meFile = fileURLToPath(import.meta.url);
    const plantPath = resolve(dirname(meFile), `.verify-shipped-zero-plant-${process.pid}.mjs`);
    const src = readFileSync(meFile, 'utf8')
      .replace('function record(r) {\n  results.push(r);', 'function record(r) {\n  return;')
      .replace("const SELFTEST = args.includes('--selftest');", 'const SELFTEST = false;');
    let out = { status: null, stdout: '', stderr: '' };
    try {
      writeFileSync(plantPath, src);
      const r = spawnSync(process.execPath, [plantPath], { encoding: 'utf8' });
      out = { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
    } finally {
      try { unlinkSync(plantPath); } catch { /* already gone */ }
    }
    const caught = out.status === 1 && /REFUSED — ran 0 check/.test(out.stderr + out.stdout);
    console.log(`  ${caught ? 'OK  ' : 'BAD '} plant: recorder neutered → zero checks must REFUSE, not print OK` +
      (caught ? '' : `  (got exit ${out.status})`));
    if (!caught) bad.push('zero-check plant');
  }
  let ran = 0;
  const expect = (label, r, wantOk, wantCode) => {
    ran += 1;
    const ok = r.ok === wantOk && r.code === wantCode;
    console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label} → ${r.ok ? 'pass' : 'fail'} [${r.code}]` +
      (ok ? '' : `  (expected ${wantOk ? 'pass' : 'fail'} [${wantCode}])`));
    if (!ok) bad.push(label);
    if (!wantOk && !r.ok) console.log(`         reason given: ${r.detail.split(' — ')[0].slice(0, 96)}`);
  };

  // A synthetic build with a full-sized ASSET_MAP. Generated at the real count
  // rather than typed, so the fixture cannot silently drift from the floor it is
  // supposed to clear.
  const artMap = (n) => Buffer.from('<html><script>const ASSET_MAP={' +
    Array.from({ length: n }, (_, i) => `"assets/a${i}.webp":"data:image/webp;base64,AAAA"`).join(',') +
    '};</script></html>', 'utf8');
  const goodArt = artMap(97);

  // 1. Synthetic art-less build — the class of defect, minimal form.
  expect('synthetic: html with no ASSET_MAP',
    checkCarriesArt('synthetic-artless.html', Buffer.from('<html>no map here</html>', 'utf8')),
    false, 'NO_ART');

  // 2. Synthetic: ASSET_MAP present but empty.
  expect('synthetic: ASSET_MAP with zero entries',
    checkCarriesArt('synthetic-emptymap.html', Buffer.from('<html>const ASSET_MAP={};</html>', 'utf8')),
    false, 'NO_ART');

  // 2b-2d. VIRA'S CONDITION 2, the cases the old boolean PASSED. The predicate used
  //        to be `images === 0`, so one image cleared it — and the real stale blob
  //        had three, which means the missing token was the only thing that ever
  //        caught it. Both edges of the floor, because a threshold checked on one
  //        side is a threshold nobody has measured.
  expect('vira: ASSET_MAP with 1 entry (passed the old boolean)',
    checkCarriesArt('synthetic-1-entry.html', artMap(1)), false, 'NO_ART');
  expect('vira: ASSET_MAP with 3 entries — the stale blob\'s own image count',
    checkCarriesArt('synthetic-3-entries.html', artMap(3)), false, 'NO_ART');
  expect('edge: one entry below the floor fails',
    checkCarriesArt('synthetic-floor-minus-1.html', artMap(MIN_ASSET_MAP_ENTRIES - 1)), false, 'NO_ART');
  expect('edge: exactly at the floor passes',
    checkCarriesArt('synthetic-floor.html', artMap(MIN_ASSET_MAP_ENTRIES)), true, 'NO_ART');
  // The population trap Vira named: `data:` URIs are 101 and ASSET_MAP entries are
  // 97, and four of the URIs are CSS's. A file with plenty of URIs and no entries is
  // the thing a URI threshold would wave through.
  expect('vira: 101 data: URIs but no ASSET_MAP entries (the wrong population)',
    checkCarriesArt('synthetic-uris-no-entries.html', Buffer.from('<html>const ASSET_MAP={};' +
      'data:image/webp;base64,AAAA'.repeat(101) + '</html>', 'utf8')), false, 'NO_ART');

  // 3. THE REAL DEFECT — dist/AshenSpire.html exactly as committed at 40c5b21,
  //    fetched from git by blob id. If this stops failing, the check is broken,
  //    not the history.
  let stale = null;
  try {
    stale = execFileSync('git', ['cat-file', 'blob', STALE_BLOB], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    // Unreachable corpus is `unknown`, and unknown blocks. Never a silent pass.
    console.log(`  BAD  real: stale blob ${STALE_BLOB.slice(0, 8)} unreachable — ${String(e.message).split('\n')[0]}`);
    console.log('         A shallow clone cannot run this corpus entry. Fetch full depth.');
    bad.push('real stale blob unreachable (unknown, not pass)');
  }
  if (stale) {
    expect(`real: dist/AshenSpire.html @40c5b21 (blob ${STALE_BLOB.slice(0, 8)}, ${stale.length} bytes)`,
      checkCarriesArt('dist/AshenSpire.html@40c5b21', stale), false, 'NO_ART');
    expect('real: that same stale blob vs a good build',
      checkShippedIsBuilt('dist/AshenSpire.html@40c5b21', stale, goodArt), false, 'DRIFT');
  }

  // 4. Synthetic drift: one byte apart. The subtle case a size check would miss.
  const drifted = Buffer.from(goodArt.toString('utf8').replace('AAAA', 'AAAB'), 'utf8');
  expect('synthetic: dist differs from build by one byte',
    checkShippedIsBuilt('synthetic-drift.html', drifted, goodArt), false, 'DRIFT');

  // 5. The stamped twin, by its real committed name.
  expect('real: AshenSpire-0.2.0-ashen.html tracked in dist/',
    checkNoStampedTwin(['AshenSpire-0.2.0-ashen.html', 'README.md']),
    false, 'STAMPED_TWIN');
  // 5a. The build itself tracked in dist/ again — the LFS cost coming back.
  expect('dist/AshenSpire.html tracked again',
    checkNoStampedTwin(['AshenSpire.html', 'README.md']), false, 'STAMPED_TWIN');
  expect('root AshenSpire.html tracked again',
    checkNoTrackedBuild(['AshenSpire.html']), false, 'TRACKED_BUILD');
  expect('build/download/AshenSpire.html tracked again',
    checkNoTrackedBuild(['build/download/AshenSpire.html']), false, 'TRACKED_BUILD');
  expect('control: nothing built is tracked', checkNoTrackedBuild([]), true, 'TRACKED_BUILD');

  // 5b. VIRA'S NINE TWIN SHAPES, verbatim from her sign-off. The denylist
  //     `/^AshenSpire-.+\.html$/` caught one of these — the one already deleted.
  //     The allowlist has to catch all nine, and it is load-bearing rather than
  //     tidy: checks A and B read only dist/AshenSpire.html, so a tracked twin
  //     under any other name is invisible to the whole chain. That is what 40c5b21
  //     shipped.
  for (const twin of [
    'AshenSpire-0.2.0-ashen.html', 'EldenSpire-0.2.0.html', 'SpireOfAsh-0.3.0.html',
    'AshenSpire.old.html', 'ashenspire-0.3.0.html', 'AshenSpire_0.2.0.html',
    'AshenSpire-0.2.0-ashen.htm', 'AshenSpire copy.html', 'sub/AshenSpire-9.9.9.html',
  ]) {
    expect(`vira's twin shapes: ${twin} tracked in dist/`,
      checkNoStampedTwin(['README.md', twin]), false, 'STAMPED_TWIN');
  }

  // 6-8. Positive controls — the checks must not fail everything indiscriminately.
  expect('control: good build carries art', checkCarriesArt('good.html', goodArt), true, 'NO_ART');
  // The edition (step 8e): the build's default tier, exactly once. The pack
  // HTML is light or high; the light single file is light and nothing else.
  const ed = (v) => Buffer.from(`<script>export const EDITION = '${v}';</script>`);
  expect('edition: a light pack build', checkEdition('light.html', ed('light')), true, 'EDITION');
  expect('edition: a high pack build', checkEdition('high.html', ed('high')), true, 'EDITION');
  expect('edition: the light single file', checkEdition('download.html', ed('light'), ['light']), true, 'EDITION');
  expect('edition: a high build under the light single file\'s name', checkEdition('download.html', ed('high'), ['light']), false, 'EDITION');
  expect('edition: the retired full single file', checkEdition('full.html', ed('full')), false, 'EDITION');
  expect('edition: the retired mobile file', checkEdition('mobile.html', ed('mobile')), false, 'EDITION');
  expect('edition: no EDITION literal', checkEdition('none.html', Buffer.from('<html></html>')), false, 'EDITION');
  expect('control: identical bytes are not drift',
    checkShippedIsBuilt('good.html', goodArt, goodArt), true, 'DRIFT');
  expect('control: clean dist/ listing', checkNoStampedTwin(['README.md']), true, 'STAMPED_TWIN');
  expect('control: the real tracked dist/ listing passes the allowlist',
    checkNoStampedTwin(ALLOWED_TRACKED_IN_DIST), true, 'STAMPED_TWIN');

  // 9. THE PACK SHAPE (check P, step 8e). A fixture build: a pin naming a
  //    light and a common index and a font sidecar, the files beside it, and
  //    each planted defect red by its own name.
  const hex = (t) => createHash('sha256').update(t).digest('hex');
  const lightIdx = '{\n"assets/a.webp":["aa",1,"image/webp"]\n}\n';
  const commonIdx = '{}\n';
  const fontsText = '{}\n';
  const files = new Map([
    ['packs/light-000000000001.json', Buffer.from(lightIdx)],
    ['packs/light-000000000001.js', Buffer.from(`window.__ashenPack("light-000000000001", ${JSON.stringify(lightIdx)});\n`)],
    ['packs/common-000000000002.json', Buffer.from(commonIdx)],
    ['packs/common-000000000002.js', Buffer.from(`window.__ashenPack("common-000000000002", ${JSON.stringify(commonIdx)});\n`)],
    ['packs/fonts-000000000003.js', Buffer.from(`__ashenFonts("fonts-000000000003", ${JSON.stringify(fontsText)});\n`)],
    ['asset-base.json', Buffer.from('{"base":"./"}\n')],
    ['objects/', Buffer.from('objects/')],
  ]);
  const pinOf = (over = {}) => ({ schema: 1, tier: 'light', packs: {
    light: { index: 'packs/light-000000000001.json', sha256: hex(lightIdx) },
    common: { index: 'packs/common-000000000002.json', sha256: hex(commonIdx) },
  }, fonts: { file: 'packs/fonts-000000000003.js', sha256: hex(fontsText), faces: 0 }, ...over });
  const packHtml = (pin, extra = '') => Buffer.from(`<script>const ASSET_MAP = {};\nconst ASSET_PACKS = ${JSON.stringify(pin)};\n${extra}</script>`);
  const reader = (map) => (rel) => map.get(rel) || null;
  const without = (rel) => { const m = new Map(files); m.delete(rel); return m; };
  expect('control: a pack build with its packs beside it', checkPackShape('pack.html', packHtml(pinOf()), reader(files)), true, 'PACKS');
  expect('pack: a single file (no ASSET_PACKS) under the game file\'s name', checkPackShape('pack.html', goodArt, reader(files)), false, 'PACKS');
  expect('pack: a pinned index missing', checkPackShape('pack.html', packHtml(pinOf()), reader(without('packs/light-000000000001.json'))), false, 'PACKS');
  expect('pack: an index twin missing (the file:// door)', checkPackShape('pack.html', packHtml(pinOf()), reader(without('packs/common-000000000002.js'))), false, 'PACKS');
  expect('pack: the font sidecar missing', checkPackShape('pack.html', packHtml(pinOf()), reader(without('packs/fonts-000000000003.js'))), false, 'PACKS');
  const staleIdx = new Map(files); staleIdx.set('packs/light-000000000001.json', Buffer.from('{}\n'));
  expect('pack: a stale index under the pinned name', checkPackShape('pack.html', packHtml(pinOf()), reader(staleIdx)), false, 'PACKS');
  expect('pack: a default tier it does not pin', checkPackShape('pack.html', packHtml(pinOf({ tier: 'high' })), reader(files)), false, 'PACKS');
  expect('pack: inlined art beside the pin', checkPackShape('pack.html', packHtml(pinOf(), `"assets/a.webp":"data:image/webp;base64,${'A'.repeat(80)}"`), reader(files)), false, 'PACKS');
  // Copilot's three findings on #1506, each planted.
  expect('pack: EDITION says high while the pin\'s tier is light', checkPackShape('pack.html', Buffer.from(packHtml(pinOf()).toString().replace('</script>', "export const EDITION = 'high';</script>")), reader(files)), false, 'PACKS');
  expect('control: EDITION agrees with the pin\'s tier', checkPackShape('pack.html', Buffer.from(packHtml(pinOf()).toString().replace('</script>', "export const EDITION = 'light';</script>")), reader(files)), true, 'PACKS');
  const badTwin = new Map(files); badTwin.set('packs/light-000000000001.js', Buffer.from(`window.__ashenPack("light-000000000001", ${JSON.stringify('{}\n')});\n`));
  expect('pack: a .js twin whose text is not its index', checkPackShape('pack.html', packHtml(pinOf()), reader(badTwin)), false, 'PACKS');
  const misnamedTwin = new Map(files); misnamedTwin.set('packs/light-000000000001.js', Buffer.from(`window.__ashenPack("light-999999999999", ${JSON.stringify(lightIdx)});\n`));
  expect('pack: a .js twin under another index\'s name', checkPackShape('pack.html', packHtml(pinOf()), reader(misnamedTwin)), false, 'PACKS');
  expect('pack: the common pack pinned with no font sidecar pin', checkPackShape('pack.html', packHtml(pinOf({ fonts: null })), reader(files)), false, 'PACKS');
  // The review's findings on #1506: the rest of the folder, and the fallback.
  expect('pack: no objects/ store beside it', checkPackShape('pack.html', packHtml(pinOf()), reader(without('objects/'))), false, 'PACKS');
  expect('pack: no asset-base.json beside it', checkPackShape('pack.html', packHtml(pinOf()), reader(without('asset-base.json'))), false, 'PACKS');
  const noBase = new Map(files); noBase.set('asset-base.json', Buffer.from('{}\n'));
  expect('pack: an asset-base.json that names no base', checkPackShape('pack.html', packHtml(pinOf()), reader(noBase)), false, 'PACKS');
  const highIdx = '{\n"assets/a.webp":["bb",1,"image/webp"]\n}\n';
  const withHigh = new Map(files);
  withHigh.set('packs/high-000000000004.json', Buffer.from(highIdx));
  withHigh.set('packs/high-000000000004.js', Buffer.from(`window.__ashenPack("high-000000000004", ${JSON.stringify(highIdx)});\n`));
  const highPin = { index: 'packs/high-000000000004.json', sha256: hex(highIdx) };
  expect('control: a high-default pin with light as its fallback', checkPackShape('pack.html', packHtml(pinOf({ tier: 'high', packs: { ...pinOf().packs, high: highPin } })), reader(withHigh)), true, 'PACKS');
  expect('pack: a high-default pin with no light pack', checkPackShape('pack.html', packHtml(pinOf({ tier: 'high', packs: { high: highPin, common: pinOf().packs.common } })), reader(withHigh)), false, 'PACKS');
  expect('control: an inline SVG mask is not inlined art', checkPackShape('pack.html', packHtml(pinOf(), `url("data:image/svg+xml;base64,${'A'.repeat(80)}")`), reader(files)), true, 'PACKS');

  boundary([
    'nothing about the working tree — --selftest checks the CHECKS, not the repo',
    'the synthetic cases are my model of the defect; only the blob cases are the defect',
    'no browser opened anything: art PRESENT is not art RENDERING',
    'the floor on ASSET_MAP entries is 64 against a real 97: it catches "a handful",',
    ' never "one asset short". An exact count would be two values kept equal by hand',
    'the allowlist is a claim about NAMES tracked in dist/, not about their contents:',
    ' a tracked README.md full of the wrong prose passes here and always will',
    'check P reads the pins and the index files, not the objects: every object is',
    ' tools/verify-external.mjs, and whether the art draws is tools/external-play.mjs',
  ]);
  if (bad.length) {
    console.error(`\nverify-shipped --selftest: ${bad.length} case(s) landed on the wrong verdict:`);
    for (const b of bad) console.error('    · ' + b);
    process.exit(1);
  }
  // #12's contract: EXACTLY ONE terminated verdict line carrying a COUNT. The
  // old line said "every known-bad case failed for its named reason" — true,
  // and countless, so a corpus that quietly shrank to zero read the same.
  // The zero-check plant above is counted with them (hence ran + 1).
  console.log(`\nverify-shipped --selftest: OK — ${ran + 1} checks passed.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Normal run: verify the working tree.
// ---------------------------------------------------------------------------
console.log('verify-shipped: checking the file a player is handed.\n');

// A MISSING FILE IS A RECORDED FAILURE, NOT AN EARLY EXIT. Since the built HTML
// stopped being committed, a fresh checkout has none; recording it keeps the
// run on its one verdict path (FAILED, or REFUSED when nothing was recorded —
// the zero-check plant in --selftest depends on reaching that line), and the
// tracked-file checks below still run.
const readOrMiss = (rel, why) => {
  const p = resolve(ROOT, rel);
  if (existsSync(p)) return readFileSync(p);
  record({ ok: false, code: 'MISSING', detail: `${rel} does not exist — ${why}` });
  return null;
};
const BUILD_FIRST = 'build it first: node tools/launch.mjs --build-only (built HTML is not committed; CI builds before this check).';
const packedBeside = (dirRel) => (rel) => {
  const p = resolve(ROOT, dirRel, rel);
  if (!existsSync(p)) return null;
  // A folder (`objects/`) answers whether it holds anything, not its bytes.
  if (rel.endsWith('/')) return readdirSync(p).length ? Buffer.from(rel) : null;
  return readFileSync(p);
};

// THE PACK-SHAPED GAME FILE, and its dist/ copy with dist/'s own packs.
const buildBytes = readOrMiss(BUILD, BUILD_FIRST);
if (buildBytes) {
  record(checkPackShape(BUILD, buildBytes, packedBeside('build')));
  record(checkEdition(BUILD, buildBytes));
  const shippedBytes = readOrMiss(SHIPPED, 'tools/launch.mjs copies the build tree into dist/.');
  if (shippedBytes) {
    record(checkPackShape(SHIPPED, shippedBytes, packedBeside(DIST_DIR)));
    record(checkShippedIsBuilt(SHIPPED, shippedBytes, buildBytes));
  }
}

// THE LIGHT SINGLE FILE, and its two copies: A on each (the chain dist===build
// only terminates in a true claim if the build itself is sound), and B.
const singleBytes = readOrMiss(SINGLE_BUILD, BUILD_FIRST);
if (singleBytes) {
  record(checkCarriesArt(SINGLE_BUILD, singleBytes));
  record(checkEdition(SINGLE_BUILD, singleBytes, ['light']));
  // NOT A VERDICT: the plan moves the retired mobile file's 30 MB budget here
  // (docs/EXTERNAL-ASSETS-PLAN.md §5), but the light single file was already
  // over it at step 8e and has never been held to it; the number is an open
  // owner question. Printed, so the drift is seen.
  const over = singleBytes.length - MOBILE_BUNDLE_BUDGET_BYTES;
  console.log(`  note        ${SINGLE_BUILD} is ${singleBytes.length} bytes, ${over > 0 ? `${over} over` : `${-over} under`} the retired mobile file's ${MOBILE_BUNDLE_BUDGET_BYTES}-byte budget (not gated; an owner question)`);
  for (const rel of [SINGLE_SHIPPED, ROOT_CURRENT]) {
    const bytes = readOrMiss(rel, 'tools/launch.mjs copies the light single file there.');
    if (!bytes) continue;
    record(checkCarriesArt(rel, bytes));
    record(checkShippedIsBuilt(rel, bytes, singleBytes, SINGLE_BUILD));
  }
}

// C from git, not the filesystem: an ignored file sitting in dist/ after a
// launcher run is correct and must not fail this. Only a TRACKED one is the bug.
let trackedDist = [];
try {
  trackedDist = execFileSync('git', ['ls-files', '--', DIST_DIR], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean).map((p) => p.replace(/^dist\//, ''));
  record(checkNoStampedTwin(trackedDist));
} catch (e) {
  record({ ok: false, code: 'STAMPED_TWIN', detail: `could not list tracked files in dist/ (${String(e.message).split('\n')[0]}) — unknown, which blocks` });
}

try {
  const trackedBuild = execFileSync('git', ['ls-files', '--', ...BUILD_HOMES], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  record(checkNoTrackedBuild(trackedBuild));
} catch (e) {
  record({ ok: false, code: 'TRACKED_BUILD', detail: `could not list tracked built HTML (${String(e.message).split('\n')[0]}) — unknown, which blocks` });
}

// Report every untracked artifact sitting in dist/, as information not verdict.
const onDisk = existsSync(resolve(ROOT, DIST_DIR)) ? readdirSync(resolve(ROOT, DIST_DIR)) : [];
const untracked = onDisk.filter((f) => f.endsWith('.html') && !trackedDist.includes(f));
if (untracked.length) console.log(`  note        untracked in dist/ (expected, launcher output): ${untracked.join(', ')}`);

boundary([
  'nothing rendered it. ASSET_MAP present and 101 data: URIs is not "the art appears"',
  '   — that needs a browser and a seeing seat, and this tool has neither',
  'nothing played it. This says the shipped file IS this source, never that this',
  ' source is a good game, balanced, or even winnable',
  // Was: "that fix lives on another branch, so a dist/ verified here still contains
  // the locked tutorial." True at #8. False since e97bd5a rebuilt the bundles on this
  // branch. Third boundary line of mine to date itself in one night, so this one is
  // phrased as what the TOOL can and cannot see, which no merge can falsify.
  // — Rune, 2026-07-28.
  'no statement about the tutorial lockout either way. This tool compares bytes, so',
  ' it cannot tell a bundle whose coach marks are reachable from one whose are not —',
  ' that is tools/tutorial-reach.mjs, and it needs a browser at a real --ui-zoom',
  'reproducibility across machines is not checked here — that is the git-diff step',
  ' in .github/workflows/ci.yml running on three runners',
  'the light single file is held to no byte budget (an owner question since step 8e),',
  ' and whether its shrunken art reads well on a phone is a seeing seat\'s call',
  'check P reads the pins and the indexes, not the objects — that is verify-external',
]);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\nverify-shipped: FAILED ${failed.length} of ${results.length}.`);
  console.error('  Fix: node tools/launch.mjs --build-only   (rebuilds build/ and refreshes the root + dist current-build aliases)');
  process.exit(1);
}
// #12'S SECOND LIVE INSTANCE, CLOSED AT THE TOOL AS WELL AS AT THE DOOR.
// This line printed `OK — 0 checks passed.` and exited 0 when the recorder was
// neutered — observed, not reasoned (the plant in --selftest re-runs it). The
// CI door (tools/verdict.mjs) now refuses that green for every tool at once;
// this floor is here because a person running this tool BY HAND is not standing
// at that door, and the tool that owns a claim should be able to state it.
//
// THE FLOOR IS BELOW THE POPULATION AND NEVER TRACKS IT: today this tool
// records 12 checks (4 on the pack-shaped file and its dist copy, 6 on the
// light single file and its two copies, 2 on what git tracks; step 8e). A floor that
// follows the count upward is a number retyped to match whatever happened,
// which is the defect one file over (verify's own ASSET_MAP note says the same
// thing about its own floor). It was raised from 4 to 8 when the mobile file
// doubled the population, because a run that silently lost one whole edition
// would otherwise still clear it.
const MIN_CHECKS = 8;
if (results.length < MIN_CHECKS) {
  console.error(`\nverify-shipped: REFUSED — ran ${results.length} check(s), floor is ${MIN_CHECKS}.`);
  console.error('  A tool that checked nothing and a tool that found nothing are the same green (#12).');
  process.exit(1);
}
console.log(`\nverify-shipped: OK — ${results.length} checks passed.`);
process.exit(0);
