// Owner ruling 2026-10-19: Defend gives 10 Block; Counter's Block is floor(Defend Block x 0.5) = 5 before bonuses.
// Counter block is stored as data (not a runtime lookup), so this pins the ratio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
const list = Array.isArray(cards) ? cards : cards.cards;
const blockOf = id => list.find(card => card.id === id).effects.find(effect => effect.op === 'block').amount;

test('core.defend gives 10 Block', () => assert.equal(blockOf('core.defend'), 10));
test('core.counter block equals floor(core.defend block x 0.5)', () => assert.equal(blockOf('core.counter'), Math.floor(blockOf('core.defend') * 0.5)));
test('core.counter return damage is unchanged (4)', () => assert.equal(list.find(card => card.id === 'core.counter').effects.find(effect => effect.op === 'damage').amount, 4));
