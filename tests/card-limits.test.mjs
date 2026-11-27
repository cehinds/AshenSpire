// Card effect and drawback limits (CARD_LIMITS in content/source/actionCosts.json).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CheckCardLimits, CountCardParts, DEFAULT_CARD_LIMIT_RULES } from '../src/model/cardLimits.js';
import { CheckCardFiles } from '../tools/card-limits.mjs';

const TIGHT_RULES = {
    ...DEFAULT_CARD_LIMIT_RULES,
    maxEffects: 2,
    maxDrawbacks: 1,
};

const HEAVY_CARD = {
    id: 'test.heavy',
    name: 'Heavy',
    keywords: ['exhaust'],
    effects: [
        {
            op: 'damage',
            target: 'enemy',
            amount: 6,
        },
        {
            op: 'loseHp',
            target: 'self',
            amount: 2,
        },
        {
            op: 'applyStatus',
            target: 'self',
            status: 'frail',
            stacks: 1,
        },
    ],
};

test('drawbacks count drawback ops, drawback keywords and debuffs on self', () =>
{
    const parts = CountCardParts(HEAVY_CARD);
    assert.equal(parts.effects, 3);
    assert.deepEqual(parts.drawbacks, [
        'loseHp',
        'frail on self',
        'exhaust',
    ]);
});

test('a debuff on an enemy is not a drawback', () =>
{
    const card = {
        id: 'test.hex',
        effects: [
            {
                op: 'applyStatus',
                target: 'enemy',
                status: 'weak',
                stacks: 1,
            },
        ],
    };
    assert.deepEqual(CountCardParts(card).drawbacks, []);
});

test('cards over a limit are named with the limit they break', () =>
{
    const problems = CheckCardLimits([HEAVY_CARD], TIGHT_RULES);
    assert.equal(problems.length, 2);
    assert.match(problems[0], /test\.heavy \(Heavy\) has 3 effects\. The limit is 2/);
    assert.match(problems[1], /has 3 drawbacks: loseHp, frail on self, exhaust\. The limit is 1/);
});

test('the upgraded face is checked too', () =>
{
    const card = {
        id: 'test.grows',
        name: 'Grows',
        effects: [],
        upgrade: {
            effects: [
                {
                    op: 'damage',
                },
                {
                    op: 'block',
                },
                {
                    op: 'draw',
                },
            ],
        },
    };
    const problems = CheckCardLimits([card], TIGHT_RULES);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /test\.grows \(Grows\) upgraded has 3 effects/);
});

test('every shipped card is within CARD_LIMITS', () =>
{
    assert.deepEqual(CheckCardFiles(), []);
});
