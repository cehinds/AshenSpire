// Owner screenshots 2026-10-19: a face line ending in a period must not get ", " glued after it ("Poise., Entry: ...").
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { cardPlainText } from '../src/ui/components/card.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { legacyRules } from './legacyHitRules.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const plain = html => html.replace(/<[^>]+>/g, '');
const faceOf = (def, rules = null) => (cardFaceLines(def, null, core, rules) || []).map(line => plain(line.html)).join(' | ');
// A fight created before the 2026-11-14 ruling snapshots rules without `accuracy.hitRoll`: its Entry Precision line still prints.
const oldFight = { fixCoreRules: legacyRules(fixCoreMechanics) };
const rules = { rules: { combatExpansionVersion: 2 } };

test('no Core card face or plain text has a period followed by a comma', () => {
  const cards = core.cards.all();
  assert.ok(cards.length > 20);
  for (const def of cards) {
    assert.doesNotMatch(faceOf(def), /\.,/, `${def.id} face`);
    assert.doesNotMatch(faceOf(def, oldFight), /\.,/, `${def.id} face (hit-roll rules)`);
    assert.doesNotMatch(cardPlainText(core, { cardId: def.id }, rules), /\.,/, `${def.id} plain`);
  }
});

test('Sundering Art reads the Smash rule then the Entry grant with a single comma', () => {
  const face = faceOf(core.cards.get('core.reaverSpecial'), oldFight);
  assert.match(face, /half of it breaks Poise, Entry: /);
  assert.doesNotMatch(face, /Poise\.,/);
  assert.doesNotMatch(faceOf(core.cards.get('core.reaverSpecial')), /Entry: /, 'the shipped rules roll no hit, so no Entry Precision line');
});

test('Counter face still reads as separate clean lines', () => {
  assert.match(faceOf(core.cards.get('core.counter'), oldFight), /^Gain 5 Block \| Counter 4 \| Entry: /);
  assert.match(faceOf(core.cards.get('core.counter')), /^Gain 5 Block \| Counter 4$/);
});
