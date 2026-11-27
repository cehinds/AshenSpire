#!/usr/bin/env node
// npm run sync: moves this copy to the newest dev. Edits already in dev are cleared;
// edits not yet shipped are carried over, with a backup copy in .owner-backup/.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChangedContentFiles } from './ship.mjs';
import {
    OWNER_TOOLS,
    REPO_ROOT,
    ApplyPatch,
    CapturePatch,
    ChangedPaths,
    RunGit,
    RunSteps,
} from './ownerSteps.mjs';

const BACKUP_FOLDER = '.owner-backup';
const TIMESTAMP_UNSAFE = /[:.]/g;

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

function copyBetween(fromRoot, toRoot, path)
{
    const source = join(fromRoot, path);
    if (!existsSync(source))
    {
        return;
    }
    mkdirSync(dirname(join(toRoot, path)), { recursive: true });
    copyFileSync(source, join(toRoot, path));
}

/** Copies each unshipped edit to the backup folder and records its patch, then undoes it here. */
function setAside(files, backupRoot)
{
    return files.map((file) =>
    {
        copyBetween(REPO_ROOT, backupRoot, file.path);
        const patch = file.untracked
            ? null
            : CapturePatch(file.path);
        restore(file);
        return {
            ...file,
            patch,
        };
    });
}

function carryBack(saved, backupRoot)
{
    const clashed = [];
    for (const file of saved)
    {
        if (file.untracked)
        {
            if (existsSync(join(REPO_ROOT, file.path)))
            {
                clashed.push(file.path);
                continue;
            }
            copyBetween(backupRoot, REPO_ROOT, file.path);
            continue;
        }
        if (!ApplyPatch(file.patch, file.path, REPO_ROOT))
        {
            clashed.push(file.path);
        }
    }
    return clashed;
}

function clearDerivedOrFindBlocking(keptPaths)
{
    const blocking = [];
    for (const file of ChangedPaths())
    {
        if (keptPaths.has(file.path))
        {
            continue;
        }
        if (IsDerivedPath(file.path))
        {
            restore(file);
            continue;
        }
        blocking.push(file.path);
    }
    return blocking;
}

function moveToNewestBase()
{
    const { remote, baseBranch } = OWNER_TOOLS.git;
    const hasLocalBase = Boolean(RunGit(['branch', '--list', baseBranch]));
    const switchArgs = hasLocalBase
        ? ['switch', baseBranch]
        : ['switch', '-c', baseBranch, '--track', `${remote}/${baseBranch}`];
    RunGit(switchArgs);
    RunGit(['merge', '--ff-only', `${remote}/${baseBranch}`]);
}

function main()
{
    const { remote, baseBranch } = OWNER_TOOLS.git;
    RunGit(['fetch', '--quiet', remote, baseBranch]);

    const unshipped = [];
    for (const file of ChangedContentFiles())
    {
        if (workingText(file.path) === devText(file.path))
        {
            restore(file);
        }
        else
        {
            unshipped.push(file);
        }
    }
    const blocking = clearDerivedOrFindBlocking(new Set(unshipped.map((file) => file.path)));
    if (blocking.length)
    {
        console.log('sync stopped. These files changed and are not game content:');
        blocking.forEach((path) => console.log(`  ${path}`));
        console.log('Ship or undo them first. Nothing was switched.');
        return 1;
    }

    const stamp = new Date().toISOString().replace(TIMESTAMP_UNSAFE, '-');
    const backupRoot = join(REPO_ROOT, BACKUP_FOLDER, stamp);
    const saved = setAside(unshipped, backupRoot);
    try
    {
        moveToNewestBase();
    }
    finally
    {
        const clashed = carryBack(saved, backupRoot);
        RunSteps(OWNER_TOOLS.buildSteps);
        reportKept(saved, clashed, backupRoot);
    }
    console.log(`\nYou are on the newest ${baseBranch}.`);
    return 0;
}

function reportKept(saved, clashed, backupRoot)
{
    if (!saved.length)
    {
        return;
    }
    console.log('\nEdits not yet shipped, kept for you:');
    saved.forEach((file) => console.log(`  ${file.path}`));
    if (clashed.length)
    {
        console.log('\nThese changed on dev too, so they now hold dev\'s version. Your copy is in:');
        console.log(`  ${backupRoot}`);
        clashed.forEach((path) => console.log(`  ${path}`));
    }
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
