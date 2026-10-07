import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { awardLevelXp, xpToNext } from '../src/model/levelup.js';
import { withModalDom } from './helpers/modal-dom.mjs';
import { openCharacterSheet } from '../src/ui/screens/characterSheet.js';

const registries = createRegistries(contentBundle);

test('Progression renders owned feats, keeps allocation separate from expansion, and commits only Done', () => {
  withModalDom(() => {
    const run = createRunState({ seed: 4242, classId: 'reaver', registries });
    awardLevelXp(registries, run, xpToNext(registries, 1), { pointsPerLevel: 2 });
    run.feats = ['fieldStudy'];
    let changes = 0;
    const sheet = openCharacterSheet({ registries, run, onChange: () => changes++ });
    const ownedFeat = sheet.panel.querySelector('[data-feat="fieldStudy"]');
    assert.equal(ownedFeat.querySelector('.progression-feat-effect').textContent, 'Gain 10% more character XP from combat.');
    assert.equal(ownedFeat.getAttribute('data-feat-owned'), 'true');
    const before = { ...run.attributes };
    const expand = sheet.panel.querySelector('.progression-attributes-toggle');
    expand.click();
    assert.equal(expand.getAttribute('aria-expanded'), 'true');
    assert.equal(sheet.panel.querySelectorAll('.progression-attributes-detail .cc-attribute-card').length, 5);
    assert.equal(document.querySelector('.cc-stat-modal'), null);
    sheet.panel.querySelector('.progression-points').click();
    document.querySelector('[data-stat-id="strength"][data-stat-action="increase"]').click();
    document.querySelector('[data-stat-cancel]').click();
    assert.deepEqual(run.attributes, before);
    assert.equal(run.level.unspentPoints, 2);
    sheet.panel.querySelector('.progression-points').click();
    document.querySelector('[data-stat-id="strength"][data-stat-action="increase"]').click();
    document.querySelector('[data-stat-done]').click();
    assert.equal(run.attributes.strength, before.strength + 1);
    assert.equal(run.level.unspentPoints, 1);
    assert.equal(changes, 1);
    assert.equal(document.activeElement, sheet.panel.querySelector('.progression-points'));
    sheet.panel.querySelector('.progression-points').click();
    document.querySelector('[data-stat-id="strength"][data-stat-action="increase"]').click();
    document.querySelector('[data-stat-id="strength"][data-stat-action="increase"]').click();
    document.querySelector('[data-stat-done]').click();
    assert.equal(run.attributes.strength, before.strength + 2, 'cannot overspend');
    assert.equal(run.level.unspentPoints, 0);
    assert.equal(sheet.panel.querySelector('.progression-points').getAttribute('aria-disabled'), 'true');
    assert.equal(sheet.panel.querySelector('.progression-points').classList.contains('available'), false);
    sheet.panel.querySelector('.progression-points').click();
    assert.equal(document.querySelector('.cc-stat-modal'), null);
    sheet.close();
  });
});

test('Skill and feat inspection render real card references and leave progression untouched', () => {
  withModalDom(() => {
    const run = createRunState({ seed: 4242, classId: 'reaver', registries });
    const before = structuredClone(run);
    const sheet = openCharacterSheet({ registries, run, tab: 'skills' });
    sheet.panel.querySelector('[data-skill="item:blade"]').click();
    assert.ok(document.querySelector('.progression-associated-cards .card'));
    const feat = document.querySelector('.progression-inspection .progression-feat-list button');
    assert.ok(feat.querySelector('.progression-feat-effect').textContent.includes('critical hit'));
    assert.ok(feat.querySelector('.progression-feat-tag'));
    feat.click();
    assert.ok(document.querySelectorAll('.progression-inspection').length >= 2);
    assert.deepEqual(run, before);
    for (const close of [...document.querySelectorAll('.modal-close')].reverse()) close.click();
  });
});
