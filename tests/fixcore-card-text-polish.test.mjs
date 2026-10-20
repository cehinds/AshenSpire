// Owner screenshots 2026-10-19: a face line ending in a period must not get ", " glued after it ("Poise., Entry: ...").
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { cardPlainText } from '../src/ui/components/card.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const plain = html => html.replace(/<[^>]+>/g, '');
const faceOf = def => (cardFaceLines(def, null, core) || []).map(line => plain(line.html)).join(' | ');
const rules = { rules: { combatExpansionVersion: 2 } };

test('no Core card face or plain text has a period followed by a comma', () => {
  const cards = core.cards.all();
  assert.ok(cards.length > 20);
  for (const def of cards) {
    assert.doesNotMatch(faceOf(def), /\.,/, `${def.id} face`);
    assert.doesNotMatch(cardPlainText(core, { cardId: def.id }, rules), /\.,/, `${def.id} plain`);
  }
});

test('Sundering Art reads the Smash rule then the Entry grant with a single comma', () => {
  const face = faceOf(core.cards.get('core.reaverSpecial'));
  assert.match(face, /half of it breaks Poise, Entry: /);
  assert.doesNotMatch(face, /Poise\.,/);
});

test('Counter face still reads as separate clean lines', () => {
  assert.match(faceOf(core.cards.get('core.counter')), /^Prepare Melee Counter: return \d+ damage \| Gain \d+ Block \| Entry: /);
});
