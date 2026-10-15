import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { playingCardDefinition, staticCardTokens } from '../src/model/playingCard.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { cardFaceProjection, FACE_EFFECT_CHARACTERS } from '../src/model/cardFaceProjection.js';
import { cardDetailHtml, cardPlainText } from '../src/ui/components/card.js';

const reg = createRegistries(contentBundle), rules = { combatExpansionVersion: 2 };
const plain = html => html.replace(/<[^>]*>/g, '');
const defOf = (cardId, extra = {}) => playingCardDefinition(reg, { cardId, ...extra }, { rules });
const project = (def, preview = null) => {
  const tokens = { ...staticCardTokens(def), ...preview?.tokens };
  const authoredHtml = def.textTemplate.replace(/\{([\w.]+)\}/g, (match, key) => tokens[key] ?? match);
  return cardFaceProjection(def, { lines: cardFaceLines(def, preview, reg), authoredHtml, registries: reg });
};

test('every authored base, upgrade and rank projects whole short clauses without changing definitions', () => {
  let checked = 0;
  for (const card of reg.cards.all()) for (const extra of [{}, { upgraded: true }, { abilityRank: 1 }, { abilityRank: 5 }]) {
    const def = defOf(card.id, extra), before = JSON.stringify(def), projection = project(def);
    assert.equal(projection.maxLines, 3);
    assert.ok(projection.clauses.length >= 1 && projection.clauses.length <= 2, card.id);
    const text = projection.clauses.map(line => plain(line.html)).join('; ');
    assert.ok(text.length <= FACE_EFFECT_CHARACTERS, `${card.id}: ${text}`);
    assert.doesNotMatch(text, /Inspect full effect|\{|\.\.\.|…/, card.id);
    assert.equal(JSON.stringify(def), before);
    checked++;
  }
  assert.equal(checked, reg.cards.all().length * 4);
});

test('live primary numbers and up/down marks survive the bounded projection', () => {
  const def = defOf('bashingBlow');
  const preview = { values: [{ op: 'damage', value: 19, hits: 1 }, { op: 'poiseDamage', value: 2 }] };
  const text = project(def, preview).clauses.map(line => line.html).join(' ');
  assert.match(text, /val up">19</);
  assert.match(text, /val down">2</);
});

test('all equipment basic profiles share the bounded projection at every authored rank', () => {
  for (const profile of reg.equipment.basicCardProfiles) for (const abilityRank of [0, 1, 5]) {
    const def = playingCardDefinition(reg, { cardId: profile.baseCardId, profileId: profile.id, abilityRank }, { rules });
    const projection = project(def), text = projection.clauses.map(line => plain(line.html)).join('; ');
    assert.ok(projection.clauses.length <= 2, profile.id);
    assert.ok(text.length <= FACE_EFFECT_CHARACTERS, `${profile.id}: ${text}`);
    assert.doesNotMatch(text, /Inspect full effect|\{/, profile.id);
  }
});

test('a chosen conditional status keeps its probability attached', () => {
  const def = { type: 'skill', effects: [{ op: 'buildup', status: 'burn', chance: 40 }] };
  const projection = cardFaceProjection(def, { lines: [
    { kind: 'condition', html: 'If target has Block: Inflict Burn 4' },
    { kind: 'detail', html: 'Burn: 40% chance' },
  ], registries: reg });
  assert.equal(projection.clauses[0].html, 'If target has Block: Apply Burn 4 (40% chance)');
});

test('payments lead their payoff and long qualified riders move whole to Information', () => {
  const projection = cardFaceProjection({}, { lines: [
    { kind: 'cost', html: 'Offer 3 HP (leave at least 1 HP)' },
    { kind: 'damage', html: 'Inflict 9 Fire damage' },
    { kind: 'condition', html: 'If you played another distinct starstone card before this card: Gain 4 Ward once per turn per family' },
  ] });
  assert.deepEqual(projection.clauses.map(line => line.kind), ['cost', 'damage']);
  assert.equal(projection.omitted, true);
  const blighted = project(defOf('blightedTransmute')).clauses.map(line => plain(line.html)).join('; ');
  assert.match(blighted, /^Pay 12 Ashen Blight;/);
});

test('authored fallback keeps trigger, cap and generated-card costs together', () => {
  assert.match(project(defOf('rallyingStandard')).clauses[0].html, /^Turn start: gain 1 Strength and take 1 damage$/);
  const bloom = project(defOf('blightBloom')).clauses.map(line => line.html).join('; ');
  assert.match(bloom, /Double.*Blight/); assert.match(bloom, /cap 3 stacks each/);
  const guardian = project(defOf('shieldGuardian')).clauses.map(line => line.html).join('; ');
  // The generated card's cost and Exhaust must stay with its grant; this long
  // complete clause is omitted, while its readable Block effect remains.
  assert.doesNotMatch(guardian, /Add a temporary/);
  assert.match(guardian, /Gain.*Block/);
});

test('stance entry details do not spend the ordinary effect budget', () => {
  const projection = cardFaceProjection({}, { lines: [
    { kind: 'damage', html: 'Inflict 8 damage' },
    { kind: 'bonus', html: 'Draw 1, Entry: +2 Precision' },
  ] });
  assert.deepEqual(projection.clauses.map(line => line.html), ['Deal 8 damage', 'Draw 1']);
});

test('full plain reading and Information preserve facts omitted from the face', () => {
  const def = defOf('sanctuaryCleanse'), face = project(def).clauses.map(line => plain(line.html)).join('; ');
  assert.doesNotMatch(face, /Usable through/);
  assert.match(cardPlainText(reg, { cardId: def.id }, { rules }), /Usable through/);
  assert.match(cardDetailHtml(reg, { cardId: 'shieldGuardian' }, { rules }), /costs 1 Stamina and Exhausts/);
  assert.match(cardDetailHtml(reg, { cardId: 'blightBloom' }, { rules }), /3 stacks each/);
});
