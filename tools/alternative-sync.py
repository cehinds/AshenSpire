"""Prepare a real dev merge, retaining the alternative's presentation boundary.

No force push or authored-content conflict preference outside protected paths.
Known derived outputs are seeded for regeneration. The caller tests the staged
merge, regenerates those outputs, verifies it, then commits/pushes after gates.
"""
import argparse
import json
from pathlib import Path
import subprocess


def git(repo, *args, check=True, data=None):
    result = subprocess.run(['git', *args], cwd=repo, input=data,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace') or result.stdout.decode(errors='replace'))
    return result


def names(raw):
    return [s.decode('utf-8') for s in raw.split(b'\0') if s]


def tree(repo, ref):
    result = {}
    for row in git(repo, 'ls-tree', '-rz', '--full-tree', ref).stdout.split(b'\0'):
        if not row:
            continue
        info, path = row.split(b'\t', 1)
        result[path.decode('utf-8')] = info.decode('ascii')
    return result


def protected(path, policy):
    if path in policy['artMetadata']:
        return False
    if any(path.startswith(p) for p in policy['artPrefixes']) and Path(path).suffix.lower() in policy['artExtensions']:
        return False
    return path in policy['protectedFiles'] or any(path.startswith(p) for p in policy['protectedPrefixes'])


def assert_preserved(repo, before, policy, ref=None):
    old = tree(repo, before)
    current = tree(repo, ref or git(repo, 'write-tree').stdout.decode().strip())
    changed = [p for p in old.keys() | current.keys()
               if protected(p, policy) and old.get(p) != current.get(p)]
    if changed:
        raise RuntimeError('Protected battlefield files changed: ' + ', '.join(sorted(changed)))


def prepare(repo, source, target, policy):
    if git(repo, 'status', '--porcelain').stdout:
        raise RuntimeError('Sync requires a clean, isolated checkout.')
    before = git(repo, 'rev-parse', '--verify', target + '^{commit}').stdout.decode().strip()
    source_sha = git(repo, 'rev-parse', '--verify', source + '^{commit}').stdout.decode().strip()
    git(repo, 'merge-base', before, source_sha)  # Refuse unrelated histories.
    git(repo, 'checkout', '--detach', before)
    if git(repo, 'merge-base', '--is-ancestor', source_sha, before, check=False).returncode == 0:
        return {'before': before, 'source': source_sha, 'mergeNeeded': False, 'retained': []}
    old, incoming = tree(repo, before), tree(repo, source_sha)
    paths = sorted(p for p in old.keys() | incoming.keys() if protected(p, policy))
    # A rename out of the protected tree must not copy frozen renderer code to
    # an unprotected destination. Stop for review rather than guessing ownership.
    delta = git(repo, 'diff', '--name-status', '-z', '--find-renames', before, source_sha).stdout.split(b'\0')
    i = 0
    while i < len(delta) and delta[i]:
        kind = delta[i].decode(); i += 1
        first = delta[i].decode(); i += 1
        if kind.startswith(('R', 'C')):
            second = delta[i].decode(); i += 1
            if protected(first, policy) != protected(second, policy):
                raise RuntimeError(f'Cross-boundary rename needs review: {first} -> {second}')
    try:
        result = git(repo, '-c', 'merge.renames=false', 'merge', '--no-ff', '--no-commit', source_sha, check=False)
        if result.returncode not in (0, 1):
            raise RuntimeError(result.stderr.decode(errors='replace'))
        # Literal, NUL-delimited paths handle spaces and avoid shell/pathspec expansion.
        if paths:
            git(repo, '--literal-pathspecs', 'restore', '--source=' + before,
                '--staged', '--worktree', '--pathspec-from-file=-', '--pathspec-file-nul',
                data=b'\0'.join(p.encode() for p in paths) + b'\0')
        conflicts = names(git(repo, 'diff', '--name-only', '--diff-filter=U', '-z').stdout)
        # Both branches build independently. These are outputs, not authored
        # choices: seed them from the alternative, then the workflow regenerates
        # them before publishing. Never resolve an authored-content conflict here.
        derived = {'buildordinal.json', 'src/content/changelog.generated.js', 'docs/ARCHITECTURE-CURRENT-DEV.md'}
        regenerated = sorted(set(conflicts) & derived)
        for path in regenerated:
            seed = before
            if path == 'buildordinal.json':
                prior = json.loads(git(repo, 'show', before + ':' + path).stdout)
                newer = json.loads(git(repo, 'show', source_sha + ':' + path).stdout)
                if newer.get('release') == prior.get('release') and newer['ordinal'] > prior['ordinal']:
                    seed = source_sha
            git(repo, 'restore', '--source=' + seed, '--staged', '--worktree', '--', path)
        conflicts = names(git(repo, 'diff', '--name-only', '--diff-filter=U', '-z').stdout)
        if conflicts:
            raise RuntimeError('Unprotected merge conflicts need review: ' + ', '.join(conflicts))
        assert_preserved(repo, before, policy)
        retained = sorted(p for p in paths if old.get(p) != incoming.get(p))
        return {'before': before, 'source': source_sha, 'mergeNeeded': True, 'retained': retained, 'regenerate': regenerated}
    except Exception:
        git(repo, 'merge', '--abort', check=False)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', default='origin/dev')
    parser.add_argument('--target', default='origin/alternative/dev')
    parser.add_argument('--policy', default='.github/alternative-battlefield-policy.json')
    parser.add_argument('--report', required=True)
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    # This CLI was the root alternative writer. Its former targets are frozen;
    # pure prepare() remains available for preservation policy tests/review.
    frozen_targets = {
        prefix + branch
        for prefix in ('', 'origin/', 'refs/heads/', 'refs/remotes/origin/')
        for branch in ('alternative/dev', 'alternative/test')
    }
    if args.target in frozen_targets:
        parser.error('Root alternative/dev and alternative/test are frozen after consolidation into dev; use a named alternative target.')
    policy = json.loads(Path(args.policy).read_text(encoding='utf-8'))
    if args.verify:
        report = json.loads(Path(args.report).read_text(encoding='utf-8'))
        assert_preserved(Path.cwd(), report['before'], policy)
        print('Protected battlefield snapshot is unchanged.')
    else:
        report = prepare(Path.cwd(), args.source, args.target, policy)
        Path(args.report).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
