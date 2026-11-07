import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { loadBundleCompiler } from './helpers/production-bundle.mjs';

// tools/bundle.mjs follows import('./literal.js'): the target is bundled but its
// factory runs on first use, never at boot. Any other import( form is refused.

const INDEX = '<script type="module" src="src/main.js"></script>';

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'ashen-dynimport-'));
  mkdirSync(join(root, 'src'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, 'src', name), text);
  return root;
}

function bundleAndRun(root) {
  const c = loadBundleCompiler({ root, indexHtml: INDEX });
  const entries = c.order.map(id => {
    const { body } = c.transformModule(id, c.sources.get(id), join(root, id));
    return `${JSON.stringify(id)}: ${c.MODULE_FN}\n${c.guardScript(body)}\n}`;
  }).join(',\n');
  const context = { log: [], Promise };
  vm.runInNewContext(c.assembleRuntime(entries, c.idOf(c.entryAbs)), context);
  return { context, order: c.order };
}

test('a dynamic import target is bundled but not evaluated at boot', async () => {
  const root = fixture({
    'main.js': `globalThis.log.push('main');\nglobalThis.load = () => import('./dev.js');\n`,
    'dev.js': `import { shared } from './shared.js';\nglobalThis.log.push('dev');\nexport const value = 'dev:' + shared;\n`,
    'shared.js': `export const shared = 's';\n`,
  });
  try {
    const { context, order } = bundleAndRun(root);
    assert.deepEqual([...order].sort(), ['src/dev.js', 'src/main.js', 'src/shared.js'], 'the target and its graph are bundled');
    assert.deepEqual([...context.log], ['main'], '(a) not evaluated at boot');
    const ns = await context.load();
    assert.equal(ns.value, 'dev:s', '(b) the promise yields the module exports');
    assert.deepEqual([...context.log], ['main', 'dev'], 'evaluated on first use');
    await context.load();
    assert.deepEqual([...context.log], ['main', 'dev'], 'modules are singletons');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a module reachable statically too is evaluated at boot, once', async () => {
  const root = fixture({
    'main.js': `import './dev.js';\nglobalThis.load = () => import("./dev.js");\n`,
    'dev.js': `globalThis.log.push('dev');\nexport const value = 1;\n`,
  });
  try {
    const { context } = bundleAndRun(root);
    assert.deepEqual([...context.log], ['dev']);
    assert.equal((await context.load()).value, 1);
    assert.deepEqual([...context.log], ['dev']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

for (const [label, call] of [
  ['a variable', 'import(name)'],
  ['a template literal', 'import(`./x${n}.js`)'],
  ['a concatenation', "import('./x' + '.js')"],
  ['a non-relative specifier', "import('node:fs')"],
]) {
  test(`(c) import() of ${label} fails the build, naming the file`, () => {
    const root = fixture({ 'main.js': `const name = './x.js', n = 1;\nglobalThis.load = () => ${call};\n`, 'x.js': 'export {};\n' });
    try {
      assert.throws(() => loadBundleCompiler({ root, indexHtml: INDEX }), /src\/main\.js/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test('a missing literal target fails the build', () => {
  const root = fixture({ 'main.js': "globalThis.load = () => import('./nope.js');\n" });
  try {
    assert.throws(() => loadBundleCompiler({ root, indexHtml: INDEX }), /unresolved import/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
