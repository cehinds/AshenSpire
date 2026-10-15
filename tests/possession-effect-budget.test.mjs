import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { renderCollectibleCard } from '../src/ui/components/collectibleCard.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const r = createRegistries(contentBundle);
test('ordinary possession hides prose facts and preserves complete inspection effects', () => withKitDom(() => {
  const item = r.relics.get('forsakenMedallion');
  const ordinary = renderCollectibleCard(r, item, 'Relic', { interactive: false, inspection: false, level: 'focus' });
  const summary = ordinary.card.querySelector('.epc-effect-summary');
  assert.ok(summary);
  assert.ok(summary.children.length <= 2);
  assert.ok(ordinary.card.querySelectorAll('.epc-line').every(row => row.hasAttribute('hidden')));
  assert.ok(ordinary.explanations.some(row => row.label.startsWith('Trigger:')));
  const full = renderCollectibleCard(r, item, 'Relic', { interactive: false, inspection: false, level: 'inspect' });
  assert.equal(full.card.querySelector('.epc-effect-summary'), null);
  assert.ok(full.card.querySelectorAll('.epc-line').every(row => !row.hasAttribute('hidden')));
  assert.ok(full.explanations.some(row => /Your first attack each combat/.test(row.label)));
}));
