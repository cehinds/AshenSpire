// Optional feature modules (owner 2026-10-17: split so the owner chooses what stays in Core).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { resolveGameAuthor, characterSettings, enemyVisibleFields, enemyRelicIds, deckCopyLimit, resolveEnemyAttributes, enemyAttributeOutcomes, enemyItemBonuses, enemyPools } from '../engine/kernel/gameConfig.js';

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
  assert.deepEqual(off.content.rewards.eligibility?.combatCards, { skipOwned: true }, 'reward ranks off leaves only the authored ownership guard');
  const e = off.content.enemies[0];
  assert.deepEqual(resolveEnemyAttributes(e, s, 7), resolveEnemyAttributes(e, s), 'variance off: no spread');
});

test('boss phase reserves remain payable with enemy relics off', () => {
  const on = resolveGameAuthor(author, catalog);
  const off = without('enemy-relics');
  const manaOutcomes = (profile, enemy) => {
    const settings = characterSettings(profile.modules);
    const bonus = enemyItemBonuses(enemy, profile.content, profile.modules.gear);
    return enemyAttributeOutcomes(enemy, settings)
      .map(attributes => enemyPools({ ...enemy, resolvedAttributes: attributes }, settings, undefined, bonus).mp);
  };
  for (const [id, cardName, onMinimum] of [
    ['mireProcessional', 'finalRequiem', 3],
    ['veiledJusticiar', 'finalJudgement', 2],
  ]) {
    const before = on.content.enemies.find(enemy => enemy.id === id);
    const after = off.content.enemies.find(enemy => enemy.id === id);
    const cardId = `${id}.${cardName}`;
    const onMana = manaOutcomes(on, before);
    assert.equal(Math.min(...onMana), onMinimum);
    assert.deepEqual(onMana, manaOutcomes(on, { ...before, mpFloor: undefined }), `${id}: relic-enabled pools are unchanged`);
    assert.equal(Math.min(...manaOutcomes(off, after)), 2);
    assert.equal(Math.min(...manaOutcomes(off, { ...after, mpFloor: undefined })), 1);
    assert.deepEqual(after.defaultDeck, before.defaultDeck);
    assert.equal(after.defaultDeck.length, 8);
    assert.deepEqual(after.phases, before.phases);
    assert.ok(after.phases.some(phase => phase.unlockCards.includes(cardId)));
    assert.deepEqual(after.unlockCards, [cardId]);
    const card = off.content.enemyCards.find(row => row.id === cardId);
    assert.deepEqual([card.staminaCost, card.manaCost], [3, 2]);
  }
});
