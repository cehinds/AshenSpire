#!/usr/bin/env node
// node tools/card-limits.mjs --check: fails, naming each card, when a card has more
// effects or drawbacks than CARD_LIMITS in content/source/actionCosts.json allows.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_LIMITS } from '../src/content/actionCosts.js';
import { CheckCardLimits } from '../src/model/cardLimits.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SETTINGS_FILE = 'content/source/actionCosts.json';

/** Problems across every file CARD_LIMITS.cardFiles names, each prefixed with its file. */
export function CheckCardFiles(root = ROOT)
{
    const problems = [];
    for (const file of CARD_LIMITS.cardFiles)
    {
        const cards = JSON.parse(readFileSync(resolve(root, file), 'utf8'));
        CheckCardLimits(cards).forEach((problem) => problems.push(`${file}: ${problem}`));
    }
    return problems;
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invoked)
{
    const problems = CheckCardFiles();
    if (problems.length)
    {
        problems.forEach((problem) => console.log(`FAIL ${problem}`));
        console.log(`\nEdit those cards, or raise the limit in ${SETTINGS_FILE} (CARD_LIMITS).`);
        process.exitCode = 1;
    }
    else
    {
        console.log(`card-limits: ok (max ${CARD_LIMITS.maxEffects} effects, ${CARD_LIMITS.maxDrawbacks} drawbacks)`);
    }
}
