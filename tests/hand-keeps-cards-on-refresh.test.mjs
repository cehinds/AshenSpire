// A hand card whose preview, affordability or availability moved keeps its element and its listeners
// (mountHand `liveWiring`): card.js refreshCard rewrites the words that moved, the host's wiring reads a live
// record, and the reading door reads the current opts when it opens. The card must equal a fresh render.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, previewCard } from '../src/engine/combat.js';
import { applyStatus } from '../src/engine/statuses.js';
import { renderCard } from '../src/ui/components/card.js';
import { mountHand } from '../src/ui/components/hand.js';
import { openBoundCardInspection } from '../src/ui/components/cardInspection.js';
import { clearSelection, resetSelection } from '../src/ui/components/cardSelection.js';
import { withModalDom } from './helpers/modal-dom.mjs';

const registries = createRegistries(contentBundle);
const player = {
  id: 'a', classId: 'reaver', hp: 80, maxHp: 80, energyMax: 20, maxStamina: 20, stamina: 20, drawPerTurn: 5, relicIds: [],
  deck: ['strike', 'defend', 'bashingBlow', 'warcry', 'strike', 'defend'].map((cardId, i) => ({ instanceId: `c${i}`, cardId, upgraded: false })),
};
const fightWith = (statuses = []) => {
  const combat = createCombat({ registries, rng: createRng(7), player: structuredClone(player), enemyIds: ['wanderingSoldier'] });
  for (const [who, id, stacks] of statuses) applyStatus(combat, who === 'enemy' ? combat.enemies[0] : combat.player, id, stacks);
  return combat;
};
const faceOf = (card) => card.querySelector('.illustrated-card-face');

function withHand(fn, mount = {}) {
  return withModalDom(() => {
    globalThis.NodeFilter ??= { SHOW_ELEMENT: 1 };
    document.createTreeWalker = () => ({ nextNode: () => false, currentNode: null });
    document.getSelection = () => ({ removeAllRanges() {}, rangeCount: 0 });
    resetSelection(); clearSelection();
    document.documentElement ??= { dataset: { handLayout: 'paging' }, getAttribute: () => null };
    const handEl = document.createElement('div');
    document.body.append(handEl);
    const wired = [], updated = [];
    const hand = mountHand(handEl, { registries, reuseCards: true, liveWiring: true,
      wireCard: (el, entry) => { wired.push(el); return null; },
      updateCard: (el, entry) => { updated.push([el, entry]); }, ...mount });
    try { return fn({ hand, handEl, wired, updated }); } finally { hand.teardown(); }
  });
}
const entry = (inst, preview, affordable, availability) => ({ inst, preview, affordable, selected: false, surface: 'combat', availability, commands: { play: () => {} } });

test('a preview or affordability that moved keeps the element, wires once, and equals a fresh card', () => withHand(({ hand, handEl, wired, updated }) => {
  const calm = fightWith();
  const strong = fightWith([['player', 'strength', 3], ['enemy', 'vulnerable', 3]]);
  const inst = calm.piles.hand.find(card => JSON.stringify(previewCard(calm, card.instanceId)) !== JSON.stringify(previewCard(strong, card.instanceId)));
  assert.ok(inst, 'a card whose numbers move');
  hand.render({ cards: [entry(inst, previewCard(calm, inst.instanceId), true, { play: true })] });
  const first = handEl.children[0];
  const face = faceOf(first);
  const written = {};
  Object.assign(first.style, { setProperty: (k, v) => { written[k] = v; }, removeProperty: k => { delete written[k]; }, getPropertyValue: k => written[k] ?? '' });
  const savedRaf = globalThis.requestAnimationFrame;
  let frames = [];
  globalThis.requestAnimationFrame = fn => { frames.push(fn); return frames.length; };
  const after = previewCard(strong, inst.instanceId);
  hand.render({ cards: [entry(inst, after, false, { play: 'Not enough stamina for this card.' })] });
  assert.equal(handEl.children[0], first, 'the element is kept');
  assert.equal(faceOf(first), face, 'on its own face nodes');
  assert.equal(wired.length, 1, 'wired once');
  assert.equal(updated.length, 1, 'and its live record refreshed');
  const fresh = renderCard(registries, inst, { preview: after, affordable: false, actionOwnsTouch: true, range: true,
    surface: 'combat', availability: { play: 'Not enough stamina for this card.' }, commands: { play: () => {} }, faceLineLimit: 3 });
  assert.equal(faceOf(first).outerHTML, faceOf(fresh).outerHTML, 'the kept face equals a fresh render');
  assert.ok(first.classList.contains('unaffordable'));
  assert.equal(first.getAttribute('aria-label'), fresh.getAttribute('aria-label'));
  try {
    assert.equal(first.style.getPropertyValue('transition'), 'none', 'the change lands without transitions for a frame');
    const run = () => { const now = frames; frames = []; now.forEach(fn => fn(0)); };
    run();
    assert.equal(first.style.getPropertyValue('transition'), 'none', 'still quiet through the frame that painted it');
    run();
    assert.equal(first.style.getPropertyValue('transition'), '', 'the stylesheet\'s own transitions return after');
  } finally { if (savedRaf === undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame = savedRaf; }
}));

test('the kept card\'s door says the current availability without a rebuild', () => withHand(({ hand, handEl }) => {
  const combat = fightWith();
  const inst = combat.piles.hand[0];
  const preview = previewCard(combat, inst.instanceId);
  hand.render({ cards: [entry(inst, preview, true, { play: true })] });
  const first = handEl.children[0];
  hand.render({ cards: [entry(inst, preview, false, { play: 'Not enough stamina for this card.' })] });
  assert.equal(handEl.children[0], first);
  assert.ok(openBoundCardInspection(first), 'the door opens');
  assert.match(document.body.outerHTML, /Not enough stamina for this card\./);
}));

test('what refresh cannot change still rebuilds: the instance, the viewer reason, the wiring, the host key', () => {
  const combat = fightWith();
  const [a, b] = combat.piles.hand;
  const pv = (card) => previewCard(combat, card.instanceId);
  withHand(({ hand, handEl }) => {
    hand.render({ cards: [entry(a, pv(a), true, { play: true })] });
    const first = handEl.children[0];
    hand.render({ cards: [entry(a, null, true, { play: true })] });
    assert.notEqual(handEl.children[0], first, 'a card losing its preview is unwired: rebuilt');
  });
  withHand(({ hand, handEl }) => {
    hand.render({ cards: [entry(a, pv(a), true, { play: true })] });
    const first = handEl.children[0];
    hand.render({ cards: [{ ...entry(a, pv(a), true, { play: true }), reason: 'Not yours' }] });
    assert.notEqual(handEl.children[0], first, 'a viewer reason rebuilds');
  });
  let key = 'one';
  withHand(({ hand, handEl }) => {
    hand.render({ cards: [entry(b, pv(b), true, { play: true })] });
    const first = handEl.children[0];
    key = 'two';
    hand.render({ cards: [entry(b, pv(b), false, { play: true })] });
    assert.notEqual(handEl.children[0], first, 'a moved host key (the upcast control) rebuilds');
  }, { rebuildKey: () => key });
});

test('without liveWiring a changed signature still rebuilds (the co-op hand wires from the entry)', () => withHand(({ hand, handEl }) => {
  const combat = fightWith();
  const inst = combat.piles.hand[0];
  const preview = previewCard(combat, inst.instanceId);
  hand.render({ cards: [entry(inst, preview, true, { play: true })] });
  const first = handEl.children[0];
  hand.render({ cards: [entry(inst, preview, false, { play: true })] });
  assert.notEqual(handEl.children[0], first);
}, { liveWiring: false }));
