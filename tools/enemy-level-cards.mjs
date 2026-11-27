#!/usr/bin/env node
// tools/enemy-level-cards.mjs - build the level-card list of every Core enemy (owner, 2026-11-20:
// "procedurally build a card list of potential cards enemies can add to their decks at higher levels,
// some may be unique to the enemy, some cards may be cards the player may receive").
//
// Writes games/ashenspire/packs/core/enemyLevelCards.json: { "<enemyId>": [entry, ...] }, 4 to 6 entries per
// enemy, best first. Each entry is { id, name, source: "unique"|"shared", from: <card id>, move }, where move is
// an enemy move { intent, damage?, hits?, block?, effects?, sp: 2, weight }. Design: docs/plans/enemy-level-scaling.md,
// "Level-card lists". Deterministic: no RNG, same input gives the same file.
//
//   node tools/enemy-level-cards.mjs --write   write the JSON
//   node tools/enemy-level-cards.mjs --check   exit 1 if the committed JSON differs from a fresh build
//   node tools/enemy-level-cards.mjs --report  print which player cards are eligible and why others are not
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PACK = join(ROOT, 'games/ashenspire/packs/core');
export const OUTPUT = join(PACK, 'enemyLevelCards.json');
export const LEVEL_CARD_SP = 2;
// A level card is a special move: never twice in a row, so it adds variety instead of replacing the rotation.
export const LEVEL_CARD_MAX_CONSECUTIVE = 1;
export const DAMAGE_CAP = 1.6;
export const UNIQUE_BOOST = 1.5;
export const SHARED_WEIGHT = 25;
const MAX_PER_SOURCE = 3;
const STATUS_SCORE = 3;
const EXCLUDED_RARITIES = new Set(['starter', 'special']);
const EXPRESSIBLE_OPS = new Set(['damage', 'block', 'applyStatus']);
const UNIQUE_KINDS = [
    { kind: 'heavy', word: 'Crushing' },
    { kind: 'guard', word: 'Stout' },
    { kind: 'rider', word: 'Cruel' },
    { kind: 'buff', word: 'Fierce' },
    { kind: 'debuff', word: 'Bitter' },
];

const json = path => JSON.parse(readFileSync(path, 'utf8'));
const display = name => String(name).replace(/_/g, ' ');
const upperFirst = text => text.charAt(0).toUpperCase() + text.slice(1);

export function loadSources()
{
    const sharedEnemies = [1, 2, 3].flatMap(act =>
        json(join(ROOT, `content/source/act${act}Enemies.json`)).map(enemy => ({ ...enemy, act }))
    );
    return {
        rows: json(join(PACK, 'characters.json')),
        enemyCards: json(join(PACK, 'enemyCards.json')),
        playerCards: json(join(PACK, 'cards.json')),
        sharedEnemies,
    };
}

/** Per-use damage of a move or level-card move. */
export function moveDamage(move)
{
    return (move?.damage ?? 0) * (move?.hits ?? 1);
}

function moveScore(move)
{
    const stacks = (move.effects || [])
        .filter(effect => effect.op === 'applyStatus')
        .reduce((sum, effect) => sum + effect.stacks, 0);
    return moveDamage(move) + (move.block ?? 0) + STATUS_SCORE * stacks;
}

// The Core projection's card overlay (src/model/enemyProjection.js applyCardOverlay): a hint with coreOffense "card"
// takes damage and hits from the card, coreBlock "card" takes block from it.
function projectedMoves(row, shared, cardsById)
{
    const moves = Object.fromEntries(Object.entries(shared.moves || {}).map(([id, move]) => [id, { ...move }]));
    for (const [cardId, hint] of Object.entries(row.enemy?.cardHints || {}))
    {
        const move = moves[hint.legacyMove];
        const card = cardsById.get(cardId);
        if (!move || !card)
        {
            continue;
        }
        const hits = (card.effects || []).filter(effect => effect.op === 'damage');
        if (hint.coreOffense === 'card' && hits.length === 1)
        {
            move.damage = hits[0].amount;
            move.hits = hits[0].hits ?? 1;
        }
        const guards = (card.effects || []).filter(effect => effect.op === 'block');
        if (hint.coreBlock === 'card' && guards.length === 1)
        {
            move.block = guards[0].amount;
        }
    }
    return moves;
}

/** The statuses enemy moves already apply, as "target:status" (target "player" or "self"). */
export function enemyStatusSet(sharedEnemies)
{
    const used = new Set();
    for (const enemy of sharedEnemies)
    {
        for (const move of Object.values(enemy.moves || {}))
        {
            for (const effect of move.effects || [])
            {
                if (effect.op === 'applyStatus')
                {
                    used.add(`${effect.target}:${effect.status}`);
                }
            }
        }
    }
    return used;
}

/** Why a player card cannot become an enemy move, or null when an enemy move expresses it exactly. */
export function playerCardProblem(card, statuses)
{
    if (EXCLUDED_RARITIES.has(card.rarity))
    {
        return `${card.rarity} card (class signature or system card)`;
    }
    if (card.staminaCost === 0 && card.manaCost === 0)
    {
        return 'free filler card (worthless at 2 SP)';
    }
    if ((card.keywords || []).length)
    {
        return `keywords ${card.keywords.join(', ')}`;
    }
    if (card.stanceTrigger || card.contest || card.ramp)
    {
        return 'stance, contest or ramp rule';
    }
    for (const effect of card.effects || [])
    {
        if (!EXPRESSIBLE_OPS.has(effect.op))
        {
            return `effect ${effect.op}`;
        }
        if (effect.op === 'damage' && effect.target !== 'enemy')
        {
            return `damage to ${effect.target}`;
        }
        if (effect.op === 'block' && effect.target !== 'self')
        {
            return `block on ${effect.target}`;
        }
        if (effect.op === 'applyStatus')
        {
            const target = { enemy: 'player', self: 'self' }[effect.target];
            if (!target || !Number.isSafeInteger(effect.stacks))
            {
                return `status ${effect.status} on ${effect.target}`;
            }
            if (!statuses.has(`${target}:${effect.status}`))
            {
                return `status ${effect.status} no enemy uses`;
            }
        }
    }
    if ((card.effects || []).filter(effect => effect.op === 'damage').length > 1)
    {
        return 'more than one damage effect';
    }
    if ((card.effects || []).filter(effect => effect.op === 'block').length > 1)
    {
        return 'more than one block effect';
    }
    return null;
}

/** The enemy move a player card becomes: same numbers, 2 SP. */
export function moveFromPlayerCard(card)
{
    const move = {};
    const effects = [];
    for (const effect of card.effects)
    {
        if (effect.op === 'damage')
        {
            move.damage = effect.amount;
            if ((effect.hits ?? 1) !== 1)
            {
                move.hits = effect.hits;
            }
        }
        else if (effect.op === 'block')
        {
            move.block = effect.amount;
        }
        else
        {
            const target = effect.target === 'enemy' ? 'player' : 'self';
            effects.push({ op: 'applyStatus', target, status: effect.status, stacks: effect.stacks });
        }
    }
    return finishMove(move, effects, SHARED_WEIGHT);
}

function finishMove(numbers, effects, weight)
{
    let intent = 'buff';
    if (numbers.damage !== undefined)
    {
        intent = 'attack';
    }
    else if (numbers.block !== undefined)
    {
        intent = 'block';
    }
    else if (effects.some(effect => effect.target === 'player'))
    {
        intent = 'debuff';
    }
    return {
        intent,
        ...numbers,
        ...(effects.length ? { effects } : {}),
        sp: LEVEL_CARD_SP,
        weight,
        maxConsecutive: LEVEL_CARD_MAX_CONSECUTIVE,
    };
}

/** The attributes a player card leans on: physical damage Str, Block Dex, spells their traditions (SPEC §17 ratings). */
export function cardAttributes(card)
{
    const attributes = new Set();
    const tags = card.tags || [];
    const spell = tags.includes('camp:spell');
    const traditions = () =>
    {
        if (tags.includes('tradition:arcane'))
        {
            attributes.add('intelligence');
        }
        if (tags.includes('tradition:divine'))
        {
            attributes.add('wisdom');
        }
    };
    for (const effect of card.effects || [])
    {
        if (effect.op === 'damage')
        {
            if (card.damageSchool === 'physical' && !spell)
            {
                attributes.add('strength');
            }
            else
            {
                traditions();
            }
        }
        else if (effect.op === 'block')
        {
            attributes.add('dexterity');
        }
        else if (spell)
        {
            traditions();
        }
        else
        {
            attributes.add('strength');
        }
    }
    return attributes;
}

// The enemy's own noun: "The Fell Warden" -> "Warden", "Duelist of the Court" -> "Duelist".
function enemyNoun(name)
{
    const base = String(name).replace(/^The\s+/, '').replace(/\s+of\s+.*$/, '');
    const words = base.split(/\s+/);
    return words[words.length - 1];
}

// "Warden's Crushing Cane Strike"; the possessive drops when the card already names the enemy ("Crushing Hearse
// Charge"), and the adjective steps aside when the card name already says it ("Heavy Crush", not "Crushing Crush").
export function uniqueName(noun, word, cardName)
{
    const lower = cardName.toLowerCase();
    const adjective = lower.includes(word.slice(0, 4).toLowerCase()) ? 'Heavy' : word;
    const owner = lower.includes(noun.toLowerCase()) ? '' : `${noun}'s `;
    return `${owner}${adjective} ${cardName}`;
}

function cardNameFor(row, moveId, cardsById)
{
    const hinted = Object.entries(row.enemy?.cardHints || {}).find(([, hint]) => hint.legacyMove === moveId);
    const cardId = hinted ? hinted[0] : `${row.id}.${moveId}`;
    const card = cardsById.get(cardId);
    return { cardId, name: card ? display(card.name) : upperFirst(moveId) };
}

// A move a level card may grow from: weighted, not a range step, a reaction or a phase lock.
function plainSource(move)
{
    return (move.weight ?? 0) > 0 && !move.reaction && move.counterDamage === undefined
        && !(move.effects || []).some(effect => effect.op === 'moveEngagement');
}

// An unlocked, undelayed move of at most 2 SP: a level card must not skip a charge, a phase lock or a 3 SP price.
const tidySource = ([, move]) => !move.locked && !move.delay && (move.sp ?? 1) <= LEVEL_CARD_SP;

function pickSource(candidates)
{
    return candidates.find(tidySource) ?? candidates[0];
}

function byStrength(entries, measure)
{
    return [...entries].sort((a, b) => measure(b[1]) - measure(a[1]));
}

function uniqueEntries(row, shared, moves, cardsById, cap)
{
    const sources = Object.entries(moves).filter(([, move]) => plainSource(move));
    const attacks = byStrength(sources.filter(([, move]) => move.intent === 'attack' && move.damage !== undefined), moveDamage);
    const guards = byStrength(sources.filter(([, move]) => move.damage === undefined && move.block !== undefined), m => m.block);
    const statusMoves = sources.filter(([, move]) => move.damage === undefined && move.block === undefined
        && (move.effects || []).some(effect => effect.op === 'applyStatus'));
    const playerStatuses = [];
    for (const move of Object.values(moves))
    {
        for (const effect of move.effects || [])
        {
            if (effect.op === 'applyStatus' && effect.target === 'player')
            {
                playerStatuses.push(effect);
            }
        }
    }
    const noun = enemyNoun(shared.name ?? display(row.name));
    const keepEffects = move => (move.effects || []).map(effect => ({ ...effect }));
    const out = [];
    const add = (kind, moveId, source, numbers, effects) =>
    {
        const { cardId, name } = cardNameFor(row, moveId, cardsById);
        const { word } = UNIQUE_KINDS.find(row2 => row2.kind === kind);
        out.push({
            id: `${row.id}.level.${kind}${upperFirst(moveId)}`,
            name: uniqueName(noun, word, name),
            source: 'unique',
            from: cardId,
            move: finishMove(numbers, effects, source.weight),
        });
    };

    const heavy = pickSource(attacks);
    if (heavy)
    {
        const [moveId, move] = heavy;
        const damage = Math.min(Math.round(move.damage * UNIQUE_BOOST), Math.floor(cap / (move.hits ?? 1)));
        add('heavy', moveId, move, { damage, ...(move.hits > 1 ? { hits: move.hits } : {}) }, keepEffects(move));
    }
    const guard = pickSource(guards);
    if (guard)
    {
        const [moveId, move] = guard;
        add('guard', moveId, move, { block: Math.round(move.block * UNIQUE_BOOST) }, keepEffects(move));
    }
    // The rider grows from the next tidy attack, else from the heavy card's own source.
    const rider = attacks.find(entry => tidySource(entry) && entry !== heavy) ?? heavy;
    if (rider)
    {
        const [moveId, move] = rider;
        const signature = playerStatuses[0] ?? { status: 'weak', stacks: 1 };
        const stacks = Math.max(...playerStatuses.filter(effect => effect.status === signature.status).map(effect => effect.stacks), 1);
        const effects = keepEffects(move);
        const own = effects.find(effect => effect.op === 'applyStatus' && effect.status === signature.status && effect.target === 'player');
        if (own)
        {
            own.stacks += 1;
        }
        else
        {
            effects.push({ op: 'applyStatus', target: 'player', status: signature.status, stacks });
        }
        add('rider', moveId, move, { damage: move.damage, ...(move.hits > 1 ? { hits: move.hits } : {}) }, effects);
    }
    const status = pickSource(byStrength(statusMoves, moveScore));
    if (status)
    {
        const [moveId, move] = status;
        const effects = keepEffects(move).map(effect => effect.op === 'applyStatus' ? { ...effect, stacks: effect.stacks + 1 } : effect);
        const kind = effects.some(effect => effect.op === 'applyStatus' && effect.target === 'player') ? 'debuff' : 'buff';
        add(kind, moveId, move, {}, effects);
    }
    return out;
}

// Fit to the enemy's top two attributes: 2 when the card leans on the first, 1 on the second only, 0 on neither.
function attributeFit(row, attributes)
{
    const [first, second] = row.attributePriority || [];
    if (attributes.has(first))
    {
        return 2;
    }
    return attributes.has(second) ? 1 : 0;
}

function sharedEntries(row, eligible, cap)
{
    return eligible
        .map(candidate => ({ ...candidate, fit: attributeFit(row, candidate.attributes) }))
        .filter(({ fit, move }) => fit > 0 && moveDamage(move) <= cap)
        .map((candidate, at) => ({ ...candidate, at, score: moveScore(candidate.move) }))
        .sort((a, b) => b.fit - a.fit || b.score - a.score || a.at - b.at)
        .map(({ card, move }) => ({
            id: `${row.id}.level.${card.id.replace(/^core\./, '')}`,
            name: card.name,
            source: 'shared',
            from: card.id,
            move: { ...move, ...(move.effects ? { effects: move.effects.map(effect => ({ ...effect })) } : {}) },
        }));
}

function bestFirst(entries)
{
    return entries
        .map((entry, at) => ({ entry, at, score: moveScore(entry.move) }))
        .sort((a, b) => b.score - a.score || a.at - b.at)
        .map(({ entry }) => entry);
}

/** Every player card with whether an enemy move can express it, and why not. */
export function playerCardEligibility(sources = loadSources())
{
    const statuses = enemyStatusSet(sources.sharedEnemies);
    return sources.playerCards.map(card =>
    {
        const problem = playerCardProblem(card, statuses);
        return problem
            ? { card, problem }
            : { card, problem: null, move: moveFromPlayerCard(card), attributes: cardAttributes(card) };
    });
}

/** The full level-card map, in characters.json enemy order. */
export function buildEnemyLevelCards(sources = loadSources())
{
    const cardsById = new Map(sources.enemyCards.map(card => [card.id, card]));
    const sharedById = new Map(sources.sharedEnemies.map(enemy => [enemy.id, enemy]));
    const eligible = playerCardEligibility(sources).filter(row => !row.problem);
    const out = {};
    for (const row of sources.rows)
    {
        if (!(row.tags || []).includes('character.enemy'))
        {
            continue;
        }
        const shared = sharedById.get(row.id);
        if (!shared)
        {
            throw new Error(`${row.id}: no shared enemy row in content/source/act*Enemies.json`);
        }
        const moves = projectedMoves(row, shared, cardsById);
        const strongest = Math.max(0, ...Object.values(moves).map(moveDamage));
        const cap = Math.floor(strongest * DAMAGE_CAP);
        const uniques = bestFirst(uniqueEntries(row, shared, moves, cardsById, cap)).slice(0, MAX_PER_SOURCE);
        const shareds = sharedEntries(row, eligible, cap).slice(0, MAX_PER_SOURCE);
        // Best first, alternating so the top of the list always mixes the enemy's own cards with player cards.
        const list = [];
        for (let at = 0; at < MAX_PER_SOURCE; at += 1)
        {
            if (uniques[at])
            {
                list.push(uniques[at]);
            }
            if (shareds[at])
            {
                list.push(shareds[at]);
            }
        }
        out[row.id] = list;
    }
    return out;
}

export const serialise = value => `${JSON.stringify(value, null, 2)}\n`;

function main(argv)
{
    if (argv.includes('--report'))
    {
        for (const { card, problem, attributes } of playerCardEligibility())
        {
            console.log(`${card.id}\t${problem ? `no: ${problem}` : `yes: ${[...attributes].join('/')}`}`);
        }
        return 0;
    }
    const fresh = serialise(buildEnemyLevelCards());
    if (argv.includes('--write'))
    {
        writeFileSync(OUTPUT, fresh);
        console.log(`wrote ${OUTPUT}`);
        return 0;
    }
    if (argv.includes('--check'))
    {
        let current = '';
        try
        {
            current = readFileSync(OUTPUT, 'utf8').replace(/\r\n/g, '\n');
        }
        catch
        {
            current = '';
        }
        if (current !== fresh)
        {
            console.error('enemyLevelCards.json is stale: run node tools/enemy-level-cards.mjs --write');
            return 1;
        }
        console.log('enemyLevelCards.json is current');
        return 0;
    }
    console.error('usage: node tools/enemy-level-cards.mjs --write | --check | --report');
    return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
    process.exitCode = main(process.argv.slice(2));
}
