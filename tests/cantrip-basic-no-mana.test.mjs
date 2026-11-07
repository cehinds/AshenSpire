// Cantrips and basics cost no Mana (owner, 2026-11-01): content census, validator, saved copies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { upgradeBasic } from '../src/model/cardUpgradeLimits.js';
import { applyUpgradeSteps } from '../src/model/cardUpgrade.js';

test('census: no Core cantrip or Basic card (upgradeBasic) prints Mana', () => {
  const bad = registries.cards.all().filter((d) => upgradeBasic(d) && d.manaCost > 0 && String(d.id).startsWith('core.'));
  assert.deepEqual(bad.map((d) => d.id), []);
  for (const d of registries.cards.all()) if (String(d.id).startsWith('core.') && upgradeBasic(d)) {
    assert.ok(!(d.upgrade && d.upgrade.manaCost > 0), `${d.id} upgrade`);
  }
});

test('the validator refuses a rank.cantrip card with Mana, base or upgrade', () => {
  assert.equal(validateContent(contentBundle).ok, true);
  const card = (patch) => ({ id: 't.cantrip', name: 'T', class: 'colorless', rarity: 'common', cost: 1, staminaCost: 1, manaCost: 0, type: 'skill', icon: 'skill', keywords: [],
    effects: [{ op: 'heal', target: 'self', amount: 4 }], tags: ['camp:spell', 'source:spell', 'rank.cantrip'], textTemplate: 'Heal {heal} HP.', ...patch });
  const mutate = (patch) => ({ ...contentBundle, cards: [...contentBundle.cards, card(patch)] });
  assert.ok(!JSON.stringify(validateContent(mutate({})).errors).includes('a cantrip costs no Mana'));
  const base = validateContent(mutate({ manaCost: 1 }));
  assert.ok(JSON.stringify(base.errors).includes('a cantrip costs no Mana'));
  const up = validateContent(mutate({ upgrade: { manaCost: 1, effects: [{ op: 'heal', target: 'self', amount: 6 }] } }));
  assert.ok(JSON.stringify(up.errors).includes('upgrade.manaCost'));
});

test('a saved Mending Touch copy, plain and upgraded, resolves to 0 Mana and 1 SP', () => {
  const def = registries.cards.get('core.mendingTouch');
  assert.equal(def.manaCost, 0);
  assert.equal(def.staminaCost, 1);
  for (const steps of [[{ k: 'authored' }]]) {
    const face = applyUpgradeSteps(def, steps);
    assert.equal(face.manaCost, 0);
    assert.equal(face.staminaCost, 1);
  }
});
