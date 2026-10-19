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
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { coreSmashClause, coreSmashHelp, withCoreSmashBlurb } from '../src/model/smashClause.js';
import { uiStrings } from '../src/content/generated/uiStrings.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const current = createRegistries(contentBundle);
const plain = lines => lines.map(line => line.html.replace(/<[^>]+>/g, '')).join(' | ');
const RULE = /double damage, plus a quarter of their Block; half of it breaks Poise/;

test('the shared Core Smash sentence states the owner rule', () => {
  assert.match(coreSmashClause(core.cards.get('core.reaverSpecial'), core), RULE);
  assert.match(coreSmashHelp(core.cards.get('core.reaverSpecial'), core), RULE);
  for (const id of ['card.smash.coreClause', 'tag.smash.coreHelp']) assert.match(uiStrings.find(r => r.id === id).full, /\{mult\}.*\{block\}.*\{poise\}/);
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

test('enemy Smash moves (blightHound.lunge): Core help states the rule, legacy keeps the node blurb', async () => {
  const { enemyMoveCards } = await import('../src/model/enemyMoveCards.js');
  const { combatProfileTags } = await import('../src/model/combatCardProfile.js');
  const detail = reg => enemyMoveCards(reg.enemies.get('blightHound'), { registries: reg }).find(card => card.moveId === 'lunge');
  const coreCard = detail(core), legacyCard = detail(current);
  assert.ok(coreCard.combatTags.some(tag => tag.id === 'maneuver:smash'), 'lunge is a Smash');
  assert.match(coreCard.detail, RULE);
  assert.doesNotMatch(legacyCard.detail, RULE);
  assert.match(legacyCard.detail, /Smash: Heavy strike\. Deals extra damage against physical Guard/);
  // combatantOverhead's intent tooltip reads the same rows
  const smashTag = reg => combatProfileTags({ camp: 'physical', maneuver: 'smash', range: 'melee' }, reg).find(tag => tag.id === 'maneuver:smash');
  assert.match(smashTag(core).blurb, RULE);
  assert.doesNotMatch(smashTag(current).blurb, RULE);
});

test('the text follows the active rules: a profile with a 3x multiplier, 30% Block and 40% Poise says so', () => {
  const rules = { ...shipped, smashVsDefensive: { damageMultiplier: 3, blockFraction: 0.3, poiseFraction: 0.4 } };
  const ctx = { gameProfile: core.gameProfile, fixCoreRules: rules };
  const reaver = core.cards.get('core.reaverSpecial');
  assert.equal(coreSmashClause(reaver, ctx), 'Against Defend or Prepared: 3× damage, plus 30% of their Block; 40% of it breaks Poise.');
  assert.match(coreSmashHelp(reaver, ctx), /3× damage, plus 30% of their Block; 40% of it breaks Poise/);
  assert.match(withCoreSmashBlurb({ id: 'maneuver:smash', blurb: 'x' }, ctx).blurb, /3× damage/);
  assert.doesNotMatch(coreSmashClause(reaver, core), /3×/);
});
