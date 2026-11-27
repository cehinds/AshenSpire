// The Game content card counter: plain counts without a cap, red with the reason past one.
// Wording comes from contentEditorUi.json and drawback rules from actionCosts.json.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    CheckCardLimits,
    CountCardParts,
    DEFAULT_CARD_LIMIT_RULES,
    HasCardLimit,
} from '../src/model/cardLimits.js';
import { FillTemplate } from '../src/model/textTemplate.js';
import { CardLimitsSummary } from '../tools/score-studio/contentEditor/cardLimitsSummary.js';
import { UI_CONFIG } from './helpers/content-editor-config.mjs';

const RULES = DEFAULT_CARD_LIMIT_RULES;
const WORDING = UI_CONFIG.text.cardLimits;
const DRAWBACK_OP = Object.keys(RULES.drawbackOps)[0];
const CARD = {
    id: 'test.counter',
    name: 'Counter',
    keywords: [],
    effects: [
        {
            op: 'damage',
            target: 'enemy',
            amount: 6,
        },
        {
            op: DRAWBACK_OP,
            target: 'self',
        },
    ],
};
const PARTS = CountCardParts(CARD);
const EFFECTS = PARTS.effects;
const DRAWBACKS = PARTS.drawbacks.length;

function rulesWith(maxEffects, maxDrawbacks)
{
    return {
        ...RULES,
        maxEffects,
        maxDrawbacks,
    };
}

function expectedText(rules)
{
    const part = (wording, count, limit) =>
    {
        const template = HasCardLimit(limit)
            ? wording.capped
            : wording.uncapped;
        return FillTemplate(template, { count, limit });
    };
    return [
        part(WORDING.effects, EFFECTS, rules.maxEffects),
        part(WORDING.drawbacks, DRAWBACKS, rules.maxDrawbacks),
    ].join(WORDING.separator);
}

test('without caps the counter shows plain counts and is never red', () =>
{
    const rules = rulesWith(null, null);
    const summary = CardLimitsSummary(CARD, UI_CONFIG, rules);
    assert.equal(summary.text, [
        FillTemplate(WORDING.effects.uncapped, { count: EFFECTS }),
        FillTemplate(WORDING.drawbacks.uncapped, { count: DRAWBACKS }),
    ].join(WORDING.separator));
    assert.equal(summary.over, false);
    assert.deepEqual(summary.problems, []);
});

test('past a set cap the counter shows the limit, turns red and gives the reason', () =>
{
    const rules = rulesWith(EFFECTS - 1, DRAWBACKS - 1);
    const summary = CardLimitsSummary(CARD, UI_CONFIG, rules);
    assert.equal(summary.text, [
        FillTemplate(WORDING.effects.capped, { count: EFFECTS, limit: rules.maxEffects }),
        FillTemplate(WORDING.drawbacks.capped, { count: DRAWBACKS, limit: rules.maxDrawbacks }),
    ].join(WORDING.separator));
    assert.equal(summary.over, true);
    assert.deepEqual(summary.problems, CheckCardLimits([CARD], rules));
    assert.equal(summary.problems.length, 2);
});

test('at a set cap, or with only one cap set, the counter is not red', () =>
{
    const cases = [
        rulesWith(EFFECTS, DRAWBACKS),
        rulesWith(EFFECTS, null),
        rulesWith(null, DRAWBACKS),
    ];
    for (const rules of cases)
    {
        const summary = CardLimitsSummary(CARD, UI_CONFIG, rules);
        assert.equal(summary.text, expectedText(rules));
        assert.equal(summary.over, false);
    }
});

test('with the shipped CARD_LIMITS the counter follows whatever caps are set', () =>
{
    const summary = CardLimitsSummary(CARD, UI_CONFIG);
    assert.equal(summary.text, expectedText(RULES));
    assert.equal(summary.over, CheckCardLimits([CARD]).length > 0);
});
