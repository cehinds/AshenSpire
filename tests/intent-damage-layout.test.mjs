// Owner 2026-10-18: an enemy's intent amount sits LEFT of its maneuver icon, on the icon's row, at about 2x the old
// size (11px to the 22px titleM step); the hit-% badge is white with a black outline and never takes a tap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withKitDom } from './helpers/kit-dom.mjs';
import { intentParts } from '../src/ui/components/combatantOverhead.js';

const css = (file) => readFileSync(new URL(`../styles/${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (text, selector) => {
  const at = text.indexOf(selector + ' {'); assert.ok(at >= 0, `${selector} rule exists`);
  return text.slice(at, text.indexOf('}', at));
};

test('each action lists its amount before its icon, so a row layout puts the amount on the left', () => {
  withKitDom(() => {
    const row = intentParts([{ icon: 'attack', value: '0–8' }, { icon: 'defend', value: '5' }]);
    const actions = row.querySelectorAll('.intent-action');
    assert.equal(actions.length, 2);
    for (const action of actions) {
      const kinds = action.children.map((node) => node.className.baseVal ?? node.className);
      assert.match(kinds[0], /intent-action-value/, 'the amount comes first');
      assert.match(kinds[1], /intent-icon/, 'the icon follows');
    }
  });
});

test('the action is a centred row and the amount is the 22px title step, in solo and co-op alike', () => {
  const text = css('combat-target-responsive.css');
  const action = rule(text, ":root .combat .intent .intent-action");
  assert.match(action, /flex-direction:\s*row/);
  assert.match(action, /align-items:\s*center/);
  assert.doesNotMatch(action, /flex-direction:\s*column/);
  assert.match(text, /--intent-value-size:\s*calc\(22px \/ var\(--ui-zoom,1\)\)/, '2x the old 11px');
  assert.match(rule(text, ":root .combat .intent .intent-action-value"), /font:\s*700 var\(--intent-value-size\)/);
  // The old stacked, 11px target-HUD rules are gone: nothing re-stacks the amount above the icon.
  assert.doesNotMatch(text, /\[data-target-hud='true'\] \.intent-action \{[^}]*column/);
  assert.doesNotMatch(text, /\.intent-action-value \{[^}]*11px/);
});

test('the hit-% badge is white, black-outlined, centred on the body and untouchable', () => {
  const badge = rule(css('kit.css'), ':root .combat .combatant > .combat-hit-chance');
  assert.match(badge, /pointer-events:\s*none/);
  assert.match(badge, /color:\s*white/);
  assert.match(badge, /text-shadow:[^;]*black/);
  assert.match(badge, /left:\s*var\(--combat-body-center-x/);
  assert.match(badge, /top:\s*var\(--combat-body-center-y/);
  assert.match(badge, /translate:\s*-50% -50%/);
  assert.match(badge, /z-index:\s*var\(--combat-layer-hud/);
  assert.doesNotMatch(css('kit.css'), /\.combat-hit-chance\[data-roll-mode='(advantage|disadvantage)'\]/, 'the on-sprite badge is white in every roll mode');
});


// Selector contract only: Chromium QA still checks the full cascade and measured bounds.
test('compact intent rules preserve planned follow-ups while still hiding verbose siblings', () => {
  withKitDom(({ document }) => {
    const compact = document.createElement('span'); compact.className = 'intent-compact';
    const followups = document.createElement('span'); followups.className = 'cr-followups';
    const verbose = document.createElement('span'); verbose.className = 'intent-values';
    for (const file of ['combat-layers.css', 'combat.css', 'combat-target-responsive.css']) {
      const hiding = [...css(file).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter(([, selector, declarations]) => selector.includes('.intent > :not(') && /display:\s*none/.test(declarations));
      assert.ok(hiding.length, `${file} still owns its compact intent presentation`);
      for (const [, selector] of hiding) {
        const child = selector.slice(selector.lastIndexOf('>') + 1).trim();
        assert.equal(compact.matches(child), false, `${file}: primary action remains visible`);
        assert.equal(followups.matches(child), false, `${file}: appended planned actions remain visible`);
        assert.equal(verbose.matches(child), true, `${file}: expanded detail remains hidden in compact mode`);
        assert.equal(followups.matches(child.replace(':not(.cr-followups)', '')), true,
          `${file}: the former hiding selector reproduces the regression on the real child class`);
      }
    }
  });
});
