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

function devRef()
{
    return `${GIT.remote}/${GIT.baseBranch}`;
}

function trackingRefspec(branch)
{
    return `+refs/heads/${branch}:refs/remotes/${GIT.remote}/${branch}`;
}

/** True when a pull request branch itself changes `path` since it left dev. */
function branchChangesPath(ref, path)
{
    const base = RunGit(['merge-base', devRef(), ref], { allowFailure: true });
    if (!base)
    {
        return false;
    }
    const changed = RunGit([
        'diff',
        '--name-only',
        base,
        ref,
        '--',
        path,
    ]);
    return Boolean(changed);
}

function holdsEdit(ref, path, text)
{
    const isDev = ref === devRef();
    const owns = isDev || branchChangesPath(ref, path);
    return owns && SameText(ReadAtRef(ref, path), text);
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
        devRef(),
        ...branches.map((name) => `${GIT.remote}/${name}`),
    ];
}

/** Where this exact edit already is: dev, or an open owner branch that changes the path. */
export function ShippedIn(path, refs)
{
    const text = ReadWorking(path);
    return refs.find((ref) => holdsEdit(
        ref,
        path,
        text,
    )) || null;
}
