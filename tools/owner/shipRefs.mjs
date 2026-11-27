// Finds where an edit is already shipped: dev, or an open owner pull request branch.
import { OWNER_TEXT, OWNER_TOOLS } from './ownerConfig.mjs';
import { ReadAtRef, ReadWorking } from './ownerGit.mjs';
import { SameText } from './ownerPaths.mjs';
import { RunGit, RunGitHub } from './ownerProcess.mjs';

const GIT = OWNER_TOOLS.git;

function openOwnerBranches()
{
    const args = [
        'pr',
        'list',
        '--state',
        'open',
        '--base',
        GIT.baseBranch,
        '--limit',
        String(GIT.openPullLimit),
        '--json',
        'headRefName',
    ];
    try
    {
        const pulls = JSON.parse(RunGitHub(args));
        return pulls
            .map((pull) => pull.headRefName)
            .filter((name) => name.startsWith(GIT.branchPrefix));
    }
    catch
    {
        console.log(OWNER_TEXT.ship.noPullList);
        return [];
    }
}

function trackingRefspec(branch)
{
    return `+refs/heads/${branch}:refs/remotes/${GIT.remote}/${branch}`;
}

/** Fetches dev and every open owner pull request branch; returns their ref names. */
export function FetchShippedRefs()
{
    const branches = openOwnerBranches();
    RunGit([
        'fetch',
        '--quiet',
        GIT.remote,
        GIT.baseBranch,
        ...branches.map(trackingRefspec),
    ]);
    return [
        `${GIT.remote}/${GIT.baseBranch}`,
        ...branches.map((name) => `${GIT.remote}/${name}`),
    ];
}

/** The ref that already holds this exact file text, or null. */
export function ShippedIn(path, refs)
{
    const text = ReadWorking(path);
    return refs.find((ref) => SameText(ReadAtRef(ref, path), text)) || null;
}
