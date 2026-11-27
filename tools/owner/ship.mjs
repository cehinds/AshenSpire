#!/usr/bin/env node
// npm run ship -- "Title": puts your JSON edits on a new feature branch from origin/dev,
// one commit per file, then pushes and opens a pull request into dev. --local skips the push.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DescribeFileChange } from './contentDiff.mjs';
import {
    OWNER_TOOLS,
    REPO_ROOT,
    ChangedPaths,
    IsEditableContentPath,
    IsNeverCommitPath,
    RunGit,
    RunNode,
    RunProgram,
    RunSteps,
} from './ownerSteps.mjs';
import { mergeReceiptLines } from '../pr-restamp.mjs';

const QUICK_FLAG = '--quick';
const DRY_RUN_FLAG = '--dry-run';
const LOCAL_FLAG = '--local';
const WORKTREE_PREFIX = 'ashenspire-ship-';
const REGENERATE_SUBJECT = 'Regenerate game data from the edited files';
const RECEIPT_SUBJECT = 'Add the changelog receipt';
const PULL_NUMBER_PATTERN = /\/pull\/(\d+)/;
const TITLE_WORD_PATTERN = /[A-Za-z0-9]+/g;
const BRANCH_TITLE_LIMIT = 40;

/** The owner-editable files changed in the working tree: [{ path, deleted }]. */
export function ChangedContentFiles(workingDirectory = REPO_ROOT)
{
    return ChangedPaths(workingDirectory).filter((file) => IsEditableContentPath(file.path));
}

/** Turns a free-text title into a CamelCase branch name under feature/Owner. */
export function BranchNameFor(title, settings = OWNER_TOOLS)
{
    const words = title.match(TITLE_WORD_PATTERN) || ['Content'];
    const camel = words
        .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
        .join('')
        .slice(0, BRANCH_TITLE_LIMIT);
    return `${settings.git.branchPrefix}${camel}`;
}

function uniqueBranchName(baseName)
{
    const remote = OWNER_TOOLS.git.remote;
    let candidate = baseName;
    let suffix = 2;
    while (RunGit(['ls-remote', '--heads', remote, candidate]) || RunGit(['branch', '--list', candidate]))
    {
        candidate = `${baseName}${suffix}`;
        suffix++;
    }
    return candidate;
}

function readAtHead(path, workingDirectory)
{
    const text = RunGit(['show', `HEAD:${path}`], workingDirectory, { allowFailure: true });
    return text || null;
}

function readWorking(path, workingDirectory)
{
    const full = join(workingDirectory, path);
    return existsSync(full)
        ? readFileSync(full, 'utf8')
        : null;
}

/** Brings one file's edit into the ship worktree with a three-way apply; untracked files are copied. */
function carryFile(file, worktree)
{
    if (file.untracked)
    {
        mkdirSync(dirname(join(worktree, file.path)), { recursive: true });
        copyFileSync(join(REPO_ROOT, file.path), join(worktree, file.path));
        return;
    }
    const patch = RunGit(['diff', '--binary', 'HEAD', '--', file.path]);
    const patchFile = join(worktree, '.owner-ship.patch');
    writeFileSync(patchFile, `${patch}\n`);
    try
    {
        RunGit(['apply', '--3way', '--whitespace=nowarn', patchFile], worktree);
    }
    catch (error)
    {
        throw new Error(`${file.path} also changed on dev and the edits clash. Run "npm run sync", redo the edit, then ship again.\n${error.message}`);
    }
    finally
    {
        rmSync(patchFile, { force: true });
    }
}

function commit(worktree, paths, subject, bodyLines)
{
    RunGit(['add', '--', ...paths], worktree);
    const bodyRepeatsSubject = bodyLines.length === 1 && bodyLines[0] === subject;
    const body = bodyLines.length && !bodyRepeatsSubject
        ? `\n\n${bodyLines.map((line) => `- ${line}`).join('\n')}`
        : '';
    RunGit(['commit', '--quiet', '-m', `${subject}${body}`], worktree);
}

function stageGenerated(worktree)
{
    return ChangedPaths(worktree)
        .map((file) => file.path)
        .filter((path) => !IsNeverCommitPath(path));
}

function pullRequestBody(described, checkSummary)
{
    const sections = described.map((item) =>
    {
        const lines = item.lines.length
            ? item.lines
            : [item.subject];
        return `**${item.path}**\n${lines.map((line) => `- ${line}`).join('\n')}`;
    });
    return [
        '## What changed',
        '',
        sections.join('\n\n'),
        '',
        '## Checks run before pushing',
        '',
        checkSummary,
        '',
        '## Try it',
        '',
        'Check out this branch, then run `npm run play`.',
        '',
        'Opened by `npm run ship` (docs/OWNER-EDITING.md).',
    ].join('\n');
}

function receiptLine(title, pullNumber, stamp, summary)
{
    const url = `${OWNER_TOOLS.git.repositoryUrl}/pull/${pullNumber}`;
    return `- **${title}** ([#${pullNumber}](${url}), \`${stamp}\`). ${summary}`;
}

/** Adds the CHANGELOG receipt for the pull request and commits it with the in-game changelog. */
export function WriteReceipt(worktree, title, pullNumber, summary)
{
    const settings = OWNER_TOOLS.changelog;
    const box = JSON.parse(readFileSync(join(worktree, settings.buildOrdinalFile), 'utf8'));
    const stamp = `${box.release}.${box.ordinal}`;
    const changelogPath = join(worktree, settings.file);
    const base = readFileSync(changelogPath, 'utf8');
    const line = receiptLine(title, pullNumber, stamp, summary);
    writeFileSync(changelogPath, mergeReceiptLines(base, line, pullNumber, stamp));
    const projection = RunNode(settings.projectionArgs, worktree);
    if (!projection.ok)
    {
        throw new Error(`Writing the changelog failed:\n${projection.output}`);
    }
    commit(worktree, [settings.file, settings.generatedModule], RECEIPT_SUBJECT, []);
}

function receiptSummary(described)
{
    const lines = described.flatMap((item) => item.lines);
    const shown = lines.slice(0, 2).join('. ');
    return shown.endsWith('.')
        ? shown
        : `${shown}.`;
}

function captureLog()
{
    const lines = [];
    return {
        lines,
        log: (line) =>
        {
            console.log(line);
            lines.push(line);
        },
    };
}

function main(argv)
{
    const quick = argv.includes(QUICK_FLAG);
    const dryRun = argv.includes(DRY_RUN_FLAG);
    const local = argv.includes(LOCAL_FLAG);
    const titleArgument = argv.filter((arg) => !arg.startsWith('--')).join(' ').trim();
    const files = ChangedContentFiles();
    if (!files.length)
    {
        console.log('Nothing to ship: no edited JSON or CSV under content/ or games/.');
        return 0;
    }

    const described = files.map((file) =>
    {
        const change = DescribeFileChange(file.path, readAtHead(file.path, REPO_ROOT), readWorking(file.path, REPO_ROOT));
        return {
            ...change,
            path: file.path,
        };
    });
    const title = titleArgument || described[0].subject;
    console.log(`Shipping ${files.length} file(s) as "${title}":`);
    described.forEach((item) => console.log(`  ${item.path}: ${item.subject}`));
    if (dryRun)
    {
        return 0;
    }

    if (!local)
    {
        RunProgram('gh', ['auth', 'status']);
    }
    const { remote, baseBranch } = OWNER_TOOLS.git;
    RunGit(['fetch', '--quiet', remote, baseBranch]);
    const branch = uniqueBranchName(BranchNameFor(title));
    const worktree = mkdtempSync(join(tmpdir(), WORKTREE_PREFIX));
    RunGit(['worktree', 'add', '--quiet', '-b', branch, worktree, `${remote}/${baseBranch}`]);
    let pushed = false;
    try
    {
        files.forEach((file) => carryFile(file, worktree));
        RunGit(['reset', '--quiet'], worktree);
        for (const item of described)
        {
            commit(worktree, [item.path], item.subject, item.lines);
        }

        const checks = captureLog();
        const built = RunSteps(OWNER_TOOLS.buildSteps, worktree, checks.log);
        const checked = built.ok && RunSteps(OWNER_TOOLS.checkSteps, worktree, checks.log).ok;
        const tested = checked && (quick || RunSteps(OWNER_TOOLS.testSteps, worktree, checks.log).ok);
        if (!tested)
        {
            console.log('\nStopped: fix the error above, then run "npm run ship" again. Nothing was pushed.');
            return 1;
        }
        const generated = stageGenerated(worktree);
        if (generated.length)
        {
            commit(worktree, generated, REGENERATE_SUBJECT, []);
        }
        if (local)
        {
            pushed = true;
            console.log(`
Local only: branch ${branch} has the commits. Nothing was pushed.`);
            return 0;
        }

        RunGit(['push', '--quiet', '-u', remote, branch], worktree);
        pushed = true;
        const url = RunProgram('gh', [
            'pr',
            'create',
            '--base',
            baseBranch,
            '--head',
            branch,
            '--title',
            title,
            '--body',
            pullRequestBody(described, checks.lines.join('\n')),
        ], worktree);
        const pullNumber = Number(PULL_NUMBER_PATTERN.exec(url)?.[1]);
        WriteReceipt(worktree, title, pullNumber, receiptSummary(described));
        RunGit(['push', '--quiet', remote, branch], worktree);
        console.log(`\nPull request: ${url}`);
        console.log('Your local edits are still here. After the pull request merges, run "npm run sync".');
        return 0;
    }
    finally
    {
        RunGit(['worktree', 'remove', '--force', worktree], REPO_ROOT, { allowFailure: true });
        if (!pushed)
        {
            RunGit(['branch', '-D', branch], REPO_ROOT, { allowFailure: true });
        }
    }
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invoked)
{
    try
    {
        process.exitCode = main(process.argv.slice(2));
    }
    catch (error)
    {
        console.error(`\nship: ${error.message}`);
        process.exitCode = 1;
    }
}
