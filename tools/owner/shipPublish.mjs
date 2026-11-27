// Commits, branch naming, pushing, the pull request and its changelog receipt.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeReceiptLines } from '../pr-restamp.mjs';
import { OWNER_TOOLS } from './ownerConfig.mjs';
import { ChangedPaths } from './ownerGit.mjs';
import { IsNeverCommitPath } from './ownerPaths.mjs';
import { RunGit, RunNode, RunProgram } from './ownerProcess.mjs';
import {
    BranchNameFor,
    CommitMessage,
    PullRequestBody,
    ReceiptLine,
} from './shipText.mjs';

const GH_PROGRAM = 'gh';
const PULL_NUMBER_PATTERN = /\/pull\/(\d+)/;
const RECEIPT_SUBJECT = 'Add the changelog receipt';
const TEXT_ENCODING = 'utf8';

function branchExists(name)
{
    const { remote } = OWNER_TOOLS.git;
    const onRemote = RunGit([
        'ls-remote',
        '--heads',
        remote,
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
    const boxPath = join(worktree, OWNER_TOOLS.changelog.buildOrdinalFile);
    const box = JSON.parse(readFileSync(boxPath, TEXT_ENCODING));
    return `${box.release}.${box.ordinal}`;
}

function manualPullAdvice(branch)
{
    const { baseBranch } = OWNER_TOOLS.git;
    const command = `gh pr create --base ${baseBranch} --head ${branch} --fill`;
    return `Branch ${branch} is on GitHub, but the pull request did not open. Run:\n  ${command}`;
}

/** Stages `paths` and commits them with a subject and change lines. */
export function Commit(
    worktree,
    paths,
    message,
)
{
    RunGit([
        'add',
        '--',
        ...paths,
    ], { cwd: worktree });
    const text = CommitMessage(message.subject, message.lines);
    RunGit([
        'commit',
        '--quiet',
        '-m',
        text,
    ], { cwd: worktree });
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
    for (let suffix = 2; branchExists(candidate); suffix++)
    {
        candidate = `${baseName}${suffix}`;
    }
    return candidate;
}

/** Opens the pull request into dev and returns { url, pullNumber }. */
export function OpenPullRequest(worktree, pull)
{
    const args = [
        'pr',
        'create',
        '--base',
        OWNER_TOOLS.git.baseBranch,
        '--head',
        pull.branch,
        '--title',
        pull.title,
        '--body',
        PullRequestBody(pull.described, pull.checkLines),
    ];
    try
    {
        const url = RunProgram(
            GH_PROGRAM,
            args,
            { cwd: worktree },
        );
        const pullNumber = Number(PULL_NUMBER_PATTERN.exec(url)?.[1]);
        return {
            url,
            pullNumber,
        };
    }
    catch (error)
    {
        throw new Error(`${manualPullAdvice(pull.branch)}\n${error.message}`);
    }
}

/** Adds the CHANGELOG receipt and the in-game changelog, then commits both. */
export function WriteReceipt(worktree, receipt)
{
    const settings = OWNER_TOOLS.changelog;
    const stamp = boxStamp(worktree);
    const changelogPath = join(worktree, settings.file);
    const base = readFileSync(changelogPath, TEXT_ENCODING);
    const line = ReceiptLine({
        ...receipt,
        stamp,
    });
    writeFileSync(changelogPath, mergeReceiptLines(
        base,
        line,
        receipt.pullNumber,
        stamp,
    ));
    const projection = RunNode(settings.projectionArgs, worktree);
    if (!projection.ok)
    {
        throw new Error(`Writing the changelog failed:\n${projection.output}`);
    }
    const paths = [
        settings.file,
        settings.generatedModule,
    ];
    Commit(worktree, paths, {
        subject: RECEIPT_SUBJECT,
        lines: [],
    });
}
