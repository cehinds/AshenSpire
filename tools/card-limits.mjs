#!/usr/bin/env node
// node tools/card-limits.mjs --check: fails, naming each card, when a card has more effects
// or drawbacks than CARD_LIMITS in content/source/actionCosts.json allows.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_LIMITS } from '../src/content/actionCosts.js';
import { CheckCardLimits } from '../src/model/cardLimits.js';
import { FillTemplate } from '../src/model/textTemplate.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TEXT = CARD_LIMITS.text;
const TEXT_ENCODING = 'utf8';
const EXIT = Object.freeze({
    ok: 0,
    failed: 1,
});

function isMainModule()
{
    const started = process.argv[1];
    return Boolean(started) && fileURLToPath(import.meta.url) === resolve(started);
}

function report(problems)
{
    if (!problems.length)
    {
        console.log(FillTemplate(TEXT.ok, {
            effects: CARD_LIMITS.maxEffects,
            drawbacks: CARD_LIMITS.maxDrawbacks,
        }));
        return EXIT.ok;
    }
    problems.forEach((problem) => console.log(FillTemplate(TEXT.failLine, problem)));
    console.log(`\n${TEXT.advice}`);
    return EXIT.failed;
}

function fileProblems(root, file)
{
    const cards = JSON.parse(readFileSync(resolve(root, file), TEXT_ENCODING));
    return CheckCardLimits(cards).map((problem) => ({
        file,
        problem,
    }));
}

/** Problems across every file CARD_LIMITS.cardFiles names: [{ file, problem }]. */
export function CheckCardFiles(root = ROOT)
{
    return CARD_LIMITS.cardFiles.flatMap((file) => fileProblems(root, file));
}

if (isMainModule())
{
    process.exitCode = report(CheckCardFiles());
}
