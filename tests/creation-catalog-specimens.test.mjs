import test from 'node:test';
import assert from 'node:assert/strict';
import { el } from '../src/ui/kit/index.js';
import { feats } from '../src/content/feats.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { mountCreationPartSpecimens } from '../src/ui/catalog/creationSpecimens.js';
import { withKitDom } from './helpers/kit-dom.mjs';

test('catalog mounts all new registered production specimens with working inspection and local choice state', () => withKitDom(dom => {
  const host = el('div');
  dom.document.body.append(host);
  const registries = createRegistries(contentBundle);
  const catalog = mountCreationPartSpecimens({ host, registries });
  const folios = host.querySelectorAll('[data-catalog-component]');
  assert.equal(folios.length, 19);
  for (const folio of folios) {
    const id = folio.dataset.catalogComponent;
    assert.equal(folio.id, `folio-${id}`);
    assert.ok(folio.querySelector(`[data-ui-component="${id}"]`), `${id} uses its real registered renderer`);
  }
  const browser = host.querySelector('#folio-creation-feat-browser .cc-feat-browser');
  const buttons = browser.querySelectorAll('.cc-feat-choices .cc-choice-tile');
  assert.equal(buttons.length, feats.length, 'all canonical generic feats remain visible');
  buttons.at(-1).click();
  assert.equal(browser.dataset.inspectedFeat, undefined);
  assert.equal(browser.dataset.birthFeatAllowance, '0');
  assert.ok(buttons.every(button => button.disabled));
  assert.ok(buttons.every(button => button.getAttribute('aria-pressed') === 'false'));
  assert.ok(buttons.at(-1).querySelector('.cc-feat-tile-requirement'), 'locked tiles show the real progression requirement');
  assert.equal(browser.querySelector('.cc-feat-detail').hidden, true, 'no empty inspector occupies the locked-only page');
  for (const groupId of ['class', 'skill']) {
    browser.querySelector(`.cc-feat-group-filter[data-feat-group="${groupId}"]`).click();
    assert.equal(browser.dataset.featGroup, groupId);
    assert.ok(browser.querySelectorAll('.cc-feat-choices .cc-choice-tile').length > 0);
    assert.ok(browser.querySelector('.cc-feat-choices .cc-feat-tile-status'), `${groupId} has compact progression status`);
    assert.ok(browser.querySelector('.cc-feat-choices .cc-feat-tile-requirement'), `${groupId} exposes the lock reason without selection`);
  }
  const tileFolio = host.querySelector('#folio-creation-choice-tile');
  tileFolio.querySelector('button').click();
  assert.equal(tileFolio.querySelector('button').getAttribute('aria-pressed'), 'true');
  const nav = host.querySelector('#folio-creation-step-navigation .cc-step-navigation');
  assert.deepEqual([...nav.querySelectorAll('[data-creation-step]')].map(node => node.dataset.creationStep),
    ['class', 'subclass', 'attributes', 'feats', 'spells', 'equipment', 'keepsake', 'review'], 'individual navigation specimen follows the production caster flow');
  nav.querySelector('[data-creation-step="attributes"]').click();
  assert.equal(nav.querySelector('[aria-current="step"]').dataset.creationStep, 'attributes');
  catalog.destroy();
}));
