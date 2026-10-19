// Owner ruling 2026-10-19: every Core card tagged maneuver:smash says the Smash-vs-defensive rule, from one shared row
// (model/smashClause.js), on its face, its summary and its Smash tag help. Other profiles keep the legacy wording.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { combatCardSummary } from '../src/model/playingCard.js';
import { cardTagExplanation } from '../src/model/cardTagExplanation.js';
import { cardPlainText } from '../src/ui/components/card.js';
import { coreSmashClause, coreSmashHelp } from '../src/model/smashClause.js';
import { uiStrings } from '../src/content/generated/uiStrings.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const current = createRegistries(contentBundle);
const CLAUSE = uiStrings.find(r => r.id === 'card.smash.coreClause').full;
const plain = lines => lines.map(line => line.html.replace(/<[^>]+>/g, '')).join(' | ');
const RULE = /double damage, plus a quarter of their Block; half of it breaks Poise/;

test('the shared Core Smash sentence states the owner rule', () => {
  assert.match(CLAUSE, RULE);
  assert.match(uiStrings.find(r => r.id === 'tag.smash.coreHelp').full, RULE);
});

test('every Core card tagged maneuver:smash shows the line, not only core.smash', () => {
  const smashes = core.cards.all().filter(def => def.tags?.includes('maneuver:smash'));
  assert.ok(smashes.some(def => def.id === 'core.reaverSpecial') && smashes.some(def => def.id === 'core.smash'));
  for (const def of smashes) {
    const lines = cardFaceLines(def, null, core);
    const text = lines ? plain(lines) : cardPlainText(core, { cardId: def.id }, { rules: { combatExpansionVersion: 2 } });
    assert.match(text, RULE, `${def.id} face`);
    const summary = combatCardSummary(def, null, core);
    if (summary) assert.match(summary, RULE, `${def.id} summary`);
  }
});

test('non-Smash cards and the legacy profile keep their old text', () => {
  const reaver = core.cards.get('core.reaverSpecial'), attack = core.cards.get('core.strike') || core.cards.get('core.attack');
  assert.equal(coreSmashClause(reaver, current), '');
  assert.doesNotMatch(plain(cardFaceLines(reaver, null, current) || []), RULE);
  if (attack) assert.equal(coreSmashClause(attack, core), '');
});

test('Smash tag help: Core states the rule, legacy keeps the node blurb', () => {
  const reaver = core.cards.get('core.reaverSpecial'), tag = { id: 'maneuver:smash', blurb: 'legacy blurb' };
  assert.match(cardTagExplanation(reaver, tag, core), RULE);
  assert.equal(cardTagExplanation(reaver, tag, current), 'legacy blurb');
  assert.equal(cardTagExplanation(reaver, tag), 'legacy blurb');
  assert.equal(coreSmashHelp(core.cards.get('core.defend'), core), null);
});
