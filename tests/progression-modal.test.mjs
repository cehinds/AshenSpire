import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { awardLevelXp, xpToNext } from '../src/model/levelup.js';
import { withModalDom } from './helpers/dom.mjs';
import { openCharacterSheet } from '../src/ui/screens/characterSheet.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { t } from '../src/ui/strings.js';

const registries = createRegistries(contentBundle);

test('Progression keeps allocation separate from expansion, and commits only Done', () => {
  withModalDom(() => {
    const run = createRunState({ seed: 4242, classId: 'reaver', registries });
    awardLevelXp(registries, run, xpToNext(registries, 1), { pointsPerLevel: 2 });
        let changes = 0;
    const sheet = openCharacterSheet({ registries, run, onChange: () => changes++ });
    assert.equal(sheet.panel.querySelector('.progression-feats'), null, 'the Feats section is retired');
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

test('Skill inspection renders real card references and leave progression untouched', () => {
  withModalDom(() => {
    const run = createRunState({ seed: 4242, classId: 'reaver', registries });
    const before = structuredClone(run);
    const sheet = openCharacterSheet({ registries, run, tab: 'skills' });
    sheet.panel.querySelector('[data-skill="item:blade"]').click();
    assert.ok(document.querySelector('.progression-associated-cards .card'));
    assert.equal(document.querySelector('.progression-feat-list'), null, 'skill feats are retired');
    assert.deepEqual(run, before);
    for (const close of [...document.querySelectorAll('.modal-close')].reverse()) close.click();
  });
});

test('configured progression opens Character directly without legacy reward or respec actions', () => {
  withModalDom(() => {
    const profile = resolveGameProfile('core');
    const coreRegistries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
    const run = createRunState({ seed: 4242, classId: 'reaver', registries: coreRegistries });
    const before = structuredClone(run), events = [];
    const sheet = openCharacterSheet({ registries: coreRegistries, run, tab: 'skills',
      onRewards: () => events.push('rewards') });
    assert.equal(sheet.panel.querySelector('.character-sheet-body').dataset.tab, 'character');
    const labels = [...sheet.panel.querySelectorAll('button')].map(node => node.textContent);
    assert.equal(labels.includes(t('progression.tab.skills')), false);
    assert.equal(labels.includes(t('progression.tab.class')), false);
    assert.equal(labels.includes(t('progression.rewards')), false);
    assert.deepEqual(events, []);
    assert.deepEqual(run, before, 'opening the configured character page does not mutate progression');
    sheet.close();
  });
});
