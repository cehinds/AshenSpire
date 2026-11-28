import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEffects } from '../src/model/validate.js';

const FUNDED_RESTORE_OPS = [
  'gainEnergy',
  'restoreMana',
];
const FIXTURE_PATH = 'fixture';

function collectErrors(effect)
{
  const errors = [];
  const context = {
    err: (path, message) =>
    {
      errors.push({
        path,
        message,
      });
    },
    nodeIds: new Set(),
    ids: { statuses: new Set() },
  };
  validateEffects([effect], FIXTURE_PATH, context);
  return errors;
}

test('a fixed-price grade may state the funded part of its own restore', () =>
{
  for (const op of FUNDED_RESTORE_OPS)
  {
    const errors = collectErrors({
      op,
      target: 'self',
      amount: 1,
      funded: 1,
    });
    assert.deepEqual(errors, [], op);
  }
});

test('a funded part must be a whole number no larger than its restore', () =>
{
  const badParts = [
    -1,
    0.5,
    2,
    'one',
  ];
  for (const op of FUNDED_RESTORE_OPS)
  {
    for (const funded of badParts)
    {
      const errors = collectErrors({
        op,
        target: 'self',
        amount: 1,
        funded,
      });
      assert.ok(errors.some((row) => row.path.endsWith('.funded')), `${op} funded ${funded}`);
    }
  }
});
