import test from 'node:test';
import assert from 'node:assert/strict';
import { el } from '../src/ui/kit/index.js';
import { feats } from '../src/content/feats.js';
import { mountCreationPartSpecimens } from '../src/ui/catalog/creationSpecimens.js';
import { withKitDom } from './helpers/kit-dom.mjs';

test('catalog mounts all new registered production specimens with working inspection and local choice state', () => withKitDom(dom => {
  const host = el('div');
  dom.document.body.append(host);
  const catalog = mountCreationPartSpecimens({ host });
  const folios = host.querySelectorAll('[data-catalog-component]');
  assert.equal(folios.length, 13);
  for (const folio of folios) {
    const id = folio.dataset.catalogComponent;
    assert.equal(folio.id, `folio-${id}`);
    assert.ok(folio.querySelector(`[data-ui-component="${id}"]`), `${id} uses its real registered renderer`);
  }
  const browser = host.querySelector('#folio-creation-feat-browser .cc-feat-browser');
  const buttons = browser.querySelectorAll('.cc-feat-choices button');
  assert.equal(buttons.length, feats.length, 'all canonical generic feats are inspectable');
  buttons.at(-1).click();
  assert.equal(browser.dataset.inspectedFeat, feats.at(-1).id);
  assert.equal(browser.dataset.birthFeatAllowance, '0');
  assert.equal(browser.querySelector('.cc-feat-detail-title').textContent, feats.at(-1).name);
  assert.equal(browser.querySelector('.cc-feat-detail-description').textContent, feats.at(-1).description);
  assert.equal(buttons.at(-1).getAttribute('aria-pressed'), 'true');
  const tileFolio = host.querySelector('#folio-creation-choice-tile');
  tileFolio.querySelector('button').click();
  assert.equal(tileFolio.querySelector('button').getAttribute('aria-pressed'), 'true');
  const nav = host.querySelector('#folio-creation-step-navigation .cc-step-navigation');
  nav.querySelector('[data-creation-step="attributes"]').click();
  assert.equal(nav.querySelector('[aria-current="step"]').dataset.creationStep, 'attributes');
  catalog.destroy();
}));
