import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTable, measureCards } from '../tools/combat-power-report.mjs';
import { configuredCustomCardIds, holdable, registries, shipped } from '../tools/lib/cardBudgetMeasure.mjs';
import { filterMembership } from '../tools/score-studio/deckCatalog.js';

const smash = 'custom.copy_mwx6xoww';
const placeholder = 'custom.card_mwx49ejs';
const excludedLegacy = 'steelResolve';

test('a configured nonstarter custom card is scored and belongs to its class survey without admitting authoring-only cards', () => {
  const starseer = holdable('starseer');
  assert.ok(configuredCustomCardIds.has(smash));
  assert.ok(starseer.ids.includes(smash));
  assert.equal(starseer.startingDeck.includes(smash), false, 'membership does not depend on the starter kit');
  assert.equal(starseer.kit.has(smash), false);
  assert.equal(holdable('reaver').ids.includes(smash), false);
  assert.equal(configuredCustomCardIds.has(placeholder), false);
  assert.equal(starseer.ids.includes(placeholder), false);
  assert.ok(shipped.content.cards.some(card => card.id === excludedLegacy), 'legacy exclusion applies even to a configured-profile row');
  assert.equal(holdable('reaver').ids.includes(excludedLegacy), false);
  const faces = measureCards();
  assert.ok(faces[smash]);
  assert.equal(Object.hasOwn(faces, placeholder), false);
  assert.equal(Object.hasOwn(faces, excludedLegacy), false);
  const table = buildTable().cardCombatPower;
  assert.ok(Number.isFinite(table[smash]?.raw));
  assert.ok(Number.isFinite(table[smash]?.cp));
  assert.equal(Object.hasOwn(table, placeholder), false);
  assert.equal(Object.hasOwn(table, excludedLegacy), false);
});

test('the fresh Studio list includes configured custom cards once and restores a draft by replacing their IDs', () => {
  const source = readFileSync(new URL('../tools/score-studio/studio.js', import.meta.url), 'utf8');
  const start = source.indexOf('function buildCardList()');
  const end = source.indexOf('\nasync function boot()', start);
  assert.ok(start > 0 && end > start);
  const legacy = { id: 'legacy.unrelated', name: 'Unrelated legacy card', class: 'starseer' };
  const authoring = { id: placeholder, name: 'Authoring-only placeholder', class: 'starseer' };
  const studioRegistries = { cards: { all: () => [...registries.cards.all(), legacy, authoring] } };
  const cards = new Function('registries', 'configuredCustomCardIds', 'clone', source.slice(start, end) + '\nreturn buildCardList();')(studioRegistries, configuredCustomCardIds, structuredClone);
  assert.equal(cards.filter(card => card.id === smash).length, 1);
  assert.equal(cards.some(card => card.id === placeholder || card.id === legacy.id || card.id === excludedLegacy), false);
  const state = { cards };
  const restoreStart = source.indexOf('for (const draftCard of draftCards)');
  const restoreEnd = source.indexOf('\n      syncAllViews();', restoreStart);
  assert.ok(restoreStart > 0 && restoreEnd > restoreStart);
  const edited = { ...cards.find(card => card.id === smash), name: 'Edited Arcane Smash' };
  new Function('state', 'draftCards', source.slice(restoreStart, restoreEnd))(state, [edited]);
  assert.equal(state.cards.filter(card => card.id === smash).length, 1);
  assert.equal(state.cards.find(card => card.id === smash).name, edited.name);
  assert.ok(filterMembership(state, 'class:starseer').has(smash));
  assert.equal(filterMembership(state, 'class:reaver').has(smash), false);
  assert.equal(filterMembership(state, 'class:starseer').has(placeholder), false);
});
