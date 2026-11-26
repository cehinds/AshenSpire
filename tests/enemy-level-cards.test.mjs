// Enemy level cards (owner, 2026-11-20; docs/plans/enemy-level-scaling.md, "Level-card lists"): every Core enemy
// carries 4 to 6 level cards, at least two of its own (unique) and two player cards (shared), each costing 2 SP, none
// hitting harder than 1.6x the enemy's strongest move. tools/enemy-level-cards.mjs builds the list; the picker in
// src/model/enemyLevelCards.js draws from it deterministically and never repeats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { LEVEL_CARD_TOP, levelCardMoves, levelCardsFor } from '../src/model/enemyLevelCards.js';
import { buildEnemyLevelCards, serialise } from '../tools/enemy-level-cards.mjs';

const readJson = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const committedText = readFileSync(new URL('../games/ashenspire/packs/core/enemyLevelCards.json', import.meta.url), 'utf8');
const lists = JSON.parse(committedText);
const coreEnemies = readJson('games/ashenspire/packs/core/characters.json')
    .filter(row => (row.tags || []).includes('character.enemy'))
    .map(row => row.id);
const perUse = move => (move.damage ?? 0) * (move.hits ?? 1);

test('every Core enemy has 4 to 6 level cards, at least two unique and two shared', () =>
{
    assert.ok(coreEnemies.length >= 60, 'the Core roster was read');
    assert.deepEqual(Object.keys(lists).sort(), [...coreEnemies].sort());
    for (const id of coreEnemies)
    {
        const list = lists[id];
        assert.ok(list.length >= 4 && list.length <= 6, `${id}: ${list.length} entries`);
        assert.ok(list.filter(entry => entry.source === 'unique').length >= 2, `${id}: fewer than two unique`);
        assert.ok(list.filter(entry => entry.source === 'shared').length >= 2, `${id}: fewer than two shared`);
        for (const entry of list)
        {
            assert.ok(['unique', 'shared'].includes(entry.source), `${entry.id}: source ${entry.source}`);
            assert.equal(typeof entry.from, 'string', `${entry.id}: from`);
        }
    }
});

test('every level-card move costs 2 SP and carries a known intent and a positive weight', () =>
{
    for (const entry of Object.values(lists).flat())
    {
        assert.equal(entry.move.sp, 2, entry.id);
        assert.ok(['attack', 'block', 'buff', 'debuff'].includes(entry.move.intent), `${entry.id}: ${entry.move.intent}`);
        assert.ok(entry.move.weight > 0, `${entry.id}: weight`);
    }
});

test('level-card ids are unique and names are short and plain', () =>
{
    const ids = Object.values(lists).flat().map(entry => entry.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const [enemyId, list] of Object.entries(lists))
    {
        const moveIds = Object.keys(levelCardMoves(list));
        assert.equal(moveIds.length, list.length, `${enemyId}: move ids collide`);
        for (const entry of list)
        {
            assert.ok(entry.id.startsWith(`${enemyId}.level.`), entry.id);
            assert.doesNotMatch(entry.name, /[–—]|\.\.\./, entry.id);
            assert.ok(entry.name.split(/\s+/).length <= 5, `${entry.id}: "${entry.name}" is long`);
        }
    }
});

test('the committed list is what the generator builds', () =>
{
    assert.equal(committedText.replace(/\r\n/g, '\n'), serialise(buildEnemyLevelCards()),
        'run node tools/enemy-level-cards.mjs --write');
});

test('no level card hits harder than 1.6x the enemy\'s strongest move in the shipped game', () =>
{
    const registries = createRegistries(contentBundle);
    for (const id of coreEnemies)
    {
        const def = registries.enemies.get(id);
        assert.ok(def, `${id}: in the shipped registry`);
        const strongest = Math.max(...Object.values(def.moves).map(perUse));
        for (const entry of lists[id])
        {
            assert.ok(perUse(entry.move) <= strongest * 1.6, `${entry.id}: ${perUse(entry.move)} over ${strongest} x 1.6`);
        }
    }
});

test('picks are deterministic, never repeat, and a larger pick keeps the smaller one', () =>
{
    const firsts = new Set();
    for (const id of coreEnemies)
    {
        const list = lists[id];
        for (const seed of ['run-a', 'run-b', 'seed 42'])
        {
            let previous = [];
            for (let count = 1; count <= list.length; count += 1)
            {
                const picks = levelCardsFor(lists, id, count, seed);
                assert.deepEqual(picks, levelCardsFor(lists, id, count, seed), `${id}: same seed, same picks`);
                assert.equal(picks.length, count);
                assert.equal(new Set(picks.map(entry => entry.id)).size, count, `${id}: repeated pick`);
                assert.deepEqual(picks.slice(0, previous.length), previous, `${id}: step ${count} dropped an earlier card`);
                if (count <= LEVEL_CARD_TOP)
                {
                    const top = new Set(list.slice(0, LEVEL_CARD_TOP).map(entry => entry.id));
                    assert.ok(picks.every(entry => top.has(entry.id)), `${id}: pick from below the top`);
                }
                previous = picks;
            }
            firsts.add(levelCardsFor(list, id, 1, seed)[0].id);
        }
    }
    assert.ok(firsts.size > coreEnemies.length, 'different seeds pick different first cards');
    assert.deepEqual(levelCardsFor(lists, 'noSuchEnemy', 2, 'x'), []);
    assert.deepEqual(levelCardsFor(lists, coreEnemies[0], 0, 'x'), []);
});

test('level-card moves are fresh copies under level. ids', () =>
{
    const picks = levelCardsFor(lists, 'bellKeeper', 2, 'run-a');
    const moves = levelCardMoves(picks);
    assert.equal(Object.keys(moves).length, 2);
    for (const [moveId, move] of Object.entries(moves))
    {
        assert.match(moveId, /^level\.[A-Za-z]+$/);
        assert.equal(move.sp, 2);
    }
    const [first] = Object.values(moves);
    first.sp = 99;
    assert.equal(picks[0].move.sp, 2, 'the list entry is untouched');
});
