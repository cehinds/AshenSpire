// src/ui/models/ConfirmationReviewModel.js — WHAT A W2 REVIEW SAYS, DOM-free.
//
// The W2 confirmation (docs/architecture-handoff/FRONTEND-WIREFRAMES.md
// "W2 — Confirmation", RESPONSIVE-WIREFRAMES.md W2a / W2e) is one frame with
// four slots: a concrete question, the target it acts on, the exact
// consequence, and two answers (Back left, the action-named primary right).
// The shared modal (components/confirmationModal.js) draws the frame; this
// file owns the words each service and quit review puts in the slots, so
// the screens that arm a review author facts and never prose.
//
// No generic eyebrow and no generic "review this change" line: the eyebrow is
// a concrete consequence tag or nothing, and every review here names its
// target and its exact cost or change. The words live in
// content/source/uiStrings.csv like every other sentence.

import { t } from '../strings.js';

/** Category words a W2 head or body must never wear in place of the real question. */
export const GENERIC_REVIEW_WORDS = Object.freeze([
  'Confirmation', 'Confirm', 'Careful', 'STATE CHANGE', 'Are you sure?',
  'Review this change before confirming, or go back without applying it.',
]);

const BUY = Object.freeze({
  card: Object.freeze({ question: 'shop.review.buy.card', message: 'shop.review.buy.card.message' }),
  relic: Object.freeze({ question: 'shop.review.buy.relic', message: 'shop.review.buy.relic.message' }),
  flask: Object.freeze({ question: 'shop.review.buy.flask', message: 'shop.review.buy.flask.message' }),
});
const SELL = Object.freeze({ relic: 'shop.review.sell.relic', flask: 'shop.review.sell.flask' });

function row(table, kind, what) {
  if (!Object.hasOwn(table, kind)) throw new Error(`${what}: unknown kind '${kind}'`);
  return table[kind];
}

function amount(value, what) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${what}: '${value}' is not a number`);
  return n;
}

/**
 * The eyebrow a routed action's review wears: the concrete tag for an action
 * that cannot be taken back, and nothing otherwise. (The old fallback was
 * "STATE CHANGE", a category word, which W2 forbids.)
 */
export function reviewEyebrow({ undo } = {}) {
  return undo === 'none' ? t('confirm.eyebrow.permanent') : '';
}

/**
 * The tone a review wears. Danger (red primary, `alertdialog`) when the
 * ConfirmationRegistry declares the action's policy DESTRUCTIVE (policyTone,
 * from registries.framework.confirmationTone), or when the secondbeat row
 * writes the profile and cannot be undone. Everything else is neutral.
 */
export function reviewTone({ stakes, undo } = {}, policyTone = 'normal') {
  return policyTone === 'danger' || (stakes === 'profile' && undo === 'none') ? 'danger' : 'neutral';
}

/** W2a merchant purchase: a card, relic or flask for cinders. */
export function purchaseReview({ kind, name, cost, cinders }) {
  const ids = row(BUY, kind, 'purchaseReview');
  const price = amount(cost, 'purchaseReview cost');
  const purse = amount(cinders, 'purchaseReview cinders');
  return Object.freeze({
    question: t(ids.question),
    target: String(name),
    message: t(ids.message, { cost: price, cinders: purse, left: purse - price }),
    confirmLabel: t('shop.buy.confirm'),
    policyAction: 'action.purchase',
  });
}

/** W2a merchant card removal (the brazier). DESTRUCTIVE by policy. */
export function burnReview({ name = null, cost, cinders }) {
  const price = amount(cost, 'burnReview cost');
  if (!name) {
    return Object.freeze({
      question: t('shop.review.burn.none'),
      target: '',
      message: t('shop.review.burn.none.message', { cost: price }),
      confirmLabel: t('shop.burn.confirm'),
      policyAction: 'action.removeCard',
    });
  }
  const purse = amount(cinders, 'burnReview cinders');
  return Object.freeze({
    question: t('shop.review.burn'),
    target: String(name),
    message: t('shop.review.burn.message', { cost: price, cinders: purse, left: purse - price }),
    confirmLabel: t('shop.burn.confirm'),
    policyAction: 'action.removeCard',
  });
}

/** W2a merchant sale of a relic or flask. */
export function sellReview({ kind, name, price }) {
  return Object.freeze({
    question: t(row(SELL, kind, 'sellReview')),
    target: String(name),
    message: t('shop.review.sell.message', { price: amount(price, 'sellReview price') }),
    confirmLabel: t('shop.sell.confirm'),
    policyAction: null,
  });
}

/** W2a Shrine rest: the Shrine and the player's pools, then the exact recovery. */
export function restReview({ shrine, heal, manaGain = 0, hp, maxHp, mana, maxMana, multiUse = false }) {
  return Object.freeze({
    question: t('rest.review.question'),
    target: t('rest.review.target', {
      shrine: String(shrine), hp: amount(hp, 'restReview hp'), maxHp: amount(maxHp, 'restReview maxHp'),
      mana: amount(mana, 'restReview mana'), maxMana: amount(maxMana, 'restReview maxMana'),
    }),
    // One sentence per shape: the Mana clause appears only when Mana moves,
    // exactly as the card's own line reads (rest.js).
    message: t(manaGain > 0 ? (multiUse ? 'rest.review.stay' : 'rest.review.leave') : (multiUse ? 'rest.review.stayHp' : 'rest.review.leaveHp'), { heal: amount(heal, 'restReview heal'), mana: amount(manaGain, 'restReview mana gain') }),
    confirmLabel: t('rest.review.confirm'),
    policyAction: null,
  });
}

/**
 * W2e: the current run's identity line — class, the slot it persists to, and
 * the same act · floor · HP facts the save slots print (`facts` is the caller's
 * `slotFacts(...)`, so the two never disagree about how a run is described).
 */
export function runIdentity({ className, slot, facts }) {
  return t('quit.review.target', { className: String(className), slot: amount(slot, 'runIdentity slot'), facts: String(facts) });
}

/** The save a slot review acts on, or nothing when the slot is empty. */
function slotTarget({ slot, className, facts }) {
  return className ? runIdentity({ className, slot, facts: facts ?? '' }) : '';
}

/**
 * W2b Delete save. The consequence is the save manager's actual policy
 * (engine/save.js clearRun): the slot's run is removed outright — the archive
 * holds only saves that failed to load — and the profile is untouched.
 */
export function deleteSaveReview({ slot, className = null, facts = null }) {
  const n = amount(slot, 'deleteSaveReview slot');
  return Object.freeze({
    question: t('save.review.delete', { slot: n }),
    target: slotTarget({ slot: n, className, facts }),
    message: t('save.review.delete.message', { slot: n }),
    confirmLabel: t('save.review.delete.confirm'),
    policyAction: 'action.deleteSave',
  });
}

/**
 * W2c Replace save, asked at the write boundary: the existing save is the
 * target, the replacement is named, and the consequence is exact.
 */
export function replaceSaveReview({ slot, existing, replacement }) {
  const n = amount(slot, 'replaceSaveReview slot');
  if (!existing?.className) throw new Error('replaceSaveReview: the existing save must be named');
  if (!replacement?.className) throw new Error('replaceSaveReview: the replacement must be named');
  return Object.freeze({
    question: t('save.review.replace'),
    target: runIdentity({ className: existing.className, slot: n, facts: existing.facts ?? '' }),
    message: t('save.review.replace.message', { className: String(replacement.className), seed: String(replacement.seed ?? '—'), slot: n }),
    confirmLabel: t('save.review.replace.confirm'),
    policyAction: 'action.overwriteSave',
  });
}

/** W2d Load over an active run: the saved climb is the target; the loss is exact. */
export function loadOverRunReview({ slot, className = null, facts = null, seed = null }) {
  const n = amount(slot, 'loadOverRunReview slot');
  const target = slotTarget({ slot: n, className, facts });
  return Object.freeze({
    question: t('save.review.load', { slot: n }),
    target: seed && target ? `${target} · ${t('title.slots.seed', { seed: String(seed) })}` : target,
    message: t('save.review.load.message'),
    confirmLabel: t('save.review.load.confirm'),
    policyAction: 'action.loadSlot',
  });
}
