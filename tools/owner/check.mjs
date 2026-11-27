#!/usr/bin/env node
// npm run check: rebuilds the game data from your JSON and runs the content checks.
// Add --full to also run the core tests (about two minutes).
import { IsMainModule, OWNER_TOOLS } from './ownerConfig.mjs';
import { RunSteps } from './ownerProcess.mjs';

const FULL_FLAG = '--full';
const PASSED_NOTE = '\nAll checks passed.';
const FAILED_NOTE = '\nA check failed. Fix the file it names, save, and run "npm run check" again.';

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
    const passed = BuildAndCheck({ full: process.argv.includes(FULL_FLAG) });
    console.log(passed
        ? PASSED_NOTE
        : FAILED_NOTE);
    process.exitCode = passed
        ? 0
        : 1;
}
