import test from 'node:test';
import assert from 'node:assert/strict';
import { fitRulesToBox } from '../src/ui/components/illustratedCardFitter.js';

// A fake rules row: height follows font size and line height, like a wrapped paragraph of `lines` lines.
function row({ lines, font = 8, boxHeight, lineHeight = 1.05 }) {
  const text = { style: { fontSize: font + 'px', lineHeight: String(lineHeight) }, clientWidth: 100, scrollWidth: 100,
    get scrollHeight() { return lines * parseFloat(this.style.fontSize) * parseFloat(this.style.lineHeight); } };
  return { text, boxHeight, lineHeight };
}

test('a row that already fits is left alone', () => {
  const r = row({ lines: 3, boxHeight: 40 });
  assert.deepEqual(fitRulesToBox([r]), []);
  assert.equal(r.text.style.lineHeight, '1.05');
  assert.equal(r.text.style.textOverflow, undefined);
});

test('a row slightly too tall gets a tighter line height and no clipping', () => {
  const r = row({ lines: 3, boxHeight: 23.5 });   // 3 * 8 * 1.05 = 25.2 > 23.5; at 0.97 it is 23.3
  assert.deepEqual(fitRulesToBox([r]), []);
  assert.ok(parseFloat(r.text.style.lineHeight) < 1.05 && parseFloat(r.text.style.lineHeight) >= 0.92);
  assert.ok(r.text.scrollHeight <= r.boxHeight + 1);
});

test('a row that cannot fit at the line-height floor is clamped with an ellipsis to the lines the box holds', () => {
  const r = row({ lines: 6, boxHeight: 20 });
  assert.deepEqual(fitRulesToBox([r]), [r]);
  assert.equal(parseFloat(r.text.style.lineHeight), 0.92);
  assert.equal(r.text.style.textOverflow, 'ellipsis');
  assert.equal(r.text.style.webkitLineClamp, String(Math.floor(20 / (8 * 0.92))));
  assert.equal(r.clipped, true);
});

import { panelInterior } from '../src/ui/components/illustratedCard.js';
import { CARD_COMPONENTS } from '../src/content/cardComponents.generated.js';
import { uiConfig } from '../src/config/generated/ui.js';

test('the grown parchment keeps its original top/bottom frame thickness in design px', () => {
  const panel = CARD_COMPONENTS.template.layers.find(l => l.id === 'panel');
  const original = panel.h * 0.12;                                   // 17.64 design px
  const configured = uiConfig.components.card.components.rulesFace.rulesBoxGrow;
  for (const grow of [0, configured, 0.3]) {
    const newH = panel.h * (1 + grow), k = panel.h / newH;
    const [top, , bottom] = panelInterior(k).split(',').map(pt => pt.trim().split(' ')[1]).map(parseFloat);
    assert.ok(Math.abs(top / 100 * newH - original) < 0.1, `top band at grow ${grow}`);
    assert.ok(Math.abs((100 - bottom) / 100 * newH - original) < 0.1, `bottom band at grow ${grow}`);
  }
});
