import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { cardFaceDefinition, projectCombatDefinition, setCardFaceRunSource, NEW_RUN_RULES } from '../src/model/cardFaceDefinition.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';

// Out of combat a card reads the same projection combat plays (one source: cardFaceDefinition).
const reg = createRegistries(contentBundle);
const ids = reg.cards.all().map(card => card.id);
const plain = html => String(html).replace(/<[^>]+>/g, '');

test('every card face out of combat equals the new-run combat projection', () => {
  for (const cardId of ids) {
    assert.deepEqual(cardFaceDefinition(reg, { cardId }), projectCombatDefinition(resolveCard(reg, { cardId }), NEW_RUN_RULES), cardId);
  }
});

test('the engine resolves the same definition the face reads', () => {
  const ctx = { registries: reg, combatExpansionVersion: 2, reactionRulesVersion: 2, player: { statuses: {} } };
  let compared = 0;
  for (const cardId of ids) {
    let combat;
    try { combat = resolveCombatCard(ctx, { cardId }); } catch { continue; }
    assert.deepEqual(cardFaceDefinition(reg, { cardId }), combat, cardId);
    compared++;
  }
  assert.ok(compared > 0, 'at least one card compared against the engine');
});

test('a spell with a raw block effect reads Ward, not Block, out of combat', () => {
  const cardId = ids.find(id => resolveCard(reg, { cardId: id }).effects?.some(e => e.op === 'block')
    && cardFaceDefinition(reg, { cardId: id }).effects?.some(e => e.op === 'gainBarrier'));
  assert.ok(cardId, 'a block spell that projects to a barrier exists');
  const text = plain(cardFaceLines(cardFaceDefinition(reg, { cardId }), null, reg).map(line => line.html ?? line).join(' '));
  assert.match(text, /Ward/);
  assert.doesNotMatch(text, /Block/);
});

test('a run on the first combat rules reads the raw definition', () => {
  setCardFaceRunSource(() => ({ combatExpansionVersion: 1 }));
  try {
    for (const cardId of ids.slice(0, 20)) assert.deepEqual(cardFaceDefinition(reg, { cardId }), resolveCard(reg, { cardId }));
  } finally { setCardFaceRunSource(null); }
});
