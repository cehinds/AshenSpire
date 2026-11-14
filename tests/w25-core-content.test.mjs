// Owner, 2026-11-14 content decisions for Core (W25-B): Backstep cost, Jab as a reaction, spell damage, Ward and Barrier.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
const card = id => cards.find(row => row.id === id);

test('Backstep costs 2 Stamina, in the pack and under every resource profile', () => {
  const backstep = card('core.backstep');
  assert.equal(backstep.staminaCost, 2);
  assert.equal(backstep.cost, 2);
  const variants = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/resourceVariants.json', import.meta.url), 'utf8'))['core.backstep'];
  assert.equal(variants.sp.staminaCost, 2);
  assert.equal(variants['sp,mp'].staminaCost, 2);
});
