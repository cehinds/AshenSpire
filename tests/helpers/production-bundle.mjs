import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

// Exercise the shipped compiler and loader without packaging artwork. Native
// ESM keeps cyclic named imports live; the production transform does not.
export function productionBundle({ additionalModules = [] } = {}) {
  const source = readFileSync(resolve(ROOT, 'tools/bundle.mjs'), 'utf8');
  const extract = (start, end) => {
    const first = source.indexOf(start), last = source.indexOf(end, first);
    if (first < 0 || last < 0) throw new Error(`Bundler fixture cannot find ${start} / ${end}`);
    return source.slice(first, last);
  };
  const bindings = {
    resolve, dirname, relative, existsSync,
    ROOT,
    readText: path => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n'),
    fail: message => { throw new Error(message); },
    indexHtml: readFileSync(resolve(ROOT, 'index.html'), 'utf8'),
  };
  const compiler = vm.runInNewContext(`(() => {
    ${extract('function idOf(', '// ---------------------------------------------------------------------------')}
    ${extract('let entrySrc = null;', 'const entryAbs =')}
    ${extract('const entryAbs =', '// ---------------------------------------------------------------------------\n// 2b.')}
    ${extract('function padLines(', 'const transformed =')}
    ${extract('function guardScript(', '// ---------------------------------------------------------------------------')}
    ${extract('const STRICT_DIRECTIVE =', 'const parseErrors =')}
    ${extract('function assembleRuntime(', 'const runtime =')}
    return { sources, order, visit, entryAbs, idOf, IMPORT_RE, transformModule, guardScript, MODULE_FN, assembleRuntime };
  })()`, bindings, { filename: 'production-bundle-compiler.js' });

  const { sources, order, entryAbs, idOf, IMPORT_RE, transformModule, guardScript, MODULE_FN, assembleRuntime } = compiler;
  // Extra entry points (e.g. the co-op server engine) initialize only after
  // the shipped main has loaded, preserving the production cycle ordering.
  for (const id of additionalModules) compiler.visit(resolve(ROOT, id));
  const entryId = idOf(entryAbs);
  // Run the real entry's imports in their authored order. Only its boot body is
  // omitted: it mounts the UI, while these tests call the headless engine API.
  IMPORT_RE.lastIndex = 0;
  const entryImports = [...sources.get(entryId).matchAll(IMPORT_RE)].map(match => match[0]).join('\n');
  const entries = order.map(id => {
    const src = id === entryId ? `${entryImports}\nglobalThis.__bundledRequire = require;` : sources.get(id);
    const { body } = transformModule(id, src, resolve(ROOT, id));
    return `${JSON.stringify(id)}: ${MODULE_FN}\n${guardScript(body)}\n}`;
  }).join(',\n');
  const context = {
    console, structuredClone, Map, Set,
    // UI modules imported by main register custom elements or defer work.
    // Their deferred rendering is irrelevant to the engine initialization.
    HTMLElement: class HTMLElement {},
    customElements: { define() {}, get() {} },
    queueMicrotask() {}, setTimeout() {}, clearTimeout() {},
  };
  vm.runInNewContext(assembleRuntime(entries, entryId), context, {
    filename: 'production-bundle.js', timeout: 10000,
  });
  return context.__bundledRequire;
}
