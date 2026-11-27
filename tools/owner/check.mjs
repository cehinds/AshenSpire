#!/usr/bin/env node
// npm run check: rebuilds the game data from your JSON and runs the content checks.
// Add the full flag from ownerTools.json to also run the core tests.
import {
    IsMainModule,
    OWNER_TEXT,
    OWNER_TOOLS,
} from './ownerConfig.mjs';
import { RunSteps } from './ownerProcess.mjs';

const TEXT = OWNER_TEXT.check;
const EXIT = Object.freeze({
    ok: 0,
    failed: 1,
});

/** Builds, then checks; returns true when every step passed. */
export function BuildAndCheck({ full = false } = {})
{
    const tests = full
        ? OWNER_TOOLS.testSteps
        : [];
    const steps = [
        ...OWNER_TOOLS.buildSteps,
        ...OWNER_TOOLS.checkSteps,
        ...tests,
    ];
    return RunSteps(steps).ok;
}

if (IsMainModule(import.meta.url))
{
    const full = process.argv.includes(OWNER_TOOLS.flags.full);
    const passed = BuildAndCheck({ full });
    console.log(passed
        ? TEXT.passed
        : TEXT.failed);
    process.exitCode = passed
        ? EXIT.ok
        : EXIT.failed;
}
