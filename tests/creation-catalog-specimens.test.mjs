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
  assert.equal(folios.length, 13);
  for (const folio of folios) {
    const id = folio.dataset.catalogComponent;
    assert.equal(folio.id, `folio-${id}`);
    assert.ok(folio.querySelector(`[data-ui-component="${id}"]`), `${id} uses its real registered renderer`);
  }
  const browser = host.querySelector('#folio-creation-feat-browser .cc-feat-browser');
  const buttons = browser.querySelectorAll('.cc-feat-choices .cc-choice-tile');
  assert.equal(buttons.length, feats.length, 'all canonical generic feats are inspectable');
  buttons.at(-1).click();
  assert.equal(browser.dataset.inspectedFeat, feats.at(-1).id);
  assert.equal(browser.dataset.birthFeatAllowance, '0');
  assert.equal(browser.querySelector('.cc-feat-detail-title').textContent, feats.at(-1).name);
  assert.equal(browser.querySelector('.cc-feat-detail-description').textContent, feats.at(-1).description);
  assert.equal(buttons.at(-1).getAttribute('aria-pressed'), 'true');
  assert.ok(buttons.at(-1).querySelector('.cc-feat-tile-status'), 'compact tile retains its progression status cue');
  assert.equal(buttons.at(-1).querySelector('.cc-feat-level-requirement'), null, 'full level requirements belong to the inspector');
  assert.equal(browser.querySelector('.cc-feat-detail').dataset.locked, 'true', 'locked birth feats remain inspectable');
  assert.match(browser.querySelector('.cc-feat-detail .cc-feat-level-copy').textContent, /2/);
  for (const groupId of ['class', 'skill']) {
    browser.querySelector(`.cc-feat-group-filter[data-feat-group="${groupId}"]`).click();
    assert.equal(browser.dataset.featGroup, groupId);
    assert.ok(browser.querySelectorAll('.cc-feat-choices .cc-choice-tile').length > 0);
    assert.ok(browser.querySelector('.cc-feat-choices .cc-feat-tile-status'), `${groupId} has compact progression status`);
    assert.ok(browser.querySelector('.cc-feat-detail .cc-feat-level-requirement'), `${groupId} inspector uses the real progression requirement`);
  }
  const tileFolio = host.querySelector('#folio-creation-choice-tile');
  tileFolio.querySelector('button').click();
  assert.equal(tileFolio.querySelector('button').getAttribute('aria-pressed'), 'true');
  const nav = host.querySelector('#folio-creation-step-navigation .cc-step-navigation');
  nav.querySelector('[data-creation-step="attributes"]').click();
  assert.equal(nav.querySelector('[aria-current="step"]').dataset.creationStep, 'attributes');
  catalog.destroy();
}));
