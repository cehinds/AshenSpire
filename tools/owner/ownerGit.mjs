// Git work the owner tools share: changed files, patches, file copies and temp worktrees.
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { REPO_ROOT } from './ownerConfig.mjs';
import { IsEditableContentPath, SameText } from './ownerPaths.mjs';
import { RunGit } from './ownerProcess.mjs';

const STATUS_UNTRACKED = '??';
const STATUS_DELETED = 'D';
const STATUS_RENAMED = 'R';
const STATUS_CODE_LENGTH = 3;
const NUL_SEPARATOR = String.fromCharCode(0);
const PATCH_FILE_NAME = '.owner-tools.patch';
const WORKTREE_PREFIX = 'ashenspire-owner-';
const HEAD_REF = 'HEAD';
const QUIET = '--quiet';
const TEXT_ENCODING = 'utf8';

function statusEntries(cwd)
{
    const args = [
        'status',
        '--porcelain',
        '-z',
        '--untracked-files=all',
    ];
    const status = RunGit(args, {
        cwd,
        raw: true,
    });
    return status
        .split(NUL_SEPARATOR)
        .filter(Boolean);
}

function changeOf(entry)
{
    const code = entry.slice(0, 2);
    return {
        path: entry.slice(STATUS_CODE_LENGTH),
        deleted: code.includes(STATUS_DELETED),
        untracked: code === STATUS_UNTRACKED,
        renamed: code.includes(STATUS_RENAMED),
    };
}

function restoreFromHead(path, cwd)
{
    const args = [
        'checkout',
        HEAD_REF,
        '--',
        path,
    ];
    RunGit(args, {
        cwd,
        allowFailure: true,
    });
}

function unstage(path, cwd)
{
    const args = [
        'reset',
        QUIET,
        '--',
        path,
    ];
    RunGit(args, {
        cwd,
        allowFailure: true,
    });
}

/** Every changed path in a working tree: [{ path, deleted, untracked, renamed }]. */
export function ChangedPaths(cwd = REPO_ROOT)
{
    const entries = statusEntries(cwd);
    const changes = [];
    for (let index = 0; index < entries.length; index++)
    {
        const change = changeOf(entries[index]);
        changes.push(change);
        if (change.renamed)
        {
            index++;
        }
    }
    return changes;
}

/** The owner-editable files changed in a working tree. */
export function ChangedContentFiles(cwd = REPO_ROOT)
{
    return ChangedPaths(cwd).filter((file) => IsEditableContentPath(file.path));
}

/** A file's text in a working tree, or null when it does not exist. */
export function ReadWorking(path, cwd = REPO_ROOT)
{
    const full = join(cwd, path);
    if (!existsSync(full))
    {
        return null;
    }
    return readFileSync(full, TEXT_ENCODING);
}

/** A file's text at a commit or ref, or null when it is not there. */
export function ReadAtRef(
    ref,
    path,
    cwd = REPO_ROOT,
)
{
    const text = RunGit(['show', `${ref}:${path}`], {
        cwd,
        allowFailure: true,
    });
    return text || null;
}

/** Copies a file between checkouts, replacing what is there (a missing source deletes it). */
export function CopyOver(
    fromRoot,
    toRoot,
    path,
)
{
    const source = join(fromRoot, path);
    const target = join(toRoot, path);
    if (!existsSync(source))
    {
        rmSync(target, { force: true });
        return;
    }
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
}

/** CopyOver, but refuses (false) to replace a different file already there. */
export function CopyBetween(
    fromRoot,
    toRoot,
    path,
)
{
    const targetText = ReadWorking(path, toRoot);
    const sourceText = ReadWorking(path, fromRoot);
    const clash = targetText !== null && !SameText(targetText, sourceText);
    if (clash)
    {
        return false;
    }
    CopyOver(
        fromRoot,
        toRoot,
        path,
    );
    return true;
}

/** The diff of one file against a ref, ready for ApplyPatch in another checkout. */
export function CapturePatch(path, ref = HEAD_REF)
{
    const args = [
        'diff',
        '--binary',
        ref,
        '--',
        path,
    ];
    return RunGit(args, { raw: true });
}

/** Three-way applies a captured patch; on a clash restores the file and returns false. */
export function ApplyPatch(
    patch,
    path,
    cwd,
)
{
    const patchFile = join(cwd, PATCH_FILE_NAME);
    writeFileSync(patchFile, patch);
    const args = [
        'apply',
        '--3way',
        '--whitespace=nowarn',
        patchFile,
    ];
    try
    {
        RunGit(args, { cwd });
        return true;
    }
    catch
    {
        restoreFromHead(path, cwd);
        return false;
    }
    finally
    {
        rmSync(patchFile, { force: true });
        unstage(path, cwd);
    }
}

/** A detached temp worktree at `ref`; pair with RemoveWorktree. */
export function AddDetachedWorktree(ref)
{
    const worktree = mkdtempSync(join(tmpdir(), WORKTREE_PREFIX));
    RunGit([
        'worktree',
        'add',
        QUIET,
        '--detach',
        worktree,
        ref,
    ]);
    return worktree;
}

export function RemoveWorktree(worktree)
{
    const args = [
        'worktree',
        'remove',
        '--force',
        worktree,
    ];
    RunGit(args, { allowFailure: true });
}
