#!/usr/bin/env node
// node tools/card-limits.mjs --check: fails, naming each card, when a card has more effects
// or drawbacks than CARD_LIMITS in content/source/actionCosts.json allows.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_LIMITS } from '../src/content/actionCosts.js';
import { CheckCardLimits } from '../src/model/cardLimits.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SETTINGS_FILE = 'content/source/actionCosts.json';
const TEXT_ENCODING = 'utf8';
const FAIL_MARK = 'FAIL';

function isMainModule()
{
    const started = process.argv[1];
    return Boolean(started) && fileURLToPath(import.meta.url) === resolve(started);
}

function okLine()
{
    const effects = `${CARD_LIMITS.maxEffects} effects`;
    const drawbacks = `${CARD_LIMITS.maxDrawbacks} drawbacks`;
    return `card-limits: ok (max ${effects}, ${drawbacks})`;
}

function report(problems)
{
    if (!problems.length)
    {
        console.log(okLine());
        return 0;
    }
    problems.forEach((problem) => console.log(`${FAIL_MARK} ${problem}`));
    console.log(`\nEdit those cards, or raise the limit in ${SETTINGS_FILE} (CARD_LIMITS).`);
    return 1;
}

/** Problems across every file CARD_LIMITS.cardFiles names, each prefixed with its file. */
export function CheckCardFiles(root = ROOT)
{
    const problems = [];
    for (const file of CARD_LIMITS.cardFiles)
    {
        const cards = JSON.parse(readFileSync(resolve(root, file), TEXT_ENCODING));
        CheckCardLimits(cards).forEach((problem) => problems.push(`${file}: ${problem}`));
    }
    return problems;
}

if (isMainModule())
{
    process.exitCode = report(CheckCardFiles());
}
