// tests/card-shelf.test.mjs — A SHELF OF RESTING CARDS HOLDS FOUR, AND SAYS SO.
//
// THE COMPLAINT THIS ANSWERS, in the owner's words (2026-09-20, with a
// photograph of the merchant at 1328x744): "why do these cards have background
// containers and why aren't they in glance view so that I can see four cards
// at a time without scrolling?"
//
// Both halves were true and neither was a card-renderer bug. The cards WERE at
// the glance width; what stood around them was a 280px OptionCard — the FOCUS
// width — and what laid them out was `repeat(auto-fill, minmax(0, 280px))`. In
// a 631px offers column that is two tracks, so a three-armament shelf wrapped
// to two rows and the third went behind a scroll, each card sitting in 128px
// of empty panel. Five shop shelves, five different layout rules, and not one
// number anywhere that said how many cards a row is meant to hold.
//
// So there is a number now, authored once at
// `content/config/ui/components/card.json -> sizing.shelf`, and this file asks
// it the questions that a stylesheet cannot be asked from Node:
//
//   A  THE COUNT IS THE CSS'S COUNT. `.card-shelf` is a wrapping flex row
//      whose items take `flex-basis: max(floor, track)`; the browser fits
//      `floor((W + gap) / (basis + gap))` per row. `cardShelfColumnsAt` is
//      that arithmetic, so the model and the stylesheet cannot drift into two
//      answers about the same shelf. Measured against the real thing in
//      headless Chromium (see the PR body); reproduced here so a change to the
//      numbers is caught in a millisecond rather than in a screenshot.
//
//   B  THE FLOOR IS A FLOOR, NOT A SIZE. Below the width four cards need, the
//      shelf drops a column — it never shaves cards to fit, because cards you
//      cannot read are the complaint, not the fix. Above it, the track is used
//      in full up to the resting width and never past it.
//
//   C  THE FLOOR CANNOT STAND ABOVE THE CARD IT FLOORS. The resting width is
//      tunable at runtime and is the phone's own variant below the compact
//      threshold; either can take it under the authored floor, and a floor
//      above the card would stretch every shelf item past its own face — the
//      empty-panel defect, restated as a number.
//
//   D  THE MERCHANT'S OFFERS COLUMN ASKS FOR A SHELF, NOT A FRACTION. Half the
//      pane was 490px at the photographed shape and a shelf of four resting
//      cards needs 644. The fraction is a floor now, and the detail column's
//      own authored minimum is the bound.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cardShelf, cardShelfWidthPx, cardShelfColumnsAt, cardShelfTrackPx, cardShelfCssProperties,
} from '../src/ui/models/CardSizeModel.js';
import { shopOffersWidthPx, shopWorkspaceLayout } from '../src/ui/models/ShopWorkspaceModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';
import { uiConfig } from '../src/config/generated/ui.js';

const SIZING = uiConfig.components.card.sizing;
const table = (over) => ({ ...SIZING, shelf: { ...SIZING.shelf, ...over } });

test('the authored shelf is three checked numbers, and a bad one is a loud boot', () => {
  const shelf = cardShelf();
  assert.equal(shelf.maxColumns, 4, 'the owner asked for four cards at a time');
  assert.ok(shelf.gapPx >= 0 && shelf.minTrackPx > 0);
  assert.equal(shelf.restingPx, SIZING.levels.glance.widthPx);
  assert.throws(() => cardShelf(table({ maxColumns: 2.5 })), /maxColumns/);
  assert.throws(() => cardShelf(table({ maxColumns: 0 })), /maxColumns/);
  assert.throws(() => cardShelf(table({ gapPx: -1 })), /gapPx/);
  assert.throws(() => cardShelf(table({ minTrackPx: 0 })), /minTrackPx/);
  // C, at boot: a floor above the resting width is refused by name rather than
  // clamped, so the mistake is visible where it was made.
  assert.throws(() => cardShelf(table({ minTrackPx: SIZING.levels.glance.widthPx + 1 })), /must not exceed the resting width/);
  // Equal is allowed: a shelf whose floor IS the resting width never shrinks a
  // card, it only ever holds fewer.
  assert.doesNotThrow(() => cardShelf(table({ minTrackPx: SIZING.levels.glance.widthPx })));
});

test('A — the column count is `floor((W + gap) / (basis + gap))`, capped at the authored maximum', () => {
  const { maxColumns, gapPx, minTrackPx } = cardShelf();
  // The CSS's own arithmetic, written out rather than borrowed from the model.
  const asCss = (width) => {
    const track = (width - (maxColumns - 1) * gapPx) / maxColumns;
    const basis = Math.max(minTrackPx, track);
    return Math.max(1, Math.min(maxColumns, Math.floor((width + gapPx) / (basis + gapPx))));
  };
  for (let width = 60; width <= 2000; width += 1) {
    assert.equal(cardShelfColumnsAt(width), asCss(width), `width ${width}`);
  }
  // The shape the owner photographed: a 631px offers column, four across.
  assert.equal(cardShelfColumnsAt(631), 4);
  // And the width at which the fourth column arrives, stated as the model's
  // own sum rather than as a literal.
  const fourNeed = cardShelfWidthPx(maxColumns, minTrackPx);
  assert.equal(cardShelfColumnsAt(fourNeed), maxColumns);
  assert.equal(cardShelfColumnsAt(fourNeed - 1), maxColumns - 1);
  // Never more than the authored maximum, however wide the shelf.
  assert.equal(cardShelfColumnsAt(10000), maxColumns);
  // Never less than one, whatever nonsense arrives.
  for (const bad of [0, -20, NaN, undefined, null]) assert.equal(cardShelfColumnsAt(bad), 1);
});

test('B — the track is floored at the legible width and capped at the resting one', () => {
  const { maxColumns, gapPx, minTrackPx, restingPx } = cardShelf();
  // Wide enough for four at rest: each card is drawn at its resting width, not
  // stretched across the slack.
  assert.equal(cardShelfTrackPx(cardShelfWidthPx(maxColumns, restingPx) + 400), restingPx);
  // Exactly enough for four at rest: exactly the resting width.
  assert.equal(cardShelfTrackPx(cardShelfWidthPx(maxColumns, restingPx)), restingPx);
  // Exactly enough for four at the floor: the floor, and still four.
  const tight = cardShelfWidthPx(maxColumns, minTrackPx);
  assert.equal(cardShelfColumnsAt(tight), maxColumns);
  assert.equal(cardShelfTrackPx(tight), minTrackPx);
  // One pixel under: a column is dropped and the cards get WIDER, not thinner.
  assert.equal(cardShelfColumnsAt(tight - 1), maxColumns - 1);
  assert.ok(cardShelfTrackPx(tight - 1) > minTrackPx);
  // At every width the track stays inside its two bounds and the row fits.
  for (let width = 60; width <= 2000; width += 1) {
    const track = cardShelfTrackPx(width);
    assert.ok(track >= Math.min(minTrackPx, width) && track <= restingPx, `width ${width} track ${track}`);
    const columns = cardShelfColumnsAt(width);
    assert.ok(cardShelfWidthPx(columns, track) <= Math.max(width, minTrackPx) + 1e-9, `width ${width} overflows`);
    assert.ok(columns >= 1 && columns <= maxColumns);
  }
});

test('C — the projected floor follows the resting width under it', () => {
  const { minTrackPx, gapPx, maxColumns } = cardShelf();
  const authored = cardShelfCssProperties();
  assert.deepEqual({ ...authored }, {
    '--card-shelf-cols': `${maxColumns}`,
    '--card-shelf-gap': `${gapPx}px`,
    '--card-shelf-min': `${minTrackPx}px`,
  });
  // A card tuned (or a phone variant) below the floor takes the floor with it.
  const narrow = minTrackPx - 30;
  assert.equal(cardShelfCssProperties(undefined, narrow)['--card-shelf-min'], `${narrow}px`);
  // A card tuned ABOVE the floor leaves it alone: the floor is a minimum, not
  // a share of the card.
  assert.equal(cardShelfCssProperties(undefined, 400)['--card-shelf-min'], `${minTrackPx}px`);
  // Nonsense falls back to the authored floor rather than projecting NaNpx.
  for (const bad of [0, -5, NaN, null, undefined, 'wide']) {
    assert.equal(cardShelfCssProperties(undefined, bad)['--card-shelf-min'], `${minTrackPx}px`);
  }
});

test('D — the merchant\'s offers column is sized for a shelf, bounded by the detail\'s floor', () => {
  const ui = wireframeUi.shop;
  const { maxColumns, restingPx } = cardShelf();
  const fullShelf = cardShelfWidthPx(maxColumns, restingPx);
  const detailFloor = ui.detailMinRem * 16;

  // A pane with room for both: the offers take a full shelf, the detail keeps
  // everything else — and that is MORE than the authored fraction would give.
  const roomy = fullShelf + detailFloor + 200;
  assert.equal(shopOffersWidthPx(roomy, 16), fullShelf);
  // The same question in the root size the app runs at (`font-size: 62.5%`),
  // where the floor is 220px rather than 352.
  const atTen = fullShelf + ui.detailMinRem * 10 + 200;
  assert.equal(shopOffersWidthPx(atTen, 10), fullShelf);
  assert.ok(fullShelf > roomy * ui.offersFraction);

  // A pane too narrow for both: the detail keeps its floor and the shelf takes
  // the rest — never the whole pane, never past its own full width.
  const tightPane = fullShelf + detailFloor - 120;
  assert.equal(shopOffersWidthPx(tightPane, 16), tightPane - detailFloor);

  // Narrower still: the authored fraction is the floor the offers never go
  // under, and the shelf's own rule drops a column from there.
  const cramped = detailFloor + 40;
  assert.equal(shopOffersWidthPx(cramped, 16), cramped * ui.offersFraction);

  // Very wide: the fraction wins again — asking for more than a full shelf
  // would only stretch the gaps, since no card is drawn above resting width.
  const huge = 4000;
  assert.equal(shopOffersWidthPx(huge, 16), huge * ui.offersFraction);

  // Never more than the pane it is dividing, at any width or root size.
  for (const rem of [12, 16, 20]) {
    for (let pane = 0; pane <= 2400; pane += 7) {
      const offers = shopOffersWidthPx(pane, rem);
      assert.ok(offers >= 0 && offers <= pane + 1e-9, `pane ${pane} rem ${rem} -> ${offers}`);
    }
  }
});

test('D — at the photographed shape the merchant shows four cards, where it showed one', () => {
  // 1328x744, the owner's window, in the numbers the page reports there:
  // `.shop-frame` 1235, `.shop-body` 917, root font-size 10px (the app's own
  // `font-size: 62.5%`). Measured in headless Chromium, not estimated — the
  // rail's track and the pane's inset stand between the frame and the body and
  // are not this model's to restate.
  const ui = wireframeUi.shop;
  const layout = shopWorkspaceLayout({ width: 1235, bodyWidth: 917, bodyHeight: 520, rem: 10 });
  assert.equal(layout.mode, 'wide');
  const columns = 917 - layout.gap;
  const offers = layout.offersFr * columns;
  assert.equal(cardShelfColumnsAt(offers), 4);
  // The old rule: half the columns, in 280px tracks. Two tracks — and the
  // shelf in the photograph held three armaments, so one went below the fold.
  const wasOffers = columns * ui.offersFraction;
  assert.ok(Math.floor((wasOffers + 16) / (280 + 16)) < 4);
  // The fractions still divide one body between two columns, and the detail
  // keeps its floor IN THE ROOT SIZE THE APP ACTUALLY USES. Resolving the
  // floor against a 16px rem while the page runs at 10px was how a 220px
  // minimum became 140 on the way to the screen.
  assert.ok(Math.abs(layout.offersFr + layout.detailFr - 1) < 1e-12);
  assert.ok(layout.detailFr * columns >= ui.detailMinRem * 10 - 1e-9);
});

test('D — the detail floor binds before the shelf does, at every width and root size', () => {
  const ui = wireframeUi.shop;
  for (const rem of [10, 12, 16]) {
    const gap = Math.round(ui.gapRem * rem);
    for (let body = 40; body <= 2400; body += 3) {
      const layout = shopWorkspaceLayout({ width: 4000, bodyWidth: body, bodyHeight: 400, rem });
      const columns = Math.max(0, body - gap);
      if (!(columns > 0)) continue;
      const detail = layout.detailFr * columns;
      const offers = layout.offersFr * columns;
      assert.ok(offers >= 0 && detail >= 0, `body ${body} rem ${rem}`);
      assert.ok(Math.abs(offers + detail - columns) < 1e-9, `body ${body} rem ${rem}`);
      // Either the detail keeps its authored floor, or the offers never took
      // more than the authored share — never both broken at once.
      const floor = ui.detailMinRem * rem;
      assert.ok(detail >= floor - 1e-9 || offers <= columns * ui.offersFraction + 1e-9,
        `body ${body} rem ${rem}: detail ${detail} < floor ${floor} with offers above its share`);
    }
  }
});

test('with nothing measured there is no derivation: the authored fraction stands', () => {
  // A caller that has not measured the body — and the stacked pane, where the
  // fractions are not column tracks at all — keep the number card.json's
  // neighbour authored rather than a number invented from a zero.
  const unmeasured = shopWorkspaceLayout({ width: 1235, bodyHeight: 520, rem: 10 });
  assert.equal(unmeasured.offersFr, wireframeUi.shop.offersFraction);
  const phone = shopWorkspaceLayout({ width: 356, bodyWidth: 340, bodyHeight: 400, rem: 10 });
  assert.equal(phone.pane, 'stacked');
  assert.equal(phone.offersFr, wireframeUi.shop.offersFraction);
  assert.equal(phone.detailFr, 1 - wireframeUi.shop.offersFraction);
});
