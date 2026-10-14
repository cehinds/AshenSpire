import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { cardDetailHtml, cardPlainText } from '../src/ui/components/card.js';

const registries = createRegistries(contentBundle);
const rules = { combatExpansionVersion: 2, reactionRulesVersion: 2, breakMeterVersion: 2 };
test('compact and inspection use the same projected Counter definition and canonical identity', () => {
  const ref = { cardId: 'fireCounter' };
  const compact = cardPlainText(registries, ref, { rules });
  const detail = cardDetailHtml(registries, ref, { rules });
  assert.match(compact, /2 Block.*3 Ward/);
  assert.match(detail, /STANCE.*Counter/);
  assert.match(detail, /Defense range:.*ranged/);
  assert.match(detail, /Return range:.*reach/);
  assert.match(detail, /Accuracy.*base Evasion/);
  assert.match(detail, /Stance group:.*Offense.*Defensive/);
});
test('inspection keeps exact live Block/Ward token parts instead of re-splitting total', () => {
  const ref = { cardId: 'fireCounter' };
  const preview = { cost: 1, manaCost: 0, staminaCost: 0, tokens: { gainBarrier: 11, 'gainBarrier.block': 5, 'gainBarrier.ward': 6 } };
  const detail = cardDetailHtml(registries, ref, { rules, preview });
  assert.match(detail, /5.*Block.*6.*Ward/);
});
