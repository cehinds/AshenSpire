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
const MAX_SOURCE_BYTES = 1024 * 1024;
const MAX_TOKENS = 250000;
const MAX_ALIAS_STEPS = 250000;
const REGEX_PREFIX_WORDS = new Set([
  'await', 'case', 'delete', 'do', 'else', 'in', 'instanceof', 'new',
  'of', 'return', 'throw', 'typeof', 'void', 'yield',
]);
const REGEX_PREFIX_PUNCT = new Set([
  '(', '[', '{', ',', ':', ';', '=', '=>', '!', '?', '?.', '&&', '||',
  '??', '+', '-', '*', '**', '%', '^', '~', '<', '>', '<=', '>=', '&', '|',
]);
const ASSIGNMENTS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&&=', '||=', '??=', '&=', '|=', '^=']);
const PUNCTUATORS = [
  '>>>=', '===', '!==', '>>>', '**=', '&&=', '||=', '??=', '<<=', '>>=', '...',
  '=>', '==', '!=', '<=', '>=', '++', '--', '&&', '||', '??', '**', '?.',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>',
];

const regexMayStart = (previous) =>
  !previous || REGEX_PREFIX_PUNCT.has(previous.value) ||
  (previous.type === 'identifier' && REGEX_PREFIX_WORDS.has(previous.value));

function regexMayStartAfterTokens(tokens) {
  const previous = tokens.at(-1);
  if (regexMayStart(previous)) return true;
  if (previous?.value !== ')') return false;
  let depth = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].value === ')') depth++;
    else if (tokens[i].value === '(' && --depth === 0) {
      return ['if', 'while', 'for', 'with', 'catch'].includes(tokens[i - 1]?.value);
    }
  }
  return false;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.(?:mjs|js)$/.test(entry.name)) out.push(path);
  }
  return out;
}

const lineAt = (source, index) => source.slice(0, index).split('\n').length;

function decodeEscapedBody(raw, start, end) {
  let out = '';
  for (let i = start; i < end; i++) {
    if (raw[i] !== '\\') { out += raw[i]; continue; }
    const next = raw[++i];
    if (next === 'x' && /^[0-9a-fA-F]{2}$/.test(raw.slice(i + 1, i + 3))) {
      out += String.fromCharCode(parseInt(raw.slice(i + 1, i + 3), 16)); i += 2; continue;
    }
    if (next === 'u' && raw[i + 1] === '{') {
      const close = raw.indexOf('}', i + 2);
      if (close > i && /^[0-9a-fA-F]+$/.test(raw.slice(i + 2, close))) {
        out += String.fromCodePoint(parseInt(raw.slice(i + 2, close), 16)); i = close; continue;
      }
    }
    if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(raw.slice(i + 1, i + 5))) {
      out += String.fromCharCode(parseInt(raw.slice(i + 1, i + 5), 16)); i += 4; continue;
    }
    if (next === '\n') continue;
    if (next === '\r' && raw[i + 1] === '\n') { i++; continue; }
    out += ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' })[next] ?? next;
  }
  return out;
}

const decodeString = (raw) => decodeEscapedBody(raw, 1, raw.length - 1);

function templateStaticPrefix(raw) {
  let end = raw.length - 1;
  for (let i = 1; i < raw.length - 1; i++) {
    if (raw[i] === '\\') { i++; continue; }
    if (raw[i] === '$' && raw[i + 1] === '{') { end = i; break; }
  }
  return decodeEscapedBody(raw, 1, end);
}

function scanQuoted(source, start, quote, errors) {
  for (let i = start + 1; i < source.length; i++) {
    if (source[i] === '\\') { i++; continue; }
    if (source[i] === quote) return i + 1;
    if ((quote === '"' || quote === "'") && (source[i] === '\n' || source[i] === '\r')) break;
  }
  errors.push({ index: start, reason: `unterminated ${quote === '`' ? 'template' : 'string'} literal` });
  return source.length;
}

function scanRegex(source, start, errors) {
  let inClass = false;
  for (let i = start + 1; i < source.length; i++) {
    if (source[i] === '\\') { i++; continue; }
    if (source[i] === '[' && !inClass) { inClass = true; continue; }
    if (source[i] === ']' && inClass) { inClass = false; continue; }
    if (source[i] === '/' && !inClass) {
      i++;
      while (/[A-Za-z]/.test(source[i] || '')) i++;
      return i;
    }
    if (source[i] === '\n' || source[i] === '\r') break;
  }
  errors.push({ index: start, reason: 'unterminated regex literal' });
  return source.length;
}

function scanTemplate(source, start, errors) {
  let interpolationDepth = 0;
  let previous = null;
  for (let i = start + 1; i < source.length;) {
    if (!interpolationDepth) {
      if (source[i] === '\\') { i += 2; continue; }
      if (source[i] === '`') return i + 1;
      if (source[i] === '$' && source[i + 1] === '{') { interpolationDepth = 1; previous = null; i += 2; continue; }
      i++; continue;
    }
    if (/\s/.test(source[i])) { i++; continue; }
    if (source[i] === '/' && source[i + 1] === '/') {
      i += 2; while (i < source.length && source[i] !== '\n') i++; continue;
    }
    if (source[i] === '/' && source[i + 1] === '*') {
      const close = source.indexOf('*/', i + 2);
      if (close < 0) { errors.push({ index: i, reason: 'unterminated block comment in template expression' }); return source.length; }
      i = close + 2; continue;
    }
    if (source[i] === '"' || source[i] === "'") {
      const end = scanQuoted(source, i, source[i], errors);
      previous = { type: 'string', value: source.slice(i, end) }; i = end; continue;
    }
    if (source[i] === '`') {
      const end = scanTemplate(source, i, errors);
      previous = { type: 'template', value: source.slice(i, end) }; i = end; continue;
    }
    if (source[i] === '/' && regexMayStart(previous)) {
      const end = scanRegex(source, i, errors);
      previous = { type: 'regex', value: source.slice(i, end) }; i = end; continue;
    }
    if (/[A-Za-z_$]/.test(source[i])) {
      const tokenStart = i++; while (/[A-Za-z0-9_$]/.test(source[i] || '')) i++;
      previous = { type: 'identifier', value: source.slice(tokenStart, i) }; continue;
    }
    if (/[0-9]/.test(source[i])) {
      const tokenStart = i++; while (/[A-Za-z0-9_.]/.test(source[i] || '')) i++;
      previous = { type: 'number', value: source.slice(tokenStart, i) }; continue;
    }
    const punct = PUNCTUATORS.find((value) => source.startsWith(value, i)) || source[i];
    i += punct.length;
    if (punct === '{') interpolationDepth++;
    else if (punct === '}' && --interpolationDepth === 0) { previous = null; continue; }
    previous = { type: 'punct', value: punct };
  }
  errors.push({ index: start, reason: 'unterminated template literal' });
  return source.length;
}

function lexJavaScript(source) {
  const tokens = [];
  const errors = [];
  if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
    return { tokens, errors: [{ index: 0, reason: `source exceeds ${MAX_SOURCE_BYTES} byte scanner cap` }] };
  }
  for (let i = 0; i < source.length;) {
    if (/\s/.test(source[i])) { i++; continue; }
    if (source[i] === '/' && source[i + 1] === '/') {
      i += 2; while (i < source.length && source[i] !== '\n') i++; continue;
    }
    if (source[i] === '/' && source[i + 1] === '*') {
      const start = i; const close = source.indexOf('*/', i + 2);
      if (close < 0) { errors.push({ index: start, reason: 'unterminated block comment' }); break; }
      i = close + 2; continue;
    }
    const start = i;
    if (source[i] === '"' || source[i] === "'") {
      i = scanQuoted(source, i, source[i], errors);
      const raw = source.slice(start, i);
      tokens.push({ type: 'string', value: decodeString(raw), raw, start, end: i });
    } else if (source[i] === '`') {
      i = scanTemplate(source, i, errors);
      const raw = source.slice(start, i);
      tokens.push({ type: 'template', value: raw.slice(1, -1), raw, start, end: i });
    } else if (/[A-Za-z_$]/.test(source[i])) {
      i++; while (/[A-Za-z0-9_$]/.test(source[i] || '')) i++;
      tokens.push({ type: 'identifier', value: source.slice(start, i), start, end: i });
    } else if (/[0-9]/.test(source[i])) {
      i++; while (/[A-Za-z0-9_.]/.test(source[i] || '')) i++;
      tokens.push({ type: 'number', value: source.slice(start, i), start, end: i });
    } else if (source[i] === '/' && regexMayStartAfterTokens(tokens)) {
      i = scanRegex(source, i, errors);
      tokens.push({ type: 'regex', value: source.slice(start, i), start, end: i });
    } else {
      const punct = PUNCTUATORS.find((value) => source.startsWith(value, i)) || source[i];
      i += punct.length;
      tokens.push({ type: 'punct', value: punct, start, end: i });
    }
    if (tokens.length > MAX_TOKENS) {
      errors.push({ index: start, reason: `token count exceeds ${MAX_TOKENS} scanner cap` });
      break;
    }
  }
  return { tokens, errors };
}

function findClose(tokens, opening, left = '(', right = ')') {
  let depth = 0;
  for (let i = opening; i < tokens.length; i++) {
    if (tokens[i].value === left) depth++;
    else if (tokens[i].value === right && --depth === 0) return i;
  }
  return -1;
}

function hasImportMetaUrl(tokens, start, end) {
  for (let i = start; i + 4 < end; i++) {
    if (tokens[i].value === 'import' && tokens[i + 1].value === '.' &&
        tokens[i + 2].value === 'meta' && tokens[i + 3].value === '.' && tokens[i + 4].value === 'url') return true;
  }
  return false;
}

function groupDepthBefore(tokens, start) {
  let depth = 0;
  let cursor = start;
  while (tokens[cursor - 1]?.value === '(' && regexMayStart(tokens[cursor - 2])) { depth++; cursor--; }
  return depth;
}

function memberPathnameAt(tokens, start) {
  let i = start;
  const optional = tokens[i]?.value === '?.';
  if (optional) i++;
  if (optional && tokens[i]?.type === 'identifier' && tokens[i].value === 'pathname') return { end: i + 1 };
  if (tokens[i]?.value === '.' && tokens[i + 1]?.type === 'identifier' && tokens[i + 1].value === 'pathname') {
    return { end: i + 2 };
  }
  if (tokens[i]?.value === '[' && tokens[i + 1]?.type === 'string' &&
      tokens[i + 1].value === 'pathname' && tokens[i + 2]?.value === ']') return { end: i + 3 };
  return null;
}

function accessAfterExpression(tokens, start, end) {
  const groups = groupDepthBefore(tokens, start);
  let cursor = end + 1;
  for (let i = 0; i < groups; i++) {
    if (tokens[cursor]?.value !== ')') return null;
    cursor++;
  }
  return memberPathnameAt(tokens, cursor);
}

function destructureBefore(tokens, assignment) {
  if (tokens[assignment - 1]?.value !== '}') return { pathname: false, dynamic: false };
  let depth = 0;
  for (let i = assignment - 1; i >= 0; i--) {
    if (tokens[i].value === '}') depth++;
    else if (tokens[i].value === '{' && --depth === 0) {
      const body = tokens.slice(i + 1, assignment - 1);
      return {
        pathname: body.some((token) => (token.type === 'identifier' || token.type === 'string') && token.value === 'pathname'),
        dynamic: body.some((token) => token.value === '['),
      };
    }
  }
  return { pathname: false, dynamic: false };
}

function findOpenBackward(tokens, close, left = '(', right = ')') {
  let depth = 0;
  for (let i = close; i >= 0; i--) {
    if (tokens[i].value === right) depth++;
    else if (tokens[i].value === left && --depth === 0) return i;
  }
  return -1;
}

function parameterScopes(tokens) {
  const atBrace = new Map();
  const parameterIndexes = new Set();
  for (let brace = 0; brace < tokens.length; brace++) {
    if (tokens[brace].value !== '{') continue;
    let open = -1;
    let close = -1;
    if (tokens[brace - 1]?.value === '=>') {
      close = brace - 2;
      if (tokens[close]?.value === ')') open = findOpenBackward(tokens, close);
      else if (tokens[close]?.type === 'identifier') open = close;
    } else if (tokens[brace - 1]?.value === ')') {
      close = brace - 1;
      open = findOpenBackward(tokens, close);
      const before = tokens[open - 1];
      const functionKeyword = before?.value === 'function' || tokens[open - 2]?.value === 'function';
      const catchKeyword = before?.value === 'catch';
      const methodShape = before?.type === 'identifier' && !['if', 'while', 'for', 'with', 'switch'].includes(before.value);
      if (!functionKeyword && !catchKeyword && !methodShape) open = -1;
    }
    if (open < 0 || close < open) continue;
    const names = new Set();
    for (let i = open; i <= close; i++) {
      if (tokens[i].type !== 'identifier') continue;
      if (['function', 'const', 'let', 'var'].includes(tokens[i - 1]?.value)) continue;
      names.add(tokens[i].value);
      parameterIndexes.add(i);
    }
    atBrace.set(brace, names);
  }
  return { atBrace, parameterIndexes };
}

function findUrlExpressions(tokens, errors) {
  const urls = new Map();
  for (let i = 0; i + 2 < tokens.length; i++) {
    if (tokens[i].value !== 'new' || tokens[i + 1].value !== 'URL' || tokens[i + 2].value !== '(') continue;
    const close = findClose(tokens, i + 2);
    if (close < 0) { errors.push({ index: tokens[i].start, reason: 'unbalanced new URL call' }); continue; }
    if (hasImportMetaUrl(tokens, i + 3, close)) urls.set(i, { start: i, close });
  }
  return urls;
}

function unwrapAssigned(tokens, start, urls, isAlias) {
  let cursor = start;
  while (tokens[cursor]?.value === '(') cursor++;
  if (urls.has(cursor)) {
    const url = urls.get(cursor);
    if (!accessAfterExpression(tokens, url.start, url.close)) return { kind: 'url', index: cursor };
    return null;
  }
  if (tokens[cursor]?.type === 'identifier' && isAlias(tokens[cursor].value)) return { kind: 'alias', index: cursor };
  return null;
}

function findPathnameMisuses(tokens, errors) {
  const urls = findUrlExpressions(tokens, errors);
  const findings = [];
  const seen = new Set();
  const scopes = [new Map()];
  const parameters = parameterScopes(tokens);
  let aliasSteps = 0;
  const isAlias = (name) => {
    for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) return scopes[i].get(name);
    return false;
  };
  const setAlias = (name, value, declaration = false) => {
    if (declaration) { scopes.at(-1).set(name, value); return; }
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].has(name)) { scopes[i].set(name, value); return; }
    }
    scopes.at(-1).set(name, value);
  };
  const add = (index, kind = 'URL pathname used as a filesystem path') => {
    const offset = tokens[index]?.start ?? 0;
    const key = `${kind}:${offset}`;
    if (!seen.has(key)) { seen.add(key); findings.push({ index: offset, kind }); }
  };

  for (const url of urls.values()) {
    if (accessAfterExpression(tokens, url.start, url.close)) add(url.start);
  }

  for (let i = 0; i < tokens.length; i++) {
    if (++aliasSteps > MAX_ALIAS_STEPS) {
      errors.push({ index: tokens[i]?.start ?? 0, reason: `alias work exceeds ${MAX_ALIAS_STEPS} step scanner cap` });
      break;
    }
    const token = tokens[i];
    if (token.value === '{') {
      const scope = new Map();
      for (const name of parameters.atBrace.get(i) || []) scope.set(name, false);
      scopes.push(scope);
    }
    if (token.value === '}') { if (scopes.length > 1) scopes.pop(); continue; }

    if (ASSIGNMENTS.has(token.value)) {
      const declaration = ['const', 'let', 'var'].includes(tokens[i - 2]?.value);
      const lhs = tokens[i - 1];
      const assigned = token.value === '=' ? unwrapAssigned(tokens, i + 1, urls, isAlias) : null;
      const destructure = destructureBefore(tokens, i);
      if (destructure.pathname && assigned) add(assigned.index);
      else if (destructure.dynamic && assigned) add(assigned.index, 'ambiguous module URL alias flow');
      if (lhs?.type === 'identifier') setAlias(lhs.value, Boolean(assigned), declaration);
      continue;
    }

    if (token.type !== 'identifier') continue;
    if (['const', 'let', 'var'].includes(tokens[i - 1]?.value)) {
      setAlias(token.value, false, true);
      continue;
    }
    if (parameters.parameterIndexes.has(i) || !isAlias(token.value)) continue;
    const access = accessAfterExpression(tokens, i, i);
    if (access) {
      if (!ASSIGNMENTS.has(tokens[access.end]?.value)) add(i);
      continue;
    }
    const previous = tokens[i - 1];
    const next = tokens[i + 1];
    const isAssignmentRhs = previous?.value === '=' && tokens[i - 2]?.type === 'identifier' &&
      !['.', '?.', ']'].includes(tokens[i - 3]?.value);
    const isStaticNonPathMember = next?.value === '.' && tokens[i + 2]?.type === 'identifier';
    const isPlatformConsumer = previous?.value === '(' && tokens[i - 2]?.value === 'fileURLToPath' && next?.value === ')';
    if (!isAssignmentRhs && !isStaticNonPathMember && !isPlatformConsumer && !ASSIGNMENTS.has(next?.value)) {
      add(i, 'ambiguous module URL alias flow');
    }
  }
  return findings;
}

function isTaggedTemplate(tokens, index) {
  const previous = tokens[index - 1];
  return Boolean(previous &&
    ((previous.type === 'identifier' && !REGEX_PREFIX_WORDS.has(previous.value)) ||
     ['string', 'number', 'regex', 'template'].includes(previous.type) || [')', ']'].includes(previous.value)));
}

function findHandRolledFileUrls(tokens) {
  const findings = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'template' && !isTaggedTemplate(tokens, i) &&
        /^file:\/{2,}/.test(templateStaticPrefix(token.raw)) && /(^|[^\\])\$\{/.test(token.value)) {
      findings.push({ index: token.start, kind: 'hand-rolled file URL' });
    }
    if (token.type === 'string' && /^file:\/{2,}/.test(token.value) && tokens[i + 1]?.value === '+') {
      findings.push({ index: token.start, kind: 'hand-rolled file URL' });
    }
  }
  return findings;
}

function scanSource(source) {
  const { tokens, errors } = lexJavaScript(source);
  const findings = [
    ...findHandRolledFileUrls(tokens),
    ...findPathnameMisuses(tokens, errors),
    ...errors.map((error) => ({ index: error.index, kind: `URL/path scanner ambiguity: ${error.reason}` })),
  ];
  return { tokens, findings };
}

export function collect(root = ROOT, { dirs = SCAN_DIRS, excludeKnownBad = true } = {}) {
  const files = dirs.flatMap((dir) => walk(resolve(root, dir)));
  const findings = [];
  for (const file of files) {
    const rel = slash(relative(root, file));
    if (rel === SELF || (excludeKnownBad && rel.startsWith(KNOWN_BAD))) continue;
    const code = readFileSync(file, 'utf8');
    for (const match of scanSource(code).findings) {
      findings.push({ path: rel, line: lineAt(code, match.index), kind: match.kind });
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
  console.log('BOUNDARY: token-aware scan catches actual dynamic file:// template/concatenation constructs and same-file static new URL(..., import.meta.url) pathname conversions through direct, grouped, optional, bracket, destructuring, and bounded local-alias forms. Ambiguous lexical or alias flow fails closed; cross-module flow and platform-API semantic correctness remain outside this guard.');
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
  say(/new\s+URL\s*\(\r?\n/.test(pathFixtureSource) && /\r?\n\)\??\.pathname/.test(pathFixtureSource),
    'handrolled_path fixture keeps the discriminating multiline conversion shape');
  say(/replace\s*\(\s*\/\\\)\/g/.test(pathFixtureSource),
    'handrolled_path fixture keeps a regex parenthesis inside the balanced call');
  say(/return\s+\/\\\)\/\.source/.test(pathFixtureSource),
    'handrolled_path fixture keeps a regex parenthesis after a return keyword');
  const retiredStatementMatcher = /new\s+URL\s*\([^;]*import\.meta\.url[^;]*\)\s*\.pathname/g;
  const pathnameCount = (source) => scanSource(source).findings.filter((finding) => finding.kind === 'URL pathname used as a filesystem path').length;
  const fileUrlCount = (source) => scanSource(source).findings.filter((finding) => finding.kind === 'hand-rolled file URL').length;
  say(!retiredStatementMatcher.test(pathFixtureSource) && pathnameCount(pathFixtureSource) === 1,
    'semicolon-in-string fixture defeats the retired matcher and is caught structurally');
  const fileUrlCases = [
    ['two-slash template control', '`file://${process.argv[1]}`'],
    ['additional-slash template plant', '`file:///${process.argv[1]}`'],
    ['two-slash concatenation control', "'file://' + process.argv[1]"],
    ['additional-slash concatenation plant', "'file:///' + process.argv[1]"],
  ];
  say(fileUrlCases.every(([, source]) => fileUrlCount(source) === 1),
    'file URL scanner catches two-or-more-slash interpolation and concatenation',
    fileUrlCases.map(([label, source]) => `${label}=${fileUrlCount(source)}`).join(', '));
  const pathnameAccessCases = [
    ['grouped pathname plant', "(new URL('./data', import.meta.url)).pathname", 1],
    ['optional pathname plant', "new URL('./data', import.meta.url)?.pathname", 1],
    ['outer-call pathname negative control', "wrap(new URL('./data', import.meta.url)).pathname", 0],
  ];
  say(pathnameAccessCases.every(([, source, expected]) => pathnameCount(source) === expected),
    'pathname scanner covers transparent grouping and optional chaining without claiming an outer call result',
    pathnameAccessCases.map(([label, source]) => `${label}=${pathnameCount(source)}`).join(', '));

  const matrix = [
    ['return regex', "const p=new URL((()=>{return /\\)/.source&&'./x'})(),import.meta.url).pathname", 1, 0],
    ['case regex', "switch(x){case /\\)/.source: new URL('./x',import.meta.url).pathname}", 1, 0],
    ['throw regex', "try{throw /\\)/g}catch{};new URL('./x',import.meta.url).pathname", 1, 0],
    ['yield regex', "function* f(){yield /\\)/};new URL('./x',import.meta.url).pathname", 1, 0],
    ['arrow regex', "const f=()=>/\\)/.source;new URL('./x',import.meta.url).pathname", 1, 0],
    ['division and control-header regex', "const n=a/(b);if(ok)/\\)/.test(x);new URL('./x',import.meta.url).origin", 0, 0],
    ['division chain control', "const n=a/b/c;new URL('./x',import.meta.url).origin", 0, 0],
    ['division assignment control', "let n=8;n/=2;new URL('./x',import.meta.url).origin", 0, 0],
    ['regex escape slash flags', "const r=/\\/\\)/giu;new URL('./x',import.meta.url).pathname", 1, 0],
    ['regex class punctuation', "const r=/[()]/;new URL('./x',import.meta.url).pathname", 1, 0],
    ['nested callback', "xs.map(()=>/\\)/.test(x));new URL('./x',import.meta.url).pathname", 1, 0],
    ['nested IIFE', "new URL((()=>{return /\\)/.source&&'./x'})(),import.meta.url).pathname", 1, 0],
    ['string structural trivia', "new URL(');/*;v=1',import.meta.url).pathname", 1, 0],
    ['template interpolation trivia', "new URL(`x;${fn()/*)*/}`,import.meta.url).pathname", 1, 0],
    ['line comment delimiter', "new URL('./x',// ) ;\nimport.meta.url).pathname", 1, 0],
    ['block comment delimiter', "new URL('./x',/* ) ; */import.meta.url).pathname", 1, 0],
    ['forbidden spelling in string control', "const s=\"new URL('./x', import.meta.url).pathname\"", 0, 0],
    ['forbidden spelling in comment control', "/* new URL('./x', import.meta.url).pathname */", 0, 0],
    ['direct pathname', "new URL('./x',import.meta.url).pathname", 1, 0],
    ['comment separated pathname', "new URL('./x',import.meta.url)/*x*/\n.pathname", 1, 0],
    ['one grouped pathname', "(new URL('./x',import.meta.url)).pathname", 1, 0],
    ['two grouped pathname', "((new URL('./x',import.meta.url))).pathname", 1, 0],
    ['optional pathname', "new URL('./x',import.meta.url)?.pathname", 1, 0],
    ['grouped optional pathname', "(new URL('./x',import.meta.url))?.pathname", 1, 0],
    ['single quoted bracket pathname', "new URL('./x',import.meta.url)['pathname']", 1, 0],
    ['double quoted bracket pathname', 'new URL(\'./x\',import.meta.url)["pathname"]', 1, 0],
    ['destructure declaration', "const {pathname}=new URL('./x',import.meta.url)", 1, 0],
    ['destructure assignment rename', "let p;({pathname:p}=new URL('./x',import.meta.url))", 1, 0],
    ['simple alias', "const u=new URL('./x',import.meta.url);u.pathname", 1, 0],
    ['nested alias chain', "const u=new URL('./x',import.meta.url);{const v=u;v.pathname}", 1, 0],
    ['alias reassignment kill', "let u=new URL('./x',import.meta.url);u=platformValue;u.pathname", 0, 0],
    ['alias block and parameter shadow kill', "const u=new URL('./x',import.meta.url);{const u=platformValue;u.pathname}function f(u){u.pathname}fileURLToPath(u)", 0, 0],
    ['outer call result control', "wrap(new URL('./x',import.meta.url)).pathname", 0, 0],
    ['other access controls', "new URL('./x',import.meta.url).origin;new URL('./x',import.meta.url).pathnameExtra", 0, 0],
    ['escaped two slash template', '`file:\\/\\/${path}`', 0, 1],
    ['three slash template', '`file:///${path}`', 0, 1],
    ['four slash template', '`file:////${path}`', 0, 1],
    ['single quote concat', "'file://' + path", 0, 1],
    ['double quote concat trivia', '"file:////" /* x */ +\npath', 0, 1],
    ['quoted spellings control', "const a=\"'file://' + path\";const b='`file://${path}`'", 0, 0],
    ['static tagged and comment controls', "const a='file:///tmp/x';tag`file://${path}`;/* 'file://' + path */", 0, 0],
  ];
  const matrixResults = [];
  for (const eol of ['\n', '\r\n']) {
    for (const [label, source, expectedPath, expectedFile] of matrix) {
      const converted = source.replace(/\n/g, eol);
      const findings = scanSource(converted).findings;
      const actualPath = findings.filter((finding) => finding.kind === 'URL pathname used as a filesystem path').length;
      const actualFile = findings.filter((finding) => finding.kind === 'hand-rolled file URL').length;
      const other = findings.length - actualPath - actualFile;
      matrixResults.push({ label, eol: eol === '\n' ? 'LF' : 'CRLF', ok: actualPath === expectedPath && actualFile === expectedFile && other === 0, actualPath, actualFile, other });
    }
  }
  const matrixFailures = matrixResults.filter((result) => !result.ok);
  say(matrixFailures.length === 0, 'shared token scanner passes the 41-case LF/CRLF adversarial matrix', matrixFailures.length ? matrixFailures.map((result) => `${result.eol}:${result.label}=path${result.actualPath}/file${result.actualFile}/other${result.other}`).join(', ') : '82/82');

  const ambiguityCases = [
    ['dynamic bracket', "const u=new URL('./x',import.meta.url);u[key]"],
    ['dynamic destructure', "const {[key]:value}=new URL('./x',import.meta.url)"],
    ['call escape', "const u=new URL('./x',import.meta.url);consume(u)"],
    ['container escape', "const u=new URL('./x',import.meta.url);const xs=[u]"],
    ['conditional escape', "const u=new URL('./x',import.meta.url);const v=ok?u:other"],
    ['property escape', "const u=new URL('./x',import.meta.url);obj.url=u"],
  ];
  const ambiguityResults = [];
  for (const eol of ['\n', '\r\n']) {
    for (const [label, source] of ambiguityCases) {
      const findings = scanSource(source.replace(/\n/g, eol)).findings;
      ambiguityResults.push({ label, eol: eol === '\n' ? 'LF' : 'CRLF', count: findings.filter((finding) => finding.kind === 'ambiguous module URL alias flow').length, total: findings.length });
    }
  }
  say(ambiguityResults.every((result) => result.count >= 1 && result.total === result.count),
    'bounded alias analysis fails closed on dynamic or escaping flows in LF and CRLF',
    ambiguityResults.map((result) => `${result.eol}:${result.label}=${result.count}`).join(', '));

  const lexicalAmbiguities = [
    "const x='unterminated",
    'const x="unterminated',
    'const x=`unterminated ${value}',
    'const x=/unterminated',
    '/* unterminated',
  ];
  say(lexicalAmbiguities.every((source) => scanSource(source).findings.some((finding) => finding.kind.startsWith('URL/path scanner ambiguity:'))),
    'unterminated lexical forms fail closed through the shared scanner');
  const oversizeFindings = scanSource(' '.repeat(MAX_SOURCE_BYTES + 1)).findings;
  const tokenCapFindings = scanSource('a;'.repeat(Math.floor(MAX_TOKENS / 2) + 1)).findings;
  say(oversizeFindings.some((finding) => finding.kind.includes('source exceeds')),
    'source byte cap fails closed before scanning an oversized module');
  say(tokenCapFindings.some((finding) => finding.kind.includes('token count exceeds')) &&
      tokenCapFindings.some((finding) => finding.kind.includes('alias work exceeds')),
    'token and alias-work caps fail closed on bounded scanner work');

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
