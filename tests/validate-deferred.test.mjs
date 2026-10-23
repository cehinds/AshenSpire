import assert from 'node:assert/strict';
import test from 'node:test';
import { legacyContentBundle as contentBundle } from './helpers/legacy-progression-content.mjs';
import { validateContent } from '../src/model/validate.js';
import { classMasteryProblems } from '../src/model/classMasteryContent.js';

const broken = () => ({ ...contentBundle, classMastery: contentBundle.classMastery.slice(1) });

test('validateContent runs the class-mastery pass by default and skips it only when deferred', () => {
  const bundle = broken();
  const full = validateContent(bundle);
  assert.equal(full.ok, false);
  assert.ok(full.errors.some(e => e.path === 'classMastery'), 'default validation reports mastery problems');
  const deferred = validateContent(bundle, { deferred: ['classMastery'] });
  assert.ok(!deferred.errors.some(e => e.path === 'classMastery'), 'deferred validation leaves them to the caller');
  assert.ok(classMasteryProblems(bundle).length > 0, 'the caller can still run the deferred pass');
});

test('deferring class mastery does not change a valid bundle result', () => {
  assert.deepEqual(validateContent(contentBundle, { deferred: ['classMastery'] }).ok, validateContent(contentBundle).ok);
});
