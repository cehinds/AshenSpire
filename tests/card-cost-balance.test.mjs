// Playtest 2026-11-17, theme C (chore/CardCostBalance): card drawbacks and the upgrades that ease them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import { resolveGameProfile, applyGameProfileToContent } from '../src/model/gameProfile.js';
import { upgradedDefinition } from '../src/model/cardUpgrade.js';
import { projectCardBehavior } from '../src/engine/cardBehavior.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const coreContent = () => applyGameProfileToContent(contentBundle, profile);
// A fight context that has seen `plays` earlier plays of the card.
const playedCtx = (cardId, plays) => ({ player: { abilityRiders: { cardUsesCombat: { [cardId]: plays } } } });

test('an authored upgrade may stop a rising cost, and the schema accepts it', () => {
  const content = coreContent();
  const card = content.cards.find((row) => row.id === 'core.strike');
  const rising = { ...card, costGrowth: { stamina: 1, perUse: 1, max: 3 }, upgrade: { ...(card.upgrade || {}), costGrowth: { stamina: 0, mana: 0 } } };
  content.cards = content.cards.map((row) => (row.id === card.id ? rising : row));
  const problems = validateContent(content).errors.filter((row) => row.path.startsWith(`cards.${card.id}`));
  assert.deepEqual(problems, []);
  assert.equal(projectCardBehavior(playedCtx(card.id, 2), { cardId: card.id }, rising).staminaCost, 3, 'the base card costs 1 more per earlier play');
  assert.equal(projectCardBehavior(playedCtx(card.id, 2), { cardId: card.id }, upgradedDefinition(rising)).staminaCost, 1, 'the upgrade holds the printed cost');
});
