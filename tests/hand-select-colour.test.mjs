// Owner 2026-10-31: a combat hand card never wears the yellow select state, only the targeting colour
// (--selection-color). Hold-start, keyboard focus, the (i) button and a second press all add
// `.inspection-selected`; it must glow exactly like `.selected`. This reads the stylesheets as text
// (no browser): every rule that targets a hand card in a selected, inspected, held or focused state must
// be coloured by the selection token, and gold stays on every other card surface.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../styles/${name}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rulesOf = css => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({ selector: match[1].trim(), body: match[2] }));
const GOLD = /#c9a227|#c49b56|#d0ac5d|#f2d87e|var\(--gold\)/i;
const kit = rulesOf(read('kit.css')), cards = rulesOf(read('illustrated-cards.css')), combat = rulesOf(read('combat.css'));
const handStateRules = rules => rules.filter(rule => /\.hand\b/.test(rule.selector) && /\.card\b/.test(rule.selector)
  && /\.(?:selected|inspection-selected)\b|:focus-visible|:hover/.test(rule.selector));

test('hand-card selected, inspected and focused states carry no gold colour', () => {
  const overrides = [...handStateRules(kit), ...handStateRules(cards)]
    .filter(rule => /^:root(?:\[[^\]]*\])? \.hand \.card/.test(rule.selector));
  assert.ok(overrides.length >= 6, 'the hand-state overrides exist');
  for (const rule of overrides) {
    for (const [, property, value] of rule.body.matchAll(/([\w-]+)\s*:\s*([^;]+);?/g)) {
      if (!/^(?:border-color|box-shadow|filter|outline|outline-color|--selection-glow|--focus-ring)$/.test(property)) continue;
      assert.doesNotMatch(value, GOLD, `${rule.selector} { ${property}: ${value} }`);
    }
  }
});

test('an inspection-selected hand card wears the same glow, border and ring as a selected one', () => {
  const glow = kit.find(rule => /\.hand \.card:is\(\.selected, \.inspection-selected\)/.test(rule.selector));
  assert.ok(glow, 'selected and inspection-selected share one glow rule');
  assert.match(glow.body, /--selection-glow:\s*drop-shadow\(0 0 6px var\(--selection-color/);
  assert.ok(kit.some(rule => /\.hand \.card\.inspection-selected$/.test(rule.selector) && /border-color:\s*var\(--selection-color/.test(rule.body)));
  assert.ok(kit.some(rule => /\.hand \.card\.playing-poker-card:is\(\.selected, \.inspection-selected, :focus-visible\)/.test(rule.selector)
    && /box-shadow:\s*0 0 0 2px var\(--selection-color/.test(rule.body)), 'the poker-card gold ring is replaced on a hand card');
  assert.ok(kit.some(rule => /^:root \.hand \.card$/.test(rule.selector) && /--focus-ring:[^;]*var\(--selection-color/.test(rule.body)), 'keyboard focus ring');
  assert.ok(cards.some(rule => /\.hand \.card\.illustrated-card:is\(\.selected,\.inspection-selected\) \.illustrated-card-face/.test(rule.selector)
    && /var\(--selection-color/.test(rule.body)), 'the face glow');
});

test('gold remains on non-hand card surfaces', () => {
  const gold = cards.find(rule => /^:root \.card\.illustrated-card:is\(:hover,:focus-visible,\.selected\) \.illustrated-card-face$/.test(rule.selector));
  assert.match(gold?.body || '', /#c49b56/, 'the shared gold lift still serves the deck editor and rewards');
  assert.ok(combat.length > 0);
});

test('combat clears an inspection mark that is not the armed card', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(source, /querySelectorAll\('\.hand \.inspection-selected'\)\.forEach\(card => \{\s*if \(active && card\.dataset\.instanceId === active\) return;/);
});
