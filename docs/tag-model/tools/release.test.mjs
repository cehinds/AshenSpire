// Tests for release.mjs. Run: node --test docs/tag-model/tools/release.test.mjs
//
// The module is compiled from the real tables, written to a temp file, imported,
// and decoded here by a reference decoder that reads only the module's data.
// Formula results are checked against the workbench formula engine, run from
// the source of workbench.html, so the workbench stays the oracle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseCsv } from './csv.mjs';
import {
  compileInputs, compileRelease, readInputs, sourceHash, gzipSize, DEFAULT_OUT, DROP, TAG_REF,
  FORMAT, OPCODES, FUNCS, BINOPS,
} from './release.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, 'release.mjs');
const WORKBENCH = join(here, '..', 'workbench.html');

const tableName = path => {
  const base = path.replace(/\.csv$/, '');
  return base.startsWith('presentation/') ? 'presentation.' + base.slice('presentation/'.length) : base;
};

// Parses a CSV the same way the compiler does: header, then non-blank rows.
function csvOf(text) {
  const all = parseCsv(text);
  const header = all.shift();
  return { header, rows: all.filter(r => !(r.length === 1 && r[0] === '')) };
}

const isExcludedFormula = (row, header) =>
  !String(row[header.indexOf('expr')] ?? '').trim() && row[header.indexOf('status')] === 'proposed';

// ------------------------------------------------------------------ fixtures

const INPUTS = readInputs();
const COMPILED = compileRelease();

// Writes the compiled module to a temp dir and imports it (the real emitted file).
let moduleNs;
async function loadModule() {
  if (moduleNs) return moduleNs;
  const dir = mkdtempSync(join(tmpdir(), 'release-test-'));
  const file = join(dir, 'tag-constants.js');
  writeFileSync(file, COMPILED.source);
  moduleNs = await import(pathToFileURL(file).href);
  rmSync(dir, { recursive: true, force: true });
  return moduleNs;
}

// ------------------------------------------------------------------ reference decoder

function makeDecoder(M) {
  const col = (tab, name) => {
    const c = M.TABLES[tab].cols.find(([h]) => h === name);
    if (!c) throw new Error(`no column ${tab}.${name}`);
    return c;
  };
  const S = i => M.STR[i];
  const tagKeys = col('tags', 'key')[2];
  const tagIds = col('tags', 'id')[2];
  const tagKey = id => S(tagKeys[id]);
  const tagId = id => S(tagIds[id]);

  // A column's cells as text, the way the CSV spelled them.
  function cellText(kind, v, h) {
    switch (kind) {
      case 's': return S(v);
      case 'n': return v === null ? '' : String(v);
      case 'g': return v < 0 ? '' : tagKey(v);
      case 'i': return v < 0 ? '' : tagId(v);
      case 'G': return v.map(tagKey).join(' ');
      case 'c': return null;
      default: throw new Error(`unknown kind ${kind} for ${h}`);
    }
  }
  function decodeTable(name) {
    const t = M.TABLES[name];
    if (!t) throw new Error(`no table ${name}`);
    const rows = [];
    for (let i = 0; i < t.n; i++) rows.push(t.cols.map(([h, kind, data]) => cellText(kind, data[i], h)));
    return { n: t.n, header: t.cols.map(c => c[0]), kinds: t.cols.map(c => c[1]), rows };
  }

  const valuesT = decodeTable('values');
  const valueKey = i => valuesT.rows[i][valuesT.header.indexOf('key')];
  const valueText = i => valuesT.rows[i][valuesT.header.indexOf('value')];
  const valueIdByKey = new Map(valuesT.rows.map((r, i) => [valueKey(i), i]));
  const formulaCodes = col('formulas', 'code')[2];
  const formulasT = decodeTable('formulas');
  const formulaIdByKey = new Map(formulasT.rows.map((r, i) => [r[formulasT.header.indexOf('key')], i]));
  const ranksT = decodeTable('ranks');
  const rankRows = ranksT.rows.map(r => Object.fromEntries(ranksT.header.map((h, i) => [h, r[i]])));

  const binop = (op, l, r) => {
    switch (op) {
      case '+': return l + r;
      case '-': return l - r;
      case '*': return l * r;
      case '/': return r === 0 ? NaN : l / r;
      case '%': return l % r;
      case '^': return Math.pow(l, r);
      case '<': return +(l < r);
      case '>': return +(l > r);
      case '<=': return +(l <= r);
      case '>=': return +(l >= r);
      case '==': return +(l === r);
      case '!=': return +(l !== r);
      case '&&': return +(l && r);
      case '||': return +(l || r);
      default: throw new Error('bad operator ' + op);
    }
  };
  const FN = {
    min: Math.min, max: Math.max, floor: Math.floor, ceil: Math.ceil, round: Math.round, abs: Math.abs,
    clamp: (x, a, b) => Math.min(Math.max(x, a), b), if: (c, a, b) => (c ? a : b),
  };

  // Rank overrides for one object at one rank: value id -> number. Changes add
  // up from rank 2 on; a change that cannot be read is skipped (the workbench rule).
  function overrides(objectId, rank) {
    const byKey = new Map();
    if (!objectId) return new Map();
    const rows = rankRows
      .filter(r => r.object === objectId && Number(r.rank) <= rank && Number(r.rank) >= 2)
      .sort((a, b) => Number(a.rank) - Number(b.rank));
    for (const r of rows) {
      const k = r.key;
      const base = byKey.has(k) ? byKey.get(k) : Number(valueText(valueIdByKey.get(k)));
      const ch = String(r.change || '').trim();
      const n = parseFloat(ch.replace(/^[+=×*x]/, ''));
      if (Number.isNaN(n) || Number.isNaN(base)) continue;
      let v = base;
      if (/^=/.test(ch)) v = n;
      else if (/^[×*x]/.test(ch)) v = base * n;
      else v = base + parseFloat(ch);
      byKey.set(k, Math.round(v * 1000) / 1000);
    }
    const byId = new Map();
    for (const [k, v] of byKey) byId.set(valueIdByKey.get(k), v);
    return byId;
  }

  // Evaluates formula id at a rank for an object (or null for none).
  function evalFormula(id, rank, objectId) {
    const over = overrides(objectId, rank);
    const memo = new Map();
    const run = fid => {
      if (memo.has(fid)) return memo.get(fid);
      const code = formulaCodes[fid];
      const st = [];
      let i = 0;
      while (i < code.length) {
        const op = OPCODES[code[i++]];
        switch (op) {
          case 'NUM': st.push(M.NUM[code[i++]]); break;
          case 'RANK': st.push(rank); break;
          case 'VALUE': {
            const vid = code[i++];
            if (over.has(vid)) { st.push(over.get(vid)); break; }
            const v = Number(valueText(vid));
            if (Number.isNaN(v)) throw new Error(`${valueKey(vid)} is not a number`);
            st.push(v);
            break;
          }
          case 'FORMULA': st.push(run(code[i++])); break;
          case 'CALL': {
            const f = FUNCS[code[i++]];
            const argc = code[i++];
            const args = st.splice(st.length - argc, argc);
            st.push(FN[f](...args));
            break;
          }
          case 'NEG': st.push(-st.pop()); break;
          case 'NOT': st.push(st.pop() ? 0 : 1); break;
          case 'BIN': {
            const r = st.pop();
            const l = st.pop();
            st.push(binop(BINOPS[code[i++]], l, r));
            break;
          }
          default: throw new Error('bad opcode ' + code[i - 1]);
        }
      }
      if (st.length !== 1) throw new Error('bad stack in formula ' + fid);
      memo.set(fid, st[0]);
      return st[0];
    };
    return run(id);
  }

  return { decodeTable, formulaIdByKey, evalFormula, valueIdByKey, tagKey, tagId };
}

// ------------------------------------------------------------------ workbench oracle

// The workbench formula engine, cut out of workbench.html by its markers
// (from findTag to the validation section). Any edit that moves those markers
// fails here and says so.
function workbenchEngine(tables) {
  const html = readFileSync(WORKBENCH, 'utf8');
  const start = html.indexOf('function findTag(k)');
  const end = html.indexOf('/* ---------- validation ---------- */');
  assert.ok(start > 0 && end > start, 'workbench.html formula engine markers moved; update the test');
  const body = html.slice(start, end);
  const { IX, state } = tables;
  const engine = new Function('IX', 'state', body + '\nreturn { evalExpr };');
  return engine(IX, state).evalExpr;
}

function workbenchTables(inputs) {
  const byName = new Map(inputs.map(i => [tableName(i.path), csvOf(i.text)]));
  const rowsOf = name => {
    const { header, rows } = byName.get(name);
    return rows.map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
  };
  const tags = rowsOf('tags');
  const IX = {
    tagByKey: new Map(tags.filter(r => r.key).map(r => [r.key, r])),
    tagById: new Map(tags.filter(r => r.id).map(r => [r.id, r])),
    val: new Map(rowsOf('values').filter(r => r.key).map(r => [r.key, r])),
    frm: new Map(rowsOf('formulas').filter(r => r.key).map(r => [r.key, r])),
    obj: new Map(rowsOf('objects').filter(r => r.id).map(r => [r.id, r])),
    ast: new Map(), cmp: new Map(),
  };
  const state = { data: { ranks: { rows: rowsOf('ranks') } } };
  return { IX, state, objectIds: [...IX.obj.keys()] };
}

// ------------------------------------------------------------------ tests

test('the module exports data only, no functions, and no imports', async () => {
  const M = await loadModule();
  assert.equal(M.FORMAT, FORMAT);
  assert.equal(M.SOURCE_HASH, sourceHash(INPUTS));
  for (const [name, v] of Object.entries(M)) {
    assert.notEqual(typeof v, 'function', `export ${name} is a function`);
  }
  assert.doesNotMatch(COMPILED.source, /^\s*import\b/m);
  assert.deepEqual(M.OPCODES, OPCODES);
  assert.deepEqual(M.FUNCS, FUNCS);
  assert.deepEqual(M.BINOPS, BINOPS);
});

test('every kept table and column round-trips exactly, rows and values', async () => {
  const M = await loadModule();
  const dec = makeDecoder(M);
  const names = Object.keys(M.TABLES).sort();
  const expected = INPUTS.map(i => tableName(i.path)).sort();
  assert.deepEqual(names, expected, 'every input table is in the module');

  for (const input of INPUTS) {
    const name = tableName(input.path);
    const { header, rows } = csvOf(input.text);
    const drop = DROP[name] || [];
    const keptHeader = header.filter(h => !drop.includes(h));
    const keep = rows.filter(r => name !== 'formulas' || !isExcludedFormula(r, header));
    const want = keep.map(r => keptHeader.map(h => r[header.indexOf(h)]));

    const got = dec.decodeTable(name);
    const textCols = got.header.map((h, i) => ({ h, i, kind: got.kinds[i] })).filter(c => c.kind !== 'c');
    assert.deepEqual(textCols.map(c => c.h), keptHeader, `${name}: kept columns`);
    assert.equal(got.n, want.length, `${name}: row count`);
    const gotRows = got.rows.map(r => textCols.map(c => r[c.i]));
    assert.deepEqual(gotRows, want, `${name}: cells`);
  }
});

test('the tags table and its references round-trip through numeric ids', async () => {
  const M = await loadModule();
  const dec = makeDecoder(M);
  const { header, rows } = csvOf(INPUTS.find(i => i.path === 'tags.csv').text);
  const parent = header.indexOf('parent');
  const related = header.indexOf('related');
  const got = dec.decodeTable('tags');
  assert.equal(got.kinds[got.header.indexOf('parent')], TAG_REF.tags.parent);
  assert.equal(got.kinds[got.header.indexOf('related')], TAG_REF.tags.related);
  rows.forEach((r, i) => {
    assert.equal(got.rows[i][got.header.indexOf('parent')], r[parent], `tags row ${i + 2} parent`);
    assert.equal(got.rows[i][got.header.indexOf('related')], r[related], `tags row ${i + 2} related`);
  });
});

test('formulas give the workbench result at rank 1 and rank 3, for every object and for none', async t => {
  const M = await loadModule();
  const dec = makeDecoder(M);
  const formulaCsv = csvOf(INPUTS.find(i => i.path === 'formulas.csv').text);
  const wb = workbenchTables(INPUTS);
  const evalExpr = workbenchEngine(wb);

  const kept = formulaCsv.rows.filter(r => !isExcludedFormula(r, formulaCsv.header));
  const keyIx = formulaCsv.header.indexOf('key');
  const exprIx = formulaCsv.header.indexOf('expr');
  const statusIx = formulaCsv.header.indexOf('status');
  assert.ok(kept.length > 0, 'there are formulas to compare');

  let comparisons = 0;
  for (const row of kept) {
    const key = row[keyIx];
    const id = dec.formulaIdByKey.get(key);
    assert.notEqual(id, undefined, `${key} is in the module`);
    for (const objectId of [null, ...wb.objectIds]) {
      for (const rank of [1, 3]) {
        const theirs = evalExpr(row[exprIx], rank, objectId, row[statusIx]);
        assert.ok('v' in theirs, `workbench gives a value for ${key} (rank ${rank}, ${objectId}): ${theirs.err}`);
        const ours = dec.evalFormula(id, rank, objectId);
        assert.ok(Object.is(ours, theirs.v), `${key} rank ${rank} object ${objectId}: module ${ours}, workbench ${theirs.v}`);
        comparisons++;
      }
    }
  }
  assert.ok(comparisons >= kept.length * 4);
  t.diagnostic(`${kept.length} formulas, ${comparisons} comparisons against the workbench`);
});

// A minimal in-memory set of tables: the compiler needs tags, values, objects,
// formulas and ranks, and nothing else. The placeholder tests use it so they do
// not depend on the real tables, which change as formulas are authored.
const PLACEHOLDER = 'placeholder.x';
function placeholderFixture({ withUser }) {
  const formulas = [
    'key,expr,scope,description,status',
    `${PLACEHOLDER},,scope,TBD,proposed`,
    'scale.two,[ar] * 2,scope,,',
    ...(withUser ? [`uses.placeholder,[${PLACEHOLDER}] * 2,scope,,`] : []),
  ];
  return [
    { path: 'tags.csv', text: 'id,key\nmeta,meta\n' },
    { path: 'values.csv', text: 'key,value\nar,24\n' },
    { path: 'objects.csv', text: 'id,kind,name\n' },
    { path: 'ranks.csv', text: 'object,rank,key,change\n' },
    { path: 'formulas.csv', text: formulas.join('\n') + '\n' },
  ];
}

test('a proposed formula with no expression is left out, with a note, as the workbench treats it', () => {
  const inputs = placeholderFixture({ withUser: false });
  const r = compileInputs(inputs);
  assert.deepEqual(r.notes, [`excluded formulas.csv "${PLACEHOLDER}": status=proposed with no expression`]);
  assert.equal(r.stats.formulas, 1, 'only the complete formula is kept');
  const formulaCsv = csvOf(inputs.find(i => i.path === 'formulas.csv').text);
  const excluded = formulaCsv.rows.filter(row => isExcludedFormula(row, formulaCsv.header));
  assert.equal(excluded.length, 1);
  const evalExpr = workbenchEngine(workbenchTables(inputs));
  const theirs = evalExpr(excluded[0][formulaCsv.header.indexOf('expr')], 1, null, excluded[0][formulaCsv.header.indexOf('status')]);
  assert.equal(theirs.note, true, 'workbench marks the placeholder as a note');
});

test('the output is byte-identical across two compiles and two CLI runs', () => {
  const again = compileRelease();
  assert.equal(again.source, COMPILED.source);
  const dir = mkdtempSync(join(tmpdir(), 'release-cli-'));
  try {
    const a = join(dir, 'a.js');
    const b = join(dir, 'b.js');
    execFileSync(process.execPath, [CLI, '--out', a], { encoding: 'utf8' });
    execFileSync(process.execPath, [CLI, '--out', b], { encoding: 'utf8' });
    assert.ok(readFileSync(a).equals(readFileSync(b)), 'two CLI runs write the same bytes');
    assert.ok(readFileSync(a).equals(Buffer.from(COMPILED.source, 'utf8')), 'the CLI writes the compiled source');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('--check passes on a current file and fails on a stale one', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-check-'));
  try {
    const out = join(dir, 'tag-constants.js');
    execFileSync(process.execPath, [CLI, '--out', out], { encoding: 'utf8' });
    execFileSync(process.execPath, [CLI, '--check', '--out', out], { encoding: 'utf8' });
    writeFileSync(out, COMPILED.source + '// stale\n');
    let failed = false;
    try {
      execFileSync(process.execPath, [CLI, '--check', '--out', out], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      failed = e.status === 1;
    }
    assert.ok(failed, '--check exits 1 on a stale file');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('size before and after: CSV bytes, module bytes, gzip', t => {
  const s = COMPILED.stats;
  const gz = gzipSize(COMPILED.source);
  assert.equal(s.moduleBytes, Buffer.byteLength(COMPILED.source, 'utf8'));
  assert.equal(s.gzipBytes, undefined, 'the compile does not compute gzip');
  const csvGz = gzipSize(INPUTS.map(i => i.text).join(''));
  t.diagnostic(`CSV ${s.csvBytes} bytes (${csvGz} gzip); module ${s.moduleBytes} bytes (${gz} gzip)`);
});

// ------------------------------------------------------------------ loud failures

function mutate(path, fn) {
  return INPUTS.map(i => (i.path === path ? { path, text: fn(i.text) } : i));
}
const appendRow = (row) => text => text + row + '\n';

test('an unresolved [key] fails the build and names it', () => {
  const inputs = mutate('formulas.csv', appendRow('x.bad,[nope.key] + 1,x,,'));
  assert.throws(() => compileInputs(inputs), /unresolved \[nope\.key\]/);
});

test('a reference to the excluded placeholder fails the build', () => {
  const inputs = placeholderFixture({ withUser: true });
  assert.throws(() => compileInputs(inputs), new RegExp(`\\[${PLACEHOLDER.replace('.', '\\.')}\\] is a proposed formula with no expression`));
});

test('a formula loop fails the build', () => {
  const inputs = mutate('formulas.csv', text => text + 'loopA,[loopB] + 1,x,,\nloopB,[loopA] + 1,x,,\n');
  assert.throws(() => compileInputs(inputs), /loop loopA -> loopB -> loopA/);
});

test('a tag with no preview value fails the build', () => {
  const inputs = mutate('formulas.csv', appendRow('x.tag,[poise] + 1,x,,'));
  assert.throws(() => compileInputs(inputs), /\[poise\] is a tag with no preview value/);
});

test('a wrong argument count fails the build', () => {
  const inputs = mutate('formulas.csv', appendRow('x.clamp,"clamp([ar],1)",x,,'));
  assert.throws(() => compileInputs(inputs), /clamp takes 3 argument/);
});

test('an unknown function fails the build', () => {
  const inputs = mutate('formulas.csv', appendRow('x.fn,sqrt([ar]),x,,'));
  assert.throws(() => compileInputs(inputs), /unknown function sqrt/);
});

test('an unknown tag in an object fails the build', () => {
  const inputs = mutate('objects.csv', text => text.replace(' ar slashing,', ' ar nosuchtag,'));
  assert.throws(() => compileInputs(inputs), /unknown tag "nosuchtag"/);
});

test('an unresolved reference in a dropped object column still fails the build', () => {
  const inputs = mutate('objects.csv', text => text.replace('Deal [strike.damage] damage.', 'Deal [strike.dmg] damage.'));
  assert.throws(() => compileInputs(inputs), /unresolved \[strike\.dmg\]/);
});

test('a rank change the workbench cannot read fails the build', () => {
  for (const change of ['plus a bit', '+-3', '--3', '+ 3', '=+3']) {
    const inputs = mutate('ranks.csv', appendRow(`strike,4,strike.arScale,${change},`));
    assert.throws(() => compileInputs(inputs), new RegExp(`bad change "${change.replace(/[+*]/g, '\\$&')}"`), change);
  }
});

test('the rank changes the workbench reads all compile', () => {
  for (const change of ['+1', '-0.5', '=0', '=8', '×1.25', '*1.25', 'x2']) {
    const inputs = mutate('ranks.csv', appendRow(`strike,4,strike.arScale,${change},`));
    assert.doesNotThrow(() => compileInputs(inputs), change);
  }
});

test('a formula that reads [rank] compiles and matches the workbench at rank 1 and 3', async () => {
  const expr = 'floor([rank] * [strike.arScale]) + [strike.baseDamage]';
  const inputs = mutate('formulas.csv', appendRow(`x.rank,${expr},x,,`));
  const source = compileInputs(inputs).source;
  const dir = mkdtempSync(join(tmpdir(), 'release-rank-'));
  let M;
  try {
    const file = join(dir, 'tag-constants.js');
    writeFileSync(file, source);
    M = await import(pathToFileURL(file).href + '?rank');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const dec = makeDecoder(M);
  const evalExpr = workbenchEngine(workbenchTables(inputs));
  for (const rank of [1, 3]) {
    const theirs = evalExpr(expr, rank, null, '');
    assert.ok('v' in theirs, theirs.err);
    assert.equal(dec.evalFormula(dec.formulaIdByKey.get('x.rank'), rank, null), theirs.v, `rank ${rank}`);
  }
});
