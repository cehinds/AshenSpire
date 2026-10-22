// DOM wiring only: packaged browser QA verifies painted width/overlap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { combatantIntent } from '../src/ui/components/combatantOverhead.js';
import { combatTargetIntentRow } from '../src/ui/components/combatTargetHud.js';

const multi = { kind: 'attack', moveId: 'flurry', damage: 5, hits: 3,
  hitDamages: [5, 5, 5], totalDamage: 15, projectedDamage: { basis: 'hp', label: '0–15' } };

function surfaces(intent) {
  const overhead = combatantIntent(intent, () => '');
  return [overhead.querySelector('.intent-compact'), combatTargetIntentRow({ role: 'enemy', intent })];
}

test('compact overhead and target HUD carry their own scoped total beside the per-hit value', () => withKitDom(({ document }) => {
  document.documentElement ??= document.body;
  for (const node of surfaces(multi)) {
    assert.equal(node.querySelector('.intent-action-value').textContent, '5×3');
    assert.equal(node.querySelector('.intent-damage-scope').textContent, 'Total 0–15 HP');
    assert.equal(node.querySelectorAll('.intent-damage-scope').length, 1, 'one scoped total per visible row');
    assert.equal(node.querySelector('.intent-actions .intent-damage-read .intent-damage-scope').textContent, 'Total 0–15 HP',
      'the summary is inside the compact row itself, independent of hidden expanded .intent-values');
  }
}));

test('current-contact scope survives both compact consumers instead of claiming a full attack total', () => withKitDom(({ document }) => {
  document.documentElement ??= document.body;
  const contact = { ...multi, damage: 9, hits: 1, hitDamages: [9], totalDamage: 9, projectedDamage: null,
    damageBasis: 'hp', damageScope: 'contact', contactIndex: 1, contactCount: 3 };
  for (const node of surfaces(contact)) {
    assert.equal(node.querySelector('.intent-action-value').textContent, '9');
    assert.equal(node.querySelector('.intent-damage-scope').textContent, 'Hit 2/3 · next 9 HP');
  }
}));

test('concealed intents cannot leak a supplied private total through either compact consumer', () => withKitDom(({ document }) => {
  document.documentElement ??= document.body;
  for (const node of surfaces({ ...multi, hidden: true, knowledgeRead: 'unknown' })) {
    assert.equal(node.querySelector('.intent-damage-scope'), null);
    assert.equal(node.querySelector('.intent-action-value').textContent, '?');
  }
}));
