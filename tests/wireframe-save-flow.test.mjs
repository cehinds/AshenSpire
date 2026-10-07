// W1l / W1m slot doors, W1r save status and the W2b / W2c / W2d save reviews —
// the words and the policy each carries (docs/architecture-handoff/
// FRONTEND-WIREFRAMES.md "W1l / W1m" and "W1r / W2b / W2c";
// RESPONSIVE-WIREFRAMES.md W1l, W1m, W1r, W2b, W2c, W2d). The shared frame's
// behaviour is confirmation-modal.test.mjs; the selection rule is
// menu-slot-availability.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GENERIC_REVIEW_WORDS, deleteSaveReview, replaceSaveReview, loadOverRunReview,
} from '../src/ui/models/ConfirmationReviewModel.js';
import { saveStatusReview, savedAtLabel } from '../src/ui/models/SaveStatusModel.js';
import { confirmationPolicies } from '../src/framework/data/confirmationPolicies.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { createRunState } from '../src/model/state.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { t } from '../src/ui/strings.js';

const policyLevel = (actionId) => {
  const action = confirmationPolicies.actions.find((entry) => entry.id === actionId);
  assert.ok(action, `no ConfirmationRegistry action '${actionId}'`);
  return confirmationPolicies.policies.find((entry) => entry.id === action.policyId).level;
};

function assertW2(review, label) {
  assert.match(review.question, /\?$/, `${label}: the title is a concrete question`);
  assert.ok(review.target.length > 0, `${label}: the target slot names the save`);
  assert.ok(review.message.length > 0, `${label}: the consequence slot is filled`);
  for (const word of GENERIC_REVIEW_WORDS) {
    assert.notEqual(review.question, word, `${label}: generic question`);
    assert.ok(!review.message.includes(word) || word.length < 12, `${label}: generic consequence '${word}'`);
  }
  assert.ok(!/^confirm\b/i.test(review.confirmLabel), `${label}: the primary names the action (${review.confirmLabel})`);
}

const facts = 'Act 1 · Floor 3 · 40/62 HP';

test('W2b Delete names the save, states the real policy, and is a destructive door', () => {
  const review = deleteSaveReview({ slot: 2, className: 'Reaver', facts });
  assertW2(review, 'delete');
  assert.match(review.target, /Reaver/);
  assert.match(review.target, /Slot 2/);
  assert.match(review.message, /cannot be recovered/, 'clearRun removes the run outright; nothing archives it');
  assert.match(review.message, /profile stays/i, 'run deletion never implies profile deletion');
  assert.equal(policyLevel(review.policyAction), 'DESTRUCTIVE');
});

test('W2c Replace is the existing save against the named replacement', () => {
  const review = replaceSaveReview({
    slot: 1,
    existing: { className: 'Reaver', facts },
    replacement: { className: 'Warden', seed: 'SHOWCASE' },
  });
  assertW2(review, 'replace');
  assert.match(review.target, /Reaver · Slot 1/);
  assert.match(review.message, /Warden/);
  assert.match(review.message, /SHOWCASE/);
  assert.match(review.message, /slot 1/);
  assert.equal(review.confirmLabel, 'Replace');
  assert.equal(policyLevel(review.policyAction), 'DESTRUCTIVE');
  assert.throws(() => replaceSaveReview({ slot: 1, existing: { className: 'Reaver' }, replacement: {} }), /replacement must be named/);
});

test('W2d Load over an active run names the saved climb and the exact loss', () => {
  const review = loadOverRunReview({ slot: 3, className: 'Reaver', facts, seed: 'SHOWCASE' });
  assertW2(review, 'load over run');
  assert.match(review.target, /Reaver · Slot 3/);
  assert.match(review.target, /Seed SHOWCASE/);
  assert.match(review.message, /since your last save/);
  assert.equal(review.confirmLabel, 'Load saved run');
  assert.equal(policyLevel(review.policyAction), 'DESTRUCTIVE');
  // An empty slot cannot be loaded; the review degrades to a slot line, never a throw.
  assert.equal(loadOverRunReview({ slot: 3 }).target, '');
});

test('W1r save status: destination, last saved, and Saved or a retry', () => {
  const ok = saveStatusReview({ slot: 2, className: 'Reaver', facts, savedAt: '2026-09-18T14:02:00Z' });
  assert.equal(ok.question, 'Save game');
  assert.match(ok.target, /Reaver · Slot 2/);
  assert.equal(ok.destination, 'Slot 2');
  assert.match(ok.lastSaved, /^Last saved /);
  assert.equal(ok.message, 'Saved.');
  assert.equal(ok.failed, false);
  assert.equal(ok.confirmLabel, 'Save');

  const failed = saveStatusReview({ slot: 2, className: 'Reaver', facts, error: new Error('QuotaExceededError') });
  assert.equal(failed.failed, true);
  assert.match(failed.message, /QuotaExceededError/);
  assert.match(failed.message, /run is unchanged/, 'failure preserves the run');
  assert.equal(failed.confirmLabel, 'Retry save', 'retry is of the save, never the play');
  assert.equal(failed.lastSaved, 'Not saved yet');
  assert.throws(() => saveStatusReview({ slot: 0, className: 'Reaver', facts }), /not a save slot/);
});

test('savedAtLabel prints the time today and the date otherwise, never Invalid Date', () => {
  const now = new Date(2026, 8, 19, 20, 0, 0);
  const today = new Date(2026, 8, 19, 14, 2, 0).toISOString();
  const earlier = new Date(2026, 8, 3, 9, 30, 0).toISOString();
  assert.match(savedAtLabel(today, { locale: 'en-GB', now }), /^14:02$/);
  assert.match(savedAtLabel(earlier, { locale: 'en-GB', now }), /^3 Sept?, 09:30$/);
  assert.equal(savedAtLabel('not a date', { now }), '');
});

test('saveRun stamps savedAt only when the write lands, and slotSummary reports it', () => {
  const store = createMemoryStorage();
  const saves = createSaveManager(store);
  const run = minimalRun();
  saves.saveRun(run, null, 2);
  assert.match(run.savedAt, /^\d{4}-\d{2}-\d{2}T/);
  const summary = saves.slotSummary(2);
  assert.equal(summary.savedAt, run.savedAt);
  assert.equal(summary.slot, 2);

  const before = run.savedAt;
  const full = createSaveManager({
    getItem: (key) => store.getItem(key),
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: (key) => store.removeItem(key),
  });
  assert.throws(() => full.saveRun(run, null, 2), /QuotaExceededError/);
  assert.equal(run.savedAt, before, 'a save that did not land leaves the stamp alone');
  assert.equal(saves.slotSummary(2).savedAt, before);
});

test('the slot doors are titled by purpose and their primary by action', () => {
  assert.equal(t('title.slots.door.new'), 'New game');
  assert.equal(t('title.slots.door.load'), 'Load game');
  assert.equal(t('title.slots.primary.new'), 'Create character');
  assert.equal(t('title.slots.primary.load'), 'Load');
  // W1l: choosing an occupied slot overwrites nothing; the door says so.
  assert.match(t('title.slots.start.occupied.prompt'), /Nothing changes until you begin/);
});

// A real run, built the way the game builds one, so the save is the game's own shape.
function minimalRun() {
  return createRunState({ seed: 808, classId: 'reaver', registries: createRegistries(contentBundle) });
}
