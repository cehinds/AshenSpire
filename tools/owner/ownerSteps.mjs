// Shared helpers for the owner's play, check and ship commands.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const OWNER_TOOLS = JSON.parse(readFileSync(new URL('./ownerTools.json', import.meta.url), 'utf8'));

const OUTPUT_TAIL_LINES = 25;
const PASS_MARK = 'ok  ';
const FAIL_MARK = 'FAIL';

/** Runs `node <args>` in `workingDirectory`; returns { ok, output }. */
export function RunNode(args, workingDirectory = REPO_ROOT)
{
    const result = spawnSync(process.execPath, args, {
        cwd: workingDirectory,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
    return {
        ok: result.status === 0,
        output: `${result.stdout || ''}${result.stderr || ''}`,
    };
}

/** Runs a program (git, gh) and returns trimmed stdout; throws with its stderr when it fails. */
export function RunProgram(program, args, workingDirectory = REPO_ROOT, { allowFailure = false, raw = false } = {})
{
    const result = spawnSync(program, args, {
        cwd: workingDirectory,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error)
    {
        throw new Error(`Could not run ${program}: ${result.error.message}`);
    }
    if (result.status !== 0 && !allowFailure)
    {
        throw new Error(`${program} ${args.join(' ')} failed:\n${(result.stderr || result.stdout || '').trim()}`);
    }
    const output = result.stdout || '';
    return raw
        ? output
        : output.trim();
}

export function RunGit(args, workingDirectory = REPO_ROOT, options = {})
{
    return RunProgram('git', args, workingDirectory, options);
}

const STATUS_UNTRACKED = '??';
const STATUS_DELETED = 'D';
const STATUS_RENAMED = 'R';
const STATUS_CODE_LENGTH = 3;
const NUL_SEPARATOR = String.fromCharCode(0);
const PATCH_FILE_NAME = '.owner-tools.patch';

/** Every changed path in a working tree: [{ path, deleted, untracked }]. */
export function ChangedPaths(workingDirectory = REPO_ROOT)
{
    const entries = RunGit(['status', '--porcelain', '-z', '--untracked-files=all'], workingDirectory, { raw: true })
        .split(NUL_SEPARATOR)
        .filter(Boolean);
    const changes = [];
    for (let index = 0; index < entries.length; index++)
    {
        const code = entries[index].slice(0, 2);
        changes.push({
            path: entries[index].slice(STATUS_CODE_LENGTH),
            deleted: code.includes(STATUS_DELETED),
            untracked: code === STATUS_UNTRACKED,
        });
        if (code.includes(STATUS_RENAMED))
        {
            index++;
        }
    }
    return changes;
}

/** The diff of one file against HEAD, ready for ApplyPatch in another checkout. */
export function CapturePatch(path, workingDirectory = REPO_ROOT)
{
    return RunGit(['diff', '--binary', 'HEAD', '--', path], workingDirectory, { raw: true });
}

/** Three-way applies a captured patch; on a clash restores the file and returns false. */
export function ApplyPatch(patch, path, workingDirectory)
{
    const patchFile = join(workingDirectory, PATCH_FILE_NAME);
    writeFileSync(patchFile, patch);
    try
    {
        RunGit(['apply', '--3way', '--whitespace=nowarn', patchFile], workingDirectory);
        return true;
    }
    catch
    {
        RunGit(['checkout', 'HEAD', '--', path], workingDirectory, { allowFailure: true });
        return false;
    }
    finally
    {
        rmSync(patchFile, { force: true });
        RunGit(['reset', '--quiet', '--', path], workingDirectory, { allowFailure: true });
    }
}

function lastLines(text)
{
    return text.trim().split('\n').slice(-OUTPUT_TAIL_LINES).join('\n');
}

/** Runs each step in order and prints one line per step; stops at the first failure. */
export function RunSteps(steps, workingDirectory = REPO_ROOT, log = console.log)
{
    for (const step of steps)
    {
        const result = RunNode(step.args, workingDirectory);
        if (!result.ok)
        {
            log(`${FAIL_MARK} ${step.label}`);
            log(lastLines(result.output));
            return { ok: false, failedStep: step.label };
        }
        log(`${PASS_MARK} ${step.label}`);
    }
    return { ok: true, failedStep: null };
}

/** True when a repo path is an owner-editable content file rather than a generated one. */
export function IsEditableContentPath(relativePath, settings = OWNER_TOOLS)
{
    const path = relativePath.replace(/\\/g, '/');
    const fileName = path.split('/').pop();
    const inRoot = settings.editableRoots.some((root) => path.startsWith(root));
    const hasExtension = settings.editableExtensions.some((extension) => path.endsWith(extension));
    const isGenerated = settings.generatedNames.includes(fileName);
    return inRoot && hasExtension && !isGenerated;
}

/** True when a path must never be committed by the owner tools (built HTML, the build box). */
export function IsNeverCommitPath(relativePath, settings = OWNER_TOOLS)
{
    const path = relativePath.replace(/\\/g, '/');
    return settings.neverCommit.some((rule) => path === rule || path.endsWith(rule));
}
