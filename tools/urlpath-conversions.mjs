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
  '(', '[', '{', '${', ',', ':', ';', '=', '=>', '!', '?', '?.', '&&', '||',
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
  if (previous?.blockClose === 'statement') return true;
  if (previous?.type === 'identifier' && ['break', 'continue', 'debugger'].includes(previous.value)) return true;
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

function declarationContextAt(tokens, keywordIndex) {
  let contextIndex = keywordIndex - 1;
  if (tokens[keywordIndex]?.value === 'function' && tokens[contextIndex]?.value === 'async') contextIndex--;
  const context = tokens[contextIndex];
  return !context || context.value === ';' || context.value === '{' || context.blockClose === 'statement' ||
    ['export', 'default'].includes(context.value);
}

function headerKeywordBefore(tokens, keyword, before = tokens.length) {
  const stack = [];
  const opening = { ')': '(', ']': '[', '}': '{' };
  for (let i = before - 1; i >= 0; i--) {
    const value = tokens[i].value;
    if (opening[value]) { stack.push(opening[value]); continue; }
    if (value === stack.at(-1)) { stack.pop(); continue; }
    if (stack.length > 0) continue;
    if (value === keyword) return i;
    if ([';', '{', '}'].includes(value)) return -1;
  }
  return -1;
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

const IDENTIFIER_START = /^[$_\p{ID_Start}]$/u;
const IDENTIFIER_PART = /^[$_\u200c\u200d\p{ID_Continue}]$/u;

function identifierEscapeAt(source, index) {
  if (source[index] !== '\\' || source[index + 1] !== 'u') return null;
  let digits = '';
  let end = index + 2;
  if (source[end] === '{') {
    const close = source.indexOf('}', end + 1);
    if (close < 0) return null;
    digits = source.slice(end + 1, close);
    end = close + 1;
  } else {
    digits = source.slice(end, end + 4);
    end += 4;
  }
  if (!/^[0-9a-fA-F]+$/.test(digits) || digits.length > 6) return null;
  const point = Number.parseInt(digits, 16);
  if (point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return null;
  return { value: String.fromCodePoint(point), end };
}

function scanIdentifier(source, start) {
  let value = '';
  let index = start;
  let first = true;
  while (index < source.length) {
    const escaped = identifierEscapeAt(source, index);
    const direct = escaped ? null : String.fromCodePoint(source.codePointAt(index));
    const character = escaped?.value ?? direct;
    if (!(first ? IDENTIFIER_START : IDENTIFIER_PART).test(character)) break;
    value += character;
    index = escaped?.end ?? index + direct.length;
    first = false;
  }
  return first ? null : { value, end: index };
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

function blockKind(tokens) {
  const previous = tokens.at(-1);
  if (!previous || previous.value === ';' || previous.blockClose === 'statement') return 'statement';
  if (['else', 'try', 'finally', 'do'].includes(previous.value)) return 'statement';
  const classIndex = headerKeywordBefore(tokens, 'class');
  if (classIndex >= 0) return declarationContextAt(tokens, classIndex) ? 'statement' : 'expression';
  if (previous.value === '=>') return 'expression';
  if (previous.value !== ')') return 'expression';
  const open = findOpenBackward(tokens, tokens.length - 1);
  const before = tokens[open - 1];
  if (['if', 'while', 'for', 'with', 'switch', 'catch'].includes(before?.value)) return 'statement';
  let functionIndex = open - 1;
  if (tokens[functionIndex]?.type === 'identifier') functionIndex--;
  if (tokens[functionIndex]?.value === '*') functionIndex--;
  if (tokens[functionIndex]?.value === 'function') {
    return declarationContextAt(tokens, functionIndex) ? 'statement' : 'expression';
  }
  return 'statement';
}

function lexTemplate(source, start, tokens, errors) {
  const tagged = isTaggedTemplate(tokens, tokens.length);
  let segment = start + 1;
  for (let i = segment; i < source.length;) {
    if (source[i] === '\\') { i += 2; continue; }
    if (source[i] === '`') {
      const raw = source.slice(segment, i);
      tokens.push({ type: 'template', value: decodeEscapedBody(source, segment, i), raw, start: segment, end: i, tagged, hasInterpolation: false });
      return i + 1;
    }
    if (source[i] === '$' && source[i + 1] === '{') {
      const raw = source.slice(segment, i);
      tokens.push({ type: 'template', value: decodeEscapedBody(source, segment, i), raw, start: segment, end: i, tagged, hasInterpolation: true });
      tokens.push({ type: 'punct', value: '${', start: i, end: i + 2 });
      const close = lexRange(source, i + 2, source.length, tokens, errors, true);
      if (source[close] !== '}') {
        errors.push({ index: start, reason: 'unterminated template interpolation' });
        return source.length;
      }
      tokens.push({ type: 'punct', value: '}$', start: close, end: close + 1 });
      i = close + 1;
      segment = i;
      continue;
    }
    i++;
  }
  errors.push({ index: start, reason: 'unterminated template literal' });
  return source.length;
}

function lexRange(source, from, to, tokens, errors, stopAtTemplateBrace = false) {
  const braces = [];
  for (let i = from; i < to;) {
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
    const identifier = scanIdentifier(source, start);
    if (source[i] === '"' || source[i] === "'") {
      i = scanQuoted(source, i, source[i], errors);
      const raw = source.slice(start, i);
      tokens.push({ type: 'string', value: decodeString(raw), raw, start, end: i });
    } else if (source[i] === '`') {
      i = lexTemplate(source, i, tokens, errors);
    } else if (identifier) {
      i = identifier.end;
      tokens.push({ type: 'identifier', value: identifier.value, start, end: i });
    } else if (source[i] === '\\' && source[i + 1] === 'u') {
      errors.push({ index: start, reason: 'invalid Unicode escape in identifier' });
      i += 2;
    } else if (/[0-9]/.test(source[i])) {
      i++; while (/[A-Za-z0-9_.]/.test(source[i] || '')) i++;
      tokens.push({ type: 'number', value: source.slice(start, i), start, end: i });
    } else if (source[i] === '/' && regexMayStartAfterTokens(tokens)) {
      i = scanRegex(source, i, errors);
      tokens.push({ type: 'regex', value: source.slice(start, i), start, end: i });
    } else {
      const punct = PUNCTUATORS.find((value) => source.startsWith(value, i)) || source[i];
      if (punct === '}' && stopAtTemplateBrace && braces.length === 0) return i;
      i += punct.length;
      const token = { type: 'punct', value: punct, start, end: i };
      if (punct === '{') { token.blockOpen = blockKind(tokens); braces.push(token.blockOpen); }
      else if (punct === '}') token.blockClose = braces.pop() || 'expression';
      tokens.push(token);
    }
    if (tokens.length > MAX_TOKENS) {
      errors.push({ index: start, reason: `token count exceeds ${MAX_TOKENS} scanner cap` });
      break;
    }
  }
  return to;
}

function lexJavaScript(source) {
  const tokens = [];
  const errors = [];
  if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
    return { tokens, errors: [{ index: 0, reason: `source exceeds ${MAX_SOURCE_BYTES} byte scanner cap` }] };
  }
  lexRange(source, 0, source.length, tokens, errors);
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
  const key = tokens[i + 1];
  const staticPathname = key?.value === 'pathname' &&
    (key.type === 'string' || (key.type === 'template' && !key.hasInterpolation && !key.tagged));
  if (tokens[i]?.value === '[' && staticPathname && tokens[i + 2]?.value === ']') return { end: i + 3 };
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
  const close = tokens[assignment - 1]?.value;
  const openValue = close === '}' ? '{' : close === ']' ? '[' : null;
  if (!openValue) return { pathname: false, dynamic: false, bindings: [], bindingIndexes: [] };
  const open = findOpenBackward(tokens, assignment - 1, openValue, close);
  if (open < 0) return { pathname: false, dynamic: true, bindings: [], bindingIndexes: [] };
  const binding = bindingIndexes(tokens, open, assignment);
  const indexes = [...binding.indexes];
  const bindings = indexes.map((index) => tokens[index].value);
  if (openValue === '[') return { pathname: false, dynamic: false, bindings, bindingIndexes: indexes };

  const separators = [open, ...topLevelIndexes(tokens, open + 1, assignment - 1, ','), assignment - 1];
  let pathname = false;
  let dynamic = false;
  for (let entry = 0; entry + 1 < separators.length; entry++) {
    let start = separators[entry] + 1;
    const end = separators[entry + 1];
    if (tokens[start]?.value === '...') { start++; }
    const colon = topLevelIndexes(tokens, start, end, ':')[0];
    const defaultAt = topLevelIndexes(tokens, start, colon ?? end, '=')[0];
    const keyEnd = colon ?? defaultAt ?? end;
    if (tokens[start]?.value === '[') {
      if (tokens[start + 1]?.type === 'string' && tokens[start + 1].value === 'pathname' &&
          tokens[start + 2]?.value === ']' && start + 3 === keyEnd) pathname = true;
      else dynamic = true;
    } else if (start + 1 === keyEnd &&
               (tokens[start]?.type === 'identifier' || tokens[start]?.type === 'string') &&
               tokens[start].value === 'pathname') pathname = true;
  }
  return { pathname, dynamic, bindings, bindingIndexes: indexes };
}

function findOpenBackward(tokens, close, left = '(', right = ')') {
  let depth = 0;
  for (let i = close; i >= 0; i--) {
    if (tokens[i].value === right) depth++;
    else if (tokens[i].value === left && --depth === 0) return i;
  }
  return -1;
}

function topLevelIndexes(tokens, start, end, value) {
  const out = [];
  const stack = [];
  const closing = { '(': ')', '[': ']', '{': '}' };
  for (let i = start; i < end; i++) {
    if (closing[tokens[i].value]) stack.push(closing[tokens[i].value]);
    else if (tokens[i].value === stack.at(-1)) stack.pop();
    else if (stack.length === 0 && tokens[i].value === value) out.push(i);
  }
  return out;
}

function declarationKindAt(tokens, assignment) {
  const stack = [];
  const opening = { ')': '(', ']': '[', '}': '{' };
  for (let i = assignment - 1; i >= 0; i--) {
    const value = tokens[i].value;
    if (opening[value]) { stack.push(opening[value]); continue; }
    if (value === stack.at(-1)) { stack.pop(); continue; }
    if (stack.length > 0) continue;
    if (['const', 'let', 'var'].includes(value)) return value;
    if ([';', '{', '}', '(', '=>'].includes(value)) return null;
  }
  return null;
}

function collectDeclarationBindings(tokens) {
  const bindings = new Map();
  const closing = { '(': ')', '[': ']', '{': '}' };
  for (let declaration = 0; declaration < tokens.length; declaration++) {
    const kind = tokens[declaration].type === 'identifier' && ['const', 'let', 'var'].includes(tokens[declaration].value)
      ? tokens[declaration].value : null;
    if (!kind) continue;
    const stack = [];
    let end = tokens.length;
    for (let i = declaration + 1; i < tokens.length; i++) {
      const value = tokens[i].value;
      if (closing[value]) stack.push(closing[value]);
      else if (value === stack.at(-1)) stack.pop();
      else if (stack.length === 0 && [';', '}', ')'].includes(value)) { end = i; break; }
    }
    const separators = [declaration, ...topLevelIndexes(tokens, declaration + 1, end, ','), end];
    for (let entry = 0; entry + 1 < separators.length; entry++) {
      const start = separators[entry] + 1;
      const entryEnd = separators[entry + 1];
      let bindingEnd = entryEnd;
      const assignment = topLevelIndexes(tokens, start, entryEnd, '=')[0];
      if (assignment !== undefined) bindingEnd = assignment;
      for (let i = start; i < bindingEnd; i++) {
        if (tokens[i].type === 'identifier' && ['of', 'in'].includes(tokens[i].value)) { bindingEnd = i; break; }
      }
      for (const index of bindingIndexes(tokens, start, bindingEnd).indexes) bindings.set(index, kind);
    }
  }
  return bindings;
}

function enclosingForOpen(tokens, index) {
  let depth = 0;
  for (let i = index - 1; i >= 0; i--) {
    if (tokens[i].value === ')') depth++;
    else if (tokens[i].value === '(') {
      if (depth > 0) { depth--; continue; }
      const previous = tokens[i - 1];
      if (previous?.value === 'for' || (previous?.value === 'await' && tokens[i - 2]?.value === 'for')) return i;
      return -1;
    }
  }
  return -1;
}

function loopAliasRanges(tokens, declarations) {
  const ranges = [];
  const bindingToRange = new Map();
  for (let keyword = 0; keyword < tokens.length; keyword++) {
    if (tokens[keyword].value !== 'for') continue;
    const open = tokens[keyword + 1]?.value === 'await' ? keyword + 2 : keyword + 1;
    if (tokens[open]?.value !== '(') continue;
    const close = findClose(tokens, open);
    if (close < 0) continue;
    const operator = topLevelIndexes(tokens, open + 1, close, 'of')[0] ??
      topLevelIndexes(tokens, open + 1, close, 'in')[0] ?? -1;
    let end = close + 1;
    if (tokens[end]?.value === '{') {
      const bodyClose = findClose(tokens, end, '{', '}');
      end = bodyClose < 0 ? tokens.length : bodyClose + 1;
    } else {
      while (end < tokens.length && tokens[end].value !== ';') end++;
      if (end < tokens.length) end++;
    }
    const range = { start: open + 1, end, close, operator, aliases: new Map(), bindingIndexes: new Set(), assignmentTarget: false };
    if (operator >= 0) {
      const declaration = ['const', 'let', 'var'].includes(tokens[open + 1]?.value) ? tokens[open + 1].value : null;
      const bindingStart = open + 1 + (declaration ? 1 : 0);
      const binding = bindingIndexes(tokens, bindingStart, operator);
      for (const index of binding.indexes) {
        range.aliases.set(tokens[index].value, false);
        range.bindingIndexes.add(index);
        if (declaration && declarations.has(index)) bindingToRange.set(index, range);
      }
      range.assignmentTarget = !declaration;
    } else {
      for (const [index, kind] of declarations) {
        if (!['const', 'let'].includes(kind) || enclosingForOpen(tokens, index) !== open) continue;
        range.aliases.set(tokens[index].value, false);
        range.bindingIndexes.add(index);
        bindingToRange.set(index, range);
      }
    }
    if (range.aliases.size > 0) ranges.push(range);
  }
  return { ranges, bindingToRange };
}

function declarationSeeds(tokens, parameters, declarations, loopBindings) {
  const seeds = new Map([[-1, new Map()]]);
  const braces = [];
  const scopeBraces = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value === '{') {
      const scope = tokens[i].blockOpen === 'statement';
      braces.push(scope ? i : -1);
      if (scope) scopeBraces.push(i);
    }
    const kind = declarations.get(i);
    if (kind && !loopBindings.has(i)) {
      let owner = scopeBraces.at(-1) ?? -1;
      if (kind === 'var') {
        owner = -1;
        for (let s = scopeBraces.length - 1; s >= 0; s--) {
          if (parameters.functionBraces.has(scopeBraces[s])) { owner = scopeBraces[s]; break; }
        }
      }
      if (!seeds.has(owner)) seeds.set(owner, new Map());
      seeds.get(owner).set(tokens[i].value, false);
    }
    if (tokens[i].value === '}') {
      const scope = braces.pop();
      if (scope !== -1) scopeBraces.pop();
    }
  }
  return seeds;
}

const CONDITIONAL_WORDS = new Set(['if', 'else', 'for', 'while', 'switch', 'case', 'catch', 'try', 'finally', 'do', 'with']);

function conditionalBlockAt(tokens, brace) {
  const previous = tokens[brace - 1];
  if (previous?.type === 'identifier' && CONDITIONAL_WORDS.has(previous.value)) return true;
  if (previous?.value !== ')') return false;
  const open = findOpenBackward(tokens, brace - 1);
  return CONDITIONAL_WORDS.has(tokens[open - 1]?.value);
}

function conditionalAssignmentAt(tokens, assignment) {
  const stack = [];
  const opening = { ')': '(', ']': '[', '}': '{' };
  for (let i = assignment - 1; i >= 0; i--) {
    const value = tokens[i].value;
    if (opening[value]) { stack.push(opening[value]); continue; }
    if (value === stack.at(-1)) { stack.pop(); continue; }
    if (stack.length > 0) continue;
    if (tokens[i].type === 'identifier' && CONDITIONAL_WORDS.has(value)) return true;
    if (['&&', '||', '??', '?'].includes(value)) return true;
    if ([';', '{', '}'].includes(value)) return false;
  }
  return false;
}

function bindingIndexes(tokens, start, end) {
  const indexes = new Set();
  const keys = new Set();
  const visit = (from, to) => {
    while (tokens[from]?.value === '...') from++;
    while (tokens[from]?.value === '(' && tokens[to - 1]?.value === ')') { from++; to--; }
    const defaultAt = topLevelIndexes(tokens, from, to, '=')[0];
    if (defaultAt !== undefined) to = defaultAt;
    if (tokens[from]?.type === 'identifier') { indexes.add(from); return; }
    const left = tokens[from]?.value;
    const right = left === '{' ? '}' : left === '[' ? ']' : null;
    if (!right || tokens[to - 1]?.value !== right) return;
    const separators = [from, ...topLevelIndexes(tokens, from + 1, to - 1, ','), to - 1];
    for (let s = 0; s + 1 < separators.length; s++) {
      let entryStart = separators[s] + 1;
      const entryEnd = separators[s + 1];
      if (entryStart >= entryEnd) continue;
      while (tokens[entryStart]?.value === '...') entryStart++;
      const colon = topLevelIndexes(tokens, entryStart, entryEnd, ':')[0];
      if (colon !== undefined) {
        if (tokens[entryStart]?.type === 'identifier') keys.add(entryStart);
        visit(colon + 1, entryEnd);
      }
      else visit(entryStart, entryEnd);
    }
  };
  const separators = [start - 1, ...topLevelIndexes(tokens, start, end, ','), end];
  for (let s = 0; s + 1 < separators.length; s++) visit(separators[s] + 1, separators[s + 1]);
  return { indexes, keys };
}

function expressionEnd(tokens, start) {
  const stack = [];
  const closing = { '(': ')', '[': ']', '{': '}' };
  for (let i = start; i < tokens.length; i++) {
    const value = tokens[i].value;
    if (closing[value]) stack.push(closing[value]);
    else if (value === stack.at(-1)) stack.pop();
    else if (stack.length === 0 && [',', ';', ')', ']', '}', '}$'].includes(value)) return i;
  }
  return tokens.length;
}

function parameterScopes(tokens) {
  const atBrace = new Map();
  const functionBraces = new Set();
  const parameterIndexes = new Set();
  const keyIndexes = new Set();
  const assignmentIndexes = new Set();
  const expressionRanges = [];
  const privateNameIndexes = new Set();
  const declarationNameIndexes = new Set();
  const register = (open, close, brace = -1, expressionStart = -1, functionScope = false, privateNameIndex = -1) => {
    if (open < 0 || close < open) return;
    const binding = bindingIndexes(tokens, open + (tokens[open]?.value === '(' ? 1 : 0), close);
    const names = new Set([...binding.indexes].map((index) => tokens[index].value));
    if (privateNameIndex >= 0) {
      const privateName = tokens[privateNameIndex].value;
      names.add(privateName);
      privateNameIndexes.add(privateNameIndex);
      if (brace >= 0 && open !== brace) expressionRanges.push({ start: open + 1, end: brace, names: new Set([privateName]) });
    }
    for (const index of binding.indexes) parameterIndexes.add(index);
    for (const index of binding.keys) keyIndexes.add(index);
    for (let i = open + (tokens[open]?.value === '(' ? 1 : 0); i < close; i++) {
      if (tokens[i].value !== '=') continue;
      if (binding.indexes.has(i - 1)) { assignmentIndexes.add(i); continue; }
      const previous = tokens[i - 1]?.value;
      const left = previous === '}' ? '{' : previous === ']' ? '[' : null;
      if (!left) continue;
      const patternOpen = findOpenBackward(tokens, i - 1, left, previous);
      if ([...binding.indexes].some((index) => index > patternOpen && index < i)) assignmentIndexes.add(i);
    }
    if (brace >= 0) {
      atBrace.set(brace, names);
      if (functionScope) functionBraces.add(brace);
    }
    else if (expressionStart >= 0) expressionRanges.push({ start: expressionStart, end: expressionEnd(tokens, expressionStart), names });
  };
  for (let brace = 0; brace < tokens.length; brace++) {
    if (tokens[brace].value !== '{') continue;
    let open = -1;
    let close = -1;
    let functionScope = false;
    let privateNameIndex = -1;
    const classIndex = headerKeywordBefore(tokens, 'class', brace);
    if (classIndex >= 0) {
      const nameIndex = tokens[classIndex + 1]?.type === 'identifier' ? classIndex + 1 : -1;
      if (nameIndex >= 0) {
        if (declarationContextAt(tokens, classIndex)) declarationNameIndexes.add(nameIndex);
        else privateNameIndex = nameIndex;
      }
      register(brace, brace, brace, -1, false, privateNameIndex);
      continue;
    }
    if (tokens[brace - 1]?.value === '=>') {
      functionScope = true;
      close = brace - 2;
      if (tokens[close]?.value === ')') open = findOpenBackward(tokens, close);
      else if (tokens[close]?.type === 'identifier') open = close;
    } else if (tokens[brace - 1]?.value === ')') {
      close = brace - 1;
      open = findOpenBackward(tokens, close);
      const before = tokens[open - 1];
      let functionIndex = open - 1;
      if (tokens[functionIndex]?.type === 'identifier') functionIndex--;
      if (tokens[functionIndex]?.value === '*') functionIndex--;
      const functionKeyword = tokens[functionIndex]?.value === 'function';
      const catchKeyword = before?.value === 'catch';
      const methodShape = before?.type === 'identifier' && !['if', 'while', 'for', 'with', 'switch', 'catch'].includes(before.value);
      functionScope = functionKeyword || methodShape;
      if (functionKeyword && tokens[open - 1]?.type === 'identifier') {
        if (declarationContextAt(tokens, functionIndex)) declarationNameIndexes.add(open - 1);
        else privateNameIndex = open - 1;
      }
      if (!functionKeyword && !catchKeyword && !methodShape) open = -1;
    }
    register(open, close + (open === close && tokens[open]?.value !== '(' ? 1 : 0), brace, -1, functionScope, privateNameIndex);
  }
  for (let arrow = 0; arrow < tokens.length; arrow++) {
    if (tokens[arrow].value !== '=>' || tokens[arrow + 1]?.value === '{') continue;
    const close = arrow - 1;
    const open = tokens[close]?.value === ')' ? findOpenBackward(tokens, close) : close;
    register(open, close + (open === close ? 1 : 0), -1, arrow + 1);
  }
  return { atBrace, functionBraces, parameterIndexes, keyIndexes, assignmentIndexes, expressionRanges, privateNameIndexes, declarationNameIndexes };
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

function unwrapAssigned(tokens, start, end, urls, isAlias) {
  let cursor = start;
  let groups = 0;
  while (tokens[cursor]?.value === '(') { groups++; cursor++; }
  let after = cursor;
  let result = null;
  if (urls.has(cursor)) {
    const url = urls.get(cursor);
    if (!accessAfterExpression(tokens, url.start, url.close)) { result = { kind: 'url', index: cursor }; after = url.close + 1; }
  } else if (tokens[cursor]?.type === 'identifier' && isAlias(tokens[cursor].value, cursor)) {
    result = { kind: 'alias', index: cursor };
    after = cursor + 1;
  }
  if (!result) return null;
  for (let i = 0; i < groups; i++) {
    if (tokens[after]?.value !== ')') return null;
    after++;
  }
  return after === end ? result : null;
}

function containingPlatformCall(tokens, index) {
  for (let open = index - 1; open >= 0; open--) {
    if (tokens[open].value !== '(' || tokens[open - 1]?.value !== 'fileURLToPath') continue;
    const close = findClose(tokens, open);
    if (close >= index) return { open, close };
  }
  return null;
}

function consumedByCall(tokens, index, ownOpen) {
  for (let open = index - 1; open >= 0; open--) {
    if (tokens[open].value !== '(' || open === ownOpen) continue;
    const close = findClose(tokens, open);
    if (close < index) continue;
    const callee = tokens[open - 1];
    if (callee?.type === 'identifier' || [')', ']'].includes(callee?.value)) return true;
  }
  return false;
}

function isPlatformConsumerAt(tokens, index) {
  const call = containingPlatformCall(tokens, index);
  if (!call) return false;
  const comma = topLevelIndexes(tokens, call.open + 1, call.close, ',')[0] ?? call.close;
  let start = call.open + 1;
  let end = comma;
  while (tokens[start]?.value === '(' && tokens[end - 1]?.value === ')') { start++; end--; }
  return start === index && end === index + 1;
}

function analyzeAssigned(tokens, start, urls, isAlias) {
  const end = expressionEnd(tokens, start);
  const exact = unwrapAssigned(tokens, start, end, urls, isAlias);
  if (exact) return exact;
  for (const url of urls.values()) {
    if (url.start < start || url.close >= end) continue;
    if (!accessAfterExpression(tokens, url.start, url.close) &&
        !containingPlatformCall(tokens, url.start) && !consumedByCall(tokens, url.start, url.start + 2)) {
      return { kind: 'ambiguous', index: url.start };
    }
  }
  return null;
}

function ternaryJoinAt(tokens, assignment, urls, isAlias) {
  const findMarker = (from, marker) => {
    const stack = [];
    const opening = { ')': '(', ']': '[', '}': '{' };
    for (let i = from; i >= 0; i--) {
      const value = tokens[i].value;
      if (opening[value]) { stack.push(opening[value]); continue; }
      if (value === stack.at(-1)) { stack.pop(); continue; }
      if (stack.length > 0) continue;
      if (value === marker) return i;
      if ([';', '{', '}'].includes(value)) return -1;
    }
    return -1;
  };
  const colon = findMarker(assignment - 1, ':');
  if (colon < 0) return null;
  const question = findMarker(colon - 1, '?');
  if (question < 0) return null;
  const end = expressionEnd(tokens, colon + 1);
  const branchAssignments = (start, stop) => {
    const out = [];
    for (let i = start; i < stop; i++) {
      if (!ASSIGNMENTS.has(tokens[i].value)) continue;
      const lhs = tokens[i - 1];
      if (lhs?.type === 'identifier' && !['.', '?.', ']'].includes(tokens[i - 2]?.value)) out.push(i);
    }
    return out;
  };
  const thenAssignments = branchAssignments(question + 1, colon);
  const elseAssignments = branchAssignments(colon + 1, end);
  if (thenAssignments.length !== 1 || elseAssignments.length !== 1 || elseAssignments[0] !== assignment) return null;
  const thenName = tokens[thenAssignments[0] - 1].value;
  const elseName = tokens[assignment - 1].value;
  if (thenName !== elseName) return null;
  const thenValue = analyzeAssigned(tokens, thenAssignments[0] + 1, urls, isAlias);
  const elseValue = analyzeAssigned(tokens, assignment + 1, urls, isAlias);
  return {
    value: Boolean((thenValue && thenValue.kind !== 'ambiguous') || (elseValue && elseValue.kind !== 'ambiguous')),
    ambiguity: thenValue?.kind === 'ambiguous' ? thenValue.index : elseValue?.kind === 'ambiguous' ? elseValue.index : -1,
    conditional: conditionalAssignmentAt(tokens, question),
  };
}

function analyzeLoopIterable(tokens, start, end, urls, isAlias) {
  while (tokens[start]?.value === '(' && findClose(tokens, start) === end - 1) { start++; end--; }
  if (tokens[start]?.value !== '[' || findClose(tokens, start, '[', ']') !== end - 1) {
    return unwrapAssigned(tokens, start, end, urls, isAlias);
  }
  const separators = [start, ...topLevelIndexes(tokens, start + 1, end - 1, ','), end - 1];
  for (let entry = 0; entry + 1 < separators.length; entry++) {
    const elementStart = separators[entry] + 1;
    const elementEnd = separators[entry + 1];
    const exact = unwrapAssigned(tokens, elementStart, elementEnd, urls, isAlias);
    if (exact) return exact;
    for (const url of urls.values()) {
      if (url.start < elementStart || url.close >= elementEnd) continue;
      if (!accessAfterExpression(tokens, url.start, url.close) &&
          !containingPlatformCall(tokens, url.start)) {
        return { kind: 'ambiguous', index: url.start };
      }
    }
  }
  return null;
}

function findPathnameMisuses(tokens, errors) {
  const urls = findUrlExpressions(tokens, errors);
  const findings = [];
  const seen = new Set();
  const parameters = parameterScopes(tokens);
  const declarations = collectDeclarationBindings(tokens);
  const loops = loopAliasRanges(tokens, declarations);
  const seeds = declarationSeeds(tokens, parameters, declarations, loops.bindingToRange);
  const scopes = [{ aliases: new Map(seeds.get(-1)), functionScope: true, conditional: false }];
  const scopeBraces = [];
  const loopIterableAliases = new Set();
  const assignmentRhsAliases = new Set();
  let aliasSteps = 0;
  const isAlias = (name, index = -1, excludedLoop = null) => {
    if (parameters.expressionRanges.some((range) => index >= range.start && index < range.end && range.names.has(name))) return false;
    const loop = loops.ranges.filter((range) => range !== excludedLoop && index >= range.start && index < range.end && range.aliases.has(name)).at(-1);
    if (loop) return loop.aliases.get(name);
    for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].aliases.has(name)) return scopes[i].aliases.get(name);
    return false;
  };
  const mergeOuterAlias = (name, value) => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].aliases.has(name)) { scopes[i].aliases.set(name, scopes[i].aliases.get(name) || value); return; }
    }
    scopes.at(-1).aliases.set(name, value);
  };
  const setAlias = (name, value, declaration = null, conditionalWrite = false, index = -1) => {
    const loop = loops.ranges.filter((range) => index >= range.start && index < range.end && range.aliases.has(name)).at(-1);
    if (loop) {
      loop.aliases.set(name, conditionalWrite ? loop.aliases.get(name) || value : value);
      return;
    }
    if (declaration) {
      let target = scopes.length - 1;
      if (declaration === 'var') {
        while (target > 0 && !scopes[target].functionScope) target--;
      }
      scopes[target].aliases.set(name, value);
      return;
    }
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].aliases.has(name)) {
        const uncertain = conditionalWrite || scopes.slice(i + 1).some((scope) => scope.conditional);
        scopes[i].aliases.set(name, uncertain ? scopes[i].aliases.get(name) || value : value);
        return;
      }
    }
    scopes.at(-1).aliases.set(name, value);
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
      const isScope = token.blockOpen === 'statement' || parameters.atBrace.has(i);
      scopeBraces.push(isScope);
      if (!isScope) continue;
      const functionScope = parameters.functionBraces.has(i);
      const scope = { aliases: new Map(seeds.get(i)), functionScope, conditional: functionScope || conditionalBlockAt(tokens, i) };
      for (const name of parameters.atBrace.get(i) || []) scope.aliases.set(name, false);
      scopes.push(scope);
    }
    if (token.value === '}') {
      if (scopeBraces.pop() && scopes.length > 1) scopes.pop();
      continue;
    }

    const loop = loops.ranges.find((range) => range.operator === i);
    if (loop && ['of', 'in'].includes(token.value)) {
      const assigned = token.value === 'of' ? analyzeLoopIterable(tokens, i + 1, loop.close, urls, isAlias) : null;
      if (assigned?.kind === 'ambiguous') add(assigned.index, 'ambiguous module URL alias flow');
      if (assigned?.kind === 'alias') loopIterableAliases.add(assigned.index);
      const sourceMayBeUrl = Boolean(assigned && assigned.kind !== 'ambiguous');
      for (const name of loop.aliases.keys()) {
        const value = loop.assignmentTarget ? isAlias(name, i, loop) || sourceMayBeUrl : sourceMayBeUrl;
        loop.aliases.set(name, value);
        if (loop.assignmentTarget) mergeOuterAlias(name, value);
      }
      continue;
    }

    if (ASSIGNMENTS.has(token.value)) {
      if (parameters.assignmentIndexes.has(i)) continue;
      const lhs = tokens[i - 1];
      const destructure = destructureBefore(tokens, i);
      const declaration = declarations.get(i - 1) ||
        destructure.bindingIndexes.map((index) => declarations.get(index)).find(Boolean) ||
        declarationKindAt(tokens, i);
      const logicalAssignment = ['&&=', '||=', '??='].includes(token.value);
      const expressionFunctionWrite = parameters.expressionRanges.some((range) => i >= range.start && i < range.end);
      const assigned = token.value === '=' || logicalAssignment ? analyzeAssigned(tokens, i + 1, urls, isAlias) : null;
      const ternaryJoin = token.value === '=' ? ternaryJoinAt(tokens, i, urls, isAlias) : null;
      const conditionalWrite = ternaryJoin?.conditional ??
        (logicalAssignment || expressionFunctionWrite || (!declaration && conditionalAssignmentAt(tokens, i)));
      const bareLhs = lhs?.type === 'identifier' && !['.', '?.', ']'].includes(tokens[i - 2]?.value);
      if (assigned?.kind === 'alias' && bareLhs) assignmentRhsAliases.add(assigned.index);
      if (destructure.pathname && assigned) add(assigned.index);
      else if ((destructure.dynamic && assigned) || assigned?.kind === 'ambiguous') add(assigned.index, 'ambiguous module URL alias flow');
      if (ternaryJoin?.ambiguity >= 0) add(ternaryJoin.ambiguity, 'ambiguous module URL alias flow');
      for (let binding = 0; binding < destructure.bindings.length; binding++) {
        setAlias(destructure.bindings[binding], false, declaration, conditionalWrite, destructure.bindingIndexes[binding]);
      }
      if (bareLhs) {
        const value = ternaryJoin ? ternaryJoin.value : Boolean(assigned && assigned.kind !== 'ambiguous');
        setAlias(lhs.value, value, declaration, conditionalWrite, i - 1);
      }
      continue;
    }

    if (token.type !== 'identifier') continue;
    if (loopIterableAliases.has(i) || assignmentRhsAliases.has(i) ||
        loops.ranges.some((range) => range.bindingIndexes.has(i))) continue;
    if (parameters.privateNameIndexes.has(i)) continue;
    if (parameters.declarationNameIndexes.has(i)) {
      setAlias(token.value, false, 'lexical');
      continue;
    }
    if (['function', 'class'].includes(tokens[i - 1]?.value)) {
      setAlias(token.value, false, 'lexical');
      continue;
    }
    if (declarations.has(i)) continue;
    if (parameters.parameterIndexes.has(i) || parameters.keyIndexes.has(i) ||
        !isAlias(token.value, i)) continue;
    const access = accessAfterExpression(tokens, i, i);
    if (access) {
      if (!ASSIGNMENTS.has(tokens[access.end]?.value)) add(i);
      continue;
    }
    const previous = tokens[i - 1];
    const next = tokens[i + 1];
    const isAssignmentRhs = ASSIGNMENTS.has(previous?.value) && tokens[i - 2]?.type === 'identifier' &&
      !['.', '?.', ']'].includes(tokens[i - 3]?.value);
    const isStaticNonPathMember = next?.value === '.' && tokens[i + 2]?.type === 'identifier';
    const isPlatformConsumer = isPlatformConsumerAt(tokens, i);
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
    if (token.type === 'template' && !token.tagged &&
        token.hasInterpolation && /^file:\/{2,}/.test(token.value)) {
      findings.push({ index: token.start, kind: 'hand-rolled file URL' });
    }
    let afterLiteral = i + 1;
    for (let groups = groupDepthBefore(tokens, i); groups > 0 && tokens[afterLiteral]?.value === ')'; groups--) {
      afterLiteral++;
    }
    if (token.type === 'string' && /^file:\/{2,}/.test(token.value) && tokens[afterLiteral]?.value === '+') {
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

  const blockerCases = [
    ['template interpolation pathname', 'const s=`cat ${new URL("./x",import.meta.url).pathname}`', 1, 0, 0],
    ['template interpolation file concat', 'const s=`cat ${"file://"+path}`', 0, 1, 0],
    ['nested template interpolation pathname', 'const s=`outer ${`inner ${new URL("./x",import.meta.url).pathname}`}`', 1, 0, 0],
    ['template interpolation outer alias', 'const u=new URL("./x",import.meta.url);const s=`${u.pathname}`', 1, 0, 0],
    ['template text spelling control', 'const s=`text: new URL("./x",import.meta.url).pathname and "file://"+path`', 0, 0, 0],
    ['conditional URL initializer fail closed', "const u=enabled&&new URL('./x',import.meta.url);u.pathname", 0, 0, 1],
    ['logical URL initializer fail closed', "const u=left||new URL('./x',import.meta.url);u.pathname", 0, 0, 1],
    ['ternary URL initializer fail closed', "const u=enabled?new URL('./x',import.meta.url):other;u.pathname", 0, 0, 1],
    ['nested alias initializer fail closed', "const base=new URL('./x',import.meta.url);const u=enabled&&base;u.pathname", 0, 0, 1],
    ['default parameter outer alias', "const u=new URL('./x',import.meta.url);function f(x=u.pathname){};fileURLToPath(u)", 1, 0, 0],
    ['destructured default outer alias', "const u=new URL('./x',import.meta.url);function f({x=u.pathname}={}){};fileURLToPath(u)", 1, 0, 0],
    ['destructured same-name binding preserves outer alias', "const u=new URL('./x',import.meta.url);function f({u=other}={}){};u.pathname", 1, 0, 0],
    ['destructured static key is not an outer use', "const u=new URL('./x',import.meta.url);function f({u:x}){};fileURLToPath(u)", 0, 0, 0],
    ['expression arrow parameter shadow', "const u=new URL('./x',import.meta.url);items.map(u=>u.pathname);fileURLToPath(u)", 0, 0, 0],
    ['destructured arrow parameter shadow', "const u=new URL('./x',import.meta.url);items.map(({u})=>u.pathname);fileURLToPath(u)", 0, 0, 0],
    ['post-block regex delimiter plant', "new URL((()=>{function f(){} /[)]/.test('x');return './x'})(),import.meta.url).pathname", 1, 0, 0],
    ['post-block innocent regex control', "function f(){} /new URL('x',import.meta.url).pathname/.test(s)", 0, 0, 0],
    ['break ASI regex delimiter plant', "new URL((()=>{while(ok){break\n/[)]/.test(x)}return './x'})(),import.meta.url).pathname", 1, 0, 0],
    ['break ASI innocent regex control', "function f(){while(ok){break\n/new URL('x',import.meta.url).pathname/.test(s)}}", 0, 0, 0],
    ['continue ASI regex delimiter plant', "new URL((()=>{while(ok){continue\n/[)]/.test(x)}return './x'})(),import.meta.url).pathname", 1, 0, 0],
    ['continue ASI innocent regex control', "function f(){while(ok){continue\n/new URL('x',import.meta.url).pathname/.test(s)}}", 0, 0, 0],
    ['debugger ASI regex delimiter plant', "new URL((()=>{debugger\n/[)]/.test(x);return './x'})(),import.meta.url).pathname", 1, 0, 0],
    ['debugger ASI innocent regex control', "function f(){debugger\n/new URL('x',import.meta.url).pathname/.test(s)}", 0, 0, 0],
    ['grouped platform consumer', "const u=new URL('./x',import.meta.url);fileURLToPath((u))", 0, 0, 0],
    ['option-bearing platform consumer', "const u=new URL('./x',import.meta.url);fileURLToPath(u,{windows:true})", 0, 0, 0],
    ['grouped option-bearing platform consumer', "const u=new URL('./x',import.meta.url);fileURLToPath(((u)),{windows:true})", 0, 0, 0],
    ['platform options alias escape fails closed', "const u=new URL('./x',import.meta.url);fileURLToPath(u,{windows:u})", 0, 0, 1],
    ['direct URL call consumer control', "const data=readFileSync(new URL('./x',import.meta.url),'utf8')", 0, 0, 0],
    ['var alias survives nested block', "function f(ok){if(ok){var u=new URL('./x',import.meta.url)}return u.pathname}", 1, 0, 0],
    ['var alias survives catch block', "function f(){try{work()}catch(err){var u=new URL('./x',import.meta.url)}return u.pathname}", 1, 0, 0],
    ['nested function owns its var alias', "function outer(){const u=platformValue;function inner(){if(ok){var u=new URL('./x',import.meta.url)}return u.pathname}return u.pathname}", 1, 0, 0],
    ['block let does not taint outer binding', "const u=platformValue;function f(ok){if(ok){let u=new URL('./x',import.meta.url)}return u.pathname}", 0, 0, 0],
    ['destructure non-path rename control', "const {origin:pathname}=new URL('./x',import.meta.url)", 0, 0, 0],
    ['destructure pathname rename', "const {pathname:local}=new URL('./x',import.meta.url)", 1, 0, 0],
    ['destructure static bracket pathname rename', "const {['pathname']:local}=new URL('./x',import.meta.url)", 1, 0, 0],
    ['direct static template bracket pathname', "new URL('./x',import.meta.url)[`pathname`]", 1, 0, 0],
    ['alias static template bracket pathname', "const u=new URL('./x',import.meta.url);u[`pathname`]", 1, 0, 0],
    ['static template bracket non-path control', "new URL('./x',import.meta.url)[`origin`]", 0, 0, 0],
    ['tagged template later segment control', 'const s=String.raw`${prefix}file://${path}`', 0, 0, 0],
    ['untagged template later segment', 'const s=`${prefix}file://${path}`', 0, 1, 0],
    ['grouped file URL concatenation', "const href=('file://')+path", 0, 1, 0],
    ['double-grouped file URL concatenation', 'const href=(("file:///"))+path', 0, 1, 0],
    ['grouped file URL concatenation inside call', "const href=String((('file:////'))+path)", 0, 1, 0],
    ['grouped static file URL control', "const href=('file:///tmp/x')", 0, 0, 0],
    ['grouped file URL property control', "const length=('file://').length", 0, 0, 0],
    ['quoted grouped concatenation spelling control', 'const text="(\'file://\') + path"', 0, 0, 0],
    ['escaped pathname identifier', "new URL('./x',import.meta.url).\\u0070athname", 1, 0, 0],
    ['escaped optional pathname identifier', "new URL('./x',import.meta.url)?.\\u{70}athname", 1, 0, 0],
    ['escaped alias binding flows to pathname', "const \\u0075=new URL('./x',import.meta.url);u.pathname", 1, 0, 0],
    ['escaped non-path identifier control', "new URL('./x',import.meta.url).\\u006Frigin", 0, 0, 0],
    ['quoted escaped pathname spelling control', 'const text="new URL(\'./x\',import.meta.url).\\\\u0070athname"', 0, 0, 0],
    ['async declaration parameter shadows outer alias', "const u=new URL('./x',import.meta.url);async function f(u){return u.pathname}fileURLToPath(u)", 0, 0, 0],
    ['exported async declaration parameter shadows outer alias', "const u=new URL('./x',import.meta.url);export async function f(u){return u.pathname}fileURLToPath(u)", 0, 0, 0],
    ['default-exported async declaration parameter shadows outer alias', "const u=new URL('./x',import.meta.url);export default async function f(u){return u.pathname}fileURLToPath(u)", 0, 0, 0],
    ['nested async declaration parameter shadows outer alias', "const u=new URL('./x',import.meta.url);function outer(){async function f(u){return u.pathname}}fileURLToPath(u)", 0, 0, 0],
    ['async generator parameter shadows outer alias', "const u=new URL('./x',import.meta.url);async function* f(u){yield u.pathname}fileURLToPath(u)", 0, 0, 0],
    ['async declaration default still reads outer alias', "const u=new URL('./x',import.meta.url);async function f(x=u.pathname){}fileURLToPath(u)", 1, 0, 0],
    ['async function expression parameter shadows outer alias', "const u=new URL('./x',import.meta.url);const f=async function(u){return u.pathname};fileURLToPath(u)", 0, 0, 0],
    ['async arrow parameter shadows outer alias', "const u=new URL('./x',import.meta.url);const f=async(u)=>u.pathname;fileURLToPath(u)", 0, 0, 0],
    ['object async method parameter shadows outer alias', "const u=new URL('./x',import.meta.url);const obj={async f(u){return u.pathname}};fileURLToPath(u)", 0, 0, 0],
    ['named function expression preserves outer alias', "const u=new URL('./x',import.meta.url);const f=function u(){};u.pathname", 1, 0, 0],
    ['named class expression preserves outer alias', "const u=new URL('./x',import.meta.url);const C=class u{};u.pathname", 1, 0, 0],
    ['named function expression private body is clean', "const f=function u(){return u.pathname}", 0, 0, 0],
    ['named function expression private default is clean', "const f=function u(x=u.pathname){}", 0, 0, 0],
    ['named class expression private body is clean', "const C=class u{static x=u.pathname}", 0, 0, 0],
    ['named async function expression preserves outer alias', "const u=new URL('./x',import.meta.url);const f=async function u(){};u.pathname", 1, 0, 0],
    ['named generator expression preserves outer alias', "const u=new URL('./x',import.meta.url);const f=function* u(){};u.pathname", 1, 0, 0],
    ['named async generator expression preserves outer alias', "const u=new URL('./x',import.meta.url);const f=async function* u(){};u.pathname", 1, 0, 0],
    ['anonymous function expression creates no synthetic name', "const u=new URL('./x',import.meta.url);const f=function(){return u.origin};u.pathname", 1, 0, 0],
    ['anonymous class expression creates no synthetic name', "const u=new URL('./x',import.meta.url);const C=class{static x=u.origin};u.pathname", 1, 0, 0],
    ['function declaration binds its block scope', "const u=new URL('./x',import.meta.url);{function u(){}u.pathname}fileURLToPath(u)", 0, 0, 0],
    ['class declaration binds its block scope', "const u=new URL('./x',import.meta.url);{class u{}u.pathname}fileURLToPath(u)", 0, 0, 0],
    ['conditional URL then platform preserves alias', "let u;if(ok)u=new URL('./x',import.meta.url);else u=platformValue;u.pathname", 1, 0, 0],
    ['conditional platform then URL preserves alias', "let u;if(ok)u=platformValue;else u=new URL('./x',import.meta.url);u.pathname", 1, 0, 0],
    ['unconditional platform reassignment clears alias', "let u=new URL('./x',import.meta.url);u=platformValue;u.pathname", 0, 0, 0],
    ['later comma declarator shadows outer alias', "const u=new URL('./x',import.meta.url);{const x=1,u=platformValue;}u.pathname", 1, 0, 0],
    ['later comma declarator owns URL alias', "const x=1,u=new URL('./x',import.meta.url);u.pathname", 1, 0, 0],
    ['destructured object binding shadows outer alias', "const u=new URL('./x',import.meta.url);{const {u}=obj;u.pathname}fileURLToPath(u)", 0, 0, 0],
    ['destructured array binding shadows outer alias', "const u=new URL('./x',import.meta.url);{const [u]=items;u.pathname}fileURLToPath(u)", 0, 0, 0],
    ['destructured rest binding shadows outer alias', "const u=new URL('./x',import.meta.url);{const {...u}=obj;u.pathname}fileURLToPath(u)", 0, 0, 0],
    ['braced conditional URL then platform preserves alias', "let u;if(ok){u=new URL('./x',import.meta.url)}else{u=platformValue}u.pathname", 1, 0, 0],
    ['plain block unconditional reassignment clears alias', "let u=new URL('./x',import.meta.url);{u=platformValue}u.pathname", 0, 0, 0],
    ['later comma uninitialized binding shadows outer alias', "const u=new URL('./x',import.meta.url);{let x=1,u;u?.pathname}fileURLToPath(u)", 0, 0, 0],
    ['later comma destructure shadows outer alias', "const u=new URL('./x',import.meta.url);{const x=1,{u}=obj;u.pathname}fileURLToPath(u)", 0, 0, 0],
    ['var binding shadows for its whole function scope', "const u=new URL('./x',import.meta.url);function f(){u.pathname;var u=platformValue}fileURLToPath(u)", 0, 0, 0],
    ['lexical binding shadows for its whole block scope', "const u=new URL('./x',import.meta.url);{u.pathname;let u=platformValue}fileURLToPath(u)", 0, 0, 0],
    ['nested function URL write preserves possible outer alias', "let u;function f(){u=new URL('./x',import.meta.url)}u.pathname", 1, 0, 0],
    ['nested function platform write does not clear outer alias', "let u=new URL('./x',import.meta.url);function f(){u=platformValue}u.pathname", 1, 0, 0],
    ['for lexical binding does not clear outer alias', "const u=new URL('./x',import.meta.url);for(const u of items){u.origin}u.pathname", 1, 0, 0],
    ['for lexical binding shadows outer alias inside loop', "const u=new URL('./x',import.meta.url);for(const u of items){u.pathname}fileURLToPath(u)", 0, 0, 0],
    ['for lexical URL alias is caught inside loop', "for(let u=new URL('./x',import.meta.url);ok;step()){u.pathname}", 1, 0, 0],
    ['logical-and conditional clear preserves possible alias', "let u=new URL('./x',import.meta.url);ok&&(u=platformValue);u.pathname", 1, 0, 0],
    ['logical-or conditional clear preserves possible alias', "let u=new URL('./x',import.meta.url);ok||(u=platformValue);u.pathname", 1, 0, 0],
    ['ternary then-branch clear preserves possible alias', "let u=new URL('./x',import.meta.url);ok?(u=platformValue):noop;u.pathname", 1, 0, 0],
    ['ternary else-branch clear preserves possible alias', "let u=new URL('./x',import.meta.url);ok?noop:(u=platformValue);u.pathname", 1, 0, 0],
    ['expression arrow clear preserves possible outer alias', "let u=new URL('./x',import.meta.url);const clear=()=>u=platformValue;u.pathname", 1, 0, 0],
    ['expression arrow URL write is caught and its initializer fails closed', "let u;const set=()=>u=new URL('./x',import.meta.url);u.pathname", 1, 0, 1],
    ['logical-and conditional URL write introduces possible alias', "let u;ok&&(u=new URL('./x',import.meta.url));u.pathname", 1, 0, 0],
    ['ternary conditional URL write introduces possible alias', "let u;ok?(u=new URL('./x',import.meta.url)):noop;u.pathname", 1, 0, 0],
    ['grouped unconditional clear stays clean', "let u=new URL('./x',import.meta.url);(u=platformValue);u.pathname", 0, 0, 0],
    ['unconditional logical-expression assignment clears alias', "let u=new URL('./x',import.meta.url);u=ok&&platformValue;u.pathname", 0, 0, 0],
    ['nullish assignment introduces URL alias', "let u;u??=new URL('./x',import.meta.url);u.pathname", 1, 0, 0],
    ['or assignment introduces URL alias', "let u;u||=new URL('./x',import.meta.url);u.pathname", 1, 0, 0],
    ['and assignment may introduce URL alias', "let u;u&&=new URL('./x',import.meta.url);u.pathname", 1, 0, 0],
    ['logical assignment cannot clear tracked URL alias', "let u=new URL('./x',import.meta.url);u??=platformValue;u.pathname", 1, 0, 0],
    ['logical assignment accepts tracked URL alias RHS', "const base=new URL('./x',import.meta.url);let u;u||=base;u.pathname", 1, 0, 0],
    ['non-URL logical assignment remains clean', "let u;u??=platformValue;u?.pathname", 0, 0, 0],
    ['platform path logical assignment remains clean', "let u;u??=fileURLToPath(new URL('./x',import.meta.url));u?.pathname", 0, 0, 0],
    ['for-of direct URL array flows into binding', "for(const u of [new URL('./x',import.meta.url)]){u.pathname}", 1, 0, 0],
    ['for-of tracked URL alias flows into binding', "const base=new URL('./x',import.meta.url);for(const u of [base]){u.pathname}", 1, 0, 0],
    ['for-of platform path array stays clean', "for(const u of [fileURLToPath(new URL('./x',import.meta.url))]){u.pathname}", 0, 0, 0],
    ['for-of tracked platform path alias stays clean', "const base=fileURLToPath(new URL('./x',import.meta.url));for(const u of [base]){u.pathname}", 0, 0, 0],
    ['for-of conditional URL element fails closed', "for(const u of [ok?new URL('./x',import.meta.url):platformValue]){u.pathname}", 0, 0, 1],
    ['for-of nested destructure fails closed', "for(const [u] of [[new URL('./x',import.meta.url)]]){u.pathname}", 0, 0, 1],
    ['for-in binds keys rather than URL values', "for(const u in {x:new URL('./x',import.meta.url)}){u.pathname}", 0, 0, 0],
  ];
  const blockerResults = [];
  for (const eol of ['\n', '\r\n']) {
    for (const [label, source, expectedPath, expectedFile, expectedAmbiguous] of blockerCases) {
      const findings = scanSource(source.replace(/\n/g, eol)).findings;
      const actualPath = findings.filter((finding) => finding.kind === 'URL pathname used as a filesystem path').length;
      const actualFile = findings.filter((finding) => finding.kind === 'hand-rolled file URL').length;
      const actualAmbiguous = findings.filter((finding) => finding.kind === 'ambiguous module URL alias flow').length;
      const other = findings.length - actualPath - actualFile - actualAmbiguous;
      blockerResults.push({ label, eol: eol === '\n' ? 'LF' : 'CRLF', ok: actualPath === expectedPath && actualFile === expectedFile && actualAmbiguous === expectedAmbiguous && other === 0, actualPath, actualFile, actualAmbiguous, other });
    }
  }
  const blockerFailures = blockerResults.filter((result) => !result.ok);
  say(blockerFailures.length === 0, 'exact-head blocker matrix passes through the shared LF/CRLF scanner',
    blockerFailures.length ? blockerFailures.map((result) => `${result.eol}:${result.label}=path${result.actualPath}/file${result.actualFile}/amb${result.actualAmbiguous}/other${result.other}`).join(', ') : `${blockerResults.length}/${blockerResults.length}`);

  const reviewU = "new URL('./x',import.meta.url)";
  const reviewP = "'./x'";
  const reviewCases = [
    ['E1', `let u=${reviewU};ok&&(u=${reviewP});u.pathname`, 1],
    ['E2', `let u=${reviewU};ok||(u=${reviewP});u.pathname`, 1],
    ['E3', `let u=${reviewU};ok?(u=${reviewP}):void 0;u.pathname`, 1],
    ['E4', `let u=${reviewP};ok&&(u=${reviewU});u.pathname`, 1],
    ['E5', `let u=${reviewP};ok?(u=${reviewU}):(u=${reviewP});u.pathname`, 1],
    ['E6', `let u=${reviewU};ok?(u=${reviewP}):(u='./y');u.pathname`, 0],
    ['E7', `let u=${reviewU};u=${reviewP};u.pathname`, 0],
    ['E8', `let u=${reviewU};ok&&(u=${reviewP});u='./y';u.pathname`, 0],
    ['E9', `let u=${reviewU};{let u=${reviewP};ok&&(u='./y');u.pathname}u.pathname`, 1],
    ['E10', `let u=${reviewU};[1].map(u=>ok&&(u=${reviewP}));u.pathname`, 1],
    ['E11', `let a=${reviewU},b=a;ok&&(a=${reviewP});b.pathname`, 1],
    ['E12', 'let a,b;a=b;b=a;a.pathname', 0],
    ['E13', `let u=${reviewU};ok&&(u=${reviewP});fileURLToPath(u)`, 0],
    ['E14', `let u=${reviewU};(ok&&(u=${reviewP}),u.pathname)`, 1],
    ['E15', `let u=${reviewU};ok&&(inner?(u=${reviewP}):(u='./y'));u.pathname`, 1],
    ['L1', `let u;u??=${reviewU};u.pathname`, 1],
    ['L2', `let u;u||=${reviewU};u.pathname`, 1],
    ['L3', `let v=${reviewU},u;u??=v;u.pathname`, 1],
    ['L4', `let v=${reviewU},u;u||=(v);u.pathname`, 1],
    ['L5', `let u;u??=${reviewP};u.pathname`, 0],
    ['L6', `let u;u||=${reviewP};u.pathname`, 0],
    ['L7', `let u;u??=${reviewU};u=${reviewP};u.pathname`, 0],
    ['L8', `let u;u??=${reviewU};const v=u;u=${reviewP};v.pathname`, 1],
    ['L9', `let u;u??=${reviewU};fileURLToPath(u)`, 0],
    ['L10', "let u;u??=new URL('./x',import.meta.url).pathname", 1],
    ['L11', `let a=${reviewU},b;b??=a;a??=b;b.pathname`, 1],
    ['L12', 'let a,b;a??=b;b??=a;a.pathname', 0],
    ['L13', `let u=${reviewP};{let u;u||=${reviewU};u.pathname}u.pathname`, 1],
    ['L14', `let u;u??=(ok?${reviewU}:${reviewP});u.pathname`, 1],
    ['L15', `let u;u||=fileURLToPath(${reviewU});u.pathname`, 0],
    ['F1', `for(const u of [${reviewU}]){u.pathname}`, 1],
    ['F2', `const xs=[${reviewU}];for(const u of xs){u.pathname}`, 1],
    ['F3', `for(const p of [fileURLToPath(${reviewU})]){p.pathname}`, 0],
    ['F4', `for(const p of [${reviewP}]){p.pathname}`, 0],
    ['F5', `for(const [u] of [[${reviewU}]]){u.pathname}`, 1],
    ['F6', `for(const {u} of [{u:${reviewU}}]){u.pathname}`, 1],
    ['F7', `let u=${reviewU};for(const u of [${reviewP}]){u.pathname}u.pathname`, 1],
    ['F8', `let u=${reviewU};for(u of [${reviewP}]){}u.pathname`, 1],
    ['F9', `let u=${reviewP};for(u of [${reviewU}]){}u.pathname`, 1],
    ['F10', `for(let u of [${reviewU}]){u=${reviewP};u.pathname}`, 0],
    ['F11', `for(let u of [${reviewU}]){u.pathname;u=${reviewP}}`, 1],
    ['F12', `for(let u of [${reviewU}]){if(ok)u=${reviewP};u.pathname}`, 1],
    ['F13', `for(const u of [${reviewU}]){fileURLToPath(u)}`, 0],
    ['F14', 'for(const k in {a:1}){k.pathname}', 0],
    ['F15', `let u=${reviewU};for(const u in {a:1}){u.pathname}fileURLToPath(u)`, 0],
    ['F16', `let u=${reviewU};for(u in obj){}u.pathname`, 1],
    ['F17', `let u=${reviewP};for(u in obj){}u.pathname`, 0],
    ['F18', `for(const k in {[${reviewU}.pathname]:1}){k.pathname}`, 1],
    ['F19', 'let a;a=a;for(const u of [a]){u.pathname}', 0],
    ['F20', `let a=${reviewU},b=a;a=b;for(const u of [b]){u.pathname}`, 1],
    ['F21', `async function f(){for await(const u of [${reviewU}]){u.pathname}}`, 1],
    ['F21-control', `async function f(){for await(const u of [${reviewU}]){fileURLToPath(u)}}`, 0],
  ];
  const reviewResults = [];
  for (const eol of ['\n', '\r\n']) {
    for (const [label, source, expected] of reviewCases) {
      const findings = scanSource(source.replace(/\n/g, eol)).findings;
      reviewResults.push({ label, eol: eol === '\n' ? 'LF' : 'CRLF', expected, actual: findings.length });
    }
  }
  const reviewFailures = reviewResults.filter((result) => result.actual !== result.expected);
  say(reviewFailures.length === 0, 'review P2 control-flow matrix reports each unsafe source site once in LF and CRLF',
    reviewFailures.length ? reviewFailures.map((result) => `${result.eol}:${result.label}=${result.actual}/${result.expected}`).join(', ') : `${reviewResults.length}/${reviewResults.length}`);

  const lexicalAmbiguities = [
    "const x='unterminated",
    'const x="unterminated',
    'const x=`unterminated ${value}',
    'const x=/unterminated',
    '/* unterminated',
    'const \\u00ZZ = 1',
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
