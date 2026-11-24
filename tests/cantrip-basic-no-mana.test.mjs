// Basics cost no Mana; a cantrip costs 0 or 1 Mana (owner, 2026-11-22 ruling, was 0 from 2026-11-01): content census, validator, saved copies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { upgradeBasic } from '../src/model/cardUpgradeLimits.js';
import { applyUpgradeSteps } from '../src/model/cardUpgrade.js';

test('census: no Core Basic prints Mana and no Core cantrip prints more than 1', () => {
  const isCantrip = (d) => (d.tags || []).includes('rank.cantrip');
  const core = registries.cards.all().filter((d) => upgradeBasic(d) && String(d.id).startsWith('core.'));
  // Gale Push costs 1 MP (owner ruling 2026-11-19, Retreat-source drawbacks)
  assert.deepEqual(core.filter((d) => !isCantrip(d) && d.manaCost > 0 && d.id !== 'core.galePush').map((d) => d.id), []);
  assert.deepEqual(core.filter((d) => isCantrip(d) && d.manaCost > 1).map((d) => d.id), []);
  for (const d of core) assert.ok(!(d.upgrade && d.upgrade.manaCost > (isCantrip(d) ? 1 : 0)) || d.id === 'core.galePush', `${d.id} upgrade`);
});

test('the validator allows a rank.cantrip card at 0 or 1 Mana and refuses 2 or more, base or upgrade', () => {
  assert.equal(validateContent(contentBundle).ok, true);
  const card = (patch) => ({ id: 't.cantrip', name: 'T', class: 'colorless', rarity: 'common', cost: 1, staminaCost: 1, manaCost: 0, type: 'skill', icon: 'skill', keywords: [],
    effects: [{ op: 'heal', target: 'self', amount: 4 }], tags: ['camp:spell', 'source:spell', 'rank.cantrip'], textTemplate: 'Heal {heal} HP.', ...patch });
  const mutate = (patch) => ({ ...contentBundle, cards: [...contentBundle.cards, card(patch)] });
  const refusal = 'a cantrip costs at most 1 Mana';
  const up = (manaCost) => ({ upgrade: { manaCost, effects: [{ op: 'heal', target: 'self', amount: 6 }] } });
  for (const patch of [{}, { manaCost: 1 }, up(0), up(1), { manaCost: 1, ...up(1) }]) {
    assert.ok(!JSON.stringify(validateContent(mutate(patch)).errors).includes(refusal), JSON.stringify(patch));
  }
  assert.ok(JSON.stringify(validateContent(mutate({ manaCost: 2 })).errors).includes(refusal));
  assert.ok(JSON.stringify(validateContent(mutate(up(2))).errors).includes('upgrade.manaCost'));
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
