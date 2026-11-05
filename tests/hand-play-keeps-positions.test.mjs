// Owner 2026-11-05: "When playing cards, try not to move hand position too much so players can easily play multiple
// cards." Plan the hand as hand.js does (responsiveHandLayout over handLayout) before and after one card is played,
// and read how far each remaining card's x moved. The bound is HAND_PLAY_SETTLE.maxShiftPx (2 px): below a pixel of
// rounding and a twentieth of the 44 px exposed touch target, so the next card is still under the finger. Without the
// hold the centred fan slides by half a step or more (the unheld rows below are asserted to exceed it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { handLayout, responsiveHandLayout, holdPlaySlots, HAND_PLAY_SETTLE } from '../src/ui/models/HandLayout.js';

const VIEWPORTS = [
  { name: '390x844', input: { width: 390, height: 234, rem: 16, zoom: 1, compact: true, controlsHeight: 0, controlled: [], headroom: 0, formFactor: 'mobile' } },
  { name: '1280x800', input: { width: 1280, height: 300, rem: 16, zoom: 1, compact: false, controlsHeight: 0, controlled: [], headroom: 0, formFactor: 'desktop' } },
];
const planFor = (input, count) => responsiveHandLayout({ ...input, count }, handLayout({ ...input, count }));
const idsOf = n => Array.from({ length: n }, (_, i) => 'c' + i);

test('the settle bound is authored and small', () => {
  assert.ok(HAND_PLAY_SETTLE.maxShiftPx > 0 && HAND_PLAY_SETTLE.maxShiftPx <= 2);
  assert.ok(HAND_PLAY_SETTLE.holdMs > 0);
});

for (const { name, input } of VIEWPORTS) {
  test(`${name}: playing any card moves no other card more than the bound, play after play`, () => {
    const key = 'k';
    for (const count of [5, 7, 10]) for (let played = 0; played < count; played++) {
      let ids = idsOf(count), previous = { ids, key, plan: planFor(input, count) };
      const xs = new Map(ids.map((id, i) => [id, previous.plan.cards[i].x]));
      // The first play, then a second and third on whatever is left (the hand held its slots between them).
      for (let play = 0; play < 3 && ids.length > 1; play++) {
        const gone = play === 0 ? played : Math.min(play, ids.length - 1);
        ids = ids.filter((_, i) => i !== gone);
        const fresh = planFor(input, ids.length);
        const held = holdPlaySlots(previous, ids, fresh, key);
        assert.ok(held, `${count} cards, play ${play + 1}: the plan is held`);
        held.cards.forEach((slot, i) => {
          assert.ok(Math.abs(slot.x - xs.get(ids[i])) <= HAND_PLAY_SETTLE.maxShiftPx, `${ids[i]} moved ${slot.x - xs.get(ids[i])}px`);
        });
        previous = { ids, key, plan: held };
      }
    }
  });

  test(`${name}: the unheld centred fan moves cards more than the bound (the bug this holds against)`, () => {
    const before = planFor(input, 5), after = planFor(input, 4);
    const moved = Math.max(...after.cards.map((slot, i) => Math.abs(slot.x - before.cards[i + (i >= 2 ? 1 : 0)].x)));
    assert.ok(moved > HAND_PLAY_SETTLE.maxShiftPx * 2, `unheld max shift ${moved.toFixed(1)}px`);
  });

  test(`${name}: a draw, a reorder or a resize lays out fresh, and the settled hand is the fresh plan`, () => {
    const ids = idsOf(5), previous = { ids, key: 'k', plan: planFor(input, 5) };
    assert.equal(holdPlaySlots(previous, [...ids, 'new'], planFor(input, 6), 'k'), null, 'a draw');
    assert.equal(holdPlaySlots(previous, ['c1', 'c0', 'c2', 'c3'], planFor(input, 4), 'k'), null, 'a reorder');
    assert.equal(holdPlaySlots(previous, ids.slice(1), planFor(input, 4), 'other'), null, 'a resize');
    assert.equal(holdPlaySlots(previous, ids.slice(1), planFor(input, 4), 'k') !== null, true);
    assert.equal(holdPlaySlots(previous, [], planFor(input, 0), 'k'), null, 'an empty hand');
  });
}

for (const { name, input } of VIEWPORTS) {
  test(`${name}: a held hand's hit lanes run to the next survivor, never overlap; fresh layouts keep step`, () => {
    const key = 'k', ids5 = idsOf(5), previous = { ids: ids5, key, plan: planFor(input, 5) };
    const ids = ids5.filter((_, i) => i !== 2), held = holdPlaySlots(previous, ids, planFor(input, 4), key);
    assert.ok(held && held.hitWidths, 'held plan carries hit widths');
    const w = held.cardWidth;
    held.cards.forEach((card, i) => {
      const expected = i === ids.length - 1 ? w : Math.min(w, held.cards[i + 1].x - card.x);
      assert.ok(Math.abs(held.hitWidths[i] - expected) < 1e-9, `card ${i} hit ${held.hitWidths[i]} vs ${expected}`);
      if (i < ids.length - 1) assert.ok(card.x + held.hitWidths[i] <= held.cards[i + 1].x + 1e-9, `lane ${i} overlaps`);
    });
    const left = held.hitWidths[1], gap = held.cards[2].x - held.cards[1].x;
    assert.equal(left, Math.min(w, gap));
    assert.ok(left > previous.plan.step, 'card left of the gap is clickable past one step');
    assert.equal(planFor(input, 4).hitWidths, undefined, 'fresh layouts carry no hit widths (hand.js uses step)');
  });
}
