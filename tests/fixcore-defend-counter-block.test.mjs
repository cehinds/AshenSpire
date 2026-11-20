// Owner ruling 2026-10-19: Defend gives 10 Block; Counter's Block is floor(Defend Block x 0.5) = 5 before bonuses.
// Counter block is stored as data (not a runtime lookup), so this pins the ratio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
const list = Array.isArray(cards) ? cards : cards.cards;
const blockOf = id => list.find(card => card.id === id).effects.find(effect => effect.op === 'block').amount;

test('core.defend gives 8 Block (Block-per-card retune, owner 2026-11-20; was 10)', () => assert.equal(blockOf('core.defend'), 8));
// Block-per-card retune (owner, 2026-11-20): Defend fell to 8 and Counter kept 5, so Counter is no longer half of Defend.
test('core.counter gives 5 Block', () => assert.equal(blockOf('core.counter'), 5));
test('core.counter return damage is unchanged (4)', () => assert.equal(list.find(card => card.id === 'core.counter').effects.find(effect => effect.op === 'damage').amount, 4));
