// Moves the owner's edits into the ship worktree, and judges rebuilt files fairly.
import { OWNER_TOOLS, REPO_ROOT } from './ownerConfig.mjs';
import {
    AddDetachedWorktree,
    ApplyPatch,
    CapturePatch,
    CopyBetween,
    CopyOver,
    RemoveWorktree,
} from './ownerGit.mjs';
import { RunGit, RunSteps } from './ownerProcess.mjs';

const HEAD_REF = 'HEAD';
const BASELINE_SUBJECT = 'Owner rebuild baseline';
const CLASH_ADVICE = 'Run "npm run sync", redo the edit, then ship again.';

function clashError(path)
{
    return new Error(`${path} also changed on dev and the edits clash. ${CLASH_ADVICE}`);
}

function silent()
{
}

function commitBaseline(baseline)
{
    const commitArgs = [
        'commit',
        '--quiet',
        '--allow-empty',
        '-m',
        BASELINE_SUBJECT,
    ];
    RunGit(['add', '--all'], { cwd: baseline });
    RunGit(commitArgs, { cwd: baseline });
    return RunGit(['rev-parse', HEAD_REF], { cwd: baseline });
}

/** Commits a rebuild of the owner's own HEAD plus their direct edits; returns that commit. */
function rebuildBaseline(direct)
{
    const baseline = AddDetachedWorktree(HEAD_REF);
    try
    {
        direct.forEach((file) => CopyOver(
            REPO_ROOT,
            baseline,
            file.path,
        ));
        const built = RunSteps(
            OWNER_TOOLS.buildSteps,
            baseline,
            silent,
        );
        if (!built.ok)
        {
            throw new Error(`The rebuild failed at "${built.failedStep}". Run "npm run check".`);
        }
        return commitBaseline(baseline);
    }
    finally
    {
        RemoveWorktree(baseline);
    }
}

/** Brings one edit into the worktree: new files are copied, changed ones three-way applied. */
export function CarryFile(file, worktree)
{
    if (file.untracked)
    {
        const copied = CopyBetween(
            REPO_ROOT,
            worktree,
            file.path,
        );
        if (!copied)
        {
            throw clashError(file.path);
        }
        return;
    }
    const patch = file.patch || CapturePatch(file.path);
    const applied = ApplyPatch(
        patch,
        file.path,
        worktree,
    );
    if (!applied)
    {
        throw clashError(file.path);
    }
}

/** The rebuilt files' own owner edits: what remains beside a rebuild of the owner's HEAD. */
export function OwnerRebuiltEdits(rebuilt, direct)
{
    if (!rebuilt.length)
    {
        return [];
    }
    const baseline = rebuildBaseline(direct);
    return rebuilt
        .map((file) => ({
            ...file,
            baseline,
            patch: CapturePatch(file.path, baseline),
        }))
        .filter((file) => file.patch);
}
