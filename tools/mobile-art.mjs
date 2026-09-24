#!/usr/bin/env node
// tools/mobile-art.mjs — assets/ → assets-mobile/, and the proof the twin tree
// is complete.
//
//   node tools/mobile-art.mjs            regenerate assets-mobile/ from assets/
//                                        (needs `cwebp` from libwebp on PATH)
//   node tools/mobile-art.mjs --check    every runtime asset has a twin of the
//                                        policy's size, nothing else is there,
//                                        and the tree fits the budget. Node
//                                        core only — this is what CI runs.
//   node tools/mobile-art.mjs --selftest the check catches its known-bads
//
// WHY A COMMITTED TREE AND NOT A BUILD STEP. The bundler is Node core only and
// its output is proven byte-identical on three runners (ci.yml); a WebP encoder
// at build time would break both — Node cannot encode WebP, and two libwebp
// versions do not agree byte for byte. So the shrinking happens ONCE, here, by
// whoever changes art, and the result is committed beside the source the way
// assets/ is committed beside art/. What CI proves is the part that can be
// proven without an encoder: that the twin tree is a complete, correctly-sized
// mirror of the runtime art, so `bundle.mjs --mobile` cannot ship a build that
// falls back to a placeholder on the third weapon.
//
// The policy itself — which files shrink, how much, how they are judged — is in
// tools/mobileart-policy.mjs, the one home this tool and the bundler share.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync, mkdtempSync } from 'node:fs';
import { spawnSync, execFile } from 'node:child_process';
import { resolve, relative, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { readdirSortedSync } from './dirorder.mjs';
import { MIME, runtimeAsset } from './assetmime.mjs';
import {
  MOBILE_ASSET_DIR, POLICY, MOBILE_ART_INLINED_BUDGET_BYTES,
  inlinedBytes, distinctInlinedBytes, webpDimensions, twinDimensions,
} from './mobileart-policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2);
const has = (f) => ARGV.includes(f);
const flag = (f, d) => { const i = ARGV.indexOf(f); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const TREE = resolve(flag('--root', ROOT));
const SOURCE_DIR = resolve(TREE, 'assets');
const TWIN_DIR = resolve(TREE, MOBILE_ASSET_DIR);

const posix = (p) => p.split(/[\\/]/g).join('/');

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSortedSync(dir, { withFileTypes: true })) {
    const abs = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

/** Every file the full build ships from `srcDir`, by the bundler's own two rules. */
export function runtimeArt(srcDir) {
  return walk(srcDir)
    .map((abs) => ({ abs, rel: posix(relative(srcDir, abs)) }))
    .filter(({ rel }) => runtimeAsset(rel) && Object.prototype.hasOwnProperty.call(MIME, extname(rel).toLowerCase()));
}

const canonicalText = (buf) => buf.toString('utf8').replace(/\r\n?/g, '\n');

/**
 * verify(srcDir, twinDir) → { findings, checks, files, rawBytes, inlined }.
 * Pure over two directories; never throws on a bad tree, it names it.
 */
export function verify(srcDir, twinDir, { budget = MOBILE_ART_INLINED_BUDGET_BYTES, policy = POLICY, listAtMost = 5 } = {}) {
  const findings = [];
  const missing = [];
  let checks = 0;
  let rawBytes = 0;
  let inlined = 0;
  const inlinedFiles = [];
  const wanted = runtimeArt(srcDir);
  if (!wanted.length) findings.push(`no runtime art found under ${posix(relative(TREE, srcDir) || srcDir)} — nothing to twin`);
  const twins = new Set(walk(twinDir).map((abs) => posix(relative(twinDir, abs))));
  const name = (rel) => `${MOBILE_ASSET_DIR}/${rel}`;
  for (const { rel, abs } of wanted) {
    checks += 1;
    if (!twins.has(rel)) { missing.push(name(rel)); continue; }
    twins.delete(rel);
    const src = readFileSync(abs);
    const out = readFileSync(resolve(twinDir, rel));
    rawBytes += out.length;
    inlinedFiles.push(out);
    if (extname(rel).toLowerCase() === '.webp') {
      const s = webpDimensions(src);
      const t = webpDimensions(out);
      if (!s) findings.push(`source is not a WebP the policy can size: assets/${rel}`);
      else if (!t) findings.push(`twin is not a WebP: ${name(rel)}`);
      else {
        const want = twinDimensions(s, policy);
        if (t.width !== want.width || t.height !== want.height) {
          findings.push(`twin is ${t.width}×${t.height}, the policy wants ${want.width}×${want.height} of a ${s.width}×${s.height} source: ${name(rel)}`);
        }
      }
      // Only an UNRESIZED twin is held to its source's byte count: the generator
      // keeps the source bytes when a same-size re-encode grows, so a larger
      // unresized twin is a generator that skipped that rule. A resized one is
      // policed by its dimensions above and may, for a tiny near-empty frame,
      // legitimately encode a few bytes larger.
      const resized = s && t && (t.width !== s.width || t.height !== s.height);
      if (!resized && out.length > src.length) findings.push(`twin is larger than its source (${out.length} > ${src.length} bytes): ${name(rel)}`);
    } else {
      const same = extname(rel).toLowerCase() === '.svg' ? canonicalText(src) === canonicalText(out) : src.equals(out);
      if (!same) findings.push(`twin differs from a source the policy copies verbatim: ${name(rel)}`);
    }
  }
  if (missing.length) {
    findings.push(...missing.slice(0, listAtMost).map((m) => `missing twin: ${m}`));
    if (missing.length > listAtMost) findings.push(`… and ${missing.length - listAtMost} more missing twins`);
  }
  const stray = [...twins].sort();
  findings.push(...stray.slice(0, listAtMost).map((s) => `stray file with no source under assets/: ${name(s)}`));
  if (stray.length > listAtMost) findings.push(`… and ${stray.length - listAtMost} more stray files`);
  checks += 1;
  // The bundle inlines each distinct image once (duplicates are aliased), so
  // the budget is held to that, not to the sum of every path.
  inlined = distinctInlinedBytes(inlinedFiles);
  if (inlined > budget) findings.push(`the twin tree inlines to ${inlined} bytes, over the ${budget}-byte budget — tighten tools/mobileart-policy.mjs or cut art`);
  return { findings, checks, files: wanted.length, rawBytes, inlined };
}

// ---------------------------------------------------------------------------
// Generation — the only part that needs an encoder.
// ---------------------------------------------------------------------------
const run = promisify(execFile);

async function encodeOne(srcAbs, destAbs, policy) {
  const src = readFileSync(srcAbs);
  mkdirSync(dirname(destAbs), { recursive: true });
  if (extname(srcAbs).toLowerCase() !== '.webp') { writeFileSync(destAbs, src); return; }
  const dims = webpDimensions(src);
  if (!dims) throw new Error(`not a WebP: ${srcAbs}`);
  const want = twinDimensions(dims, policy);
  const resized = want.width !== dims.width || want.height !== dims.height;
  // No -mt: multithreaded encoding is what could make two runs disagree, and
  // the parallelism lives across files instead (WORKERS below).
  const args = ['-quiet', '-m', '6', '-q', String(policy.quality), '-alpha_q', String(policy.alphaQuality), '-alpha_filter', 'best'];
  if (resized) args.push('-resize', String(want.width), String(want.height));
  args.push(srcAbs, '-o', destAbs);
  await run('cwebp', args);
  // A re-encode at the same size that grew is worse than the source; keep the
  // source bytes. A resized one is always taken — it is smaller in pixels, and
  // --check holds it to the policy's dimensions, not to a byte count.
  if (!resized && statSync(destAbs).size >= src.length) writeFileSync(destAbs, src);
}

async function generate(srcDir, twinDir, policy = POLICY) {
  const probe = spawnSync('cwebp', ['-version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    console.error('mobile-art: cwebp is not on PATH — install libwebp (apt: webp; brew: webp; https://developers.google.com/speed/webp/download) and retry.');
    console.error('mobile-art: nothing was written. --check needs no encoder and still runs.');
    process.exit(2);
  }
  console.log(`mobile-art: cwebp ${probe.stdout.trim().split('\n')[0]} — policy q${policy.quality} alpha_q${policy.alphaQuality}, ×${policy.scale} from ${policy.scaleFrom}px`);
  rmSync(twinDir, { recursive: true, force: true });
  const wanted = runtimeArt(srcDir);
  let next = 0;
  let done = 0;
  const WORKERS = 4;
  const worker = async () => {
    while (next < wanted.length) {
      const item = wanted[next++];
      await encodeOne(item.abs, resolve(twinDir, item.rel), policy);
      done += 1;
      if (done % 500 === 0) console.log(`  ${done}/${wanted.length}`);
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));
  console.log(`mobile-art: wrote ${done} twins → ${posix(relative(TREE, twinDir))}`);
}

// ---------------------------------------------------------------------------
// Selftest — the check against a fixture whose right answer is typed here.
// ---------------------------------------------------------------------------
/** A syntactically valid VP8L WebP header of the given size, padded to `bytes`. */
function fakeWebp(width, height, bytes = 64) {
  const buf = Buffer.alloc(Math.max(bytes, 30));
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(buf.length - 8, 4);
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8L', 12, 'ascii');
  buf.writeUInt32LE(buf.length - 20, 16);
  buf[20] = 0x2f;
  buf.writeUInt32LE(((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14), 21);
  return buf;
}

function selftest() {
  const dir = mkdtempSync(resolve(tmpdir(), 'mobile-art-selftest-'));
  const src = resolve(dir, 'assets');
  const twin = resolve(dir, MOBILE_ASSET_DIR);
  const put = (base, rel, bytes) => { const p = resolve(base, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, bytes); };
  const good = () => {
    rmSync(src, { recursive: true, force: true });
    rmSync(twin, { recursive: true, force: true });
    put(src, 'animations/x/ATK-01.webp', fakeWebp(512, 512, 4000));
    put(src, 'poses/small.webp', fakeWebp(200, 100, 900));
    put(src, 'bg/mask.svg', Buffer.from('<svg/>\r\n'));
    put(src, 'equipment/components/experiment.webp', fakeWebp(512, 512, 4000)); // authoring-only: no twin wanted
    put(src, 'animations/README.md', Buffer.from('not art\n'));                 // no MIME: no twin wanted
    put(twin, 'animations/x/ATK-01.webp', fakeWebp(256, 256, 800));
    put(twin, 'poses/small.webp', fakeWebp(200, 100, 700));
    put(twin, 'bg/mask.svg', Buffer.from('<svg/>\n'));
  };
  const plants = [
    ['control: a complete twin tree passes', () => {}, null],
    ['a twin is missing', () => rmSync(resolve(twin, 'poses/small.webp')), /missing twin: assets-mobile\/poses\/small\.webp/],
    ['a twin nothing sources', () => put(twin, 'poses/ghost.webp', fakeWebp(10, 10)), /stray file .*assets-mobile\/poses\/ghost\.webp/],
    ['a big source was not shrunk', () => put(twin, 'animations/x/ATK-01.webp', fakeWebp(512, 512, 800)), /twin is 512×512, the policy wants 256×256/],
    ['a small source was shrunk anyway', () => put(twin, 'poses/small.webp', fakeWebp(100, 50, 700)), /twin is 100×50, the policy wants 200×100/],
    ['a twin grew past its source', () => put(twin, 'poses/small.webp', fakeWebp(200, 100, 901)), /larger than its source \(901 > 900 bytes\)/],
    ['a verbatim copy that is not verbatim', () => put(twin, 'bg/mask.svg', Buffer.from('<svg id="x"/>\n')), /differs from a source the policy copies verbatim/],
    ['a twin that is not a WebP', () => put(twin, 'poses/small.webp', Buffer.from('not a webp at all, but long enough to read')), /twin is not a WebP/],
    ['the tree is over budget', () => {}, /over the 1000-byte budget/, { budget: 1000 }],
    ['an empty source tree', () => rmSync(src, { recursive: true, force: true }), /no runtime art found/],
  ];
  let bad = 0;
  let caught = 0;
  for (const [label, plant, want, opts] of plants) {
    good();
    plant();
    const r = verify(src, twin, opts);
    const ok = want ? r.findings.some((f) => want.test(f)) : r.findings.length === 0;
    if (ok && want) caught += 1;
    console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${ok ? '' : `\n         findings: ${r.findings.join(' | ') || '(none)'}`}`);
    if (!ok) bad += 1;
  }
  rmSync(dir, { recursive: true, force: true });
  if (bad) {
    console.error(`mobile-art --selftest: ${bad} case(s) landed on the wrong verdict`);
    process.exit(1);
  }
  // The terminated line is in tools/verdict.mjs's `N <words>, N caught` form —
  // the CI door refuses any other shape — so the control is stated on its own line.
  console.log('  (plus 1 control: a complete twin tree passes)');
  console.log(`mobile-art --selftest: OK — ${caught} known-bads, ${caught} caught`);
}

function boundary() {
  console.log('BOUNDARY: this proves the twin tree MIRRORS the runtime art at the policy\'s');
  console.log('          sizes and fits the art budget. It does not look at a pixel, so a');
  console.log('          twin that is the right size and the wrong picture passes; that is');
  console.log('          the generator\'s honesty, and a browser\'s. The bundle\'s own size');
  console.log('          is tools/verify-shipped.mjs\'s subject, not this tool\'s.');
}

if (has('--selftest')) {
  selftest();
} else if (has('--check')) {
  const r = verify(SOURCE_DIR, TWIN_DIR);
  for (const f of r.findings) console.log(`  FAIL  ${f}`);
  if (r.findings.length) {
    console.error(`mobile-art --check: FAILED — ${r.findings.length} finding(s) across ${r.files} runtime assets.`);
    console.error('  Fix: node tools/mobile-art.mjs   (regenerates assets-mobile/ with cwebp on PATH)');
    boundary();
    process.exit(1);
  }
  console.log(`  ${r.files} twins, ${r.rawBytes} bytes raw, inlining to ${r.inlined} of the ${MOBILE_ART_INLINED_BUDGET_BYTES}-byte budget`);
  // The verdict line carries the count and nothing after it: tools/verdict.mjs
  // matches `label: OK — N checks passed` to the end of the line.
  console.log(`mobile-art --check: OK — ${r.checks} checks passed.`);
  boundary();
} else {
  await generate(SOURCE_DIR, TWIN_DIR);
  const r = verify(SOURCE_DIR, TWIN_DIR);
  for (const f of r.findings) console.log(`  FAIL  ${f}`);
  if (r.findings.length) {
    console.error(`mobile-art: generated, but the tree does not pass its own check — ${r.findings.length} finding(s).`);
    process.exit(1);
  }
  console.log(`mobile-art: OK — ${r.files} twins, ${r.rawBytes} bytes raw, inlines to ${r.inlined} of ${MOBILE_ART_INLINED_BUDGET_BYTES}`);
  boundary();
}
