// Enemies module (docs/plans/enemy-decks.md, owner 2026-10-17): JSON-configured enemy decks,
// tier pools from attributes, tag-driven heal rules, and the build validator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { resolveGameAuthor, enemyPools } from '../engine/kernel/gameConfig.js';

const author = JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url)));
const catalog = loadGameProfileCatalog();
const profile = resolveGameAuthor(author, catalog);
const settings = profile.modules.enemies;
const { enemies, enemyCards } = profile.content;

// Resolve again with one pack-content edit applied to a cloned catalog.
function resolveWith(edit, authorEdit = a => a) {
  const copy = structuredClone(catalog);
  const pack = copy.packs['ashen.core-content@1.0.0'].content;
  edit(pack);
  return () => resolveGameAuthor(authorEdit(structuredClone(author)), copy);
}

test('core profile enables the enemies module with its JSON defaults', () => {
  assert.ok(settings, 'enemies module resolved');
  assert.deepEqual(settings.include, ['minion', 'elite', 'boss']);
  assert.equal(settings.healRules.shapes.find(s => s.id === 'full').cost.sp, 3);
  assert.equal(settings.healRules.shapes.find(s => s.id === 'full').cost.mp, 2);
  assert.equal(settings.healRules.shapes.find(s => s.id === 'full').amount.percentMaxHp, 10);
  assert.equal(settings.healRules.shapes.find(s => s.id === 'cheap').exhaust, true);
});

test('attributes start at 0 and are assigned freely: minion 2, elite 4, boss 6 points', () => {
  const total = e => Object.values(e.attributes).reduce((a, b) => a + b, 0);
  for (const e of enemies) {
    const [lo, hi] = { minion: [2, 2], elite: [4, 4], boss: [6, 6] }[e.tier];
    assert.ok(total(e) >= lo && total(e) <= hi, `${e.id} (${e.tier}) assigns ${total(e)}`);
    assert.deepEqual(settings.tiers[e.tier].attributeBudget, [lo, hi]);
  }
  // Free assignment: stat shapes differ between enemies.
  assert.ok(new Set(enemies.map(e => JSON.stringify(e.attributes))).size >= 8, 'stat shapes vary');
});

test('CON stays small (at most 1) and every enemy can pay its dearest card', () => {
  for (const e of enemies) {
    const pools = enemyPools(e, settings);
    const needs = Math.max(...[...e.deck, ...(e.unlockCards || [])].map(id => enemyCards.find(c => c.id === id)?.staminaCost ?? 0));
    assert.ok(e.attributes.constitution <= 1, `${e.id} CON ${e.attributes.constitution}`);
    const needMp = Math.max(...[...e.deck, ...(e.unlockCards || [])].map(id => enemyCards.find(c => c.id === id)?.manaCost ?? 0));
    assert.ok(needMp <= pools.mp, `${e.id} can pay its dearest MP card`);
    assert.ok(needs <= pools.sp, `${e.id} can pay its dearest card`);
  }
});

test('HP is 10 + CON 10 / STR 5 / DEX 3 / WIS 2 / INT 2 per point + 5 per level, plus the level term; SP/MP/AR/DR/hand follow the existing stat rows', () => {
  assert.deepEqual(settings.statRules.hp, { strength: 5, dexterity: 3, constitution: 10, wisdom: 2, intelligence: 2, perLevel: 5 });
  for (const tier of ['minion', 'elite', 'boss']) assert.equal(settings.tiers[tier].pools.hp, 10);
  for (const e of enemies) {
    const level = Math.max(1, e.levelProfile?.min ?? 1);
    const p = enemyPools(e, settings);
    const a = e.attributes;
    assert.equal(p.hp, 10 + 10 * a.constitution + 5 * a.strength + 3 * a.dexterity + 2 * a.wisdom + 2 * a.intelligence + 5 * (level - 1), e.id);
    assert.equal(p.ar, e.attributes.strength, e.id);
    assert.equal(p.dr, e.attributes.dexterity, e.id);
  }
  // Level feeds in: the same character is stronger at a higher level.
  const wisp = enemies.find(e => e.id === 'graveWisp');
  assert.ok(enemyPools(wisp, settings, 10).hp > enemyPools(wisp, settings, 1).hp);
});

test('enemy decks vary in size within the configured bounds and resolve every reference', () => {
  const sizes = new Set(enemies.map(e => e.deck.length));
  assert.ok(sizes.size > 1, 'deck size varies by enemy');
  const cards = new Set(enemyCards.map(c => c.id));
  for (const e of enemies) for (const id of e.deck) assert.ok(cards.has(id), `${e.id} -> ${id}`);
});

test('heal cards take their cost from healRules; minion heals are the cheap exhaust shape', () => {
  const heals = enemyCards.filter(c => c.tags.includes('heal'));
  assert.ok(heals.length > 0);
  for (const card of heals) {
    const owner = enemies.find(e => e.id === card.enemy);
    if (owner.tier === 'minion') {
      assert.ok(card.tags.includes('exhaust'), `${card.id} exhausts`);
      assert.deepEqual([card.staminaCost, card.manaCost], [1, 1]);
    } else {
      assert.deepEqual([card.staminaCost, card.manaCost], [3, 2]);
    }
    assert.ok(card.effects.some(e => e.op === 'heal' && e.rule === 'healRules'));
  }
});

test('validator refuses an unknown card reference', () => {
  assert.throws(resolveWith(p => { p.enemies[0].deck[0] = 'nope.card'; }), /unresolved card reference 'nope\.card'/);
});

test('validator refuses a deck outside the size bounds', () => {
  assert.throws(resolveWith(p => { p.enemies[0].deck = p.enemies[0].deck.slice(0, 2); }), /deck size 2 outside/);
});

test('validator refuses attributes outside the tier budget', () => {
  assert.throws(resolveWith(p => { p.enemies[0].attributes.strength += 20; }), /outside minion budget/);
});

test('validator refuses a card the enemy can never afford (minion full heal)', () => {
  assert.throws(resolveWith(p => {
    const wisp = p.enemies.find(e => e.id === 'graveWisp');
    const drain = p.enemyCards.find(c => c.id === 'graveWisp.drain');
    drain.tags = drain.tags.filter(t => t !== 'exhaust');
    drain.staminaCost = 3; drain.manaCost = 2;
    assert.ok(wisp.deck.includes(drain.id));
  }), /costs 3 SP\/2 MP; enemy has 2 SP/);
});

test('validator refuses a heal card whose cost disagrees with its heal shape', () => {
  assert.throws(resolveWith(p => { p.enemyCards.find(c => c.id === 'graveWisp.drain').staminaCost = 0; }), /cost must match heal shape 'cheap'/);
});

test('game.json can override module settings, and the validator follows the override', () => {
  const override = a => ({ ...a, modules: { ...a.modules, enemies: { healRules: { ...settings.healRules,
    shapes: settings.healRules.shapes.map(s => s.id === 'cheap' ? { ...s, cost: { sp: 2, mp: 0 } } : s) } } } });
  // Existing cheap heal cards (1 SP / 1 MP) no longer match the overridden shape.
  assert.throws(resolveWith(() => {}, override), /cost must match heal shape 'cheap'/);
});
