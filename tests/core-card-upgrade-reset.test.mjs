// Card upgrades 5/7: wherever `upgraded` is reset to false, stored upgrade steps go too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries as coreRegistries } from './helpers/fixcore-combat-rules.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';

const legacyRegistries = createRegistries(contentBundle);
import { resolveCard } from '../src/model/registries.js';
import { upgradeCount, upgradeStepsOf } from '../src/model/cardUpgrade.js';
import { createRunState } from '../src/model/state.js';
import { restampSmithingCards } from '../src/model/smithing.js';
import { readFileSync } from 'node:fs';

const STEPS = [{ k: 'authored' }, { k: 'dmg', n: 3 }];

test('an explicit upgraded:false wins over a stale step list', () => {
  const stale = { instanceId: 'i', cardId: 'core.strike', upgraded: false, upgradeSteps: STEPS };
  assert.equal(upgradeCount(stale), 0);
  assert.deepEqual(upgradeStepsOf(stale), []);
  assert.deepEqual(resolveCard(coreRegistries, stale), resolveCard(coreRegistries, { instanceId: 'i', cardId: 'core.strike' }));
});

test('restampSmithingCards drops the steps of an equipment-bound card it resets', () => {
  const run = createRunState({ seed: 211, classId: 'reaver', registries: legacyRegistries });
  const kit = run.deck.find((row) => row.instanceId === 'kit:straightSword:attack');
  assert.ok(kit);
  Object.assign(kit, { upgraded: true, upgradeSteps: STEPS });
  restampSmithingCards(legacyRegistries, run);
  assert.equal(kit.upgraded, false);
  assert.equal(kit.upgradeSteps, undefined);
});

test('every site that resets upgraded to false on a spread or live instance clears upgradeSteps', () => {
  for (const [file, needle] of [
    ['../src/model/smithing.js', 'instance.upgraded = false;'],
    ['../src/model/loadout.js', 'inst.upgraded = false;'],
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const at = [...source.matchAll(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))];
    assert.ok(at.length > 0);
    for (const m of at) assert.match(source.slice(m.index, m.index + 120), /delete (instance|inst)\.upgradeSteps/, `${file} reset at ${m.index}`);
  }
});
