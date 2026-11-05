import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Owner 2026-11-05: card tooltips open only in the card inspect modal. Outside it the
// triggers are decoration: no pointer events (a tap lands on the card), and the
// tooltip service already holds them back and out of the tab order (see
// tooltip-hand-keyword-gate.test.mjs). This pins the stylesheet half.
const cards = readFileSync(new URL('../styles/illustrated-cards.css', import.meta.url), 'utf8');
const kit = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');
const rule = (css, selector) => {
  const at = css.indexOf(selector + ' {');
  assert.notEqual(at, -1, 'missing rule: ' + selector);
  return css.slice(at, css.indexOf('}', at));
};

test('a card tag symbol takes no pointer outside the inspector', () => {
  assert.match(rule(cards, ':root .card-tag-symbol'), /pointer-events:\s*none/);
});

test('a card tag symbol takes a pointer again inside the inspector', () => {
  assert.match(rule(cards, ':root :is(.card-inspection-modal, .card-inspection-layout) .card-tag-symbol'), /pointer-events:\s*auto/);
});

test('a keyword on a card face is inert outside the inspector and live inside it', () => {
  assert.match(rule(kit, '.card .tooltip-keyword'), /pointer-events:\s*none/);
  assert.match(rule(kit, ':is(.card-inspection-modal, .card-inspection-layout) .card .tooltip-keyword'), /pointer-events:\s*auto/);
});

test('no stylesheet re-enables pointer events on a tag symbol outside the inspector', () => {
  for (const [name, css] of [['illustrated-cards.css', cards], ['kit.css', kit]]) {
    for (const m of css.matchAll(/([^{}]*\.card-tag-symbol[^{}]*)\{[^}]*pointer-events:\s*auto/g)) {
      assert.match(m[1], /card-inspection/, name + ': ' + m[1].trim());
    }
  }
});
