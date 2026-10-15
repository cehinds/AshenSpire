import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { combatStatusRules } from '../src/content/combatStatusRules.js';
import { cardDetailHtml } from '../src/ui/components/card.js';

const reg = createRegistries(contentBundle);
const effect = (status, op = 'applyStatus') => ({ op, target: 'self', status, stacks: 1, amount: 1 });
const fixture = extra => ({ ...resolveCard(reg, { cardId: 'strike' }), type: 'skill',
  effects: [effect('crimsonBlight')], textTemplate: 'Apply {crimsonBlight} Crimson Blight.',
  minCombatExpansionVersion: undefined, defenseRulesVersion: undefined, ...extra });
const details = (definition, opts = {}, registries = reg) => {
  const html = cardDetailHtml(registries, { cardId: 'strike' }, { definition, ...opts });
  const section = html.match(/<section class="inspection-status-details">([\s\S]*?)<\/section>/);
  assert.ok(section, 'status details are visible section content');
  assert.doesNotMatch(section[1], /data-tip=/, 'duration and stacking require no hover');
  return section[1];
};

test('Information shows every nested status once without a three-status cap', () => {
  const def = fixture({ effects: [effect('strength'), effect('strength'), effect('bleed', 'buildup')],
    counterPayload: { effects: [effect('weak')] },
    upcast: { tiers: [{ effects: [effect('vulnerable')] }] },
    schoolEffect: { do: [effect('regen')] } });
  const section = details(def, { preview: { cost: 1, manaCost: 0,
    chargedEffects: [effect('precision')], combatExpansionVersion: 2 } });
  for (const id of ['strength', 'bleed', 'weak', 'vulnerable', 'regen', 'precision']) {
    assert.equal(section.split(`data-inspection-status="${id}"`).length - 1, 1, id);
  }
  assert.match(section, /Reapplying/);
  assert.match(section, /No automatic turn-end decay/);
});

test('visible status details use the actual classic, expanded and custom cap context', () => {
  const def = fixture();
  const classic = details(def, { rules: { combatExpansionVersion: 1 } });
  assert.doesNotMatch(classic, /up to 3|at the cap|Classic combat:/);
  const expanded = details(def, { rules: { combatExpansionVersion: 2 } });
  assert.match(expanded, /up to 3/);
  assert.match(expanded, /at the cap leaves the timer unchanged/);
  const custom = { ...combatStatusRules, statuses: { ...combatStatusRules.statuses,
    crimsonBlight: { ...combatStatusRules.statuses.crimsonBlight, cap: 5 } } };
  const preview = { cost: 1, manaCost: 0, combatExpansionVersion: 2, combatStatusRules: custom };
  assert.match(details(def, { preview, rules: { combatExpansionVersion: 1 } }), /up to 5/);
});

test('unstamped definitions name both rule sets; a v2 definition supplies known context', () => {
  const unknown = details(fixture());
  assert.match(unknown, /Classic combat:/); assert.match(unknown, /Expanded combat:/);
  const expanded = details(fixture({ minCombatExpansionVersion: 2 }));
  assert.match(expanded, /at the cap leaves the timer unchanged/);
  assert.doesNotMatch(expanded, /Classic combat:/);
});

test('status names and explanations are escaped visible text', () => {
  const source = reg.statuses.get('strength');
  const display = { ...source, name: '<img src=x>', tooltip: '<script>bad()</script>' };
  const custom = { ...reg, frameworkTerms: { ...reg.frameworkTerms,
    withStatusWords: row => row.id === 'strength' ? display : row } };
  const section = details(fixture({ effects: [effect('strength')] }), {}, custom);
  assert.match(section, /&lt;img src=x&gt;/); assert.match(section, /&lt;script&gt;/);
  assert.doesNotMatch(section, /<img|<script/);
});

test('the complete authored effect remains beside the visible status explanations', () => {
  const html = cardDetailHtml(reg, { cardId: 'rallyingStandard' }, { rules: { combatExpansionVersion: 2 } });
  assert.match(html, /At the start of your turn, gain 1 Strength and take 1 damage/);
  assert.match(html, /data-inspection-status="rallyingStandard"/);
  assert.match(html, /Reapplying adds to the stack total/);
});
