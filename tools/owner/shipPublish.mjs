// Commits, branch naming, pushing, the pull request and its changelog receipt.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeReceiptLines } from '../pr-restamp.mjs';
import {
    FormatText,
    OWNER_TEXT,
    OWNER_TOOLS,
} from './ownerConfig.mjs';
import { ChangedPaths } from './ownerGit.mjs';
import { IsNeverCommitPath } from './ownerPaths.mjs';
import {
    RunGit,
    RunGitHub,
    RunNode,
} from './ownerProcess.mjs';
import {
    BranchNameFor,
    CommitMessage,
    PullRequestBody,
    ReceiptLine,
} from './shipText.mjs';

const PULL_NUMBER_PATTERN = /\/pull\/(\d+)/;
const TEXT_ENCODING = 'utf8';
const FIRST_SUFFIX = 2;
const GIT = OWNER_TOOLS.git;
const CHANGELOG = OWNER_TOOLS.changelog;

function branchExists(name)
{
    const onRemote = RunGit([
        'ls-remote',
        '--heads',
        GIT.remote,
        name,
    ]);
    const onLocal = RunGit([
        'branch',
        '--list',
        name,
    ]);
    return Boolean(onRemote || onLocal);
}

function boxStamp(worktree)
{
    const boxPath = join(worktree, CHANGELOG.buildOrdinalFile);
    const box = JSON.parse(readFileSync(boxPath, TEXT_ENCODING));
    return `${box.release}.${box.ordinal}`;
}

function createArgs(pull)
{
    return [
        'pr',
        'create',
        '--base',
        GIT.baseBranch,
        '--head',
        pull.branch,
        '--title',
        pull.title,
        '--body',
        PullRequestBody(pull.described, pull.checkLines),
    ];
}

function pullNotOpened(branch, error)
{
    const message = FormatText(OWNER_TEXT.ship.pullNotOpened, {
        branch,
        base: GIT.baseBranch,
        error: error.message,
    });
    return new Error(message);
}

function addReceiptLine(worktree, receipt)
{
    const stamp = boxStamp(worktree);
    const changelogPath = join(worktree, CHANGELOG.file);
    const base = readFileSync(changelogPath, TEXT_ENCODING);
    const line = ReceiptLine({
        ...receipt,
        stamp,
    });
    const merged = mergeReceiptLines(
        base,
        line,
        receipt.pullNumber,
        stamp,
    );
    writeFileSync(changelogPath, merged);
}

/** Stages `paths` and commits them with { subject, lines }. */
export function Commit(
    worktree,
    paths,
    message,
)
{
    const addArgs = [
        'add',
        '--',
        ...paths,
    ];
    const commitArgs = [
        'commit',
        '--quiet',
        '-m',
        CommitMessage(message.subject, message.lines),
    ];
    RunGit(addArgs, { cwd: worktree });
    RunGit(commitArgs, { cwd: worktree });
}

/** Every changed path in the worktree that may be committed (never built HTML or the box). */
export function GeneratedPaths(worktree)
{
    return ChangedPaths(worktree)
        .map((file) => file.path)
        .filter((path) => !IsNeverCommitPath(path));
}

/** The first free branch name for a title: Name, Name2, Name3... */
export function UniqueBranchName(title)
{
    const baseName = BranchNameFor(title);
    let candidate = baseName;
    for (let suffix = FIRST_SUFFIX; branchExists(candidate); suffix++)
    {
        candidate = `${baseName}${suffix}`;
    }
    return candidate;
}

/** Opens the pull request into dev and returns { url, pullNumber }. */
export function OpenPullRequest(worktree, pull)
{
    try
    {
        const url = RunGitHub(createArgs(pull), { cwd: worktree });
        const match = PULL_NUMBER_PATTERN.exec(url);
        return {
            url,
            pullNumber: Number(match?.[1]),
        };
    }
    catch (error)
    {
        throw pullNotOpened(pull.branch, error);
    }
}

/** Adds the CHANGELOG receipt and the in-game changelog, then commits both. */
export function WriteReceipt(worktree, receipt)
{
    addReceiptLine(worktree, receipt);
    const projection = RunNode(CHANGELOG.projectionArgs, worktree);
    if (!projection.ok)
    {
        const message = FormatText(OWNER_TEXT.ship.changelogFailed, {
            output: projection.output,
        });
        throw new Error(message);
    }
    const paths = [
        CHANGELOG.file,
        CHANGELOG.generatedModule,
    ];
    Commit(worktree, paths, {
        subject: OWNER_TEXT.commits.receipt,
        lines: [],
    });
}
