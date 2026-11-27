#!/usr/bin/env node
// npm run sync: moves this copy to the newest dev. Edits already in dev are cleared; edits
// not yet shipped are carried over, with a backup copy in .owner-backup/.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import {
    FormatText,
    IsMainModule,
    OWNER_TEXT,
    OWNER_TOOLS,
    REPO_ROOT,
} from './ownerConfig.mjs';
import {
    ApplyPatch,
    CapturePatch,
    ChangedContentFiles,
    ChangedPaths,
    CopyBetween,
    CopyOver,
    ReadAtRef,
    ReadWorking,
} from './ownerGit.mjs';
import { IsDerivedPath, SameText } from './ownerPaths.mjs';
import { RunGit, RunSteps } from './ownerProcess.mjs';

const BACKUP_FOLDER = OWNER_TOOLS.files.backupFolder;
const TIMESTAMP_UNSAFE = /[:.]/g;
const TIMESTAMP_SAFE = '-';
const HEAD_REF = 'HEAD';
const QUIET = '--quiet';
const TEXT = OWNER_TEXT.sync;
const INDENT = OWNER_TEXT.marks.indent;

function newestBase()
{
    const { remote, baseBranch } = OWNER_TOOLS.git;
    return `${remote}/${baseBranch}`;
}

function restore(file)
{
    if (file.untracked)
    {
        rmSync(join(REPO_ROOT, file.path), { force: true });
        return;
    }
    RunGit([
        'checkout',
        HEAD_REF,
        '--',
        file.path,
    ]);
}

/** Clears edits already in dev; returns the ones still unshipped. */
function clearShipped()
{
    const unshipped = [];
    for (const file of ChangedContentFiles())
    {
        const inDev = SameText(ReadWorking(file.path), ReadAtRef(newestBase(), file.path));
        if (inDev)
        {
            restore(file);
            continue;
        }
        unshipped.push(file);
    }
    return unshipped;
}

/** Restores derived files; returns any other changed path, which blocks the switch. */
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

/** Backs up each unshipped edit and records its patch, then undoes it; fills `saved`. */
function setAside(
    files,
    backupRoot,
    saved,
)
{
    for (const file of files)
    {
        CopyOver(
            REPO_ROOT,
            backupRoot,
            file.path,
        );
        const patch = file.untracked
            ? null
            : CapturePatch(file.path);
        restore(file);
        saved.push({
            ...file,
            patch,
        });
    }
}

function carryBack(saved, backupRoot)
{
    const clashed = [];
    for (const file of saved)
    {
        const carried = file.untracked
            ? CopyBetween(
                backupRoot,
                REPO_ROOT,
                file.path,
            )
            : ApplyPatch(
                file.patch,
                file.path,
                REPO_ROOT,
            );
        if (!carried)
        {
            clashed.push(file.path);
        }
    }
    return clashed;
}

/** Points the owner's work branch at the newest dev; refuses if it has commits dev lacks. */
function moveToNewestBase()
{
    const { baseBranch, workBranch } = OWNER_TOOLS.git;
    const exists = Boolean(RunGit([
        'branch',
        '--list',
        workBranch,
    ]));
    const unmerged = exists
        ? RunGit([
            'log',
            '--oneline',
            `${newestBase()}..${workBranch}`,
        ])
        : '';
    if (unmerged)
    {
        const message = FormatText(TEXT.unmerged, {
            branch: workBranch,
            base: baseBranch,
            commits: unmerged,
        });
        throw new Error(message);
    }
    RunGit([
        'switch',
        '--no-track',
        '-C',
        workBranch,
        newestBase(),
    ]);
}

function reportKept(
    saved,
    clashed,
    backupRoot,
)
{
    if (!saved.length)
    {
        return;
    }
    console.log(TEXT.kept);
    saved.forEach((file) => console.log(`${INDENT}${file.path}`));
    console.log(FormatText(TEXT.backup, { folder: backupRoot }));
    if (!clashed.length)
    {
        return;
    }
    console.log(TEXT.clashed);
    clashed.forEach((path) => console.log(`${INDENT}${path}`));
}

function backupFolder()
{
    const stamp = new Date()
        .toISOString()
        .replace(TIMESTAMP_UNSAFE, TIMESTAMP_SAFE);
    return join(
        REPO_ROOT,
        BACKUP_FOLDER,
        stamp,
    );
}

function reportBlocking(blocking)
{
    console.log(TEXT.blocked);
    blocking.forEach((path) => console.log(`${INDENT}${path}`));
    console.log(TEXT.blockedAdvice);
}

function fetchNewest()
{
    const { remote, baseBranch } = OWNER_TOOLS.git;
    RunGit([
        'fetch',
        QUIET,
        remote,
        baseBranch,
    ]);
    RunGit(['reset', QUIET]);
}

/** Sets unshipped edits aside, switches, and always carries them back. */
function switchCarrying(unshipped)
{
    const backupRoot = backupFolder();
    const saved = [];
    try
    {
        setAside(
            unshipped,
            backupRoot,
            saved,
        );
        moveToNewestBase();
    }
    finally
    {
        const clashed = carryBack(saved, backupRoot);
        RunSteps(OWNER_TOOLS.buildSteps);
        reportKept(
            saved,
            clashed,
            backupRoot,
        );
    }
}

function main()
{
    const { baseBranch, workBranch } = OWNER_TOOLS.git;
    fetchNewest();
    const unshipped = clearShipped();
    const keptPaths = new Set(unshipped.map((file) => file.path));
    const blocking = clearDerivedOrFindBlocking(keptPaths);
    if (blocking.length)
    {
        reportBlocking(blocking);
        return 1;
    }
    switchCarrying(unshipped);
    console.log(FormatText(TEXT.done, {
        branch: workBranch,
        base: baseBranch,
    }));
    return 0;
}

if (IsMainModule(import.meta.url))
{
    try
    {
        process.exitCode = main();
    }
    catch (error)
    {
        console.error(FormatText(TEXT.errorPrefix, { error: error.message }));
        process.exitCode = 1;
    }
}
