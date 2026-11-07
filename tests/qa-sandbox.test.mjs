// tests/qa-sandbox.test.mjs — the pure parts of tools/qa-sandbox.mjs (spec
// validation, check evaluation). No browser. Run: node --test tests/qa-sandbox.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSpec, validateCheck, evaluateCheck, verdict, renderReport } from '../tools/qa-sandbox.mjs';

const scene = (extra = {}) => ({ name: 's', url: '?shot=combat', success: [{ kind: 'visible', label: 'v', selector: '.x' }], ...extra });
const spec = (extra = {}) => ({ request: 'make it so', viewports: [{ name: 'desktop', width: 1280, height: 800 }], scenes: [scene()], ...extra });

test('a well-formed spec is valid', () => assert.deepEqual(validateSpec(spec()), []));
test('a missing request is rejected', () => assert.match(validateSpec(spec({ request: '' })).join('\n'), /missing request/));
test('an unknown check kind is rejected', () => {
  const errs = validateSpec(spec({ scenes: [scene({ failure: [{ kind: 'sparkles', label: 'x', selector: '.a' }] })] }));
  assert.match(errs.join('\n'), /unknown check kind "sparkles"/);
});
test('a missing selector is rejected', () => {
  assert.match(validateCheck({ kind: 'visible', label: 'l' }, 'c').join(), /needs a selector/);
  assert.match(validateCheck({ kind: 'within', label: 'l', selector: '.a' }, 'c').join(), /needs a container/);
  assert.match(validateCheck({ kind: 'noOverlap', label: 'l', a: '.a' }, 'c').join(), /needs a b/);
});
test('count needs a bound; text needs includes or matches', () => {
  assert.match(validateCheck({ kind: 'count', label: 'l', selector: '.a' }, 'c').join(), /min, max or eq/);
  assert.match(validateCheck({ kind: 'text', label: 'l', selector: '.a' }, 'c').join(), /includes or matches/);
});
test('a scene with no success check, or a bad action, is rejected', () => {
  assert.match(validateSpec(spec({ scenes: [scene({ success: [] })] })).join('\n'), /at least one success/);
  assert.match(validateSpec(spec({ scenes: [scene({ actions: [{ dance: 1 }] })] })).join('\n'), /unknown action/);
});

const B = (x, y, width, height) => ({ x, y, width, height });
test('visible / hidden', () => {
  assert.equal(evaluateCheck({ kind: 'visible' }, { count: 1, visible: true }).holds, true);
  assert.equal(evaluateCheck({ kind: 'visible' }, { count: 0, visible: false }).holds, false);
  assert.equal(evaluateCheck({ kind: 'hidden' }, { count: 0, visible: false }).holds, true);
});
test('count bounds', () => {
  const c = { kind: 'count', min: 2, max: 5 };
  assert.equal(evaluateCheck(c, { count: 1 }).holds, false);
  assert.equal(evaluateCheck(c, { count: 3 }).holds, true);
  assert.equal(evaluateCheck({ kind: 'count', eq: 0 }, { count: 0 }).holds, true);
});
test('text includes and matches', () => {
  assert.equal(evaluateCheck({ kind: 'text', includes: 'HP' }, { texts: ['HP 10/20'] }).holds, true);
  assert.equal(evaluateCheck({ kind: 'text', matches: '^\\d+$' }, { texts: ['12'] }).holds, true);
  assert.equal(evaluateCheck({ kind: 'text', includes: 'x' }, { texts: [] }).holds, false);
});
test('within uses bounding boxes', () => {
  const c = { kind: 'within', selector: '.a', container: '.b' };
  assert.equal(evaluateCheck(c, { box: B(10, 10, 50, 20), container: B(0, 0, 100, 100) }).holds, true);
  assert.equal(evaluateCheck(c, { box: B(90, 10, 50, 20), container: B(0, 0, 100, 100) }).holds, false);
  assert.equal(evaluateCheck(c, { box: null, container: B(0, 0, 1, 1) }).holds, false);
});
test('noOverlap uses bounding boxes', () => {
  const c = { kind: 'noOverlap', a: '.a', b: '.b' };
  assert.equal(evaluateCheck(c, { a: B(0, 0, 10, 10), b: B(10, 0, 10, 10) }).holds, true);
  assert.equal(evaluateCheck(c, { a: B(0, 0, 10, 10), b: B(5, 5, 10, 10) }).holds, false);
});
test('style and consoleErrors', () => {
  assert.equal(evaluateCheck({ kind: 'style', prop: 'display', equals: 'flex' }, { value: 'flex' }).holds, true);
  assert.equal(evaluateCheck({ kind: 'consoleErrors', max: 0 }, { errors: [] }).holds, true);
  assert.equal(evaluateCheck({ kind: 'consoleErrors', max: 0 }, { errors: ['boom'] }).holds, false);
});
test('a failure check that holds is a FAIL; one that does not hold passes', () => {
  assert.equal(verdict('failure', { holds: true, detail: 'x' }).pass, false);
  assert.equal(verdict('failure', { holds: false, detail: 'x' }).pass, true);
  assert.equal(verdict('success', { holds: true, detail: 'x' }).pass, true);
});
test('the report leads with the request and lists PASS/FAIL', () => {
  const md = renderReport({ request: 'REQ', base: null, totals: { pass: 1, fail: 1 }, runs: [{ viewport: 'd', scene: 's', after: { screenshot: 'a.png', checks: [{ group: 'success', label: 'L1', pass: true, detail: 'ok' }, { group: 'failure', label: 'L2', pass: false, detail: 'FAILURE PRESENT' }] } }] });
  assert.match(md, /^# QA sandbox report\n\n## Request\n\n> REQ/);
  assert.match(md, /PASS ok/); assert.match(md, /FAIL FAILURE PRESENT/); assert.match(md, /Result: FAIL/);
});
