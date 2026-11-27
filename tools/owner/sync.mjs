#!/usr/bin/env node
// npm run sync: moves this copy to the newest dev. Edits already merged into dev are
// cleared; edits not yet shipped are kept, and nothing else is ever thrown away.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChangedContentFiles } from './ship.mjs';
import { OWNER_TOOLS, REPO_ROOT, ChangedPaths, RunGit, RunSteps } from './ownerSteps.mjs';

/** True for a file the build writes, which is safe to restore before switching. */
export function IsDerivedPath(relativePath, settings = OWNER_TOOLS)
{
    const path = relativePath.replace(/\\/g, '/');
    const inLocation = settings.generatedLocations.some((location) => path.startsWith(location));
    const hasSuffix = settings.generatedSuffixes.some((suffix) => path.endsWith(suffix));
    return inLocation || hasSuffix;
}

function devText(path)
{
    const { remote, baseBranch } = OWNER_TOOLS.git;
    const text = RunGit(['show', `${remote}/${baseBranch}:${path}`], REPO_ROOT, { allowFailure: true });
    return text || null;
}

function workingText(path)
{
    const full = join(REPO_ROOT, path);
    return existsSync(full)
        ? readFileSync(full, 'utf8').trim()
        : null;
}

function restore(file)
{
    if (file.untracked)
    {
        rmSync(join(REPO_ROOT, file.path), { force: true });
        return;
    }
    RunGit(['checkout', 'HEAD', '--', file.path]);
}

function main()
{
    const { remote, baseBranch } = OWNER_TOOLS.git;
    RunGit(['fetch', '--quiet', remote, baseBranch]);

    const kept = [];
    for (const file of ChangedContentFiles())
    {
        if (workingText(file.path) === devText(file.path))
        {
            restore(file);
        }
        else
        {
            kept.push(file.path);
        }
    }
    const editable = new Set(kept);
    const blocking = [];
    for (const file of ChangedPaths())
    {
        if (editable.has(file.path))
        {
            continue;
        }
        if (IsDerivedPath(file.path))
        {
            restore(file);
        }
        else
        {
            blocking.push(file.path);
        }
    }
    if (blocking.length)
    {
        console.log('sync stopped. These files changed and are not game content:');
        blocking.forEach((path) => console.log(`  ${path}`));
        console.log('Ship or undo them first. Nothing was switched.');
        return 1;
    }

    const hasLocalDev = Boolean(RunGit(['branch', '--list', baseBranch]));
    const switchArgs = hasLocalDev
        ? ['switch', baseBranch]
        : ['switch', '-c', baseBranch, '--track', `${remote}/${baseBranch}`];
    RunGit(switchArgs);
    RunGit(['merge', '--ff-only', `${remote}/${baseBranch}`]);
    RunSteps(OWNER_TOOLS.buildSteps);
    console.log(`\nYou are on the newest ${baseBranch}.`);
    if (kept.length)
    {
        console.log('Edits not yet in dev, kept for you:');
        kept.forEach((path) => console.log(`  ${path}`));
    }
    return 0;
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invoked)
{
    try
    {
        process.exitCode = main();
    }
    catch (error)
    {
        console.error(`\nsync: ${error.message}`);
        process.exitCode = 1;
    }
}
