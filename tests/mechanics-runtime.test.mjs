// Every portable mechanic runs its own cases through the interpreter (engine/runtime/SPEC.md).
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createRuntime, loadMechanics, loadOps, runCases } from '../engine/runtime/interpreter.mjs';

const mechanics = loadMechanics(fileURLToPath(new URL('../engine/mechanics/', import.meta.url)));
const ops = loadOps();
const runtime = createRuntime({ mechanics, ops });
const portable = [...mechanics.values()].filter(m => m.manifest.portability === 'portable');

function* steps(list) {
  for (const step of list || []) { yield step; yield* steps(step.then); yield* steps(step.else); yield* steps(step.do); }
}
function* portableSteps() {
  for (const m of portable) for (const handler of m.service.handlers || []) for (const step of steps(handler.do)) yield [m, step];
}

test('there are portable mechanics to run', () => {
  assert.ok(portable.length >= 8);
});

for (const m of portable) {
  test(`${m.manifest.id}: every case passes through the interpreter`, () => {
    assert.ok(m.cases.length >= 3, 'at least 3 cases');
    const results = runCases(m, runtime);
    const failed = results.filter(r => !r.ok).map(r => `${r.name}: ${r.error}`);
    assert.deepEqual(failed, []);
  });
}

test('portable services use only portable ops', () => {
  for (const [m, step] of portableSteps()) {
    if (!step.op) continue;
    assert.equal(ops.ops[step.op]?.reference, 'portable', `${m.manifest.id}: op ${step.op} is not portable in ops.json`);
  }
});

test('every call and emit names an existing mechanic command or event, or runtime.*', () => {
  const split = (full) => {
    for (let i = full.lastIndexOf('.'); i > 0; i = full.lastIndexOf('.', i - 1)) {
      if (mechanics.has(full.slice(0, i))) return [full.slice(0, i), full.slice(i + 1)];
    }
    return null;
  };
  for (const [m, step] of portableSteps()) {
    const id = m.manifest.id;
    if (step.call) {
      const parts = split(step.call);
      assert.ok(parts && parts[1] in (mechanics.get(parts[0]).interface.commands || {}), `${id}: call ${step.call} names no command`);
    }
    if (step.emit && !step.emit.startsWith('runtime.')) {
      const parts = split(step.emit);
      assert.ok(parts && parts[1] in (mechanics.get(parts[0]).interface.events || {}), `${id}: emit ${step.emit} names no event`);
    }
  }
});
