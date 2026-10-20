// Compact card text (reward list, deck editor) reads the profile's Evade stack config.
//   node --test tests/fixcore-compact-evade-text.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { fixCoreRules } from '../src/model/fixCoreMechanics.js';
import { cardPlainText } from '../src/ui/components/card.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const bind = p => bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, p)), p);

test('compact Evade text follows a profile evadeStackBase/evadeStackDex override', () => {
  const reg = bind(profile);
  const base = cardPlainText(reg, { cardId: 'core.evade' });
  const over = Object.create(reg, { gameProfile: { value: null, writable: true } });
  over.gameProfile = { ...profile, fixCoreRules: (r => ({ ...r, accuracy: { ...r.accuracy, evadeStackBase: 5, evadeStackDex: 0 } }))(structuredClone(fixCoreRules({ combatExpansionVersion: 2 }))) };
  const text = cardPlainText(over, { cardId: 'core.evade' });
  assert.match(text, /\b5\b/);
  assert.notEqual(text, base);
});

test('a run snapshot (opts.rules.gameProfile) wins over the current registries profile for Evade text and the Entry line', () => {
  const reg = bind(profile);
  const snapshot = { ...profile, fixCoreRules: (r => ({ ...r, accuracy: { ...r.accuracy, evadeStackBase: 5, evadeStackDex: 0 } }))(structuredClone(fixCoreRules({ combatExpansionVersion: 2 }))) };
  const rules = { combatExpansionVersion: 2, gameProfile: snapshot };
  const current = cardPlainText(reg, { cardId: 'core.evade' }, { rules: { combatExpansionVersion: 2, gameProfile: profile } });
  const text = cardPlainText(reg, { cardId: 'core.evade' }, { rules });
  assert.match(text, /\b5\b/, text);
  assert.notEqual(text, current, 'the registries default profile is not what is shown');
  // Entry Precision follows the run's profile, not the registries' current one.
  assert.match(cardPlainText(reg, { cardId: 'core.strike' }, { rules: { combatExpansionVersion: 2, gameProfile: profile } }), /Entry: \+1 \+ stat mix Precision/);
});
