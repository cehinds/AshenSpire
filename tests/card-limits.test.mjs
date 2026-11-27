// Card effect and drawback limits. Ops, statuses, keywords and every expected sentence come
// from CARD_LIMITS and the drawback tables in actionCosts.json, so retuning needs no test edit.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    CheckCardLimits,
    CountCardParts,
    DEFAULT_CARD_LIMIT_RULES,
} from '../src/model/cardLimits.js';
import { FillTemplate } from '../src/model/textTemplate.js';
import { CheckCardFiles } from '../tools/card-limits.mjs';

const RULES = DEFAULT_CARD_LIMIT_RULES;
const TEXT = RULES.text;
const DRAWBACK_OP = Object.keys(RULES.drawbackOps)[0];
const SELF_DEBUFF = RULES.selfDebuffStatuses[0];
const DRAWBACK_KEYWORD = Object.keys(RULES.keywordTags)
    .find((keyword) => RULES.drawbackKeywordTags.includes(RULES.keywordTags[keyword]));
const PLAIN_EFFECT = {
    op: 'damage',
    target: 'enemy',
    amount: 6,
};
const HEAVY_CARD = {
    id: 'test.heavy',
    name: 'Heavy',
    keywords: [DRAWBACK_KEYWORD],
    effects: [
        PLAIN_EFFECT,
        {
            op: DRAWBACK_OP,
            target: 'self',
        },
        {
            op: 'applyStatus',
            target: 'self',
            status: SELF_DEBUFF,
            stacks: 1,
        },
    ],
};
const HEAVY_DRAWBACKS = [
    DRAWBACK_OP,
    FillTemplate(TEXT.selfDebuff, { status: SELF_DEBUFF }),
    DRAWBACK_KEYWORD,
];
const TIGHT_RULES = {
    ...RULES,
    maxEffects: HEAVY_CARD.effects.length - 1,
    maxDrawbacks: HEAVY_DRAWBACKS.length - 1,
};

function cardName(card, face)
{
    return FillTemplate(TEXT.cardName, {
        id: card.id,
        name: card.name,
        face,
    });
}

test('drawbacks count drawback ops, drawback keywords and debuffs on self', () =>
{
    const parts = CountCardParts(HEAVY_CARD);
    assert.equal(parts.effects, HEAVY_CARD.effects.length);
    assert.deepEqual(parts.drawbacks, HEAVY_DRAWBACKS);
});

test('a debuff on an enemy is not a drawback', () =>
{
    const card = {
        id: 'test.hex',
        effects: [
            {
                op: 'applyStatus',
                target: 'enemy',
                status: SELF_DEBUFF,
                stacks: 1,
            },
        ],
    };
    assert.deepEqual(CountCardParts(card).drawbacks, []);
});

test('cards over a limit are named with the limit they break', () =>
{
    const name = cardName(HEAVY_CARD, '');
    const problems = CheckCardLimits([HEAVY_CARD], TIGHT_RULES);
    assert.deepEqual(problems, [
        FillTemplate(TEXT.tooManyEffects, {
            name,
            count: HEAVY_CARD.effects.length,
            limit: TIGHT_RULES.maxEffects,
        }),
        FillTemplate(TEXT.tooManyDrawbacks, {
            name,
            count: HEAVY_DRAWBACKS.length,
            listed: HEAVY_DRAWBACKS.join(TEXT.listJoiner),
            limit: TIGHT_RULES.maxDrawbacks,
        }),
    ]);
});

test('the upgraded face is checked too', () =>
{
    const effects = Array.from({ length: TIGHT_RULES.maxEffects + 1 }, () => PLAIN_EFFECT);
    const card = {
        id: 'test.grows',
        name: 'Grows',
        effects: [],
        upgrade: { effects },
    };
    const problems = CheckCardLimits([card], TIGHT_RULES);
    assert.deepEqual(problems, [
        FillTemplate(TEXT.tooManyEffects, {
            name: cardName(card, TEXT.upgradedFace),
            count: effects.length,
            limit: TIGHT_RULES.maxEffects,
        }),
    ]);
});

test('a missing cap means no limit', () =>
{
    const unlimited = {
        ...RULES,
        maxEffects: null,
        maxDrawbacks: null,
    };
    assert.deepEqual(CheckCardLimits([HEAVY_CARD], unlimited), []);
});

test('every shipped card is within CARD_LIMITS', () =>
{
    const problems = CheckCardFiles().map((entry) => `${entry.file}: ${entry.problem}`);
    assert.deepEqual(problems, []);
});
