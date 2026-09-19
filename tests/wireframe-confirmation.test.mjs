// W2a Service confirmation and W2e Quit confirmation — the words and the
// policy each review carries (docs/architecture-handoff/FRONTEND-WIREFRAMES.md
// "W2 — Confirmation"; RESPONSIVE-WIREFRAMES.md W2a, W2e). The shared frame's
// behaviour (focus, Escape, single commit, input shield) is
// confirmation-modal.test.mjs; the footer order is tools/modal-shell-contract.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GENERIC_REVIEW_WORDS, reviewEyebrow, reviewTone, purchaseReview, burnReview, sellReview, restReview, runIdentity,
} from '../src/ui/models/ConfirmationReviewModel.js';
import { confirmationPolicies } from '../src/framework/data/confirmationPolicies.js';
import { ACTIONS } from '../src/model/secondbeat.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
// The same rule as registries.framework.confirmationTone, read off the data.
const policyTone = (actionId) => {
  const action = confirmationPolicies.actions.find((entry) => entry.id === actionId);
  assert.ok(action, `no ConfirmationRegistry action '${actionId}'`);
  const policy = confirmationPolicies.policies.find((entry) => entry.id === action.policyId);
  return policy.level === 'DESTRUCTIVE' ? 'danger' : 'normal';
};

function assertW2(review, label) {
  assert.match(review.question, /\?$/, `${label}: the title is a concrete question`);
  assert.ok(review.target && review.target.length > 0, `${label}: the target slot is filled`);
  assert.ok(review.message && review.message.length > 0, `${label}: the consequence slot is filled`);
  for (const word of GENERIC_REVIEW_WORDS) {
    assert.notEqual(review.question, word, `${label}: generic question`);
    assert.ok(!review.message.includes(word) || word.length < 12, `${label}: generic consequence '${word}'`);
  }
  assert.ok(!/^confirm\b/i.test(review.confirmLabel), `${label}: the primary names the action (${review.confirmLabel})`);
}

test('W2a merchant purchases name the offer and the exact cinders', () => {
  for (const kind of ['card', 'relic', 'flask']) {
    const review = purchaseReview({ kind, name: 'War Surgeon', cost: 242, cinders: 999 });
    assertW2(review, `buy ${kind}`);
    assert.equal(review.target, 'War Surgeon');
    assert.match(review.message, /242/);
    assert.match(review.message, /999/);
    assert.match(review.message, /757 left/);
    assert.equal(review.confirmLabel, 'BUY IT');
    assert.equal(policyTone(review.policyAction), 'normal', 'a purchase is not a destructive door');
  }
  assert.throws(() => purchaseReview({ kind: 'armour', name: 'x', cost: 1, cinders: 1 }), /unknown kind 'armour'/);
});

test('W2a card burn names the card and cost, and is an alert door by policy', () => {
  const review = burnReview({ name: 'Gorefire Slash', cost: 225, cinders: 999 });
  assertW2(review, 'burn');
  assert.equal(review.target, 'Gorefire Slash');
  assert.match(review.message, /225/);
  assert.equal(review.policyAction, 'action.removeCard');
  assert.equal(policyTone(review.policyAction), 'danger', 'card removal is DESTRUCTIVE in the ConfirmationRegistry');
  assert.equal(reviewTone(ACTIONS.shopRemove, policyTone(review.policyAction)), 'danger');
  const unlit = burnReview({ name: null, cost: 225, cinders: 999 });
  assert.match(unlit.question, /\?$/);
  assert.equal(unlit.target, '');
  assert.match(unlit.message, /225/);
});

test('W2a sale and Shrine rest fill every slot', () => {
  for (const kind of ['relic', 'flask']) {
    const review = sellReview({ kind, name: 'Crimson Flask', price: 30 });
    assertW2(review, `sell ${kind}`);
    assert.match(review.message, /30 cinders/);
  }
  const leave = restReview({ shrine: 'Shrine of Ember', heal: 12, manaGain: 7, hp: 40, maxHp: 62, mana: 3, maxMana: 10, multiUse: false });
  assertW2(leave, 'rest');
  assert.equal(leave.target, 'Shrine of Ember · 40/62 HP · 3/10 Mana');
  assert.match(leave.message, /Heal 12 HP and restore 7 Mana/);
  assert.match(leave.message, /then leave/);
  assert.match(restReview({ shrine: 'S', heal: 0, hp: 1, maxHp: 1, mana: 1, maxMana: 1, multiUse: true }).message, /You stay/);
});

test('the eyebrow is a concrete tag or nothing, for every declared action', () => {
  assert.equal(reviewEyebrow({ undo: 'none' }), 'CANNOT BE UNDONE');
  assert.equal(reviewEyebrow({ undo: 'faucet' }), '');
  for (const [id, row] of Object.entries(ACTIONS)) {
    const eyebrow = reviewEyebrow(row);
    assert.ok(!GENERIC_REVIEW_WORDS.includes(eyebrow), `${id}: generic eyebrow '${eyebrow}'`);
  }
});

test('tone keeps the profile rule (W2b delete stays danger) and adds the policy rule', () => {
  assert.equal(reviewTone(ACTIONS.deleteSave), 'danger');
  assert.equal(reviewTone(ACTIONS.shopBuy, policyTone('action.purchase')), 'neutral');
  assert.equal(reviewTone(ACTIONS.shrineRest), 'neutral');
  assert.equal(policyTone('action.quitWithoutSaving'), 'danger', 'W2e is an alertdialog');
});

test('W2e names the run it leaves the way its save slot does', () => {
  assert.equal(runIdentity({ className: 'Reaver', slot: 1, facts: 'Act 2 · Floor 5 · 48/62 HP' }),
    'Reaver · Slot 1 · Act 2 · Floor 5 · 48/62 HP');
  const main = read('src/main.js');
  const quit = main.slice(main.indexOf('function quitWithoutSaving'), main.indexOf('// ---- screens'));
  assert.match(quit, /target: run \? runIdentity\(/, 'the quit review passes the run identity as its target');
  assert.match(quit, /confirmationTone\('action\.quitWithoutSaving'\)/, 'the quit tone is the registry policy');
});

test('the shared door has no generic eyebrow and an optional target slot', () => {
  const door = read('src/ui/components/confirmationModal.js');
  assert.ok(!/'Careful'|: 'Confirm'\)/.test(door), 'no generic Confirm/Careful eyebrow fallback');
  assert.match(door, /confirmation-target/);
  const armer = read('src/ui/components/holdconfirm.js');
  assert.ok(!armer.includes("'STATE CHANGE'"), 'beatArmer no longer wears the STATE CHANGE category word');
  for (const [file, stale] of [['src/ui/screens/shop.js', /Buy \$\{[^}]+\} for \$\{/], ['src/ui/screens/rest.js', /Rest here\? Heal/]]) {
    assert.ok(!stale.test(read(file)), `${file}: the question/consequence is no longer one crammed title`);
  }
  for (const file of ['src/ui/components/smithUpgradeModal.js', 'src/ui/components/mountServiceModal.js']) {
    assert.ok(!read(file).includes("'Keep reviewing'"), `${file}: the W2 way out reads Back`);
  }
});
