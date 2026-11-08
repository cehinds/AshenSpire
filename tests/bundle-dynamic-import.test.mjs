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
    c.assertNoNativeImport(id, body);
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

test('the word import( in comments and regexes is not a call', async () => {
  const root = fixture({
    'main.js': [
      '// import(name) in a line comment',
      "/* import(`./x${n}.js`) in a block comment, with a 'quote */",
      "const d = /import\\(['\"]/.test('a') ? 1 : 2;",
      'globalThis.log.push(d);',
      "globalThis.load = () => import('./dev.js');",
      '',
    ].join('\n'),
    'dev.js': 'export const value = 7;\n',
  });
  try {
    const { context, order } = bundleAndRun(root);
    assert.deepEqual([...order].sort(), ['src/dev.js', 'src/main.js'], 'only the real call is an edge');
    assert.equal((await context.load()).value, 7);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a non-literal import() in code still fails even beside comment mentions', () => {
  const root = fixture({ 'main.js': "// import('./fine.js') is prose\nconst s = 'import(x)';\nglobalThis.load = (n) => import(`./${n}.js`);\n" });
  try {
    assert.throws(() => loadBundleCompiler({ root, indexHtml: INDEX }), /src\/main\.js/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

import { scanDynamicImports } from '../tools/dynamic-imports.mjs';

test('scanner: / after ++ or -- is division, not a regex', () => {
  const calls = scanDynamicImports("let b = a++ / 2; f = () => import('./y.js');\nlet c = a-- / 2; g = () => import('./z.js');");
  assert.deepEqual(calls.map(c => c.spec), ['./y.js', './z.js']);
});

test('scanner: / after an if/while/for/with head starts a regex', () => {
  for (const head of ['if (ok)', 'while (ok)', 'for (;;)', 'with (o)']) {
    const calls = scanDynamicImports(`${head} /x'/.test(s);\nf = () => import('./y.js');`);
    assert.deepEqual(calls.map(c => c.spec), ['./y.js'], head);
  }
  assert.deepEqual(scanDynamicImports("if (true) /'/.test('x'); globalThis.load = () => import('./dev.js');").map(c => c.spec), ['./dev.js']);
  // a ) that is not a control head still means division
  assert.deepEqual(scanDynamicImports("let q = (a + b) / 2, r = 1 / 2; f = () => import('./y.js');").map(c => c.spec), ['./y.js']);
});

test('scanner: an unterminated quote does not swallow the following lines', () => {
  assert.deepEqual(scanDynamicImports("const s = 'oops\nf = () => import('./y.js');").map(c => c.spec), ['./y.js']);
});

test('scanner: import( inside strings and templates is not a call', () => {
  const src = "const a = 'import(name)', b = \"import('./nope.js')\";\nconst c = `text import(x) ${1 + 1} import(y)`;\n";
  assert.deepEqual(scanDynamicImports(src), []);
});

test('backstop: a raw import( left in a module body fails the build, naming file and line', () => {
  // The scanner ignores a string literal, so it reaches the post-transform check.
  const root = fixture({ 'main.js': "const ok = 1;\nconst s = 'see import(x) here';\n" });
  try {
    assert.throws(() => bundleAndRun(root), /native import\( left in src\/main\.js at line 2/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('backstop: a comment-only line may mention import(', () => {
  const root = fixture({ 'main.js': "// import(x)\n/* import(y) */\n/*\n * import(z)\n */\nconst ok = 1;\n" });
  try { bundleAndRun(root); } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a dynamic target whose evaluation threw rejects the same way every time', async () => {
  const root = fixture({
    'main.js': "globalThis.load = () => import('./bad.js');\n",
    'bad.js': "globalThis.log.push('bad');\nthrow new Error('boom');\n",
  });
  try {
    const { context } = bundleAndRun(root);
    const p1 = context.load(), p2 = context.load();
    assert.equal(p1, p2, 'the same cached promise');
    await assert.rejects(p1, /boom/);
    await assert.rejects(context.load(), /boom/);
    assert.deepEqual([...context.log], ['bad'], 'the factory ran once');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a bundle with no dynamic import carries no dynamic helper', () => {
  const root = fixture({ 'main.js': "globalThis.log.push('m');\n" });
  try {
    const c = loadBundleCompiler({ root, indexHtml: INDEX });
    assert.ok(!c.assembleRuntime('"src/main.js": function (module, exports, require) {\n}', 'src/main.js').includes('__dyn'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

import { findCycleHazards } from '../tools/bundle-cycles.mjs';

test('bundle-cycles: each lazy root is analysed independently of source order', () => {
  // B named-imports `value` from A while A (loading) pulls B in: a hazard, but
  // only when A is the lazy root. Declaring the loader for B first must not hide it.
  for (const order of [['b', 'a'], ['a', 'b']]) {
    const root = fixture({
      'main.js': order.map(n => `globalThis.load_${n} = () => import('./${n}.js');`).join('\n') + '\n',
      'a.js': "import * as B from './b.js';\nexport const value = 1;\nexport const useB = () => B;\n",
      'b.js': "import { value } from './a.js';\nexport const copy = value;\n",
    });
    try {
      const hazards = findCycleHazards('src/main.js', root);
      assert.equal(hazards.length, 1, order.join(','));
      assert.equal(hazards[0].importer, 'src/b.js');
      assert.deepEqual(hazards[0].names, ['value']);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('bundle-cycles: a dynamic edge alone is not a boot-time cycle', () => {
  const root = fixture({
    'main.js': "import { x } from './a.js';\nglobalThis.x = x;\n",
    'a.js': "export const x = 1;\nexport const later = () => import('./main.js');\n",
  });
  try {
    assert.deepEqual(findCycleHazards('src/main.js', root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('import with a comment before the parenthesis is still a call', async () => {
  assert.deepEqual(scanDynamicImports("f = () => import /* lazy */ ('./dev.js');").map(c => c.spec), ['./dev.js']);
  assert.deepEqual(scanDynamicImports("f = () => import // c\n ( /* a */ './dev.js' /* b */ );").map(c => c.spec), ['./dev.js']);
  const root = fixture({
    'main.js': "globalThis.load = () => import /* lazy */ ('./dev.js');\n",
    'dev.js': 'export const value = 3;\n',
  });
  try {
    const { context, order } = bundleAndRun(root);
    assert.deepEqual([...order].sort(), ['src/dev.js', 'src/main.js']);
    assert.equal((await context.load()).value, 3);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('import with a comment before a non-literal argument fails the build', () => {
  const root = fixture({ 'main.js': "globalThis.load = (n) => import /* x */ (n);\n" });
  try {
    assert.throws(() => bundleAndRun(root), /src\/main\.js/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('backstop: import /* c */ ( in a string literal is caught too', () => {
  const root = fixture({ 'main.js': "const s = 'import /* c */ (x)';\n" });
  try {
    assert.throws(() => bundleAndRun(root), /native import\( left in src\/main\.js at line 1/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a comment-separated dynamic call before a static import does not break the static parse', async () => {
  const root = fixture({
    'main.js': "import /* lazy */ ('./dev.js');\nimport { shared } from './shared.js';\nglobalThis.log.push(shared);\n",
    'dev.js': 'export const value = 1;\n',
    'shared.js': "export const shared = 's';\n",
  });
  try {
    const { context, order } = bundleAndRun(root);
    assert.deepEqual([...order].sort(), ['src/dev.js', 'src/main.js', 'src/shared.js']);
    assert.deepEqual([...context.log], ['s']);
    assert.deepEqual(findCycleHazards('src/main.js', root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('backstop: code after a block comment on the same line cannot hide a native import (Codex)', () => {
  const root = fixture({
    'dev.js': 'export const value = 1;\n',
    'main.js': "/* lazy */ const x = {} / 2; globalThis.load = () => import('./dev.js');\n",
  });
  try {
    // The scanner reads `} /` as a regex start and misses the call; the backstop still fails loudly.
    assert.throws(() => bundleAndRun(root), /native import\( left in src\/main\.js at line 1/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('backstop: a mention inside a comment on a code line is exempt, one after it is not', () => {
  const ok = fixture({ 'main.js': "const a = 1; // import(x)\nconst b = 2; /* import(y) */ const c = 3;\n" });
  try { bundleAndRun(ok); } finally { rmSync(ok, { recursive: true, force: true }); }
  const bad = fixture({ 'main.js': "/* c */ const s = 'import(z)';\n" });
  try {
    assert.throws(() => bundleAndRun(bad), /native import\( left in src\/main\.js at line 1/);
  } finally { rmSync(bad, { recursive: true, force: true }); }
});

test('backstop: code after a block comment cannot hide a scanner miss', () => {
  for (const prefix of ['/* lazy */ ', '/* lazy\n */ ']) {
    const root = fixture({
      'main.js': `${prefix}const x = {} / 2; globalThis.load = () => import('./dev.js');\n`,
      'dev.js': 'export const value = 1;\n',
    });
    try {
      assert.throws(() => bundleAndRun(root), /native import\( left in src\/main\.js/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('backstop: only the comment span is exempt, including inline comments', () => {
  const root = fixture({
    'main.js': "const n = 1; /* import(x) */\nconst m = 2; // import(y)\n/*\n import(z)\n */\n",
  });
  try { bundleAndRun(root); } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a failed static dependency rejects every later dynamic importer', async () => {
  const root = fixture({
    'main.js': "globalThis.loadA = () => import('./a.js');\nglobalThis.loadB = () => import('./b.js');\nglobalThis.loadC = () => import('./c.js');\n",
    'a.js': "import './b.js';\nexport const value = 'a';\n",
    'b.js': "globalThis.log.push('b');\nthrow new Error('boom');\n",
    'c.js': "import './b.js';\nexport const value = 'c';\n",
  });
  try {
    const { context } = bundleAndRun(root);
    let failure;
    await assert.rejects(context.loadA(), error => { failure = error; return error.message === 'boom'; });
    for (const load of [context.loadB, context.loadC, context.loadA]) {
      await assert.rejects(load(), error => error === failure);
    }
    assert.deepEqual([...context.log], ['b'], 'the throwing dependency is evaluated once');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
