#!/usr/bin/env node
// Reject hand-rolled conversion between module URLs and filesystem paths.
// Platform conversions belong to node:url: pathToFileURL / fileURLToPath.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['tools', 'tests'];
const SELF = 'tools/urlpath-conversions.mjs';
const KNOWN_BAD = 'tests/fixtures/urlpath/';

const slash = (path) => path.split(/[\\/]/).join('/');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.(?:mjs|js)$/.test(entry.name)) out.push(path);
  }
  return out;
}

// Preserve strings because the forbidden file:// construction lives inside a
// string/template. Blank comments so examples and boundary prose cannot count.
function stripComments(source) {
  let out = '';
  let mode = 'code';
  let quote = '';
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
    if (mode === 'line') {
      if (char === '\n') { mode = 'code'; out += '\n'; } else out += ' ';
      continue;
    }
    if (mode === 'block') {
      if (char === '*' && next === '/') { out += '  '; i++; mode = 'code'; }
      else out += char === '\n' ? '\n' : ' ';
      continue;
    }
    if (mode === 'string') {
      out += char;
      if (char === '\\') { if (i + 1 < source.length) out += source[++i]; continue; }
      if (char === quote) mode = 'code';
      continue;
    }
    if (char === '/' && next === '/') { out += '  '; i++; mode = 'line'; continue; }
    if (char === '/' && next === '*') { out += '  '; i++; mode = 'block'; continue; }
    if (char === '"' || char === "'" || char === '`') { quote = char; mode = 'string'; out += char; continue; }
    out += char;
  }
  return out;
}

const lineAt = (source, index) => source.slice(0, index).split('\n').length;

export function collect(root = ROOT, { dirs = SCAN_DIRS, excludeKnownBad = true } = {}) {
  const files = dirs.flatMap((dir) => walk(resolve(root, dir)));
  const findings = [];
  for (const file of files) {
    const rel = slash(relative(root, file));
    if (rel === SELF || (excludeKnownBad && rel.startsWith(KNOWN_BAD))) continue;
    const code = stripComments(readFileSync(file, 'utf8'));
    const rules = [
      {
        kind: 'hand-rolled file URL',
        pattern: /`file:\/\/\$\{|(["'])file:\/\/\1\s*\+/g,
      },
      {
        kind: 'URL pathname used as a filesystem path',
        pattern: /new\s+URL\s*\([^;]*import\.meta\.url[^;]*\)\s*\.pathname/g,
      },
    ];
    for (const rule of rules) {
      for (const match of code.matchAll(rule.pattern)) {
        findings.push({ path: rel, line: lineAt(code, match.index), kind: rule.kind });
      }
    }
  }
  return { files: files.length, findings };
}

function report(root = ROOT) {
  const result = collect(root);
  for (const finding of result.findings) {
    console.log(`FINDING ${finding.path}:${finding.line} — ${finding.kind}`);
  }
  console.log(`RESULT: scanned ${result.files} JavaScript module(s) under tools/ and tests/; ${result.findings.length} unconverted module URL/filesystem path site(s).`);
  console.log(`EXCLUDED: ${KNOWN_BAD} is the deliberate known-bad corpus; --selftest proves both fixtures.`);
  console.log('BOUNDARY: this catches direct file:// interpolation/concatenation and direct new URL(..., import.meta.url).pathname. It does not prove every platform-API call is semantically correct.');
  return result.files ? (result.findings.length ? 1 : 0) : 2;
}

function runFixture(file, cwd) {
  try {
    const out = execFileSync(process.execPath, [file], { cwd, encoding: 'utf8' });
    return { code: 0, out };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout || ''}${error.stderr || ''}` };
  }
}

function selftest() {
  let failures = 0;
  const say = (ok, label, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures++;
  };

  const clean = collect(ROOT);
  say(clean.findings.length === 0, 'clean tree has no hand-rolled conversion', clean.findings.map((finding) => `${finding.path}:${finding.line}`).join(', '));

  const fixtureRoot = resolve(ROOT, 'tests/fixtures/urlpath');
  const fixtureScan = collect(fixtureRoot, { dirs: ['.'], excludeKnownBad: false });
  const fixtureKinds = new Map(fixtureScan.findings.map((finding) => [finding.path, finding.kind]));
  const pathFixtureSource = readFileSync(join(fixtureRoot, 'handrolled_path.mjs'), 'utf8');
  say(fixtureScan.findings.length === 2, 'fixture corpus has exactly the two required findings', `${fixtureScan.findings.length}/2`);
  say(fixtureKinds.get('handrolled_url.mjs') === 'hand-rolled file URL', 'handrolled_url fixture is caught by the real scanner');
  say(fixtureKinds.get('handrolled_path.mjs') === 'URL pathname used as a filesystem path', 'handrolled_path fixture is caught by the real scanner');
  say(/new\s+URL\s*\(\r?\n/.test(pathFixtureSource) && /\r?\n\)\.pathname/.test(pathFixtureSource),
    'handrolled_path fixture keeps the discriminating multiline conversion shape');

  const temp = mkdtempSync(join(tmpdir(), 'urlpath working dir '));
  const spaced = join(temp, 'repo with spaces');
  mkdirSync(spaced, { recursive: true });
  const copiedUrl = join(spaced, 'handrolled_url.mjs');
  const copiedPath = join(spaced, 'handrolled_path.mjs');
  copyFileSync(join(fixtureRoot, 'handrolled_url.mjs'), copiedUrl);
  copyFileSync(join(fixtureRoot, 'handrolled_path.mjs'), copiedPath);
  try {
    const urlRun = runFixture(copiedUrl, spaced);
    say(urlRun.code === 0 && urlRun.out.trim() === '', 'spaced cwd makes the hand-rolled main guard observably silent', `exit ${urlRun.code}, output ${JSON.stringify(urlRun.out.trim())}`);
    const pathRun = runFixture(copiedPath, spaced);
    say(pathRun.code === 1 && /%20/.test(pathRun.out) && /exists=false/.test(pathRun.out), 'spaced cwd leaves the hand-rolled pathname encoded and missing', `exit ${pathRun.code}, ${pathRun.out.trim()}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  console.log(`RESULT: clean tree ${clean.findings.length ? 'RED' : 'GREEN'}; required fixtures caught ${fixtureScan.findings.length}/2; spaced-working-directory symptoms proved ${failures ? 'with failures' : '2/2'}.`);
  return failures ? 1 : 0;
}

if (process.argv.includes('--selftest')) process.exit(selftest());
process.exit(report());
