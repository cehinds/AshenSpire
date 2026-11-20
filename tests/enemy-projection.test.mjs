import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gameDigest, GameConfigError } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { ProjectEnemyContent } from '../src/model/enemyProjection.js';
import { applyGameProfileToContent, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRegistries } from '../src/model/registries.js';
import { catalogOf, loadPack, validateSheet } from '../tools/enemy-sheets.mjs';

const stock = resolveGameProfile('core');
const dragon = 'ashheartDragon';
const breath = 'ashheartDragon.ashBreath';
const advance = 'ashheartDragon.advance';
const colossus = 'charredColossus';
const smash = 'charredColossus.smash';

function profileWith(mutate)
{
    const { hash, ...copy } = structuredClone(stock);
    mutate(copy.content);
    return { ...copy, hash: gameDigest(copy) };
}

function enemy(rows, id)
{
    return rows.find(row => row.id === id);
}

function withoutRange(row)
{
    const rangeIds = new Set([row.rangeClosingMove, row.rangeRetreatMove].filter(Boolean));
    for (const [cardId, hint] of Object.entries(row.cardHints || {}))
    {
        if (rangeIds.has(hint.legacyMove))
        {
            delete row.cardHints[cardId];
        }
    }
    delete row.rangeClosingMove;
    delete row.rangeRetreatMove;
    delete row.startingRange;
    delete row.rangeRoutePolicy;
}

function assertPath(apply, path)
{
    assert.throws(apply, error => error instanceof GameConfigError && error.path === path);
}

test('Core card offense and SP opt-ins project without an authored closing move', () =>
{
    const profile = profileWith(content =>
    {
        withoutRange(enemy(content.enemies, dragon));
        withoutRange(enemy(content.enemies, colossus));
    });
    const projected = applyGameProfileToContent(contentBundle, profile);
    const registry = createRegistries(projected);
    const sharedDragon = enemy(contentBundle.enemies, dragon);
    const sharedColossus = enemy(contentBundle.enemies, colossus);
    const dragonMoves = enemy(projected.enemies, dragon).moves;
    const colossusMoves = enemy(projected.enemies, colossus).moves;
    assert.deepEqual(Object.keys(dragonMoves), Object.keys(sharedDragon.moves));
    assert.deepEqual(Object.keys(colossusMoves), Object.keys(sharedColossus.moves));
    assert.deepEqual(dragonMoves, { ...sharedDragon.moves, ashBreath: { ...sharedDragon.moves.ashBreath, damage: 18, hits: 2 } });
    assert.deepEqual(colossusMoves, { ...sharedColossus.moves, smash: { ...sharedColossus.moves.smash, sp: 1 } });
    assert.equal(registry.enemies.get(dragon).moves.ashBreath.damage, 18);
    assert.equal(registry.enemies.get(colossus).moves.smash.sp, 1);
    assert.equal(registry.enemies.get(dragon).rangeClosingMove, undefined);
    assert.equal(registry.enemies.get('wanderingSoldier').rangeClosingMove, 'advance');
    assert.deepEqual([sharedDragon.moves.ashBreath.damage, sharedDragon.moves.ashBreath.hits], [9, 4]);
    assert.equal(sharedColossus.moves.smash.sp, undefined);
});

test('card-only projection preserves explicit shared rows and their order', () =>
{
    const profile = profileWith(content =>
    {
        for (const row of content.enemies)
        {
            withoutRange(row);
        }
    });
    const shared = {
        ...contentBundle,
        enemyMoves: contentBundle.enemyMoves.map(move => move.enemyId === 'wanderingSoldier' && move.id === 'slash'
            ? { ...move, damage: 123 } : move),
    };
    const projected = applyGameProfileToContent(shared, profile);
    const registry = createRegistries(projected);
    assert.equal(registry.enemies.get(dragon).moves.ashBreath.damage, 18);
    assert.equal(registry.enemies.get('wanderingSoldier').moves.slash.damage, 123);
    assert.deepEqual(projected.enemyMoves.map(({ enemyId, id }) => [enemyId, id]), shared.enemyMoves.map(({ enemyId, id }) => [enemyId, id]));
    assert.deepEqual(projected.enemyMoves.find(move => move.enemyId === 'wanderingSoldier' && move.id === 'slash'),
        shared.enemyMoves.find(move => move.enemyId === 'wanderingSoldier' && move.id === 'slash'));
});

test('resolved Core profile metadata problems point at the exact enemy and hint field', () =>
{
    const cases = [
        ['cardHints', row => { row.cardHints = []; }],
        ['cardHints/' + advance, row => { row.cardHints[advance] = null; }],
        ['cardHints/' + breath + '/coreOffense', row => { row.cardHints[breath].coreOffense = 'ignored'; }],
        ['cardHints/' + breath + '/coreSp', row => { row.cardHints[breath].coreSp = false; }],
        ['cardHints/' + breath + '/legacyMove', row => { delete row.cardHints[breath].legacyMove; }],
        ['cardHints/' + breath + '/legacyMove', row => { row.cardHints[breath].legacyMove = 'unknownMove'; }],
        ['cardHints/' + advance + '/aiWeight', row => { row.cardHints[advance].aiWeight = -1; }],
        ['cardHints/' + advance + '/maxConsecutive', row => { row.cardHints[advance].maxConsecutive = 1.5; }],
    ];
    for (const [path, mutate] of cases)
    {
        const profile = profileWith(content => mutate(enemy(content.enemies, dragon)));
        assertPath(() => applyGameProfileToContent(contentBundle, profile), '$/content/enemies/' + dragon + '/' + path);
    }
});

test('Core projection addresses bad overlay source card payloads at the opt-in field', () =>
{
    const profile = profileWith(content =>
    {
        const card = content.enemyCards.find(row => row.id === breath);
        card.effects.push(structuredClone(card.effects.find(effect => effect.op === 'damage')));
    });
    assertPath(() => applyGameProfileToContent(contentBundle, profile), '$/content/enemies/' + dragon + '/cardHints/' + breath + '/coreOffense');

    // A resolved profile's kernel validates card prices first. Probe the adapter boundary directly for this diagnostic.
    const content = structuredClone(stock.content);
    content.enemyCards.find(row => row.id === smash).staminaCost = -1;
    assertPath(
        () => ProjectEnemyContent({ ...contentBundle }, content, contentBundle, structuredClone),
        '$/content/enemies/' + colossus + '/cardHints/' + smash + '/coreSp',
    );
});

test('sheet checks address adapter fields and still allow opaque hint extensions', () =>
{
    const readSheet = () => JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/enemies/ashheartDragon.json', import.meta.url)));
    const catalog = catalogOf(loadPack());
    const file = 'ashheartDragon.json';
    const hint = 'card:' + breath;
    const malformed = [
        ['', sheet => { sheet.ai = null; }],
        ['/' + hint, sheet => { sheet.ai[hint] = []; }],
        ['/' + hint + '/coreOffense', sheet => { sheet.ai[hint].coreOffense = 'unknown'; }],
        ['/' + hint + '/coreSp', sheet => { sheet.ai[hint].coreSp = true; }],
        ['/' + hint + '/legacyMove', sheet => { sheet.ai[hint].legacyMove = 'unknownMove'; }],
        ['/' + hint + '/legacyMove', sheet => { delete sheet.ai[hint].legacyMove; }],
        ['/' + hint + '/aiWeight', sheet => { sheet.ai[hint].aiWeight = '1'; }],
        ['/' + hint + '/maxConsecutive', sheet => { sheet.ai[hint].maxConsecutive = 0; }],
    ];
    for (const [path, mutate] of malformed)
    {
        const sheet = readSheet();
        mutate(sheet);
        assert.ok(validateSheet(sheet, file, catalog).some(problem => problem.startsWith(file + ' ai' + path + ': ')), path);
    }
    const sheet = readSheet();
    const extensionCard = sheet.deck.find(id => id !== hint && id !== 'card:' + advance);
    sheet.ai[extensionCard] = { futureHint: { version: 1 } };
    assert.deepEqual(validateSheet(sheet, file, catalog), []);
    const profile = profileWith(content =>
    {
        enemy(content.enemies, dragon).cardHints[extensionCard.slice('card:'.length)] = sheet.ai[extensionCard];
    });
    assert.equal(enemy(applyGameProfileToContent(contentBundle, profile).enemies, dragon).moves.ashBreath.damage, 18);
});

