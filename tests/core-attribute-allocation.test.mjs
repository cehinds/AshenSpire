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
