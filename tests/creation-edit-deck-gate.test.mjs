// Core 2 creation review: "Edit deck" follows the Armory's deck-editor gate (profile editor + the deck-editing setting).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { armouryOpensDeckEditor } from '../src/model/armouryRules.js';
import { legacyCoreProfile, legacyCoreRegistries } from './helpers/legacy-core-profile.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

test('the shipped Core (deck edited at rest sites) opens no Armoury or creation deck door', () => {
  const preview = createRunState({ seed: 0, classId: 'reaver', registries, gameProfile: profile });
  assert.equal(armouryOpensDeckEditor(preview, { deckEditing: true }), false);
});

test('the gate the review asks (the preview run + the settings) is off with deck editing off and on with it on (pre-rest Core)', () => {
  const legacy = legacyCoreProfile();
  const preview = createRunState({ seed: 0, classId: 'reaver', registries: legacyCoreRegistries(legacy), gameProfile: legacy });
  assert.equal(armouryOpensDeckEditor(preview, { deckEditing: false }), false);
  assert.equal(armouryOpensDeckEditor(preview, { deckEditing: true }), true);
});

test('the review shows Edit deck only through that gate', () => {
  const src = readFileSync(new URL('../src/ui/screens/customize.js', import.meta.url), 'utf8');
  assert.match(src, /if \(!armouryOpensDeckEditor\(previewRun\(\), meta\.settings \|\| \{\}\)\) return null;/);
  assert.match(src, /\}\)\.filter\(Boolean\)\);/);
});
