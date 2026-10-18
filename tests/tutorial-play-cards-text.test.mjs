// The first-combat "Play cards" callout must match the active oneTapPlay
// setting (owner ruling, 2026-10-18): tap-to-play wording when on, the
// select-then-target wording when off. Both strings live in uiStrings.csv.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { t } from '../src/ui/strings.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('both Play cards strings are authored rows', () => {
  assert.match(t('tutorial.playCards.tap'), /^Tap a card to play it; with several enemies, tap the one to hit\./);
  assert.match(t('tutorial.playCards.select'), /^Click a card or press 1–9\. Attacks need a target/);
});

test('the callout picks its string from the setting combat.js passes', () => {
  const tutorial = read('../src/ui/components/tutorial.js');
  assert.match(tutorial, /text: \(\{ oneTapPlay \}\) => t\(oneTapPlay \? 'tutorial\.playCards\.tap' : 'tutorial\.playCards\.select'\)/);
  assert.match(tutorial, /step\.text\(\{ oneTapPlay \}\)/);
  assert.match(read('../src/ui/screens/combat.js'), /mountTutorial\(app, \{[^}]*oneTapPlay: \(meta\.settings \|\| \{\}\)\.oneTapPlay === true/);
});
