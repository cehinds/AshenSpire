import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { applyGameProfileToContent, resolveGameProfile } from '../src/model/gameProfile.js';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { resolveGameAuthor, characterSettings, enemyAttributeOutcomes, enemyItemBonuses, enemyLevel, enemyPools } from '../engine/kernel/gameConfig.js';
import { CODEX_IDS } from '../tools/enemy-roster-table.mjs';

const cards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/enemyCards.json', import.meta.url)));
const smashes = cards.filter(card => CODEX_IDS.includes(card.id.split('.')[0]) && card.tags.includes('maneuver:smash'));
const bands = new Map([[2, [5, 8]], [3, [15, 20]], [4, [25, 30]]]);

test('Codex Smashes pay one Stamina more than the matching Attack damage tier', () => {
  assert.equal(smashes.length, 22);
  for (const card of smashes) {
    const band = bands.get(card.staminaCost);
    assert.ok(band, `${card.id}: supported Smash cost`);
    assert.equal(card.cost, card.staminaCost, `${card.id}: face and paid cost agree`);
    const damage = card.effects.filter(effect => effect.op === 'damage');
    assert.equal(damage.length, 1, card.id);
    const amount = damage[0].amount * (damage[0].hits ?? 1);
    assert.ok(amount >= band[0] && amount <= band[1], `${card.id}: ${amount} damage for ${card.staminaCost} Stamina`);
  }
});

test('every Codex deck and phase reserve stays affordable with optional modules disabled', () => {
  const author = JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url)));
  const catalog = loadGameProfileCatalog();
  const optional = ['attribute-variance', 'heal-rules', 'stagger', 'enemy-visibility', 'enemy-relics', 'card-pools', 'deck-training', 'reward-ranks'];
  for (const disabled of [[], ...optional.map(id => [id]), optional]) {
    const label = disabled.join(', ') || 'all enabled';
    const profile = resolveGameAuthor({ ...author, modules: { ...author.modules, ...Object.fromEntries(disabled.map(id => [id, false])) } }, catalog);
    const settings = characterSettings(profile.modules);
    const byId = new Map(profile.content.cards.map(card => [card.id, card]));
    for (const enemy of profile.content.enemies.filter(row => CODEX_IDS.includes(row.id))) {
      const bonus = enemyItemBonuses(enemy, profile.content, profile.modules.gear);
      const pools = enemyAttributeOutcomes(enemy, settings).map(attributes => enemyPools({ ...enemy, resolvedAttributes: attributes }, settings, enemyLevel(enemy, settings), bonus));
      const sp = Math.min(...pools.map(pool => pool.sp)), mp = Math.min(...pools.map(pool => pool.mp));
      for (const id of [...enemy.defaultDeck, ...(enemy.unlockCards || []), ...(enemy.firstCard ? [enemy.firstCard] : [])]) {
        const card = byId.get(id);
        const context = `${label}: ${enemy.id}, ${id}`;
        assert.ok(card, `${context} resolves`);
        assert.ok(card.staminaCost <= sp, `${context} costs ${card.staminaCost} of ${sp} Stamina`);
        assert.ok(card.manaCost <= mp, `${context} costs ${card.manaCost} of ${mp} Mana`);
      }
    }
  }
});

test('Core projects the repriced Smash costs and damage into real enemy moves', () => {
  const profile = resolveGameProfile('core');
  const projected = applyGameProfileToContent(contentBundle, profile);
  for (const card of smashes) {
    const id = card.id.split('.')[0];
    const authored = profile.content.enemies.find(enemy => enemy.id === id);
    const moveId = authored.cardHints[card.id].legacyMove;
    const move = projected.enemies.find(enemy => enemy.id === id).moves[moveId];
    assert.equal(move.sp, card.staminaCost, `${card.id}: runtime price`);
    assert.equal(move.damage, card.effects.find(effect => effect.op === 'damage').amount, `${card.id}: runtime damage`);
  }
});
