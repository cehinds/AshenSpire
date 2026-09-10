#!/usr/bin/env node
// tools/verify-external.mjs — verify the DE-INLINED build: that the art a player
// will fetch is actually there, and is the same art the single file carries.
//
// WHY THIS EXISTS — de-inlining trades a loud failure for a quiet one
// ------------------------------------------------------------------
// In the single-file build a missing asset is impossible by construction: the
// bytes are inside the HTML or they are not, and tools/verify-shipped.mjs reads
// the shipped file and refuses when the art is not in it. That guard cannot be
// pointed at this build, because here "the art is present" means a FILE ON DISK
// BESIDE THE HTML, and an absent one does not change the HTML by a byte. It
// fails later, in a browser, as a blank card — which is the art-less-build bug
// tools/bundle.mjs's header describes, wearing different clothes.
//
// So the property has to be checked where it now lives. This tool reads the
// output directory off disk, exits non-zero, and proves it can fail with
// --selftest against planted known-bads rather than asserting its own care.
//
//   node tools/verify-external.mjs [--dir build/web]
//   node tools/verify-external.mjs --selftest
//
// WHAT IT CHECKS
//   A  the build IS the external shape — ASSET_MAP left empty, not injected
//   B  no art travelled inside it anyway (a data: payload here means the flag
//      did not take, and the 12x size win is silently gone)
//   C  every shippable file under the SOURCE assets/ has a byte-identical copy
//      beside the HTML — the check the single file gets for free
//   D  every CSS url() in the HTML resolves to a file that is actually there
//
// WHAT IT DOES NOT CHECK, and the boundary matters as much as the checks:
// paths built at RUNTIME (`assets/equipment/weapon_${id}.webp`) are not
// enumerable from this source — that is the whole reason src/ui/assetmap.js
// exists. C covers them only in the sense that it proves the WHOLE tree was
// copied, so any path that resolved in the source tree resolves here too. It
// says nothing about a path that was already wrong. Nothing here plays the game.
import { readFileSync, existsSync, readdirSync, statSync, rmSync, cpSync, mkdtempSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname, relative, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { MIME } from './assetmime.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2);
const SELFTEST = ARGV.includes('--selftest');
const dirFlag = ARGV.indexOf('--dir');
const OUT = resolve(ROOT, dirFlag >= 0 ? ARGV[dirFlag + 1] : 'build/web');
const SRC_ASSETS = resolve(ROOT, 'assets');

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

// A data: URI with a real payload. The bare string `data:image/webp;base64,`
// appears in assetmap.js's own PROSE describing the mechanism, and counting
// that as inlined art would make this check fire on a correct build.
const REAL_PAYLOAD = /data:(?:image|audio|font)\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]{64,}/g;

function verify(outDir) {
  const findings = [];
  let checks = 0;
  const html = resolve(outDir, 'AshenSpire.html');
  if (!existsSync(html)) return { findings: [`no build at ${relative(ROOT, html)}`], checks: 0 };
  const text = readFileSync(html, 'utf8');

  // A — the shape
  checks++;
  if (!/export const ASSET_MAP = \{\};/.test(text) && !/ASSET_MAP = \{\}/.test(text)) {
    findings.push('ASSET_MAP is not empty — this is not the external-art build');
  }

  // B — nothing inlined anyway
  checks++;
  const payloads = text.match(REAL_PAYLOAD) || [];
  if (payloads.length) findings.push(`${payloads.length} inlined asset payload(s) in a build that should carry none`);

  // C — the copy is complete and faithful
  const want = walk(SRC_ASSETS).filter((a) => Object.prototype.hasOwnProperty.call(MIME, extname(a).toLowerCase()));
  let missing = 0, differing = 0;
  for (const abs of want) {
    checks++;
    const rel = relative(SRC_ASSETS, abs);
    const copy = resolve(outDir, 'assets', rel);
    if (!existsSync(copy)) { missing++; if (missing <= 3) findings.push(`asset missing beside the build: assets/${rel.split(/[\\/]/g).join('/')}`); continue; }
    if (!readFileSync(abs).equals(readFileSync(copy))) {
      differing++; if (differing <= 3) findings.push(`asset differs from source: assets/${rel.split(/[\\/]/g).join('/')}`);
    }
  }
  if (missing > 3) findings.push(`… and ${missing - 3} more missing`);
  if (differing > 3) findings.push(`… and ${differing - 3} more differing`);

  // D — CSS urls resolve
  for (const m of text.matchAll(/url\(\s*"([^"]+)"\s*\)/g)) {
    const ref = m[1];
    if (/^(data:|https?:|\/\/|#)/i.test(ref)) continue;
    checks++;
    if (!existsSync(resolve(outDir, ref.split('?')[0].split('#')[0]))) findings.push(`CSS url does not resolve: ${ref}`);
  }
  return { findings, checks, assets: want.length };
}

if (!SELFTEST) {
  const { findings, checks, assets } = verify(OUT);
  for (const f of findings) console.log('  RED ' + f);
  if (findings.length) {
    console.log(`verify-external: RED — ${findings.length} finding(s) over ${checks} check(s) in ${relative(ROOT, OUT) || '.'}`);
    process.exit(1);
  }
  // THE VERDICT LINE ENDS AT THE COUNT. tools/verdict.mjs parses a fixed
  // grammar and a trailing parenthetical matches none of it: `OK — N checks
  // passed (…)` read as prose, so an exit-0 run reported SILENCE and the CI
  // step failed with "a tool that checked nothing and a tool that found
  // nothing are the same green". The detail belongs on the line above.
  console.log(`  ${assets} shippable assets present and byte-identical beside the build.`);
  console.log(`verify-external: OK — ${checks} checks passed`);
  console.log('BOUNDARY: files on disk only. Runtime-built paths are covered only insofar as the');
  console.log('          WHOLE tree is present; a path that was already wrong is still wrong, and');
  console.log('          nothing here loaded the page or played the game.');
  process.exit(0);
}

// --- selftest: prove each check can fail, on a copy, never on the real tree ---
// --selftest plants into a COPY of whatever --dir names, so it works against
// the CI build (preview/) as well as the local one. It ignored --dir at first
// and always looked at build/web, which would have exited 2 in CI and read as
// "the harness could not run" rather than as a green.
const base = OUT;
if (!existsSync(resolve(base, 'AshenSpire.html'))) {
  console.error(`verify-external --selftest: no build at ${relative(ROOT, base)} — node tools/bundle.mjs --external-art --out ${relative(ROOT, base)}`);
  process.exit(2);
}
const work = mkdtempSync(join(tmpdir(), 'vext-'));
let pass = 0, fail = 0;
const plant = (name, mutate) => {
  const dir = join(work, name.replace(/\W+/g, '-'));
  cpSync(base, dir, { recursive: true });
  mutate(dir);
  const { findings } = verify(dir);
  const red = findings.length > 0;
  console.log(`  ${red ? 'caught' : 'MISSED'}  ${name}`);
  red ? pass++ : fail++;
};
// the clean baseline must be GREEN, or every plant below proves nothing
{
  const dir = join(work, 'clean');
  cpSync(base, dir, { recursive: true });
  const { findings } = verify(dir);
  console.log(`  ${findings.length ? 'DIRTY ' : 'green '}  clean baseline`);
  findings.length ? fail++ : pass++;
}
plant('a deleted asset', (d) => {
  const first = walk(resolve(d, 'assets'))[0];
  unlinkSync(first);
});
plant('an asset whose bytes drifted', (d) => {
  const first = walk(resolve(d, 'assets'))[0];
  writeFileSync(first, Buffer.concat([readFileSync(first), Buffer.from('drift')]));
});
plant('art inlined into a build that should carry none', (d) => {
  const h = resolve(d, 'AshenSpire.html');
  writeFileSync(h, readFileSync(h, 'utf8').replace('</body>', `<img src="data:image/webp;base64,${'A'.repeat(200)}"></body>`));
});
plant('a CSS url pointing at nothing', (d) => {
  const h = resolve(d, 'AshenSpire.html');
  writeFileSync(h, readFileSync(h, 'utf8').replace('url("assets/bg/bg_act1.webp")', 'url("assets/bg/does-not-exist.webp")'));
});
plant('an injected ASSET_MAP — the wrong shape shipped', (d) => {
  const h = resolve(d, 'AshenSpire.html');
  writeFileSync(h, readFileSync(h, 'utf8').replace(/ASSET_MAP = \{\}/g, 'ASSET_MAP = {"assets/x.webp":"data:image/webp;base64,AAAA"}'));
});
rmSync(work, { recursive: true, force: true });
if (fail) { console.log(`verify-external --selftest: RED — ${fail} of ${pass + fail} did not behave`); process.exit(1); }
console.log(`  the clean baseline was green, which is what makes the ${pass - 1} plants mean anything.`);
console.log(`verify-external --selftest: OK — ${pass - 1} plants, ${pass - 1} caught`);
