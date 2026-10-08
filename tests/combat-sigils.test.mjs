import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACTION_SIGILS, SCHOOL_SIGILS, cardSigilIdentity } from '../src/content/combatSigils.js';
import { compactCardRules, cardSigilsHtml, sigilExplanationHtml, sigilHtml } from '../src/ui/components/combatSigilView.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { playingCardModel, combatCardType } from '../src/model/playingCard.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';

test('all requested identities have unique monochrome geometry', () => {
  assert.deepEqual(Object.keys(ACTION_SIGILS), ['attack','defend','counter','sweep','ranged','smash','spell','power','skill','status']);
  assert.deepEqual(Object.keys(SCHOOL_SIGILS), ['frost','fire','lightning','force','alteration','illusion','divine','decay']);
  const marks = [...Object.values(ACTION_SIGILS), ...Object.values(SCHOOL_SIGILS)];
  assert.equal(new Set(marks.map(m => m.shape)).size, 18);
  for (const m of marks) { assert.ok(m.label && m.help); assert.doesNotMatch(m.shape, /fill=|style=|#[0-9a-f]/i); }
});

test('identity follows authored action and school rather than damage or card name', () => {
  assert.deepEqual(cardSigilIdentity('Smash', {camp:'physical',maneuver:'smash',damageType:'fire'}), {action:'smash',school:null});
  assert.deepEqual(cardSigilIdentity('Spell', {camp:'spell',maneuver:'ranged',school:'alteration'}), {action:'spell',school:'alteration'});
  assert.deepEqual(cardSigilIdentity('Power', {camp:'spell',school:'divine'}), {action:'power',school:'divine'});
  assert.equal(cardSigilIdentity('Skill', {}).action, 'skill');
  assert.equal(cardSigilIdentity('Status', {}).action, 'status');
  assert.throws(() => cardSigilIdentity('Unknown', {}), /Unknown primary card type/);
  assert.throws(() => cardSigilIdentity('Constructor', {}), /Unknown primary card type/);
  assert.throws(() => cardSigilIdentity('Spell', {school:'unknown'}), /Unknown card school/);
});

test('Power explanations remain truthful for historical and expanded lifecycles', () => {
  const reg=createRegistries(contentBundle), legacy=reg.cards.get('rallyingStandard'), expanded=applyCombatExpansionCard(legacy);
  assert.ok(!legacy.keywords.includes('exhaust'));
  assert.ok(expanded.keywords.includes('exhaust'));
  assert.match(ACTION_SIGILS.power.help,/Cast once/);
  assert.match(ACTION_SIGILS.power.help,/lasts for this combat/);
  assert.doesNotMatch(ACTION_SIGILS.power.help,/then Exhaust/);
});

test('marks preserve readable accessible names and inspection explanations', () => {
  const identity = {action:'spell', school:'alteration'};
  const html = cardSigilsHtml(identity);
  assert.match(html, /data-primary-sigil="spell"/);
  assert.match(html, /role="img" aria-label="Spell"/);
  assert.match(html, /role="img" aria-label="Alteration"/);
  assert.match(html, /focusable="false"/);
  assert.doesNotMatch(html, /tabindex=/);
  assert.doesNotMatch(html, /title=/);
  assert.equal(sigilHtml('constructor'), '');
  assert.match(sigilExplanationHtml(identity), /earth and grounding/);
  assert.match(cardSigilsHtml(identity, ['Blunt', 'Cold']), /class="card-damage-types">Blunt · Cold<\/span>/);
});

test('short damage wording retains numbers, types, timing, targets and conditions', () => {
  const original = 'Deal <span class="val">9</span> Piercing damage to all enemies.\nGain 4 Guard until next turn. If Guard breaks, deal 3 Cold damage.';
  assert.equal(compactCardRules(original), '<span class="val">9</span> Piercing damage to all enemies. Gain 4 Guard until next turn. If Guard breaks, deal 3 Cold damage.');
});

test('compact authored rules keep family limits, charge expiry, stacking and HP floors', () => {
  assert.equal(compactCardRules('Deal 7 damage to the selected enemy. If you previously played at least 1 guile card(s) this turn and If you previously played at least 1 guard card(s) this turn: Deal 4 damage to the selected enemy. Gain 2 Block, once per turn from this family.'), '7 damage to target. If 1+ guile cards played this turn and 1+ guard cards played this turn: 4 damage to target. Gain 2 Block, once per turn per family.');
  assert.equal(compactCardRules('Your next spell this turn costs 1 less Mana (minimum zero); this charge cannot stack with itself.'), 'Next spell this turn costs 1 less Mana (min 0); cannot stack with itself.');
  assert.equal(compactCardRules('Offer 3 HP; the payment must leave at least one HP. Deal 17 damage to every living enemy.'), 'Offer 3 HP (leave at least 1 HP). 17 damage to all enemies.');
});

test('every base, upgrade, authored rank and equipment profile uses the shared identity', () => {
  const reg = createRegistries(contentBundle), actions = new Set(), schools = new Set();
  const refs = contentBundle.cards.flatMap(card => [{cardId:card.id}, {cardId:card.id,upgraded:true}, ...(card.gradeProfiles || []).map((_,abilityRank)=>({cardId:card.id,abilityRank}))]);
  for (const profile of reg.equipment.basicCardProfiles || []) refs.push({cardId:profile.role === 'defend' ? 'defend' : 'strike',profileId:profile.id});
  for (const ref of refs) for (const expanded of [false, true]) {
    const def = expanded ? applyCombatExpansionCard(resolveCard(reg, ref)) : resolveCard(reg, ref);
    const model = playingCardModel(reg, ref, {preview: expanded ? {resolvedDefinition:def} : null});
    assert.deepEqual(model.sigils, cardSigilIdentity(combatCardType(def), combatProfileFor(def)), JSON.stringify(ref));
    assert.ok(Object.isFrozen(model.sigils));
    actions.add(model.sigils.action); if(model.sigils.school)schools.add(model.sigils.school);
  }
  assert.equal(actions.size, 10); assert.equal(schools.size, 8);
});
