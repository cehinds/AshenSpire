import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { cardManaCategory } from '../src/model/cardManaPolicy.js';

// Measured by resolving real base and upgraded faces on clean dev 66e473a77c.
// Inner Orbit+ re-pinned 2026-11-20 (#2902): its upgrade now drops Exhaust, which the legacy action-cost formula prices +1 (0 -> 1).
// Core's profile authors fixed costs and is unaffected (tests/stat-buff-exhaust.test.mjs).
// A new package's default art contributes to a registry-wide identity set:
// lending an ordinary old card must not silently reprice it for every weapon.
const baseline = JSON.parse(readFileSync(new URL('./fixtures/codex-equipment-legacy-mana.json', import.meta.url)));
const packages = JSON.parse(readFileSync(new URL('../content/source/weaponCardPackages.json', import.meta.url)));
const registries = createRegistries(contentBundle);
const signature = face => [cardManaCategory(registries, face), face.cost, face.manaCost || 0];

test('all 28 pre-Codex weapon packages retain their complete authored identity', () => {
  assert.equal(baseline.packages.length, 28);
  for (const row of baseline.packages) assert.deepEqual(packages.find(current => current.weaponId === row.weaponId), row, row.weaponId);
});

test('the 33 new defaults use only existing weapon-art identities or the existing Quickstep exception', () => {
  const oldIds = new Set(baseline.packages.map(row => row.weaponId));
  const allowed = new Set(baseline.packages.flatMap(row => row.package.weaponArtDefaults));
  allowed.add('quickstep');
  const additions = packages.filter(row => !oldIds.has(row.weaponId));
  assert.equal(additions.length, 33);
  const changed = additions.filter(row => row.package.weaponArtDefaults.some(id => !allowed.has(id)));
  assert.deepEqual(changed.map(row => [row.weaponId, row.package.weaponArtDefaults]), []);
});

test('all 395 legacy cards keep their resolved Mana categories and base and upgrade prices', () => {
  assert.equal(baseline.cards.length, 395);
  const changed = [];
  for (const [id, expectedBase, expectedUpgrade] of baseline.cards) {
    const actualBase = signature(resolveCard(registries, { cardId: id }));
    const actualUpgrade = signature(resolveCard(registries, { cardId: id, upgraded: true }));
    if (JSON.stringify([actualBase, actualUpgrade]) !== JSON.stringify([expectedBase, expectedUpgrade])) {
      changed.push({ id, expected: [expectedBase, expectedUpgrade], actual: [actualBase, actualUpgrade] });
    }
  }
  assert.deepEqual(changed, [], 'new gear must not reclassify old cards or change what their faces charge');
});
