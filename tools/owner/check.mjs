#!/usr/bin/env node
// npm run check: rebuilds the game data from your JSON and runs the content checks.
// Add --full to also run the core tests (about two minutes).
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OWNER_TOOLS, RunSteps } from './ownerSteps.mjs';

const FULL_FLAG = '--full';

/** Builds, then checks; returns true when every step passed. */
export function BuildAndCheck({ full = false } = {})
{
    const steps = [
        ...OWNER_TOOLS.buildSteps,
        ...OWNER_TOOLS.checkSteps,
        ...(full
            ? OWNER_TOOLS.testSteps
            : []),
    ];
    return RunSteps(steps).ok;
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invoked)
{
    const passed = BuildAndCheck({ full: process.argv.includes(FULL_FLAG) });
    console.log(passed
        ? '\nAll checks passed.'
        : '\nA check failed. Fix the file it names, save, and run "npm run check" again.');
    process.exitCode = passed
        ? 0
        : 1;
}
