// tests/ui-strings.test.mjs — the rules the copy table promises.
//
// The table (content/source/uiStrings.csv) and its lookup (src/ui/strings.js)
// exist so prose lives in one authored place. These are the promises a screen
// relies on when it stops holding its own sentences: the three forms are
// distinct, `extends` fills only what a row leaves blank, and every way of
// asking for something that is not there fails BY NAME rather than painting an
// empty control (Law 1 clause 5, applied to copy).
import test from 'node:test';
import assert from 'node:assert/strict';
import { t, tFull, tTip, has, stringIds } from '../src/ui/strings.js';
import { uiStrings } from '../src/content/generated/uiStrings.js';

test('the three forms are authored separately, not derived from one another', () => {
  assert.equal(t('common.back'), 'Back');
  assert.equal(tFull('common.back'), 'Return to the screen before this one.');
  assert.equal(tTip('common.back'), 'Back');
  assert.notEqual(t('reward.blocked.storage'), tFull('reward.blocked.storage'));
});

test('extends fills every cell a row leaves blank and never overwrites one it authors', () => {
  // reward.skip extends common.skip: its own `full` and `tip`, the parent's word.
  assert.equal(t('reward.skip'), t('common.skip'));
  assert.equal(tFull('reward.skip'), 'Leave this blocked reward behind.');
  assert.notEqual(tFull('reward.skip'), tFull('common.skip'));
  assert.equal(tTip('reward.skip'), 'Skip unavailable reward');
});

test('tokens are substituted from the caller and an unpassed one is loud', () => {
  assert.equal(t('reward.cinders.title', { amount: 40 }), '40 cinders');
  assert.equal(t('reward.stone.title', { amount: 1, plural: '' }), '1 Smithing Stone');
  assert.equal(t('reward.stone.title', { amount: 3, plural: 's' }), '3 Smithing Stones');
  assert.throws(() => t('reward.cinders.title'), /wants \{amount\}/);
  assert.throws(() => t('reward.cinders.title', { other: 1 }), /wants \{amount\}/);
});

test('an unknown id and an unauthored form each fail by name', () => {
  assert.throws(() => t('no.such.id'), /unknown id 'no\.such\.id'/);
  assert.throws(() => tTip('reward.cinders.title'), /has no tip form/);
  assert.equal(has('reward.cinders.title', 'tip'), false);
  assert.equal(has('reward.cinders.title', 'short'), true);
  assert.equal(has('no.such.id'), false);
});

test('every authored row resolves, and every parent it names exists', () => {
  const ids = new Set(stringIds());
  assert.ok(ids.size >= uiStrings.length - 0, 'every row is indexed');
  for (const row of uiStrings) {
    if (row.extends) assert.ok(ids.has(row.extends), `'${row.id}' extends '${row.extends}', which is not a row`);
    // A row must say something in at least one form, or it is an id with no words.
    const forms = ['short', 'full', 'tip'].filter((form) => has(row.id, form));
    assert.ok(forms.length > 0, `'${row.id}' authors no form at all`);
  }
});

test('no row carries a list — a cell is one sentence', () => {
  for (const row of uiStrings) {
    for (const form of ['short', 'full', 'tip']) {
      assert.ok(!Array.isArray(row[form]), `'${row.id}.${form}' contains a '|' and arrived as a list`);
    }
  }
});
