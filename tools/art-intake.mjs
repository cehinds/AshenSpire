#!/usr/bin/env node
// tools/art-intake.mjs — which files in a pull request belong to the art
// repository (cehinds/AshenSpire-art), and where each one goes there.
//
//   node tools/art-intake.mjs --list --base <sha> --head <sha>
//       one repository path per line, for every file ADDED or MODIFIED in
//       base...head (the diff from the merge base) that the art repository
//       keeps. Files this checkout keeps (the light tier, the score's source)
//       are counted on stderr and not listed. Exit 0 (an empty list is 0).
//   node tools/art-intake.mjs --stage <dir> --base <sha> --head <sha>
//       the same files, read at <head>, copied into a checkout of the art
//       repository at the path it keeps them under (see DESTINATIONS below).
//       Exit 0; prints one "staged <dest>" line per file.
//   node tools/art-intake.mjs --selftest
//       the classification and the diff parser on in-memory cases. Exit 0,
//       or 1 with every failing case named.
//
// Exit codes: 0 ok; 1 a selftest case failed; 2 usage, a bad ref, or a git error.
//
// TRUST BOUNDARY. This file is read and run from the BASE commit only, by
// .github/workflows/art-migrate.yml. A pull request's head is data here: its
// tree is never checked out or executed, and its files are read as git blobs
// (`git cat-file blob <head>:<path>`), which runs no filter or textconv. The
// workflow runs this tool with no art-repository token in its environment; the
// token is used only by the git push and gh steps that follow.
//

// WHICH FILES (owner, 2026-10-11). The art repository holds what
// art-manifest.json's own roots name (tools/art-manifest.mjs, commonSources
// and the high tier): the high tier under assets/ (fonts and sound effects
// included), the score's renders music/manifest.json and music/**/*.mp3, the
// map detail tiles under map-detail/, and the authoring tree art/. NEVER
// migrated: assets-mobile/ (the light tier stays tracked here) and the score's
// source music/score/ (the step-13 note keeps it here).
//
// WHERE THEY GO (the art repository's layout, its README's table):
//   assets/fonts/…         common/assets/fonts/…
//   assets/…               hd/assets/…
//   music/manifest.json,   common/music/…
//     music/**/*.mp3
//   map-detail/…           common/map-detail/…
//   art/…                  art/…
//
// Deletions and renames are not migrated: the art repository is changed by
// its own pull requests, and a deleted file is removed there by hand.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ART_REPO = 'cehinds/AshenSpire-art';

/** A repository path → where the art repository keeps it, or null when it is not an art file. */
export function destinationFor(rel) {
  const p = rel.replace(/^\.\//, '');
  if (p.startsWith('assets/fonts/')) return `common/${p}`;
  if (p.startsWith('assets/')) return `hd/${p}`;
  if (p.startsWith('map-detail/')) return `common/${p}`;
  if (p.startsWith('art/')) return p;
  if (p === 'music/manifest.json' || (p.startsWith('music/') && p.toLowerCase().endsWith('.mp3'))) return `common/${p}`;
  return null;
}

/**
 * classify(rel) → { verdict, dest }. verdict is 'migrate' (an art-repository
 * file, with its dest), 'stays' (an art file this checkout keeps: the light
 * tier, the score's source and notes), or 'ignored' (not art).
 */
export function classify(rel) {
  const p = String(rel).replace(/^\.\//, '');
  if (p.startsWith('assets-mobile/')) return { verdict: 'stays', dest: null };
  if (p.startsWith('music/') && !destinationFor(p)) return { verdict: 'stays', dest: null };
  const dest = destinationFor(p);
  if (dest) return { verdict: 'migrate', dest };
  return { verdict: 'ignored', dest: null };
}

/** The `git diff -z --name-status` output → [{ status, path }] for A and M entries only. */
export function parseNameStatus(text) {
  const parts = String(text).split('\0').filter((s) => s !== '');
  const out = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const status = parts[i];
    const path = parts[i + 1];
    if (status === 'A' || status === 'M') out.push({ status, path });
  }
  return out;
}

/** Sorts a diff's added and modified files into { migrate: [{path, dest}], stays: [path] }. */
export function intake(entries) {
  const migrate = [];
  const stays = [];
  for (const { path } of entries) {
    const c = classify(path);
    if (c.verdict === 'migrate') migrate.push({ path, dest: c.dest });
    else if (c.verdict === 'stays') stays.push(path);
  }
  migrate.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { migrate, stays };
}

/** A ref, a revision expression (origin/dev~20) or a sha a git command may take: no leading dash, no spaces. */
export function checkRef(ref) {
  if (typeof ref !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._\/~^-]*$|^[0-9a-f]{7,64}$/.test(ref)) {
    throw Object.assign(new Error(`not a commit: ${JSON.stringify(ref)}`), { exit: 2 });
  }
  return ref;
}

function git(args, opts = {}) {
  return execFileSync('git', args, { maxBuffer: 1 << 30, ...opts });
}

/** The files a pull request adds or modifies, from the merge base of base and head. */
export function diffEntries(base, head) {
  const out = git(['diff', '-z', '--name-status', '--no-renames', '--diff-filter=AM', `${checkRef(base)}...${checkRef(head)}`]);
  return parseNameStatus(out.toString('utf8'));
}

function parseArgs(argv) {
  const a = { list: false, stage: null, base: null, head: null, selftest: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--list') a.list = true;
    else if (k === '--selftest') a.selftest = true;
    else if (k === '--stage') a.stage = argv[++i];
    else if (k === '--base') a.base = argv[++i];
    else if (k === '--head') a.head = argv[++i];
    else throw Object.assign(new Error(`unknown argument ${JSON.stringify(k)}`), { exit: 2 });
  }
  return a;
}

/**
 * A destination inside the art checkout: relative, with no empty, '.', '..'
 * or '.git' segment, so a staged file can never climb out of the checkout or
 * land in a git directory (its config and hooks).
 */
export function checkDest(dest) {
  const segs = String(dest).split('/');
  if (segs.some((seg) => seg === '' || seg === '.' || seg === '..' || seg === '.git')) {
    throw Object.assign(new Error(`refusing destination ${JSON.stringify(dest)}`), { exit: 2 });
  }
  return dest;
}

/**
 * Writes the bytes of `path` at `head` (a blob, read raw: no textconv, no
 * filters) to `dest`, under the art checkout `dir`.
 */
export function stageFile(dir, path, dest, head) {
  checkDest(dest);
  const bytes = git(['cat-file', 'blob', `${checkRef(head)}:${path}`], { maxBuffer: 1 << 30 });
  const target = resolve(dir, ...dest.split('/'));
  if (!target.startsWith(resolve(dir) + sep)) throw Object.assign(new Error(`${dest} escapes ${dir}`), { exit: 2 });
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  return target;
}

/* ---------- selftest ---------- */

export function selftest() {
  const failures = [];
  const check = (name, got, want) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  };
  check('high tier file migrates to hd/', classify('assets/bg/town.webp'), { verdict: 'migrate', dest: 'hd/assets/bg/town.webp' });
  check('font migrates to common/', classify('assets/fonts/Inter.woff2'), { verdict: 'migrate', dest: 'common/assets/fonts/Inter.woff2' });
  check('sound effect rides the high tier', classify('assets/sfx/click.ogg'), { verdict: 'migrate', dest: 'hd/assets/sfx/click.ogg' });
  check('light tier stays', classify('assets-mobile/bg/town.webp'), { verdict: 'stays', dest: null });
  check('score source stays', classify('music/score/theme.mjs'), { verdict: 'stays', dest: null });
  check('music manifest migrates', classify('music/manifest.json'), { verdict: 'migrate', dest: 'common/music/manifest.json' });
  check('music render migrates', classify('music/town/theme.mp3'), { verdict: 'migrate', dest: 'common/music/town/theme.mp3' });
  check('map tile migrates', classify('map-detail/r1/t.webp'), { verdict: 'migrate', dest: 'common/map-detail/r1/t.webp' });
  check('authoring art migrates', classify('art/poses/a.png'), { verdict: 'migrate', dest: 'art/poses/a.png' });
  check('source file is ignored', classify('src/ui/assetmap.js'), { verdict: 'ignored', dest: null });
  check('asset-data is ignored', classify('asset-data/fonts/OFL.txt'), { verdict: 'ignored', dest: null });
  check('a name that only starts like an art root is ignored', classify('assetsx/a.webp'), { verdict: 'ignored', dest: null });
  const diff = '\0M\0assets/bg/a.webp\0A\0src/x.js\0R\0old\0\0D\0gone.webp\0A\0music/town.mp3\0';
  check('diff parser keeps A and M only', parseNameStatus(diff), [
    { status: 'M', path: 'assets/bg/a.webp' }, { status: 'A', path: 'src/x.js' }, { status: 'A', path: 'music/town.mp3' },
  ]);
  check('intake sorts migrations and names the kept light files', intake([
    { status: 'A', path: 'music/town.mp3' }, { status: 'M', path: 'assets-mobile/a.webp' }, { status: 'A', path: 'assets/a.webp' },
  ]), { migrate: [{ path: 'assets/a.webp', dest: 'hd/assets/a.webp' }, { path: 'music/town.mp3', dest: 'common/music/town.mp3' }], stays: ['assets-mobile/a.webp'] });
  check('a ref starting with a dash is refused', (() => { try { checkRef('--output=/tmp/x'); return 'accepted'; } catch (e) { return e.exit; } })(), 2);
  for (const bad of ['hd/../x', 'art/.git/config', 'common//x', 'art/./x']) {
    check(`a destination ${bad} is refused`, (() => { try { checkDest(bad); return 'accepted'; } catch (e) { return e.exit; } })(), 2);
  }
  check('an ordinary destination is accepted', checkDest('hd/assets/bg/town.webp'), 'hd/assets/bg/town.webp');
  if (failures.length) {
    for (const f of failures) console.error(`art-intake selftest FAIL: ${f}`);
    return 1;
  }
  console.log('art-intake selftest: OK');
  return 0;
}

/* ---------- entry ---------- */

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const a = parseArgs(process.argv.slice(2));
    if (a.selftest) process.exit(selftest());
    if (!a.base || !a.head || (!a.list && !a.stage)) {
      console.error('usage: node tools/art-intake.mjs --list --base <sha> --head <sha> | --stage <dir> --base <sha> --head <sha> | --selftest');
      process.exit(2);
    }
    const { migrate, stays } = intake(diffEntries(a.base, a.head));
    if (a.list) {
      for (const m of migrate) process.stdout.write(`${m.path}\n`);
      process.stderr.write(`art-intake: ${migrate.length} file(s) for ${ART_REPO}; ${stays.length} art file(s) this checkout keeps\n`);
    } else {
      for (const m of migrate) console.log(`staged ${stageFile(a.stage, m.path, m.dest, a.head).slice(resolve(a.stage).length + 1)}`);
      console.log(`art-intake: ${migrate.length} file(s) staged under ${a.stage}`);
    }
    process.exit(0);
  } catch (e) {
    console.error(`art-intake: ${e.message}`);
    process.exit(e.exit || 2);
  }
}
