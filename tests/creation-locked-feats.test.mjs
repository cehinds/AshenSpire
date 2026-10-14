import test from 'node:test';
import assert from 'node:assert/strict';
import { createCreationFeatBrowser } from '../src/ui/components/creationPageParts.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const locked = { id: 'locked', name: 'Locked feat', description: 'Future benefit.', locked: true, currentLevel: 1, requiredLevel: 2 };
const legal = { id: 'legal', name: 'Available feat', description: 'Browse this benefit.', locked: false, currentLevel: 2, requiredLevel: 2 };

test('locked feats refuse native, synthetic and API inspection without changing the active available feat', () => withKitDom(dom => {
  const inspected = [];
  const browser = createCreationFeatBrowser({ groups: [{ id: 'character', rows: [locked, legal] }], selectedId: 'locked', onInspect: id => inspected.push(id) });
  dom.document.body.append(browser);
  const tile = browser.querySelector('[data-feat="locked"]');
  assert.equal(tile.disabled, true);
  assert.equal(tile.getAttribute('aria-disabled'), 'true');
  assert.match(tile.querySelector('.cc-feat-tile-requirement').textContent, /1 \/ 2/);
  assert.equal(browser.dataset.inspectedFeat, 'legal');
  tile.click();
  tile.dispatchEvent(new dom.Event('click'));
  assert.equal(browser.inspect('locked'), false);
  assert.equal(browser.dataset.inspectedFeat, 'legal');
  assert.equal(tile.getAttribute('aria-pressed'), 'false');
  assert.equal(tile.classList.contains('chosen'), false);
  assert.deepEqual(inspected, []);
  browser.querySelector('[data-feat="legal"]').click();
  assert.deepEqual(inspected, ['legal']);
  assert.equal(browser.dataset.birthFeatAllowance, '0', 'inspection grants no birth feat');
  const oldLegal = browser.querySelector('[data-feat="legal"]');
  browser.setGroups([{ id: 'character', rows: [locked, { ...legal, locked: true }] }]);
  oldLegal.click();
  assert.equal(browser.dataset.inspectedFeat, undefined, 'stale handlers recheck the current lock');
  assert.equal(browser.querySelector('.cc-feat-detail').hidden, true);
  assert.deepEqual(inspected, ['legal']);
}));
