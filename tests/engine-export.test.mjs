// tests/engine-export.test.mjs — tools/engine-export.mjs writes a well-formed,
// deterministic engine export, and its --check notices drift.
// Runs the real tool against temporary directories; about four seconds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('..', import.meta.url));
const tool = join(root, 'tools', 'engine-export.mjs');
const scratch = mkdtempSync(join(tmpdir(), 'engine-export-test-'));
process.on('exit', () => rmSync(scratch, { recursive: true, force: true }));

const run = (...args) => spawnSync(process.execPath, [tool, ...args], { cwd: root, encoding: 'utf8' });
const exportTo = (name) => {
  const out = join(scratch, name);
  const r = run('--out', out);
  assert.equal(r.status, 0, `export failed:\n${r.stdout}${r.stderr}`);
  return { out, stdout: r.stdout };
};
const readJson = (dir, rel) => JSON.parse(readFileSync(join(dir, rel), 'utf8'));
const listFiles = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => relative(dir, join(e.parentPath ?? e.path, e.name)).split(sep).join('/'))
  .sort();

const first = exportTo('a');
const manifest = readJson(first.out, 'manifest.json');

// A deliberately small JSON Schema validator: the keywords the exporter emits
// (type, enum, properties, required, items) and nothing else.
function typeMatches(value, type) {
  switch (type) {
    case 'null': return value === null;
    case 'array': return Array.isArray(value);
    case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'integer': return Number.isInteger(value);
    case 'number': return typeof value === 'number';
    default: return typeof value === type;
  }
}
function validate(schema, value, path = '$', errors = []) {
  if (errors.length > 20) return errors;
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(value, t))) { errors.push(`${path}: expected ${types.join('|')}`); return errors; }
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: ${JSON.stringify(value)} not in enum`);
  if (schema.properties && typeMatches(value, 'object')) {
    for (const key of schema.required || []) if (!(key in value)) errors.push(`${path}: missing required '${key}'`);
    for (const [key, sub] of Object.entries(schema.properties)) if (key in value) validate(sub, value[key], `${path}.${key}`, errors);
  }
  if (schema.items && Array.isArray(value)) value.forEach((item, i) => validate(schema.items, item, `${path}[${i}]`, errors));
  return errors;
}

test('the tool prints a one-line OK summary with the table and row counts', () => {
  assert.match(first.stdout.trim(), /^engine-export: OK — \d+ tables, \d+ rows, \d+ config, \d+ art files → /);
  assert.equal(first.stdout.trim().split('\n').length, 1);
});

test('the manifest names its format, build and every file it lists', () => {
  assert.equal(manifest.format, 'ashenspire.engine-export/1');
  assert.equal(typeof manifest.version, 'string');
  assert.ok(manifest.buildOrdinal === null || Number.isInteger(manifest.buildOrdinal));
  assert.ok(manifest.gitSha === null || /^[0-9a-f]{40}$/.test(manifest.gitSha));
  assert.equal(manifest.rowKey, 'Name');
  assert.ok(manifest.tables.length > 50, `only ${manifest.tables.length} tables`);
  const ids = manifest.tables.map((t) => t.id);
  for (const id of ['content.cards', 'content.enemies', 'content.relics', 'content.encounters', 'source.nodes', 'framework.terms.terms']) {
    assert.ok(ids.includes(id), `no table ${id}`);
  }
  assert.ok(manifest.art.some((a) => a.file === 'art/art-manifest.json'), 'art manifest not copied');
  for (const entry of [...manifest.tables, ...manifest.config, ...manifest.art]) {
    const text = readFileSync(join(first.out, entry.file));
    assert.equal(createHash('sha256').update(text).digest('hex'), entry.sha256, `${entry.file} hash`);
  }
  assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(readFileSync(join(first.out, 'manifest.json'), 'utf8')), 'manifest carries a timestamp');
  const scripts = manifest.config.find((c) => c.id === 'content.scripts');
  assert.ok(scripts && scripts.omittedFunctions.length, 'the function in content.scripts is not reported as omitted');
});

test('every table parses, every row has a unique string Name first, and its schema accepts it', () => {
  for (const table of manifest.tables) {
    const rows = readJson(first.out, table.file);
    assert.ok(Array.isArray(rows), `${table.file} is not an array`);
    assert.equal(rows.length, table.rows, `${table.file} row count`);
    const names = new Set();
    for (const row of rows) {
      assert.equal(typeof row.Name, 'string', `${table.file}: a row without a string Name`);
      assert.equal(Object.keys(row)[0], 'Name', `${table.file}: Name is not the first field`);
      assert.ok(!names.has(row.Name), `${table.file}: duplicate Name '${row.Name}'`);
      names.add(row.Name);
    }
    const schema = readJson(first.out, table.schema);
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.deepEqual(validate(schema, rows), [], `${table.schema} rejects ${table.file}`);
  }
});

test('two exports are byte-identical', () => {
  const second = exportTo('b');
  const a = listFiles(first.out);
  assert.deepEqual(listFiles(second.out), a);
  for (const rel of a) {
    assert.ok(readFileSync(join(first.out, rel)).equals(readFileSync(join(second.out, rel))), `${rel} differs between runs`);
  }
});

test('--check passes on fresh output and fails after one file changes or the folder is absent', () => {
  const ok = run('--check', '--out', first.out);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /--check: OK/);

  const file = join(first.out, manifest.tables[0].file);
  writeFileSync(file, `${readFileSync(file, 'utf8')} `);
  const bad = run('--check', '--out', first.out);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, new RegExp(`changed  ${manifest.tables[0].file.replace(/\./g, '\\.')}`));

  const absent = run('--check', '--out', join(scratch, 'never-written'));
  assert.equal(absent.status, 1);
  assert.ok(!existsSync(join(scratch, 'never-written')));
});

test('--only limits the export and the tool refuses to clear a foreign folder', () => {
  const out = join(scratch, 'only');
  const r = run('--only', 'content.cards', '--out', out);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(readJson(out, 'manifest.json').tables.map((t) => t.id), ['content.cards']);

  const foreign = join(scratch, 'foreign');
  mkdirSync(foreign, { recursive: true });
  writeFileSync(join(foreign, 'keep.txt'), 'mine');
  const refused = run('--out', foreign);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /refusing to clear it/);
  assert.equal(readFileSync(join(foreign, 'keep.txt'), 'utf8'), 'mine');
});

test('a failed refresh preserves the complete last good export', async () => {
  const { writeExport, FORMAT } = await import('../tools/engine-export.mjs');
  const out = join(scratch, 'atomic-refresh');
  const good = new Map([
    ['manifest.json', JSON.stringify({ format: FORMAT })],
    ['tables/old.json', 'last good'],
  ]);
  writeExport(good, out);

  let writes = 0;
  assert.throws(() => writeExport(new Map([
    ['manifest.json', JSON.stringify({ format: FORMAT })],
    ['tables/new.json', 'replacement'],
  ]), out, { writeFile(full, text) {
    if (++writes === 2) throw Error('disk full');
    writeFileSync(full, text);
  } }), /disk full/);

  assert.equal(readFileSync(join(out, 'tables/old.json'), 'utf8'), 'last good');
  assert.equal(existsSync(join(out, 'tables/new.json')), false);
  assert.deepEqual(readdirSync(join(out, '..')).filter((name) => name.startsWith('.atomic-refresh.')), []);
});

test('staleGenerated runs the builders (or their --check) and names the stale ones; --no-build passes when current', async () => {
  const { staleGenerated, BUILDERS } = await import('../tools/engine-export.mjs');
  assert.deepEqual(BUILDERS, ['tools/framework-data-build.mjs', 'tools/config-build.mjs', 'tools/content-build.mjs']);
  const fixture = join(scratch, 'stale-fixture');
  mkdirSync(join(fixture, 'tools'), { recursive: true });
  // current.mjs is always current; stale.mjs fails its --check but builds fine.
  writeFileSync(join(fixture, 'tools', 'current.mjs'), "process.exit(0);\n");
  writeFileSync(join(fixture, 'tools', 'stale.mjs'), "if (process.argv.includes('--check')) { console.error('STALE: out of date'); process.exit(1); }\n");
  const builders = ['tools/current.mjs', 'tools/stale.mjs', 'tools/absent.mjs'];
  const checked = staleGenerated({ root: fixture, build: false, builders });
  assert.deepEqual(checked.map((f) => f.script), ['tools/stale.mjs']);
  assert.match(checked[0].output, /STALE: out of date/);
  assert.deepEqual(staleGenerated({ root: fixture, build: true, builders }), [], 'build mode does not pass --check');

  const r = run('--no-build', '--only', 'content.cards', '--out', join(scratch, 'no-build'));
  assert.equal(r.status, 0, `the checkout's generated modules are current:\n${r.stdout}${r.stderr}`);
});

test('--no-build holds the generated tree before checking or importing it', () => {
  const source = readFileSync(tool, 'utf8');
  const main = source.slice(source.indexOf('async function main()'));
  const lock = main.indexOf("await holdForCli(ROOT, 'engine-export')");
  const staleCheck = main.indexOf('staleGenerated({ build: opts.build })');
  assert.ok(lock >= 0, 'engine-export does not take the shared lock');
  assert.ok(lock < staleCheck, 'the lock must cover stale checks and generated-module imports');
  assert.doesNotMatch(main.slice(0, staleCheck), /if\s*\(opts\.build\)[^\n]*holdForCli/, '--no-build must not skip the lock');
});

// The Unreal importer runs against a stub `unreal` module (no editor here):
// after a complete import it deletes only the DT_* DataTables it tagged as its own that the
// manifest no longer lists; a cancelled or failed import, or --no-prune, keeps them.
const STUB_UNREAL = String.raw`
import sys, types, json
state = json.loads(sys.argv[1])
assets = {a["path"]: a for a in state["assets"]}
deleted, saved = [], []
tags = {}
class DataTable:
    def __init__(self, path): self.path = path
class Other: pass
def obj(path):
    a = assets[path]
    return DataTable(path) if a["cls"] == "DataTable" else Other()
class EditorAssetLibrary:
    @staticmethod
    def list_assets(dest, recursive=True, include_folder=False):
        return [p + "." + p.rsplit("/", 1)[-1] for p, a in assets.items() if (p.rsplit("/", 1)[0] == dest.rstrip("/")) or (recursive and p.startswith(dest))]
    @staticmethod
    def does_asset_exist(path): return path.split(".")[0] in assets
    @staticmethod
    def load_asset(path): return obj(path.split(".")[0])
    @staticmethod
    def get_metadata_tag(t, key): return "1" if (assets[t.path].get("owned") or tags.get(t.path)) else ""
    @staticmethod
    def set_metadata_tag(t, key, value): tags[t.path] = value
    @staticmethod
    def delete_asset(path): deleted.append(path.split(".")[0]); return True
    @staticmethod
    def save_loaded_asset(t): saved.append(t); return True
class ScopedSlowTask:
    def __init__(self, n, label): self.n = 0
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def make_dialog(self, b): pass
    def should_cancel(self):
        self.n += 1
        return state.get("cancelAt") == self.n
    def enter_progress_frame(self, n, label): pass
class DataTableFunctionLibrary:
    @staticmethod
    def fill_data_table_from_json_file(t, f, s): return not state.get("fail")
m = types.ModuleType("unreal")
m.DataTable = DataTable
m.EditorAssetLibrary = EditorAssetLibrary
m.ScopedSlowTask = ScopedSlowTask
m.DataTableFunctionLibrary = DataTableFunctionLibrary
m.load_object = lambda outer, p: object()
m.log = m.log_warning = m.log_error = lambda msg: None
sys.modules["unreal"] = m
sys.path.insert(0, state["dir"])
import import_ashenspire as imp
imp.import_export(state["export"], state["structs"], "/Game/A", prune=state.get("prune", True))
print(json.dumps(sorted(deleted)))
`;

test('the Unreal importer mirrors the manifest: it prunes only its own stale DT_* tables after a complete import', (t) => {
  const python = ['python3', 'python'].find((p) => spawnSync(p, ['--version']).status === 0);
  if (!python) return t.skip('no python on PATH');
  const exp = join(scratch, 'unreal-prune');
  mkdirSync(join(exp, 'tables'), { recursive: true });
  writeFileSync(join(exp, 'tables/content.cards.json'), '[]');
  writeFileSync(join(exp, 'manifest.json'), JSON.stringify({ format: 'ashenspire.engine-export/1', tables: [
    { id: 'content.cards', file: 'tables/content.cards.json' }, { id: 'content.unmapped', file: 'tables/x.json' },
  ] }));
  const assets = [
    { path: '/Game/A/DT_content_cards', cls: 'DataTable' },
    { path: '/Game/A/DT_content_unmapped', cls: 'DataTable' }, // in the manifest, not mapped: kept
    { path: '/Game/A/DT_content_removed', cls: 'DataTable', owned: true }, // ours, gone from the manifest: pruned
    { path: '/Game/A/DT_ProjectTable', cls: 'DataTable' }, // a project's own DT_* table, not tagged by us: kept
    { path: '/Game/A/DT_Mine', cls: 'Other' }, // matches the name, not a DataTable: kept
    { path: '/Game/A/MyTable', cls: 'DataTable', owned: true }, // not the importer's naming: kept
    { path: '/Game/A/Sub/DT_content_old', cls: 'DataTable', owned: true }, // a subfolder: kept
  ];
  const go = (extra) => {
    const r = spawnSync(python, ['-I', '-B', '-c', STUB_UNREAL, JSON.stringify({ dir: join(root, 'docs/engine-export/unreal'), export: exp, structs: { 'content.cards': '/Script/X.Row' }, assets, ...extra })], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout.trim().split('\n').pop());
  };
  assert.deepEqual(go({}), ['/Game/A/DT_content_removed']);
  assert.deepEqual(go({ cancelAt: 2 }), [], 'a cancelled import prunes nothing');
  assert.deepEqual(go({ fail: true }), [], 'a failed table prunes nothing');
  assert.deepEqual(go({ prune: false }), [], '--no-prune keeps everything');
});

// The Unity importer (C#, not compiled here) prunes by ownership: only paths its
// record lists, never a folder scan that would delete hand-made assets.
test('the Unity importer prunes only the paths its import record lists', () => {
  const source = readFileSync(join(root, 'docs', 'engine-export', 'unity', 'AshenSpireExportImporter.cs'), 'utf8');
  const body = source.slice(source.indexOf('public static int Import('), source.indexOf('private static HashSet<string> CopyAll('));
  assert.doesNotMatch(body, /Directory\.GetFiles\(/, 'pruning must not scan the folders');
  assert.match(body, /ReadRecord\(\)/, 'pruning reads the previous import record');
  assert.match(body, /AssetDatabase\.DeleteAsset\(stale\)/, 'only recorded stale paths are deleted');
  assert.match(source, /ashenspire-import\.json/, 'the record file is named in the importer');
});
