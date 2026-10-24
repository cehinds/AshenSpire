import test from 'node:test';
import assert from 'node:assert/strict';
import { createConsoleRecorder, consoleValueText, CONSOLE_MAX_ENTRIES, CONSOLE_MAX_TEXT, consoleLogText } from '../src/ui/consoleLog.js';
import { saveTextFile } from '../src/ui/services/saveTextFile.js';

test('console wrappers preserve native receiver, arguments, return and thrown errors for every level', () => {
  const recorder = createConsoleRecorder(), calls = [];
  const failure = new Error('native failure'), target = {};
  for (const level of ['log', 'info', 'warn', 'error', 'debug']) target[level] = function (...args) {
    calls.push([level, this, args]); if (level === 'error') throw failure; return level;
  };
  const nativeLog = target.log, obj = { a: 1 };
  const release = recorder.install(target);
  for (const level of ['log', 'info', 'warn', 'debug']) assert.equal(target[level]('%s', obj), level);
  assert.throws(() => target.error(obj), error => error === failure);
  assert.equal(calls.length, 5);
  assert.equal(calls[0][1], target);
  assert.equal(calls[0][2][1], obj);
  assert.equal(recorder.getEntries().length, 5);
  release(); assert.equal(target.log, nativeLog);
});

test('capture snapshots circular values, errors, bigint and getters without executing getters', () => {
  const circular = { count: 2n }; circular.self = circular;
  Object.defineProperty(circular, 'bad', { enumerable: true, get() { throw new Error('getter ran'); } });
  const text = consoleValueText(circular);
  assert.match(text, /count: 2/); assert.match(text, /Circular/); assert.match(text, /bad: \[Getter\]/);
  const ordinary = new Error('stack marker');
  assert.match(consoleValueText(ordinary), /Error: stack marker/);
  Object.defineProperty(ordinary, 'stack', { value: 'Error: stack marker\n    at console-test.js:1', configurable: true });
  assert.equal(consoleValueText(ordinary), 'Error: stack marker', 'explicit stack values are omitted by the summary-only policy');
  assert.equal(consoleValueText(new Proxy({}, { ownKeys() { throw new Error('hostile'); } })), '[Uninspectable value]');
  const recorder = createConsoleRecorder(), value = { before: 1 };
  recorder.append('log', value); value.before = 2;
  assert.match(recorder.getEntries()[0].text, /before: 1/);
});

test('session storage and notification work stay bounded, even with recursive or throwing subscribers', () => {
  const recorder = createConsoleRecorder(); let notifications = 0;
  const stop = recorder.subscribe(() => { notifications++; recorder.append('log', 'recursive'); throw new Error('subscriber'); });
  for (let i = 0; i < CONSOLE_MAX_ENTRIES + 10; i++) recorder.append('log', i, 'x'.repeat(CONSOLE_MAX_TEXT * 2));
  const rows = recorder.getEntries();
  assert.equal(rows.length, CONSOLE_MAX_ENTRIES);
  assert.match(rows[0].text, /^10 /);
  assert(rows.every(row => row.text.length <= CONSOLE_MAX_TEXT));
  rows.splice(0); assert.equal(recorder.getEntries().length, CONSOLE_MAX_ENTRIES);
  stop(); recorder.append('log', 'after');
  assert.equal(notifications, CONSOLE_MAX_ENTRIES + 10);
});

test('export metadata names build and device without reading saved state or location', () => {
  const text = consoleLogText({ Build: 'test-build', Device: 'test-device' });
  assert.match(text, /Build: test-build\nDevice: test-device/);
  assert.match(text, /Exported: \d{4}-/);
  assert.match(text, /network\/DevTools-only/);
  assert.match(text, /No save or profile is attached/);
});

function downloadFixture() {
  const state = { clicked: 0, removed: 0, revoked: [] };
  const options = { File: class { constructor(parts, name, options) { Object.assign(this, { parts, name, ...options }); } },
    window: { URL: { createObjectURL(blob) { state.blob = blob; return 'blob:console'; }, revokeObjectURL(url) { state.revoked.push(url); } }, setTimeout(fn) { state.cleanup = fn; } },
    document: { body: { appendChild(node) { state.anchor = node; } }, createElement() { return { click() { state.clicked++; }, remove() { state.removed++; } }; } }, navigator: {} };
  return { state, options };
}

test('mobile export shares a plain text file when supported', async () => {
  const { state, options } = downloadFixture(); let shared;
  options.navigator = { canShare: ({ files }) => files[0].type === 'text/plain', async share(data) { shared = data; } };
  assert.deepEqual(await saveTextFile('marker', options), { ok: true, method: 'share' });
  assert.equal(shared.files[0].name, 'ashen-spire-console.txt');
  assert.deepEqual(shared.files[0].parts, ['marker']); assert.equal(state.clicked, 0);
});

test('rejected share falls back to download; cancellation stops without another prompt', async () => {
  const { state, options } = downloadFixture();
  options.navigator = { canShare: () => true, share: async () => { throw new Error('blocked'); } };
  assert.equal((await saveTextFile('download marker', options)).method, 'download');
  assert.equal(state.clicked, 1); assert.equal(state.removed, 1);
  assert.equal(await state.blob.text(), 'download marker');
  assert.equal(state.anchor.download, 'ashen-spire-console.txt'); state.cleanup();
  assert.deepEqual(state.revoked, ['blob:console']);
  options.navigator.share = async () => { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); };
  assert.equal((await saveTextFile('cancel', options)).method, 'cancelled'); assert.equal(state.clicked, 1);
});

test('failed downloads release resources and return an actionable unavailable result', async () => {
  const { state, options } = downloadFixture();
  options.document.createElement = () => ({ click() { throw new Error('blocked download'); }, remove() { state.removed++; } });
  assert.equal((await saveTextFile('marker', options)).method, 'unavailable');
  assert.equal(state.removed, 1); state.cleanup(); assert.equal(state.revoked.length, 1);
  assert.equal((await saveTextFile('marker', { window: {}, navigator: {} })).ok, false);
});

test('error and function hooks never run while diagnostic text is captured', () => {
  let reads = 0;
  const error = new Error('initial');
  for (const key of ['stack', 'name', 'message']) Object.defineProperty(error, key, { get() { reads++; return 'side effect'; }, configurable: true });
  const fn = function () {};
  fn[Symbol.toPrimitive] = () => { reads++; return 'side effect'; };
  const obj = { get toJSON() { reads++; return () => 'side effect'; }, [Symbol.toPrimitive]() { reads++; return 'side effect'; } };
  const recorder = createConsoleRecorder(); recorder.append('log', error, fn, obj);
  assert.equal(reads, 0);
  assert.match(recorder.getEntries()[0].text, /\[Getter\].*\[Function\]/);
});

test('fresh native Error summaries do not materialize lazy stacks or custom name/message getters', () => {
  let reads = 0;
  const error = new Error('fresh native error');
  Object.defineProperty(error, 'name', { configurable: true, get() { reads++; return 'custom name'; } });
  Object.defineProperty(error, 'message', { configurable: true, get() { reads++; return 'custom message'; } });
  const summary = consoleValueText(error);
  assert.equal(reads, 0, 'capturing a fresh native Error must not format its lazy stack');
  assert.equal(summary, '[Getter]: [Getter]');
});

test('capturing native Errors never calls a custom prepareStackTrace hook', () => {
  const original = Object.getOwnPropertyDescriptor(Error, 'prepareStackTrace');
  let calls = 0;
  Object.defineProperty(Error, 'prepareStackTrace', { configurable: true, writable: true, value: () => { calls++; return 'prepared stack'; } });
  try {
    assert.equal(consoleValueText(new Error('fresh lazy stack')), 'Error: fresh lazy stack');
    assert.equal(calls, 0);
  } finally {
    if (original) Object.defineProperty(Error, 'prepareStackTrace', original);
    else delete Error.prepareStackTrace;
  }
});

test('Error summaries never even request the native stack descriptor', () => {
  let stackProbes = 0;
  const error = new Proxy(new Error('summary only'), {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'stack') stackProbes++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  assert.equal(consoleValueText(error), 'Error: summary only');
  assert.equal(stackProbes, 0, 'stack descriptor inspection can materialize native V8 stacks');
});
