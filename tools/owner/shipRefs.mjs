// Finds where an edit is already shipped: dev, or an open owner pull request branch.
import { OWNER_TOOLS } from './ownerConfig.mjs';
import { ReadAtRef, ReadWorking } from './ownerGit.mjs';
import { SameText } from './ownerPaths.mjs';
import { RunGit, RunProgram } from './ownerProcess.mjs';

const OPEN_PULL_LIMIT = '200';
const GH_PROGRAM = 'gh';
const NO_LIST_NOTE = 'Could not list open pull requests, so only dev is checked for shipped edits.';

function openOwnerBranches()
{
    const { baseBranch, branchPrefix } = OWNER_TOOLS.git;
    const args = [
        'pr',
        'list',
        '--state',
        'open',
        '--base',
        baseBranch,
        '--limit',
        OPEN_PULL_LIMIT,
        '--json',
        'headRefName',
    ];
    try
    {
        const pulls = JSON.parse(RunProgram(GH_PROGRAM, args));
        return pulls
            .map((pull) => pull.headRefName)
            .filter((name) => name.startsWith(branchPrefix));
    }
    catch
    {
        console.log(NO_LIST_NOTE);
        return [];
    }
}

function trackingRefspec(branch)
{
    const { remote } = OWNER_TOOLS.git;
    return `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`;
}

/** Fetches dev and every open owner pull request branch; returns their ref names. */
export function FetchShippedRefs()
{
    const { remote, baseBranch } = OWNER_TOOLS.git;
    const branches = openOwnerBranches();
    RunGit([
        'fetch',
        '--quiet',
        remote,
        baseBranch,
        ...branches.map(trackingRefspec),
    ]);
    return [
        `${remote}/${baseBranch}`,
        ...branches.map((name) => `${remote}/${name}`),
    ];
}

/** The ref that already holds this exact file text, or null. */
export function ShippedIn(path, refs)
{
    const text = ReadWorking(path);
    return refs.find((ref) => SameText(ReadAtRef(ref, path), text)) || null;
}
