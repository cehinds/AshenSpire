import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { withModalDom } from './helpers/modal-dom.mjs';
import { openCharacterSheet } from '../src/ui/screens/characterSheet.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

test('Core Armory sheet spends an earned attribute point without a rest visit', () => {
  withModalDom(() => {
    const run = createRunState({ seed: 73, classId: 'reaver', registries });
    run.level.unspentPoints = 1;
    const before = run.attributes.strength;
    let changes = 0;
    const sheet = openCharacterSheet({ registries, run, onChange: () => changes++ });
    sheet.panel.querySelector('.progression-points').click();
    document.querySelector('[data-stat-id="strength"][data-stat-action="increase"]').click();
    document.querySelector('[data-stat-done]').click();
    assert.equal(run.attributes.strength, before + 1);
    assert.equal(run.level.unspentPoints, 0);
    assert.equal(changes, 1);
    sheet.close();
  });
});

test('the character sheet cadence line is profile-aware: Core says where points are spent, legacy keeps Level up', () => {
  withModalDom(() => {
    const core = createRunState({ seed: 73, classId: 'reaver', registries });
    const sheet = openCharacterSheet({ registries, run: core });
    assert.match(sheet.panel.querySelector('.cs-cadence').textContent, /Spend attribute points here or on the Victory screen/);
    sheet.close();
    const legacyRegistries = createRegistries(contentBundle);
    const legacy = createRunState({ seed: 4242, classId: 'reaver', registries: legacyRegistries });
    const old = openCharacterSheet({ registries: legacyRegistries, run: legacy });
    assert.match(old.panel.querySelector('.cs-cadence').textContent, /Each level is claimed with Level up/);
    old.close();
  });
});
