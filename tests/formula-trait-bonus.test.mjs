import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/model/formulas.js';
import { validateFormula } from '../src/model/validate.js';

// traitBonus is the Counterstrike wrapper: a + max(floor(a × pct), 1) for a > 0.
test('traitBonus adds the counterstrike share to a numeric base', () => {
  assert.equal(evaluate({ f: 'traitBonus', base: 6, pct: 0.5 }), 9);
  assert.equal(evaluate({ f: 'traitBonus', base: 6, pct: 0.75 }), 10);
  assert.equal(evaluate({ f: 'traitBonus', base: 1, pct: 0.5 }), 2);
  assert.equal(evaluate({ f: 'traitBonus', base: 0, pct: 0.5 }), 0);
});

test('traitBonus floors its base before wrapping it', () => {
  // add(3, 4) = 7; floor(7 × 0.5) = 3; 7 + 3 = 10.
  assert.equal(evaluate({ f: 'traitBonus', base: { f: 'add', args: [3, 4] }, pct: 0.5 }), 10);
});

test('traitBonus reads its base from the same evaluation context', () => {
  const ctx = { cardsPlayedThisTurn: 2 };
  // cardsPlayedThisTurn × 2 = 4; floor(4 × 0.5) = 2; 4 + 2 = 6.
  assert.equal(evaluate({ f: 'traitBonus', base: { f: 'cardsPlayedThisTurn', per: 2 }, pct: 0.5 }, ctx), 6);
});

test('traitBonus validates its base and numeric pct', () => {
  const problems = [];
  const vctx = { ids: { statuses: new Set() }, err: (path, message) => problems.push(`${path}: ${message}`) };
  validateFormula({ f: 'traitBonus', base: 4, pct: 0.5 }, 'amount', vctx);
  assert.deepEqual(problems, []);
  validateFormula({ f: 'traitBonus', base: { f: 'nope' }, pct: 0.5 }, 'amount', vctx);
  validateFormula({ f: 'traitBonus', base: 4 }, 'amount', vctx);
  assert.ok(problems.some(p => p.startsWith('amount.base:')));
  assert.ok(problems.some(p => p.startsWith('amount.pct:')));
});
