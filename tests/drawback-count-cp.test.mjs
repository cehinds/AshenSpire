// scoring.drawbackCount: Combat Power per drawback, flat or as a multiplier of the positive score.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CountCardParts, CountFaceDrawbacks } from '../src/model/cardLimits.js';
import { HeadlessCardFace } from '../src/model/autoBalance.js';
import { CountSurcharge, ScoreCard } from '../src/model/combatPower.js';
import { scoring as shippedScoring } from '../src/content/generated/scoring.js';
import { CARD_LIMITS } from '../src/content/actionCosts.js';

const PART = 'drawback count';
const MULTIPLIER_WEIGHT = -0.1;
const cards = JSON.parse(readFileSync(new URL(`../${CARD_LIMITS.cardFiles[0]}`, import.meta.url), 'utf8'));

function scoringWith(drawbackCount)
{
    return {
        ...structuredClone(shippedScoring),
        drawbackCount,
    };
}

function faceWithDrawbacks()
{
    return cards
        .map((card) => HeadlessCardFace(card, shippedScoring))
        .find((face) => CountFaceDrawbacks(face).length > 0);
}

test('a face counts the same drawbacks as its card', () =>
{
    cards.forEach((card) =>
    {
        const face = HeadlessCardFace(card, shippedScoring);
        assert.equal(CountFaceDrawbacks(face).length, CountCardParts(card).drawbacks.length, card.id);
    });
});

test('the shipped rule is off, so no card pays for its drawbacks yet', () =>
{
    const card = faceWithDrawbacks();
    assert.equal(ScoreCard(card, shippedScoring).parts[PART], undefined);
});

test('a flat weight is paid once per drawback', () =>
{
    const card = faceWithDrawbacks();
    const rule = {
        ...shippedScoring.drawbackCount,
        surchargeEnabled: true,
    };
    const count = CountFaceDrawbacks(card).length;
    const scored = ScoreCard(card, scoringWith(rule));
    assert.equal(scored.parts[PART], rule.weight * count);
});

test('the multiplier form scales the positive score per drawback', () =>
{
    const card = faceWithDrawbacks();
    const rule = {
        ...shippedScoring.drawbackCount,
        surchargeEnabled: true,
        multiplier: true,
        weight: MULTIPLIER_WEIGHT,
    };
    const count = CountFaceDrawbacks(card).length;
    const scored = ScoreCard(card, scoringWith(rule));
    assert.equal(scored.parts[PART], CountSurcharge(rule, scored.positive, count));
});
