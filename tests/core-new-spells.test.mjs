// Current authored card and resource projections; no old balance wave is frozen here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gameProfileCatalog } from '../src/content/generated/gameProfiles.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, projectGameCard } from '../src/model/gameProfile.js';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const source = read('games/ashenspire/packs/core/cards.json');
const variants = read('games/ashenspire/packs/core/resourceVariants.json');
const author = read('games/ashenspire/game.json');
const profile = resolveGameProfile(author);
const pack = Object.values(gameProfileCatalog.packs).find(row => row.manifest.id === 'ashen.core-content').content;
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

test('current configured cards preserve source membership, class, rarity, effects and upgrade definitions', () => {
  const manifest = read('games/ashenspire/packs/core/pack.json');
  assert.equal(new Set(pack.cards.map(card => card.id)).size, pack.cards.length, 'compiled card IDs are unique');
  assert.deepEqual(pack.cards.map(card => card.id).sort(), [...source.map(card => card.id), ...(manifest.sharedCardIds || [])].sort(),
    'the compiled pack contains exactly current cards and explicitly admitted shared definitions');
  for (const row of source) {
    const projected = profile.content.cards.find(card => card.id === row.id);
    for (const key of ['name', 'class', 'rarity', 'effects', 'upgrade']) {
      assert.deepEqual(projected[key], row[key], `${row.id}.${key}`);
    }
    const resolved = resolveCard(reg, { cardId: row.id });
    const upgraded = resolveCard(reg, { cardId: row.id, upgraded: true });
    const expected = projectGameCard(profile, row.id);
    const expectedUpgrade = projectGameCard(profile, { cardId: row.id, upgraded: true });
    for (const key of ['cost', 'manaCost', 'effects', 'keywords', 'textTemplate']) {
      assert.deepEqual(resolved[key], expected[key], `${row.id} base ${key}`);
      assert.deepEqual(upgraded[key], expectedUpgrade[key], `${row.id} upgraded ${key}`);
    }
  }
});

test('resource variant definitions reach the profile unchanged', () => {
  for (const [id, row] of Object.entries(variants)) assert.deepEqual(pack.resourceVariants[id], row, id);
  for (const [id, row] of Object.entries(variants)) assert.deepEqual(profile.content.resourceVariants[id], row, id);
});

test('all authored resource modes apply their own prices without mutating source definitions', () => {
  const before = JSON.stringify([source, variants, profile]);
  for (const include of [[], ['sp'], ['mp'], ['sp', 'mp']]) {
    const changed = resolveGameProfile({ ...author, modules: { ...author.modules, resources: { include } } });
    const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, changed)), changed);
    const key = include.join(',') || 'none';
    for (const row of source) {
      const alternate = variants[row.id]?.[key] || {};
      const expected = { ...row, ...alternate };
      const projected = projectGameCard(changed, row.id);
      assert.equal(projected.cost, expected.cost, `${row.id} ${key} SP price`);
      assert.equal(projected.manaCost || 0, expected.manaCost || 0, `${row.id} ${key} MP price`);
      const resolved = resolveCard(registries, { cardId: row.id });
      assert.equal(resolved.cost, projected.cost, `${row.id} ${key} runtime SP`);
      assert.equal(resolved.manaCost || 0, projected.manaCost || 0, `${row.id} ${key} runtime MP`);
      assert.deepEqual(resolved.effects, projected.effects, `${row.id} ${key} effects`);
    }
  }
  assert.equal(JSON.stringify([source, variants, profile]), before);
});
