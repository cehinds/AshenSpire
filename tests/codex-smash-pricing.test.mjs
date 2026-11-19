import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { applyGameProfileToContent, resolveGameProfile } from '../src/model/gameProfile.js';
import { buildDerivedTables } from '../tools/derived-tables.mjs';
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

test('every Codex deck and phase reserve fits its lowest-level Stamina pool', () => {
  const characters = new Map(buildDerivedTables()['characters.json'].map(row => [row.id, row]));
  const byId = new Map(cards.map(card => [card.id, card]));
  for (const id of CODEX_IDS) {
    const sheet = JSON.parse(readFileSync(new URL(`../games/ashenspire/packs/core/enemies/${id}.json`, import.meta.url)));
    for (const ref of [...sheet.deck, ...sheet.reserve]) {
      const card = byId.get(ref.slice('card:'.length));
      assert.ok(card, `${id}: ${ref} resolves`);
      assert.ok(card.staminaCost <= characters.get(id).pools.sp, `${id}: ${card.id} costs ${card.staminaCost} of ${characters.get(id).pools.sp} Stamina`);
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
