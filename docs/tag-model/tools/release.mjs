// Compiles the tag-model tables into the release constants module.
//
//   node docs/tag-model/tools/release.mjs [--out <path>] [--check]
//
// Input: every CSV under tables/ and tables/presentation/.
// Output: docs/tag-model/release/tag-constants.js (default), one ES module of
// data only. --check writes nothing and exits 1 when the file on disk is not
// what a fresh compile gives. Pure Node, no dependencies. Design and encoding:
// docs/tag-model/RELEASE.md. Compile failures list every problem and exit 2.
//
// Exports for check.mjs and the tests: compileRelease(), readInputs(),
// FORMAT, DEFAULT_OUT, OPCODES, FUNCS, BINOPS.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { parseCsv } from './csv.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TM = join(HERE, '..');
export const TABLES_DIR = join(TM, 'tables');
export const DEFAULT_OUT = join(TM, 'release', 'tag-constants.js');

// Encoding version. Bump when the module layout changes.
export const FORMAT = 1;

// RPN opcodes. An opcode is followed by its arguments (RELEASE.md).
export const OPCODES = ['NUM', 'RANK', 'VALUE', 'FORMULA', 'CALL', 'NEG', 'NOT', 'BIN'];
const OP = Object.fromEntries(OPCODES.map((n, i) => [n, i]));
// Functions and binary operators, as the workbench formula engine has them.
export const FUNCS = ['min', 'max', 'floor', 'ceil', 'round', 'abs', 'clamp', 'if'];
const FUNC_ARITY = {
  min: [1, Infinity], max: [1, Infinity], floor: [1, 1], ceil: [1, 1], round: [1, 1],
  abs: [1, 1], clamp: [3, 3], if: [3, 3],
};
export const BINOPS = ['+', '-', '*', '/', '%', '^', '<', '>', '<=', '>=', '==', '!=', '&&', '||'];
const BIN = Object.fromEntries(BINOPS.map((n, i) => [n, i]));

// Columns that never reach the release module, per table. Each is prose or
// provenance the game does not read at runtime (RELEASE.md, Encoding).
export const DROP = {
  assets: ['note'],
  formulas: ['description', 'expr'],
  objects: ['description'],
  ranks: ['note'],
  relations: ['note'],
  values: ['description'],
  tags: ['description', 'effect'],
  'presentation.animations': ['source', 'liveRef'],
  'presentation.assets': ['usedBy', 'liveRef'],
  'presentation.breakpoints': ['file', 'usedBy', 'liveRef'],
  'presentation.combat-symbols': ['currentSymbol', 'currentAssetRef', 'liveRef'],
  'presentation.components': ['file', 'notes', 'liveRef'],
  'presentation.effects': ['source', 'liveRef'],
  'presentation.layouts': ['source', 'liveRef'],
  'presentation.resolutions': ['description', 'usedWhen', 'source', 'liveRef'],
  'presentation.settings': ['readBy', 'file', 'storage', 'liveRef'],
  'presentation.strings': ['context', 'file', 'liveRef'],
  'presentation.styles': ['source', 'liveRef'],
  'presentation.symbols': ['usedFor', 'file', 'liveRef'],
  'presentation.tokens': ['file', 'liveRef'],
};

// Columns that name tags. 'g' is one tag key (or empty), 'G' a list of tag
// keys, 'i' one tag id (its full path, used by tags.parent).
export const TAG_REF = {
  tags: { parent: 'i', school: 'g', related: 'G' },
  objects: { cardType: 'g', stance: 'g', rarity: 'g', costResource: 'g', skill: 'g', exp: 'G', tags: 'G' },
  relations: { source: 'g', target: 'g' },
};

const CANONICAL_NUMBER = /^-?\d+(\.\d+)?$/;
const isCanonicalNumber = t => CANONICAL_NUMBER.test(t) && String(Number(t)) === t;
const RANK_CHANGE = /^(?:[+\-=×*x])?-?\d+(\.\d+)?$/;
const NUMBER_TOKEN = /^(\d+\.?\d*|\.\d+)$/;

// ------------------------------------------------------------------ inputs

// Relative paths of every table, sorted: top-level tables, then presentation.
export function listInputs(tablesDir = TABLES_DIR) {
  const top = readdirSync(tablesDir).filter(f => f.endsWith('.csv')).sort();
  const pres = join(tablesDir, 'presentation');
  const presentation = existsSync(pres)
    ? readdirSync(pres).filter(f => f.endsWith('.csv')).sort().map(f => 'presentation/' + f)
    : [];
  return [...top, ...presentation];
}

// Reads every input as { path, text }, the path relative to tablesDir with '/'.
export function readInputs(tablesDir = TABLES_DIR) {
  return listInputs(tablesDir).map(path => ({
    path,
    text: readFileSync(join(tablesDir, ...path.split('/')), 'utf8'),
  }));
}

function tableName(path) {
  const base = path.replace(/\.csv$/, '');
  return base.startsWith('presentation/') ? 'presentation.' + base.slice('presentation/'.length) : base;
}

function parseTable(path, text) {
  const all = parseCsv(text);
  const header = all.shift() || [];
  const rows = all.filter(r => !(r.length === 1 && r[0] === ''));
  rows.forEach((r, n) => {
    if (r.length !== header.length) {
      throw new Error(`${path}: row ${n + 2} has ${r.length} columns, header has ${header.length}`);
    }
  });
  if (new Set(header).size !== header.length) throw new Error(`${path}: duplicate column name`);
  return { header, rows };
}

// ------------------------------------------------------------------ formulas

// Tokenizer and parser: the workbench formula grammar (workbench.html, the
// formula engine). Two deliberate differences, both loud errors where the
// workbench would give a wrong answer: a malformed number such as 1.2.3 fails,
// and an operator token is matched by type, so a [ref] named "(" is not read
// as a parenthesis.
export function tokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '[') {
      const j = s.indexOf(']', i);
      if (j < 0) throw new Error('missing ]');
      out.push({ t: 'ref', v: s.slice(i + 1, j).trim() });
      i = j + 1;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const text = s.slice(i, j);
      if (!NUMBER_TOKEN.test(text)) throw new Error(`bad number "${text}"`);
      out.push({ t: 'num', v: parseFloat(text) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z_0-9]/.test(s[j])) j++;
      out.push({ t: 'id', v: s.slice(i, j) });
      i = j;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/%^()<>,!×'.includes(c)) { out.push({ t: 'op', v: c === '×' ? '*' : c }); i++; continue; }
    throw new Error(`unexpected "${c}"`);
  }
  return out;
}

export function parseFormula(s) {
  const tk = tokenize(s);
  let p = 0;
  const peek = () => tk[p];
  const isOp = (t, v) => t && t.t === 'op' && t.v === v;
  const eat = v => { if (isOp(tk[p], v)) { p++; return true; } return false; };
  const need = v => { if (!eat(v)) throw new Error('expected ' + v); };
  const bin = (next, ops) => () => {
    let l = next();
    for (;;) {
      const o = peek();
      if (o && o.t === 'op' && ops.includes(o.v)) { p++; l = { op: o.v, l, r: next() }; } else return l;
    }
  };
  function unary() {
    if (eat('-')) return { op: 'neg', a: unary() };
    if (eat('!')) return { op: 'not', a: unary() };
    return pow();
  }
  function pow() {
    const b = prim();
    if (eat('^')) return { op: '^', l: b, r: unary() };
    return b;
  }
  function prim() {
    const t = tk[p++];
    if (!t) throw new Error('unexpected end');
    if (t.t === 'num') return { num: t.v };
    if (t.t === 'ref') return { ref: t.v };
    if (t.t === 'id') {
      need('(');
      const args = [];
      if (!eat(')')) {
        do { args.push(or()); } while (eat(','));
        need(')');
      }
      return { fn: t.v.toLowerCase(), args };
    }
    if (isOp(t, '(')) { const e = or(); need(')'); return e; }
    throw new Error(`unexpected "${t.v}"`);
  }
  const mul = bin(unary, ['*', '/', '%']);
  const add = bin(mul, ['+', '-']);
  const cmp = bin(add, ['<', '>', '<=', '>=', '==', '!=']);
  const and = bin(cmp, ['&&']);
  const or = bin(and, ['||']);
  const e = or();
  if (p < tk.length) throw new Error(`unexpected "${tk[p].v}"`);
  return e;
}

// ------------------------------------------------------------------ compile

// Compiles every input. Returns { source, notes, stats } or throws one Error
// that lists every problem. Pure: no files are read or written here.
export function compileInputs(inputs) {
  const errors = [];
  const fail = msg => errors.push(msg);
  const notes = [];

  const parsed = new Map();
  for (const { path, text } of inputs) {
    const name = tableName(path);
    const t = parseTable(path, text);
    parsed.set(name, t);
  }
  const need = name => {
    if (!parsed.has(name)) throw new Error(`missing table ${name}.csv`);
    return parsed.get(name);
  };

  // Tags: id = row index. A tag column names a tag by key ('g', 'G') or by id ('i').
  const tagsT = need('tags');
  const tagIx = tagsT.header.indexOf('id');
  const tagKeyIx = tagsT.header.indexOf('key');
  const tagByKey = new Map();
  const tagById = new Map();
  tagsT.rows.forEach((r, i) => {
    const key = r[tagKeyIx];
    if (key) {
      if (tagByKey.has(key)) fail(`tags: duplicate key "${key}"`);
      tagByKey.set(key, i);
    }
    if (r[tagIx]) {
      if (tagById.has(r[tagIx])) fail(`tags: duplicate id "${r[tagIx]}"`);
      tagById.set(r[tagIx], i);
    }
  });
  const findTag = k => (tagByKey.has(k) ? tagByKey.get(k) : -1);
  const findTagId = k => (tagById.has(k) ? tagById.get(k) : -1);

  // Values: id = row index.
  const valT = need('values');
  const valueIds = new Map();
  const valKeyIx = valT.header.indexOf('key');
  valT.rows.forEach((r, i) => {
    const k = r[valKeyIx];
    if (!k) fail(`values row ${i + 2}: empty key`);
    else if (valueIds.has(k)) fail(`values: duplicate key "${k}"`);
    else valueIds.set(k, i);
  });

  // Objects: ids and every [key] in their text columns.
  const objT = need('objects');
  const objIx = objT.header.indexOf('id');
  const objectIds = new Set(objT.rows.map(r => r[objIx]));
  const formulaT = need('formulas');
  const fKeyIx = formulaT.header.indexOf('key');
  const fExprIx = formulaT.header.indexOf('expr');
  const fStatusIx = formulaT.header.indexOf('status');
  const formulaRows = formulaT.rows.filter(r => {
    const excluded = !String(r[fExprIx] ?? '').trim() && r[fStatusIx] === 'proposed';
    if (excluded) notes.push(`excluded formulas.csv "${r[fKeyIx]}": status=proposed with no expression`);
    return !excluded;
  });
  const formulaIds = new Map();
  const excludedKeys = new Set(formulaT.rows.map(r => r[fKeyIx]).filter(k => !formulaRows.some(r => r[fKeyIx] === k)));
  formulaRows.forEach((r, i) => {
    const k = r[fKeyIx];
    if (!k) fail('formulas: empty key');
    else if (formulaIds.has(k)) fail(`formulas: duplicate key "${k}"`);
    else formulaIds.set(k, i);
  });

  const refKind = k => {
    if (k === 'rank') return 'rank';
    if (valueIds.has(k) && formulaIds.has(k)) return 'ambiguous';
    if (formulaIds.has(k)) return 'formula';
    if (valueIds.has(k)) return 'value';
    if (findTag(k) >= 0) return 'tag';
    if (objectIds.has(k)) return 'object';
    if (excludedKeys.has(k)) return 'excluded';
    return null;
  };

  // [key] references in object text: any kind the workbench accepts.
  for (const row of objT.rows) {
    objT.header.forEach((col, c) => {
      for (const k of bracketRefs(row[c])) {
        const kind = refKind(k);
        if (kind === null || kind === 'excluded') fail(`objects ${row[objIx]}.${col}: unresolved [${k}]`);
        if (kind === 'ambiguous') fail(`objects ${row[objIx]}.${col}: [${k}] is both a value and a formula`);
      }
    });
  }

  // Formulas: RPN with resolved refs.
  const numPool = [];
  const numIx = new Map();
  const funcIx = new Map(FUNCS.map((f, i) => [f, i]));
  const deps = formulaRows.map(() => new Set());
  const codes = formulaRows.map((r, fi) => {
    const key = r[fKeyIx];
    const out = [];
    const pushNum = v => {
      if (!numIx.has(v)) { numIx.set(v, numPool.length); numPool.push(v); }
      return numIx.get(v);
    };
    const resolve = name => {
      const kind = refKind(name);
      if (name === 'rank') return [OP.RANK];
      if (kind === 'ambiguous') throw new Error(`[${name}] is both a value and a formula`);
      if (kind === 'formula') { deps[fi].add(formulaIds.get(name)); return [OP.FORMULA, formulaIds.get(name)]; }
      if (kind === 'value') return [OP.VALUE, valueIds.get(name)];
      if (kind === 'excluded') throw new Error(`[${name}] is a proposed formula with no expression`);
      if (kind === 'tag') throw new Error(`[${name}] is a tag with no preview value`);
      if (kind === 'object') throw new Error(`[${name}] is an object, not a value`);
      throw new Error(`unresolved [${name}]`);
    };
    const emit = (n) => {
      if ('num' in n) { out.push(OP.NUM, pushNum(n.num)); return; }
      if ('ref' in n) { out.push(...resolve(n.ref)); return; }
      if (n.fn !== undefined) {
        if (!funcIx.has(n.fn)) throw new Error(`unknown function ${n.fn}`);
        const [lo, hi] = FUNC_ARITY[n.fn];
        if (n.args.length < lo || n.args.length > hi) {
          throw new Error(`${n.fn} takes ${lo === hi ? lo : lo + ' or more'} argument(s), got ${n.args.length}`);
        }
        for (const a of n.args) emit(a);
        out.push(OP.CALL, funcIx.get(n.fn), n.args.length);
        return;
      }
      if (n.op === 'neg') { emit(n.a); out.push(OP.NEG); return; }
      if (n.op === 'not') { emit(n.a); out.push(OP.NOT); return; }
      emit(n.l);
      emit(n.r);
      out.push(OP.BIN, BIN[n.op]);
    };
    try {
      emit(parseFormula(String(formulaRows[fi][fExprIx] ?? '')));
    } catch (e) {
      fail(`formulas ${key}: ${e.message}`);
    }
    return out;
  });

  // Formula loops, found on the resolved graph.
  {
    const state = new Array(formulaRows.length).fill(0);
    const stack = [];
    const visit = fi => {
      if (state[fi] === 2) return;
      if (state[fi] === 1) {
        const from = stack.indexOf(fi);
        fail(`formulas: loop ${stack.slice(from).concat(fi).map(i => formulaRows[i][fKeyIx]).join(' -> ')}`);
        return;
      }
      state[fi] = 1;
      stack.push(fi);
      for (const d of deps[fi]) visit(d);
      stack.pop();
      state[fi] = 2;
    };
    formulaRows.forEach((_, fi) => visit(fi));
  }

  // Ranks: object and key must exist; change must be a workbench change.
  const rankT = need('ranks');
  const rc = name => rankT.header.indexOf(name);
  for (const r of rankT.rows) {
    const [obj, rank, key, change] = [r[rc('object')], r[rc('rank')], r[rc('key')], r[rc('change')]];
    if (!objectIds.has(obj)) fail(`ranks: unknown object "${obj}"`);
    if (!valueIds.has(key)) fail(`ranks: "${key}" is not a value key`);
    if (!/^\d+$/.test(rank)) fail(`ranks ${obj} ${key}: bad rank "${rank}"`);
    if (!RANK_CHANGE.test(String(change).trim())) fail(`ranks ${obj} ${key}: bad change "${change}"`);
  }

  // Tag reference columns: resolve every name to a tag id.
  const tagOne = (where, text, find = findTag) => {
    if (text === '') return -1;
    const id = find(text);
    if (id < 0) fail(`${where}: unknown tag "${text}"`);
    return id;
  };
  const tagList = (where, text) => {
    if (text === '') return [];
    const parts = text.split(' ');
    if (parts.some(p => p === '')) { fail(`${where}: tag list "${text}" is not single-space separated`); return []; }
    return parts.map(p => {
      const id = findTag(p);
      if (id < 0) fail(`${where}: unknown tag "${p}"`);
      return id;
    });
  };

  // Build the tables.
  const names = [...parsed.keys()];
  const strings = [''];
  const strIx = new Map([['', 0]]);
  const intern = s => {
    if (!strIx.has(s)) { strIx.set(s, strings.length); strings.push(s); }
    return strIx.get(s);
  };

  const outTables = {};
  let kept = 0;
  for (const name of names) {
    const t = parsed.get(name);
    const drop = new Set(DROP[name] || []);
    const cols = t.header.map((h, c) => ({ h, c })).filter(({ h }) => !drop.has(h));
    let rows = t.rows;
    if (name === 'formulas') rows = formulaRows;
    const tagRefs = TAG_REF[name] || {};
    const columns = [];

    for (const { h, c } of cols) {
      if (tagRefs[h] === 'g' || tagRefs[h] === 'i') {
        const find = tagRefs[h] === 'i' ? findTagId : findTag;
        columns.push([h, tagRefs[h], rows.map((r, i) => tagOne(`${name} row ${i + 2} ${h}`, r[c], find))]);
        continue;
      }
      if (tagRefs[h] === 'G') {
        columns.push([h, 'G', rows.map((r, i) => tagList(`${name} row ${i + 2} ${h}`, r[c]))]);
        continue;
      }
      const values = rows.map(r => r[c]);
      const nonEmpty = values.filter(v => v !== '');
      if (nonEmpty.length && nonEmpty.every(isCanonicalNumber)) {
        columns.push([h, 'n', values.map(v => (v === '' ? null : Number(v)))]);
      } else {
        columns.push([h, 's', values.map(intern)]);
      }
    }

    if (name === 'formulas') {
      columns.push(['code', 'c', codes]);
    }
    outTables[name] = { n: rows.length, cols: columns };
    kept += cols.length;
  }

  if (errors.length) {
    const err = new Error(`release compile failed (${errors.length} problem${errors.length === 1 ? '' : 's'}):\n  ` + errors.join('\n  '));
    err.problems = errors;
    throw err;
  }

  const hash = sourceHash(inputs);
  const source = renderModule({ hash, strings, numPool, outTables });
  return {
    source,
    notes,
    stats: {
      inputs: inputs.length,
      csvBytes: inputs.reduce((n, i) => n + Buffer.byteLength(i.text, 'utf8'), 0),
      moduleBytes: Buffer.byteLength(source, 'utf8'),
      gzipBytes: gzipSync(Buffer.from(source, 'utf8'), { level: 9 }).length,
      strings: strings.length,
      columns: kept,
      formulas: formulaRows.length,
      hash,
    },
  };
}

function bracketRefs(text) {
  const out = [];
  String(text ?? '').replace(/\[([^\]]+)\]/g, (m, k) => { out.push(k.trim()); return m; });
  return out;
}

export function sourceHash(inputs) {
  const h = createHash('sha256');
  h.update(`tag-constants/${FORMAT}\n`);
  for (const { path, text } of inputs) {
    const bytes = Buffer.from(text, 'utf8');
    h.update(`${path}\n${bytes.length}\n`);
    h.update(bytes);
  }
  return h.digest('hex');
}

// ------------------------------------------------------------------ render

function renderModule({ hash, strings, numPool, outTables }) {
  const lines = [];
  lines.push('// Generated by docs/tag-model/tools/release.mjs from docs/tag-model/tables/.');
  lines.push('// Do not edit: change the tables, then run the compiler (docs/tag-model/RELEASE.md).');
  lines.push(`export const FORMAT = ${FORMAT};`);
  lines.push(`export const SOURCE_HASH = ${JSON.stringify(hash)};`);
  lines.push(`export const OPCODES = ${JSON.stringify(OPCODES)};`);
  lines.push(`export const FUNCS = ${JSON.stringify(FUNCS)};`);
  lines.push(`export const BINOPS = ${JSON.stringify(BINOPS)};`);
  lines.push(`export const NUM = ${JSON.stringify(numPool)};`);
  lines.push('export const STR = [');
  strings.forEach((s, i) => lines.push(JSON.stringify(s) + (i < strings.length - 1 ? ',' : '')));
  lines.push('];');
  lines.push('export const TABLES = {');
  const names = Object.keys(outTables);
  names.forEach((name, ti) => {
    const t = outTables[name];
    lines.push(`${JSON.stringify(name)}: {`);
    lines.push(`  "n": ${t.n},`);
    lines.push('  "cols": [');
    t.cols.forEach(([h, kind, data], ci) => {
      const tail = ci < t.cols.length - 1 ? ',' : '';
      lines.push(`    [${JSON.stringify(h)}, ${JSON.stringify(kind)}, ${JSON.stringify(data)}]${tail}`);
    });
    lines.push('  ]');
    lines.push('}' + (ti < names.length - 1 ? ',' : ''));
  });
  lines.push('};');
  return lines.join('\n') + '\n';
}

// ------------------------------------------------------------------ CLI

export function compileRelease(tablesDir = TABLES_DIR) {
  return compileInputs(readInputs(tablesDir));
}

function main(argv) {
  let out = DEFAULT_OUT;
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out = argv[++i];
    else if (argv[i] === '--check') check = true;
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  const result = compileRelease();
  const rel = p => relative(process.cwd(), p).split(sep).join('/') || p;
  const s = result.stats;
  if (check) {
    const current = existsSync(out) ? readFileSync(out, 'utf8') : null;
    if (current !== result.source) {
      process.stderr.write(`${rel(out)} is stale: run node docs/tag-model/tools/release.mjs\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${rel(out)} is current (${s.moduleBytes} bytes)\n`);
    return;
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, result.source);
  process.stdout.write(`wrote ${rel(out)}: ${s.moduleBytes} bytes, ${s.columns} columns, ${s.strings} strings, ${s.formulas} formulas\n`);
  for (const n of result.notes) process.stdout.write(`note: ${n}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exitCode = 2;
  }
}
