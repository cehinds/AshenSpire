// Weakness chips (owner, 2026-11-01; SPEC 5.3): an icon per trigger, a tooltip, and discovery gating.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { WEAKNESS_ICON, weaknessIconId } from '../src/model/weaknessIcons.js';
import { WEAKNESS_HIT_TRIGGERS, WEAKNESS_STATUSES } from '../src/model/enemyWeaknessRules.js';
import { hasTagSymbol } from '../src/ui/components/cardTagSymbols.js';

test('every weakness trigger and every authored weakness has a real icon, never a letter', () => {
  const triggers = new Set([...WEAKNESS_HIT_TRIGGERS, ...WEAKNESS_STATUSES]);
  for (const def of contentBundle.enemies) for (const row of def.weaknesses || []) triggers.add(row.to);
  assert.ok(triggers.size >= 15);
  for (const to of triggers) {
    assert.ok(weaknessIconId(to), `${to} has an icon id`);
    assert.ok(hasTagSymbol(weaknessIconId(to)), `${to} icon ${weaknessIconId(to)} resolves to a mark`);
  }
  assert.deepEqual([...triggers].filter(to => !Object.hasOwn(WEAKNESS_ICON, to)), []);
});

import { withKitDom } from './helpers/kit-dom.mjs';
import { weaknessChips, weaknessChipText } from '../src/ui/components/weaknessChips.js';

test('a chip is a labelled square icon with the badge tooltip attached', () => {
  withKitDom(() => {
    const [chip] = weaknessChips([{ to: 'piercing', effect: 'damage' }]);
    assert.equal(chip.getAttribute('aria-label'), 'Weak to Piercing: +25% damage');
    assert.equal(chip.dataset.weakness, 'piercing');
    assert.equal(chip.dataset.tipAttached, 'true', 'the shared tooltip is attached');
    assert.equal(chip.querySelectorAll('svg').length, 1, 'one real icon, no letter');
    assert.equal(chip.textContent, '');
    assert.equal(weaknessChipText({ to: 'burn', effect: 'tick' }).full, 'Weak to Burn: ticks harder');
  });
});
