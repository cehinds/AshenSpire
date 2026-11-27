#!/usr/bin/env node
// npm run ship -- "Title": puts your JSON edits on a feature branch cut from origin/dev, one
// commit per file, then pushes and opens a pull request. --quick, --dry-run, --local.
import { DescribeFileChange } from './contentDiff.mjs';
import { IsMainModule, OWNER_TOOLS } from './ownerConfig.mjs';
import {
    AddDetachedWorktree,
    ChangedContentFiles,
    ReadAtRef,
    ReadWorking,
    RemoveWorktree,
} from './ownerGit.mjs';
import { IsRebuiltPath } from './ownerPaths.mjs';
import { RunGit, RunProgram, RunSteps } from './ownerProcess.mjs';
import { CarryFile, OwnerRebuiltEdits } from './shipCarry.mjs';
import {
    Commit,
    GeneratedPaths,
    OpenPullRequest,
    UniqueBranchName,
    WriteReceipt,
} from './shipPublish.mjs';
import { FetchShippedRefs, ShippedIn } from './shipRefs.mjs';
import { ReceiptSummary } from './shipText.mjs';

const QUICK_FLAG = '--quick';
const DRY_RUN_FLAG = '--dry-run';
const LOCAL_FLAG = '--local';
const FLAG_PREFIX = '--';
const HEAD_REF = 'HEAD';
const GH_PROGRAM = 'gh';
const REGENERATE_SUBJECT = 'Regenerate game data from the edited files';
const STOPPED_NOTE = 'Stopped: fix the error above, then run "npm run ship" again. Not pushed.';
const SYNC_NOTE = 'Your edits are still here. After the pull request merges, run "npm run sync".';
const RECEIPT_FAILED = 'The pull request is open, but its changelog entry failed:';

function parseOptions(argv)
{
    const words = argv.filter((arg) => !arg.startsWith(FLAG_PREFIX));
    return {
        quick: argv.includes(QUICK_FLAG),
        dryRun: argv.includes(DRY_RUN_FLAG),
        local: argv.includes(LOCAL_FLAG),
        title: words.join(' ').trim(),
    };
}

function describe(file)
{
    const beforeRef = file.baseline || HEAD_REF;
    const before = ReadAtRef(beforeRef, file.path);
    const change = DescribeFileChange(
        file.path,
        before,
        ReadWorking(file.path),
    );
    return {
        ...change,
        path: file.path,
    };
}

function unshippedFiles()
{
    const refs = FetchShippedRefs();
    return ChangedContentFiles().filter((file) =>
    {
        const ref = ShippedIn(file.path, refs);
        if (ref)
        {
            console.log(`Skipping ${file.path}: already in ${ref}.`);
        }
        return !ref;
    });
}

/** The edits to ship: plain files, plus the owner's own part of rebuilt files. */
function selectEdits()
{
    const fresh = unshippedFiles();
    const direct = fresh.filter((file) => !IsRebuiltPath(file.path));
    const rebuilt = fresh.filter((file) => IsRebuiltPath(file.path));
    const carried = [
        ...direct,
        ...OwnerRebuiltEdits(rebuilt, direct),
    ];
    return carried.map((file) => ({
        file,
        described: describe(file),
    }));
}

function runGates(
    worktree,
    quick,
    log,
)
{
    const tests = quick
        ? []
        : OWNER_TOOLS.testSteps;
    const gates = [
        OWNER_TOOLS.buildSteps,
        OWNER_TOOLS.checkSteps,
        tests,
    ];
    return gates.every((steps) => RunSteps(
        steps,
        worktree,
        log,
    ).ok);
}

/** Carries and commits each edit, rebuilds, runs the gates, commits generated data. */
function buildBranch(
    worktree,
    edits,
    quick,
)
{
    const checkLines = [];
    const log = (line) =>
    {
        console.log(line);
        checkLines.push(line);
    };
    edits.forEach((edit) => CarryFile(edit.file, worktree));
    edits.forEach((edit) => Commit(
        worktree,
        [edit.file.path],
        edit.described,
    ));
    const passed = runGates(
        worktree,
        quick,
        log,
    );
    if (!passed)
    {
        return null;
    }
    const generated = GeneratedPaths(worktree);
    if (generated.length)
    {
        Commit(worktree, generated, {
            subject: REGENERATE_SUBJECT,
            lines: [],
        });
    }
    return checkLines;
}

function push(worktree, branch)
{
    const args = [
        'push',
        '--quiet',
        '-u',
        OWNER_TOOLS.git.remote,
        branch,
    ];
    RunGit(args, { cwd: worktree });
}

/** Pushes, opens the pull request, then adds its receipt. */
function publish(
    worktree,
    pull,
    state,
)
{
    push(worktree, pull.branch);
    state.unpushedBranch = null;
    const opened = OpenPullRequest(worktree, pull);
    try
    {
        WriteReceipt(worktree, {
            title: pull.title,
            pullNumber: opened.pullNumber,
            summary: ReceiptSummary(pull.described),
        });
        push(worktree, pull.branch);
    }
    catch (error)
    {
        console.log(`\n${RECEIPT_FAILED}\n${error.message}`);
    }
    console.log(`\nPull request: ${opened.url}\n${SYNC_NOTE}`);
}

function listEdits(edits)
{
    console.log('Shipping:');
    edits.forEach((edit) => console.log(`  ${edit.file.path}: ${edit.described.subject}`));
}

/** Builds the branch in `worktree`, then keeps it local or publishes it; returns an exit code. */
function shipFrom(
    worktree,
    edits,
    state,
)
{
    const checkLines = buildBranch(
        worktree,
        edits,
        state.options.quick,
    );
    if (!checkLines)
    {
        console.log(`\n${STOPPED_NOTE}`);
        return 1;
    }
    const described = edits.map((edit) => edit.described);
    const title = state.options.title || described[0].subject;
    const branch = UniqueBranchName(title);
    RunGit([
        'switch',
        '--quiet',
        '-c',
        branch,
    ], { cwd: worktree });
    if (state.options.local)
    {
        console.log(`\nLocal only: branch ${branch} has the commits. Nothing was pushed.`);
        return 0;
    }
    state.unpushedBranch = branch;
    publish(worktree, {
        branch,
        title,
        described,
        checkLines,
    }, state);
    return 0;
}

function cleanUp(worktree, state)
{
    RemoveWorktree(worktree);
    if (!state.unpushedBranch)
    {
        return;
    }
    RunGit([
        'branch',
        '-D',
        state.unpushedBranch,
    ], { allowFailure: true });
}

function main(argv)
{
    const options = parseOptions(argv);
    const edits = selectEdits();
    if (!edits.length)
    {
        console.log('Nothing new to ship.');
        return 0;
    }
    listEdits(edits);
    if (options.dryRun)
    {
        return 0;
    }
    if (!options.local)
    {
        RunProgram(GH_PROGRAM, ['auth', 'status']);
    }
    const { remote, baseBranch } = OWNER_TOOLS.git;
    const worktree = AddDetachedWorktree(`${remote}/${baseBranch}`);
    const state = {
        options,
        unpushedBranch: null,
    };
    try
    {
        return shipFrom(
            worktree,
            edits,
            state,
        );
    }
    finally
    {
        cleanUp(worktree, state);
    }
}

if (IsMainModule(import.meta.url))
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
