// A confirmation stays only where something is lost for good (owner, 2026-11-14, Wave 2).
// The list of what still confirms is the second-beat table (model/secondbeat.js); this file pins it
// exactly, and drives the real beatArmer to prove the freed actions commit on ONE activation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enumerateBeats, assertTableSane, beatFor } from '../src/model/secondbeat.js';
import { beatArmer } from '../src/ui/components/holdconfirm.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the actions that still take a second beat are exactly the ones that lose something for good', () => {
  assert.deepEqual(assertTableSane(), []);
  const asking = [...new Set(enumerateBeats().filter((cell) => cell.form !== 'none').map((cell) => cell.id))].sort();
  assert.deepEqual(asking, [
    'deleteSave',      // a save is gone
    'freshProfile',    // a new profile over an unreadable one
    'profileRestore',  // a restored profile replaces the one in play
    'shopRemove',      // a card burned out of the deck
    'shrineLevelUp',   // a stat point, spent (the stat card's own two steps)
    'smithExtract',    // chooser: review, then a plain Confirm
    'smithInstall',    // chooser: review, then a plain Confirm
    'smithUpgrade',    // chooser: review, then a plain Confirm
  ].sort());
});

test('every action freed in Wave 2 is declared `tap: true` and takes no beat at any edge', () => {
  const freed = ['endTurn', 'eventChoice', 'rewardContinue', 'shopBuy', 'shopSell', 'useFlask', 'shrineRest'];
  for (const id of freed) {
    const cells = enumerateBeats().filter((cell) => cell.id === id);
    assert.ok(cells.length, `${id} is in the table`);
    for (const cell of cells) {
      assert.equal(cell.tap, true, `${id} ${JSON.stringify(cell.ctx)} says it commits on a tap`);
      assert.equal(cell.form, 'none', `${id} ${JSON.stringify(cell.ctx)} owes no beat`);
    }
  }
});

// ---- the real armer on a stand-in control: one activation commits, once ----------------------------
function fakeControl() {
  const handlers = new Map();
  const props = new Map();
  return {
    handlers, isConnected: true, dataset: {},
    classList: { add() {}, remove() {}, contains: () => false },
    style: { setProperty: (k, v) => props.set(k, v), getPropertyValue: (k) => props.get(k) ?? '', removeProperty: (k) => props.delete(k) },
    addEventListener(type, fn) { handlers.set(type, fn); },
    removeEventListener(type) { handlers.delete(type); },
    querySelector: () => null, matches: () => false, closest: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 80, height: 40 }),
  };
}
const REGISTRIES = {
  balance: { ui: { holdConfirm: { def: 'normal', steps: { off: 0, normal: 600 } } } },
  framework: { confirmationTone: () => 'normal' },
};
for (const k of ['addEventListener', 'removeEventListener']) if (typeof globalThis[k] !== 'function') globalThis[k] = () => {};
function tap(control) {
  control.handlers.get('click')(Object.assign(new Event('click', { cancelable: true }), { detail: 0 }));
}
// If a tap tried to open the confirmation modal it would build a DOM node and throw.
function noModal(fn) {
  const was = globalThis.document;
  globalThis.document = { activeElement: null, createElement() { throw new Error('a modal opened'); } };
  try { return fn(); } finally { if (was === undefined) delete globalThis.document; else globalThis.document = was; }
}

const CASES = [
  ['endTurn', { playable: true }],
  ['endTurn', { playable: false }],
  ['eventChoice', { binding: true }],
  ['eventChoice', { binding: false }],
  ['rewardContinue', {}],
  ['shopBuy', {}],
  ['shopSell', {}],
  ['useFlask', { targeted: false }],
  ['shrineRest', {}],
];
for (const [id, ctx] of CASES) {
  test(`${id} ${JSON.stringify(ctx)} commits on one activation with the hold dial at its default`, () => {
    const control = fakeControl();
    const committed = [];
    const disarm = beatArmer({ settings: {} }, REGISTRIES)(control, id, { ctx, onConfirm: () => committed.push(id), showHint: false });
    try {
      assert.equal(control.dataset.beat, 'none');
      assert.equal(control.dataset.holdMs, undefined, 'no hold is drawn');
      noModal(() => tap(control));
      assert.deepEqual(committed, [id], 'exactly one commit');
    } finally { disarm(); }
  });
}

test('a row that still asks keeps its hold and its review', () => {
  assert.equal(beatFor('deleteSave').form, 'hold');
  assert.equal(beatFor('smithUpgrade').form, 'confirm');
});

// ---- the screens that wire the freed actions no longer carry a review ---------------------------------
test('screens wire the freed actions with a commit and no review', () => {
  for (const [file, actionId] of [['src/ui/screens/event.js', 'eventChoice'], ['src/ui/screens/dialogue.js', 'eventChoice'],
    ['src/ui/screens/shop.js', 'shopBuy'], ['src/ui/screens/shop.js', 'shopSell'], ['src/ui/screens/rest.js', 'shrineRest'],
    ['src/ui/components/combatActionRow.js', 'useFlask'], ['src/ui/screens/combat.js', 'endTurn']]) {
    const src = read(file);
    const call = src.match(new RegExp(`arm\\([^\\n]*'${actionId}',\\s*\\{[\\s\\S]*?\\}\\)\\)?[;,]`))?.[0] || '';
    assert.ok(call, `${file} arms ${actionId}`);
    assert.doesNotMatch(call, /question:|confirmLabel:|detailHtml:|\.\.\.restReview|\.\.\.review/, `${file}: ${actionId} has no review wording`);
  }
  assert.doesNotMatch(read('src/ui/screens/event.js'), /CHOOSE/);
});

test('equip and unequip commit on one tap: the Armoury never hands its card the hold dial', () => {
  const src = read('src/ui/components/armouryInventory.js');
  assert.match(src, /const holdDuration = 0;/);
});

test('the smith and card-upgrade choosers review on a tap and never commit on a hold', () => {
  const src = read('src/ui/components/optionDecision.js');
  assert.match(src, /const duration = 0;/);
});

// ---- leaving a reward unclaimed asks once, in the shared modal ----------------------------------------
test('leaving rewards unclaimed asks once with the specific line; nothing unclaimed goes straight on', () => {
  const strings = read('content/source/uiStrings.csv');
  assert.match(strings, /^reward\.leave\.question,,Leave without taking a reward\?,,$/m);
  assert.match(strings, /^reward\.leave\.confirm,,Leave it,/m);
  assert.match(strings, /^reward\.leave\.take,,Take a reward,/m);
  const offers = read('src/ui/components/gameProfileOffers.js');
  assert.match(offers, /offer\.claimed === null && !offer\.taken\.length && offer\.options\.length/);
  assert.match(offers, /cancelLabel: t\('reward\.leave\.take'\)/, 'the default (Back) button returns to the door');
  const reward = read('src/ui/screens/reward.js');
  assert.match(reward, /const hasUnclaimedReward = \(\) => plan\.rows\.some\(\(row\) => !states\[row\.key\] && !row\.blockedBy\)/);
  assert.match(reward, /if \(!hasUnclaimedReward\(\)\) return leave\(\);/);
});
