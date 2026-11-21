// Core removed spell ranks, so the Upcast button, the after-target rank prompt
// and its setting must stay off: offering them crashed the play.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UPCASTING_ENABLED, UpcastingOffered } from '../src/model/upcasting.js';
import { settingsRowAvailable } from '../src/ui/models/SettingsCapabilitiesModel.js';

const upcastable = { upcast: { baseTier: 1, unlockedTiers: [2, 3], maximumTier: 3 } };

test('upcasting is switched off', () => {
  assert.equal(UPCASTING_ENABLED, false);
  assert.equal(UpcastingOffered(upcastable), false, 'a card with authored upcast tiers offers no Upcast');
  assert.equal(UpcastingOffered(null), false);
});

test('the ask-to-upcast setting is hidden in every profile', () => {
  const row = { key: 'askToUpcastAfterTarget', cat: 'Combat' };
  assert.equal(settingsRowAvailable(row, { foundation: { mode: 'legacy' }, modules: { cards: {} } }), false);
  assert.equal(settingsRowAvailable(row, { foundation: { mode: 'configured' }, modules: { cards: {} } }), false);
});

test('combat screen gates every Upcast entry point and sends no rank', () => {
  const src = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.ok(!/\bupcastOptions\(/.test(src), 'combat.js offers upcast only through UpcastingOffered');
  assert.match(src, /function wireUpcastControl\([^)]*\) \{\n\s*if \(combat\.combatExpansionVersion !== 2 \|\| !UpcastingOffered\(/);
  assert.match(src, /askToUpcastAfterTarget && UpcastingOffered\(definition\)/);
  assert.match(src, /const rank = UPCASTING_ENABLED \? .* : undefined;/);
});
