import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { awardLevelXp, xpToNext } from '../src/model/levelup.js';
import { withModalDom } from './helpers/modal-dom.mjs';
import { openCharacterSheet } from '../src/ui/screens/characterSheet.js';
import { t } from '../src/ui/strings.js';

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

test('Progression hub hands rewards and respec to their writers after closing and keeps Back functional', () => {
  withModalDom(() => {
    const run = createRunState({ seed: 4242, classId: 'reaver', registries });
    const before = structuredClone(run), events = [];
    const open = () => openCharacterSheet({ registries, run, settings: {},
      onClose: () => events.push('closed'), onRewards: () => events.push('rewards'),
      onRespec: () => events.push('respec'),
    });
    const clickLabel = (sheet, label) => {
      const action = [...sheet.panel.querySelectorAll('button')].find(node => node.textContent === label);
      assert.ok(action, `missing action ${label}`);
      action.click();
    };
    clickLabel(open(), t('progression.rewards'));
    assert.deepEqual(events, ['closed', 'rewards']);
    clickLabel(open(), t('classRespec.title'));
    assert.deepEqual(events, ['closed', 'rewards', 'closed', 'respec']);
    clickLabel(open(), t('common.back'));
    assert.deepEqual(events, ['closed', 'rewards', 'closed', 'respec', 'closed']);
    assert.deepEqual(run, before, 'opening and leaving the hub never claims or rebuilds progression');
  });
});
