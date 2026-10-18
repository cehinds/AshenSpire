// Node adapter: filesystem loading and conformance assertions stay outside the browser runtime.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { compileBindings, evaluateModifiers, queryBinding } from './bindings.mjs';
import { createRuntime as createPureRuntime, createState } from './evaluator.mjs';
export { createState, MAX_DEPTH, PORTABLE_OPS } from './evaluator.mjs';
export function createRuntime(options = {}) { return createPureRuntime({ ...options, ops: options.ops ?? loadOps() }); }

const here = fileURLToPath(new URL('.', import.meta.url));
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

export function loadOps() {
  return readJson(join(here, 'ops.json'));
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/** loadMechanic(dir) -> { manifest, model, interface, service, cases } from the files mechanic.json names. */
export function loadMechanic(dir) {
  const manifest = readJson(join(dir, 'mechanic.json'));
  const files = manifest.files || {};
  const read = (name, fallback) => {
    if (!files[name]) return fallback;
    const path = join(dir, files[name]);
    if (!existsSync(path)) throw new Error(`${manifest.id}: mechanic.json names ${name} file '${files[name]}', which does not exist`);
    return readJson(path);
  };
  return {
    manifest,
    model: read('model', {}),
    interface: read('interface', { mechanic: manifest.id }),
    service: read('service', { mechanic: manifest.id, handlers: [] }),
    cases: read('cases', []),
  };
}

/** loadMechanics(rootDir) -> Map slug -> mechanic. Folders without mechanic.json are skipped. */
export function loadMechanics(rootDir = fileURLToPath(new URL('../mechanics/', import.meta.url))) {
  const out = new Map();
  if (!existsSync(rootDir)) return out;
  const names = readdirSync(rootDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
  for (const name of names) {
    const dir = join(rootDir, name);
    if (!existsSync(join(dir, 'mechanic.json'))) continue;
    const mechanic = loadMechanic(dir);
    out.set(mechanic.manifest.id, mechanic);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

function partialMatch(actual, expected, path) {
  if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
    if (actual === null || typeof actual !== 'object') throw new Error(`${path}: expected an object, got ${JSON.stringify(actual)}`);
    for (const [k, v] of Object.entries(expected)) partialMatch(actual[k], v, `${path}.${k}`);
    return;
  }
  if (!isDeepStrictEqual(actual, expected)) throw new Error(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

/** runCases(mechanic, runtime) -> [{ name, ok, error }] */
export function runCases(mechanic, runtime) {
  return (mechanic.cases || []).map(testCase => {
    try {
      const state = createState(testCase.given || {});
      const when = testCase.when || {};
      const then = testCase.then || {};
      const unknown = Object.keys(then).filter(k => !['entities', 'piles', 'mechanics', 'events', 'value', 'error'].includes(k));
      if (unknown.length) throw new Error(`then has unknown key(s): ${unknown.join(', ')}`);
      let result = { state, events: [] };
      let value;
      const run = () => {
        if (when.command) result = runtime.command(state, when.command, when.with || {});
        else if (when.event) result = runtime.emit(state, when.event, when.with || {});
        else if (when.query) value = runtime.query(state, when.query, when.with || {});
        else if (when.bindingQuery) {
          const {attachments,moduleParameters,query,params} = when.bindingQuery;
          const bindings = compileBindings({mechanics:new Map([[mechanic.manifest.id,mechanic]]),attachments,moduleParameters});
          if (bindings.length !== 1) throw new Error('query requires one active binding');
          value = queryBinding(bindings[0],query,params);
        }
        else if (when.modifiers) {
          const { attachments, moduleParameters, ...options } = when.modifiers;
          value = evaluateModifiers({ ...options, bindings: compileBindings({mechanics: new Map([[mechanic.manifest.id, mechanic]]), attachments, moduleParameters}) }).amount;
        }
        else throw new Error('when needs command, event or query');
      };
      if (then.error !== undefined) {
        let message = null;
        try { run(); } catch (err) { message = err.message; }
        if (message === null) throw new Error(`expected an error containing '${then.error}', but none was thrown`);
        if (!message.includes(then.error)) throw new Error(`expected an error containing '${then.error}', got '${message}'`);
        return { name: testCase.name, ok: true };
      }
      run();
      for (const section of ['entities', 'piles', 'mechanics']) {
        if (then[section]) partialMatch(result.state[section], then[section], section);
      }
      if (then.events) {
        const names = result.events.map(e => e.name);
        let at = 0;
        for (const wanted of then.events) {
          const found = names.indexOf(wanted, at);
          if (found < 0) throw new Error(`events: expected '${wanted}' in order, got [${names.join(', ')}]`);
          at = found + 1;
        }
      }
      if ('value' in then && !isDeepStrictEqual(value, then.value)) {
        throw new Error(`value: expected ${JSON.stringify(then.value)}, got ${JSON.stringify(value)}`);
      }
      return { name: testCase.name, ok: true };
    } catch (err) {
      return { name: testCase.name, ok: false, error: err.message };
    }
  });
}
