import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT_TOOLS_HEIGHT_PX, handLayout } from '../src/ui/models/HandLayout.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

// Desktop (data-form-factor="desktop") plan, mirroring hand.js: the band is
// `bandPx` physical px tall and the tool row (30px, plus its 4px separation)
// sits at its top. The plan's origin is below that separation.
const TOOLS_ROW_PX = 30;
const desktop = ({ width = 1440, zoom = 1.2, bandPx = 342, count = 4, controlsHeight = 0 } = {}) => {
  const toolsLocal = COMBAT_TOOLS_HEIGHT_PX / zoom;
  return {
    zoom, bandPx, count, controlsHeight, toolsLocal,
    // rem as hand.js derives it: the 16px authored rem, or the page's 10px root when larger.
    plan: handLayout({ width: width / zoom, height: bandPx / zoom - toolsLocal, count, rem: Math.max(16 / zoom, 10), zoom,
      controlsHeight, headroom: toolsLocal, desktop: true }),
  };
};

// Each resting card's rotated top edge, in plan px, from its authored slot.
const restTops = plan => plan.cards.map(card => {
  const radians = card.angle * Math.PI / 180;
  return plan.top + card.y + plan.cardHeight / 2 - (Math.abs(Math.sin(radians)) * plan.cardWidth
    + Math.abs(Math.cos(radians)) * plan.cardHeight) / 2;
});

test('desktop fan top sits within 12px under the tool row at each desktop band', () => {
  for (const [width, zoom, bandPx] of [[1280, .99, 274], [1440, 1.2, 342], [1920, 1.48, 411]]) for (const count of [3, 4, 5, 7]) {
    const { plan, zoom: z } = desktop({ width, zoom, bandPx, count });
    const gapPx = COMBAT_TOOLS_HEIGHT_PX + Math.min(...restTops(plan)) * z - TOOLS_ROW_PX;
    assert.ok(gapPx > 0 && gapPx <= 12 + 1e-9, `${width} ${count} cards: fan top ${gapPx}px under the tool row`);
  }
});

test('desktop selected card and its Upcast chooser stay inside the band', () => {
  for (const [width, zoom, bandPx] of [[1280, .99, 274], [1440, 1.2, 342], [1920, 1.48, 411]]) for (const controlsPx of [44, 52, 64]) {
    const controlsHeight = controlsPx / zoom;
    const { plan, toolsLocal } = desktop({ width, zoom, bandPx, count: 4, controlsHeight });
    const height = bandPx / zoom - toolsLocal;
    for (const slot of plan.cards) {
      // The chooser's correction may raise the face to the hand's top edge,
      // which is the tool row's headroom above the plan origin.
      const selectedTop = -toolsLocal;
      assert.ok(plan.top + slot.y - plan.lift >= selectedTop - 1e-9, `${width}: lifted face stays under the hand's top edge`);
      assert.ok(selectedTop + plan.cardHeight + controlsHeight <= height + 1e-9,
        `${width} ${controlsPx}px chooser: selected face and chooser clear the footer`);
    }
  }
});

test('desktop fan is unchanged when no desktop flag is given', () => {
  const input = { width: 1440 / 1.2, height: (342 - 34) / 1.2, count: 4, rem: 16, zoom: 1.2, controlsHeight: 40 };
  assert.deepEqual(handLayout({ ...input, headroom: 34 / 1.2 }, wireframeUi.hand), handLayout({ ...input, headroom: 34 / 1.2, desktop: false }));
});

// Each resting card's rotated bottom edge, in plan px.
const restBottoms = plan => plan.cards.map(card => {
  const radians = card.angle * Math.PI / 180;
  return plan.top + card.y + plan.cardHeight / 2 + (Math.abs(Math.sin(radians)) * plan.cardWidth
    + Math.abs(Math.cos(radians)) * plan.cardHeight) / 2;
});

test('desktop cards fill the band down to the chooser reserve, within 20px', () => {
  // 1920 fills too: its desktop cap (desktopMaxWidthRem) lets the face grow.
  for (const [width, zoom, bandPx] of [[1280, .99, 274], [1440, 1.2, 342], [1920, 1.48, 411]]) for (const count of [3, 4, 5, 7])
    for (const controlsPx of [44, 52]) {
      const { plan, toolsLocal, zoom: z } = desktop({ width, zoom, bandPx, count, controlsHeight: controlsPx / zoom });
      const height = bandPx / zoom - toolsLocal;
      // Empty space under the lowest resting corner, including the chooser's reserve.
      const emptyBelowPx = (height - Math.max(...restBottoms(plan))) * z;
      assert.ok(emptyBelowPx >= -1e-6 && emptyBelowPx <= 20, `${width} ${count} cards, ${controlsPx}px chooser: ${emptyBelowPx}px below`);
    }
});

test('desktop 3, 4 and 5 card rows are a tight, centred, non-overlapping row', () => {
  for (const [width, zoom, bandPx] of [[1280, .99, 274], [1440, 1.2, 342], [1920, 1.48, 411]]) for (const count of [3, 4, 5]) {
    const { plan, zoom: z } = desktop({ width, zoom, bandPx, count });
    const gaps = plan.cards.slice(1).map((card, index) => card.x - plan.cards[index].x - plan.cardWidth);
    for (const gap of gaps) {
      assert.ok(gap >= -1e-9, `${width} ${count} cards overlap by ${gap}`);
      assert.ok(gap <= 0.08 * plan.cardWidth + 1e-9, `${width} ${count} cards gap ${gap} exceeds 8% of ${plan.cardWidth}`);
      assert.ok(Math.abs(gap - 0.07 * plan.cardWidth) < 1e-6, `${width} ${count} cards gap ${gap} is not the 7% gap`);
    }
    const left = plan.cards[0].x * z;
    const right = (width - (plan.cards.at(-1).x + plan.cardWidth) * z);
    assert.ok(Math.abs(left - right) < 1e-6, `${width} ${count} cards off centre: ${left} vs ${right}`);
  }
});

test('a seven-card desktop hand still fits the width', () => {
  for (const [width, zoom, bandPx] of [[1280, .99, 274], [1440, 1.2, 342], [1920, 1.48, 411]]) {
    const { plan, zoom: z } = desktop({ width, zoom, bandPx, count: 7 });
    assert.equal(plan.cards.length, 7);
    assert.ok(plan.cards[0].x * z >= 0, `${width}: left edge inside`);
    assert.ok((plan.cards.at(-1).x + plan.cardWidth - plan.cards[0].x) * z <= width * 0.9 + 1e-6, `${width}: row spans more than 90%`);
    assert.ok((plan.cards.at(-1).x + plan.cardWidth) * z <= width + 1e-6, `${width}: right edge inside`);
  }
});
