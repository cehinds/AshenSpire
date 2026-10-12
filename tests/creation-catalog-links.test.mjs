import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { el } from '../src/ui/kit/index.js';
import { creationCatalogHref, linkCreationCatalogFolios } from '../src/ui/catalog/creationCatalogLinks.js';

test('live catalog links name the same production folio and preserve its accessible heading', () => withKitDom(dom => {
  const heading = el('h3', { id: 'cc-catalog-class-choice-card', text: 'Class choice card' });
  const folio = el('section', { dataset: { catalogComponent: 'class-choice-card' }, 'aria-labelledby': heading.id }, heading);
  const host = el('div', {}, folio);
  dom.document.body.append(host);
  let scrolled = 0;
  folio.scrollIntoView = () => { scrolled += 1; };
  const target = linkCreationCatalogFolios(host, '#folio-class-choice-card');
  assert.equal(target, folio);
  assert.equal(folio.id, 'folio-class-choice-card');
  assert.equal(dom.document.activeElement, folio);
  assert.equal(scrolled, 1);
  assert.equal(heading.querySelector('a').textContent, 'Class choice card');
  assert.equal(heading.querySelector('a').href, '#folio-class-choice-card');
  assert.equal(creationCatalogHref('class-choice-card'), 'index.html?shot=components#folio-class-choice-card');
  linkCreationCatalogFolios(host);
  assert.equal(heading.querySelectorAll('a').length, 1, 'relinking keeps one heading link');
}));

test('unknown and malformed catalog fragments leave focus unchanged', () => withKitDom(dom => {
  const folio = el('section', { dataset: { catalogComponent: 'creation-step-navigation' } });
  const host = el('div', {}, folio);
  dom.document.body.append(host);
  const before = dom.document.activeElement;
  for (const fragment of ['#missing', '#folio-%E0%A4%A', '#folio-creation-step-navigation[attr]']) {
    assert.equal(linkCreationCatalogFolios(host, fragment), null);
    assert.equal(dom.document.activeElement, before);
  }
}));
