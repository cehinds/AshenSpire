// Owner ruling 2026-10-19 (Core): equipped gear grants cards; the Bone Sceptre grants Mana Surge
// (1 SP, gain 2 Mana) to any class holding it.
import test from 'node:test';
import assert from 'node:assert/strict';

// Kernel validation of gear.grantedCards (like classDecks: names the item and row).
test('gear.grantedCards is validated at profile construction, naming the item and row', async () => {
  const { compileGameProfiles } = await import('../tools/game-config.mjs');
  const { resolveGameAuthor } = await import('../engine/kernel/gameConfig.js');
  const { catalog, authors } = compileGameProfiles();
  const pack = catalog.bundles[authors.core.core].manifest.packs.find(row => row.id === 'ashen.core-content');
  const build = (mutate) => {
    const copy = JSON.parse(JSON.stringify(catalog));
    mutate(copy.packs[`${pack.id}@${pack.version}`].content.gear.find(item => item.id === 'boneSceptre'));
    return () => resolveGameAuthor(authors.core, copy);
  };
  assert.doesNotThrow(build(() => {}), 'the shipped Core bundle validates');
  assert.throws(build(g => { g.grantedCards[0].card = 'core.missing'; }), /gear\/boneSceptre\/grantedCards\/0\/card.*unknown card reference "core.missing" for item boneSceptre row 0/);
  assert.throws(build(g => { g.grantedCards[0].copies = 0; }), /gear\/boneSceptre\/grantedCards\/0\/copies.*positive integer copies for item boneSceptre row 0/);
  assert.throws(build(g => { g.grantedCards[0].copies = '1'; }), /positive integer copies/);
  assert.throws(build(g => { g.grantedCards[0].copies = 1.5; }), /positive integer copies/);
  assert.throws(build(g => { g.grantedCards[0].copies = 2 ** 60; }), /positive integer copies/);
  assert.throws(build(g => { g.grantedCards = 'x'; }), /grantedCards.*expected an array/);
});
