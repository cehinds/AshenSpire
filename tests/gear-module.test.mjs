// Gear module (owner 2026-10-17): point pools by rarity, tag-driven fill priority, merged in Core,
// and enemies wearing the same (lootable) gear and playing player-shaped cards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { resolveGameAuthor, resolveGearItem, mergeGameSettings } from '../engine/kernel/gameConfig.js';

const author = JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url)));
const catalog = loadGameProfileCatalog();
const profile = resolveGameAuthor(author, catalog);
const gearSettings = profile.modules.gear;
const { gear, enemies, enemyCards } = profile.content;
const RATINGS = ['ar', 'dr', 'poise'], ATTRS = ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'];
const total = (p, keys) => keys.reduce((s, k) => s + p[k], 0);

test('Core merges the two pools; the module default is split', () => {
  assert.equal(gearSettings.pools, 'merged');
  assert.equal(catalog.modules.gear.defaults.pools, 'split');
});

test('every item spends exactly its pool, minus tag costs, within 3 attributes', () => {
  for (const mode of ['split', 'merged']) for (const item of gear) {
    const s = { ...gearSettings, pools: mode }, r = resolveGearItem(item, s);
    const R = s.poolSizes.ratings[item.rarity].max, B = s.poolSizes.bonus[item.rarity].max;
    const spent = total(r.points, RATINGS) + total(r.points, ATTRS) + r.tagCost;
    assert.equal(spent, R + B, `${mode} ${item.id}`);
    if (mode === 'split') assert.equal(total(r.points, RATINGS), R, `${item.id} ratings pool`);
    assert.ok(ATTRS.filter(a => r.points[a] > 0).length <= s.maxAttributes, item.id);
  }
});

test('a greatsword favours STR, AR and poise through its gear-type tag', () => {
  const gs = resolveGearItem(gear.find(i => i.id === 'greatsword'), { ...gearSettings, pools: 'split' }).points;
  assert.ok(gs.strength >= Math.max(gs.dexterity, gs.wisdom, gs.intelligence));
  assert.ok(gs.ar > 0 && gs.poise > 0 && gs.dr === 0);
});

test('points an item sets are kept; only the rest is filled', () => {
  const item = { id: 't', slot: 'rightHand', kind: 'weapon', rarity: 'uncommon', tags: ['greatsword'], points: { intelligence: 3 } };
  const r = resolveGearItem(item, { ...gearSettings, pools: 'split' });
  assert.equal(r.points.intelligence, 3);
  assert.equal(total(r.points, ATTRS), 4);
});

test('pool size changes re-flow unset points automatically', () => {
  const item = gear.find(i => i.id === 'dagger');
  const bigger = mergeGameSettings(gearSettings, { pools: 'split', poolSizes: { bonus: { common: { min: 2, max: 5 } } } });
  assert.equal(total(resolveGearItem(item, bigger).points, ATTRS) + resolveGearItem(item, bigger).tagCost, 5);
});

test('validator refuses set points that exceed the pool', () => {
  const copy = structuredClone(catalog);
  copy.packs['ashen.core-content@1.0.0'].content.gear.find(i => i.id === 'dagger').points = { strength: 9 };
  assert.throws(() => resolveGameAuthor(structuredClone(author), copy), /exceed the pool/);
});

test('enemies wear player gear by id, so their gear can be looted', () => {
  const ids = new Set(gear.map(i => i.id));
  for (const e of enemies) for (const id of e.gear) assert.ok(ids.has(id), `${e.id} -> ${id}`);
  assert.ok(new Set(enemies.flatMap(e => e.gear)).size >= 8, 'gear varies');
});

test('enemy cards are player-shaped with owner-relative targets', () => {
  const player = profile.content.cards[0];
  for (const key of ['id', 'name', 'class', 'rarity', 'cost', 'staminaCost', 'manaCost', 'costRule', 'type', 'icon', 'keywords', 'effects', 'tags', 'textTemplate'])
    for (const card of enemyCards) assert.ok(key in card && key in player, `${card.id}.${key}`);
  for (const card of enemyCards) for (const e of card.effects) assert.notEqual(e.target, 'player', card.id);
  assert.equal(enemyCards.find(c => c.id === 'graveWisp.curse').effects[0].target, 'enemy');
});
