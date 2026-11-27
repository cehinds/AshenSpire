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
  const poolOutcomes = (profile, enemy) => {
    const settings = characterSettings(profile.modules);
    const bonus = enemyItemBonuses(enemy, profile.content, profile.modules.gear);
    return enemyAttributeOutcomes(enemy, settings)
      .map(attributes => enemyPools({ ...enemy, resolvedAttributes: attributes }, settings, undefined, bonus));
  };
  const bosses = on.content.enemies.filter(enemy => enemy.phases?.some(phase => phase.unlockCards?.length));
  assert.ok(bosses.length > 0, 'exercise authored phase unlocks');
  for (const before of bosses) {
    const id = before.id;
    const after = off.content.enemies.find(enemy => enemy.id === id);
    assert.ok(after, id);
    const cardIds = [...new Set(before.phases.flatMap(phase => phase.unlockCards || []))];
    assert.deepEqual(after.defaultDeck, before.defaultDeck);
    assert.deepEqual(after.phases, before.phases);
    assert.deepEqual(after.unlockCards, before.unlockCards);
    for (const cardId of cardIds) {
      const card = off.content.enemyCards.find(row => row.id === cardId);
      assert.ok(card, `${id}: ${cardId} resolves`);
      assert.deepEqual(card, on.content.enemyCards.find(row => row.id === cardId));
      for (const [label, configured, enemy] of [['on', on, before], ['off', off, after]]) {
        for (const pools of poolOutcomes(configured, enemy)) {
          assert.ok(pools.mp >= (card.manaCost || 0), `${id}: ${label} reserve pays ${cardId} Mana`);
          assert.ok(pools.sp >= (card.staminaCost ?? card.cost ?? 0), `${id}: ${label} reserve pays ${cardId} Stamina`);
        }
      }
    }
  }
});

test('explicit enemy pool floors remain effective without equipment or relic bonuses', () => {
  const settings = { levelFrom: 'levelProfile.max', rounding: 'down',
    tagRules: { 'character.enemy': { pools: { hp: 20, sp: 1, mp: 1 } } },
    statRules: { hp: {}, sp: {}, mp: {} } };
  const enemy = { tier: 'boss', levelProfile: { min: 1, max: 1 }, spFloor: 3, mpFloor: 4,
    resolvedAttributes: { strength: 0, dexterity: 0, constitution: 0, wisdom: 0, intelligence: 0 } };
  const plain = enemyPools({ ...enemy, spFloor: undefined, mpFloor: undefined }, settings);
  assert.deepEqual(plain, { hp: 20, sp: 1, mp: 1 });
  assert.deepEqual(enemyPools(enemy, settings), { hp: 20, sp: 3, mp: 4 });
  assert.deepEqual(enemyPools(enemy, settings, 1, { sp: 2, mp: 4 }), { hp: 20, sp: 3, mp: 5 });
});
