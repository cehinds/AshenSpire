import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACTION_SIGILS, SCHOOL_SIGILS, cardSigilIdentity } from '../src/content/combatSigils.js';
import { compactCardRules, cardSigilsHtml, sigilExplanationHtml } from '../src/ui/components/combatSigilView.js';

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
  assert.throws(() => cardSigilIdentity('Spell', {school:'unknown'}), /Unknown card school/);
});

test('marks preserve readable accessible names and inspection explanations', () => {
  const identity = {action:'spell', school:'alteration'};
  const html = cardSigilsHtml(identity);
  assert.match(html, /data-primary-sigil="spell"/);
  assert.match(html, /role="img" aria-label="Spell"/);
  assert.match(html, /role="img" aria-label="Alteration"/);
  assert.match(html, /focusable="false"/);
  assert.doesNotMatch(html, /tabindex=/);
  assert.match(sigilExplanationHtml(identity), /earth and grounding/);
  assert.match(cardSigilsHtml(identity, ['Blunt', 'Cold']), /class="card-damage-types">Blunt · Cold<\/span>/);
});

test('short damage wording retains numbers, types, timing, targets and conditions', () => {
  const original = 'Deal <span class="val">9</span> Piercing damage to all enemies.\nGain 4 Guard until next turn. If Guard breaks, deal 3 Cold damage.';
  assert.equal(compactCardRules(original), '<span class="val">9</span> Piercing damage to all enemies. Gain 4 Guard until next turn. If Guard breaks, deal 3 Cold damage.');
});
