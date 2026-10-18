// Optional feature modules (owner 2026-10-17: split so the owner chooses what stays in Core).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { resolveGameAuthor, characterSettings, enemyVisibleFields, enemyRelicIds, deckCopyLimit, resolveEnemyAttributes } from '../engine/kernel/gameConfig.js';

const author = JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url)));
const catalog = loadGameProfileCatalog();
const OPTIONAL = ['attribute-variance', 'heal-rules', 'stagger', 'enemy-visibility', 'enemy-relics', 'card-pools', 'deck-training', 'reward-ranks'];
const without = (...ids) => resolveGameAuthor({ ...author, modules: { ...author.modules, ...Object.fromEntries(ids.map(id => [id, false])) } }, catalog);

test('Core selects every optional feature module', () => {
  const profile = resolveGameAuthor(author, catalog);
  for (const id of OPTIONAL) assert.ok(profile.modules[id], id);
});

test('each optional module can be switched off on its own, and all at once', () => {
  for (const id of OPTIONAL) assert.doesNotThrow(() => without(id), id);
  assert.doesNotThrow(() => without(...OPTIONAL));
});

test('switched-off features fall back as documented', () => {
  const off = without(...OPTIONAL), s = characterSettings(off.modules);
  assert.equal(enemyVisibleFields(s, []).has('sp'), true, 'visibility off: everything shown');
  assert.ok(off.content.enemies.every(e => enemyRelicIds(e).length === 0), 'relics off: none carried');
  const reaver = off.content.characters.find(c => c.id === 'reaver');
  assert.equal(deckCopyLimit('core.strike', reaver, off.content, s, off.modules.gear, { 'core.strike': 3 }), 3, 'training off: owned copies');
  assert.equal(off.content.rewards.eligibility?.combatCards, undefined, 'reward ranks off');
  const e = off.content.enemies[0];
  assert.deepEqual(resolveEnemyAttributes(e, s, 7), resolveEnemyAttributes(e, s), 'variance off: no spread');
});
