#!/usr/bin/env node
// npm run ship -- "Title": puts your JSON edits on a feature branch cut from origin/dev, one
// commit per file, then pushes and opens a pull request. Flags are in ownerTools.json.
import { DescribeFileChange } from './contentDiff.mjs';
import {
    FormatText,
    IsMainModule,
    OWNER_TEXT,
    OWNER_TOOLS,
} from './ownerConfig.mjs';
import {
    AddDetachedWorktree,
    ChangedContentFiles,
    ChangedPaths,
    ReadAtRef,
    ReadWorking,
    RemoveWorktree,
} from './ownerGit.mjs';
import { IsRebuiltPath } from './ownerPaths.mjs';
import {
    RunGit,
    RunGitHub,
    RunSteps,
} from './ownerProcess.mjs';
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

const HEAD_REF = 'HEAD';
const FLAGS = OWNER_TOOLS.flags;
const GIT = OWNER_TOOLS.git;
const TEXT = OWNER_TEXT.ship;
const EXIT = Object.freeze({
    ok: 0,
    failed: 1,
});

function say(key, values)
{
    console.log(FormatText(TEXT[key], values));
}

function parseOptions(argv)
{
    const words = argv.filter((arg) => !arg.startsWith(FLAGS.prefix));
    return {
        quick: argv.includes(FLAGS.quick),
        dryRun: argv.includes(FLAGS.dryRun),
        local: argv.includes(FLAGS.local),
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
            say('skipping', {
                path: file.path,
                ref,
            });
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

/** Carries every edit; keeps only those that still change something on dev. */
function carryEdits(worktree, edits)
{
    edits.forEach((edit) => CarryFile(edit.file, worktree));
    const changed = new Set(ChangedPaths(worktree).map((file) => file.path));
    return edits.filter((edit) =>
    {
        const landed = changed.has(edit.file.path);
        if (!landed)
        {
            say('alreadyInDev', { path: edit.file.path });
        }
        return landed;
    });
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

function commitGenerated(worktree)
{
    const generated = GeneratedPaths(worktree);
    if (!generated.length)
    {
        return;
    }
    Commit(worktree, generated, {
        subject: OWNER_TEXT.commits.regenerate,
        lines: [],
    });
}

/** Commits each edit, runs the gates, commits generated data; null when a gate fails. */
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
    commitGenerated(worktree);
    return checkLines;
}

function push(worktree, branch)
{
    const args = [
        'push',
        '--quiet',
        '-u',
        GIT.remote,
        branch,
    ];
    RunGit(args, { cwd: worktree });
}

function addReceipt(
    worktree,
    pull,
    pullNumber,
)
{
    try
    {
        WriteReceipt(worktree, {
            title: pull.title,
            pullNumber,
            summary: ReceiptSummary(pull.described),
        });
        push(worktree, pull.branch);
    }
    catch (error)
    {
        say('receiptFailed', { error: error.message });
    }
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
    addReceipt(
        worktree,
        pull,
        opened.pullNumber,
    );
    say('pullRequest', { url: opened.url });
    say('afterMerge');
}

function listEdits(edits)
{
    say('shipping');
    edits.forEach((edit) => say('shippingLine', {
        path: edit.file.path,
        subject: edit.described.subject,
    }));
}

function startBranch(
    worktree,
    edits,
    state,
)
{
    const described = edits.map((edit) => edit.described);
    const title = state.options.title || described[0].subject;
    const branch = UniqueBranchName(title);
    RunGit([
        'switch',
        '--quiet',
        '-c',
        branch,
    ], { cwd: worktree });
    return {
        branch,
        title,
        described,
    };
}

/** Builds the branch in `worktree`, then keeps it local or publishes it; returns an exit code. */
function shipFrom(
    worktree,
    edits,
    state,
)
{
    const landed = carryEdits(worktree, edits);
    if (!landed.length)
    {
        say('allInDev');
        return EXIT.ok;
    }
    const checkLines = buildBranch(
        worktree,
        landed,
        state.options.quick,
    );
    if (!checkLines)
    {
        say('stopped');
        return EXIT.failed;
    }
    const pull = startBranch(
        worktree,
        landed,
        state,
    );
    if (state.options.local)
    {
        say('localOnly', { branch: pull.branch });
        return EXIT.ok;
    }
    state.unpushedBranch = pull.branch;
    publish(worktree, {
        ...pull,
        checkLines,
    }, state);
    return EXIT.ok;
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

function shipInWorktree(edits, options)
{
    const worktree = AddDetachedWorktree(`${GIT.remote}/${GIT.baseBranch}`);
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

function main(argv)
{
    const options = parseOptions(argv);
    const edits = selectEdits();
    if (!edits.length)
    {
        say('nothingNew');
        return EXIT.ok;
    }
    listEdits(edits);
    if (options.dryRun)
    {
        return EXIT.ok;
    }
    if (!options.local)
    {
        RunGitHub(['auth', 'status']);
    }
    return shipInWorktree(edits, options);
}

if (IsMainModule(import.meta.url))
{
    try
    {
        process.exitCode = main(process.argv.slice(2));
    }
    catch (error)
    {
        console.error(FormatText(TEXT.errorPrefix, { error: error.message }));
        process.exitCode = EXIT.failed;
    }
}
