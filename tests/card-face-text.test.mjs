import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';

const reg = createRegistries(contentBundle);
const card = id => applyCombatExpansionCard(reg.cards.get(id));
const lines = (id, preview = null) => cardFaceLines(card(id), preview, reg);
const text = (id, preview = null) => (lines(id, preview) || []).map(line => line.html.replace(/<[^>]+>/g, ''));

test('a mixed damage and poise card reads one damage line with the poise joined', () => {
  const [first] = text('bashingBlow');
  assert.match(first, /^Inflict 7 (\w+ )?damage, 4 Poise damage$/);
});

test('a cleanse card lists its removals, its Ward gain, and the usable-while detail last', () => {
  const all = text('sanctuaryCleanse');
  assert.ok(all.includes('Remove 1 Sleep, 1 Paralysis, 1 Dazed'), all.join(' | '));
  assert.ok(all.includes('Gain 3 Ward'), all.join(' | '));
  assert.match(all.at(-1), /^Usable through Sleep, Paralysis, Dazed$/);
});

test('a conditional card groups its effects under the status that gates them', () => {
  // The authored data: Weak buildup 4 gated on the card's own Starstone Charge, and a self Charge gain of 1.
  const all = text('starSpark');
  assert.ok(all.includes('Starstone Charge: Inflict Weak 4'), all.join(' | '));
  assert.ok(all.includes('Gain Starstone Charge 1'), all.join(' | '));
});

test('an area damage card names its area on the damage line', () => {
  const [first] = text('rockfall');
  assert.match(first, /to all enemies$/);
});

test('a preview above the static base marks the number up, below it marks down', () => {
  const up = lines('bashingBlow', { values: [{ op: 'damage', value: 9, hits: 1 }, { op: 'poiseDamage', value: 4 }] });
  assert.match(up[0].html, /class="val up">9</);
  const down = lines('bashingBlow', { values: [{ op: 'damage', value: 3, hits: 1 }, { op: 'poiseDamage', value: 4 }] });
  assert.match(down[0].html, /class="val down">3</);
});

test('without a preview no number is marked up or down', () => {
  for (const line of lines('bashingBlow')) assert.doesNotMatch(line.html, /val (up|down)/);
});

test('a card with an effect it cannot phrase returns null', () => {
  assert.equal(cardFaceLines({ type: 'attack', effects: [{ op: 'noSuchOp', target: 'enemy', amount: 1 }] }, null, reg), null);
});

test('a partial buildup chance keeps a detail line so the face never reads as certain', () => {
  const all = lines('cinderSigil');
  assert.ok(all, 'cinderSigil phrases');
  const detail = all.filter(line => line.kind === 'detail').map(line => line.html.replace(/<[^>]+>/g, ''));
  assert.ok(detail.some(line => /\d+% chance$/.test(line)), `chance detail line: ${JSON.stringify(detail)}`);
});

test('a card with nothing to phrase returns null so the authored text stays', () => {
  assert.equal(cardFaceLines({ type: 'status', effects: [] }, null, reg), null);
});
