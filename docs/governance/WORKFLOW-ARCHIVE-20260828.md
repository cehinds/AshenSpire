# AshenSpire workflow archive — 2026-08-28

## Outcome

All discovered local AshenSpire workflow state is preserved on `origin` under:

```text
workflow/<team>/<workflow>/snapshot-20260828-<source-head>-<identity>
```

- Remote repository: `https://github.com/cehinds/AshenSpire.git`
- Archive refs: **220**
- Sources: **200 worktrees + 20 unattached local branches**
- Worktree snapshots with a captured tree differing from HEAD: **95**
- Detached worktrees: **76**
- Remote verification: **220/220 exact commit matches; failures 0; extras 0**
- Snapshot plan SHA-256: `33E66244961676FD5DA049A3DC2568DEBC4AEC22397C2D70F384EDA47E18EC0D`
- Verification SHA-256: `4BDDAADC9792501DF5310514A3E3FF7146BF7249564A68F86C1188785B74AB77`

Team distribution: application 77; art 12; CQM 20; data 15; Help Desk 3; Incident/IT Support 4; ITM Integration/Delivery 4; Functional QA 80; Review/Approval Hub 1; writing 4.

## Resume after a context wipe

```powershell
git clone https://github.com/cehinds/AshenSpire.git C:\repos\AshenSpire-restored
git -C C:\repos\AshenSpire-restored branch -r --list 'origin/workflow/*'
git -C C:\repos\AshenSpire-restored switch --create recovered/<short-name> --track origin/workflow/<team>/<workflow>/<snapshot>
```

Use `workflow-snapshot-plan.json` to map each former worktree path or local branch to its exact remote ref, source HEAD/tree, and archived commit/tree.

## Oversized-file recovery

GitHub rejected the original 132,629,648-byte `docs/preview/hybrid-input-parity-root-manifest.json` blob because it exceeds the platform's 100 MB hard limit. Its archive branch contains ordered parts under:

```text
docs/preview/hybrid-input-parity-root-manifest.json.parts/
```

Concatenate `part-*.bin` in filename order. Validate the reconstructed file as:

- bytes: `132629648`
- SHA-256: `E18B17FD189BA07933191C22AB40AF723F522BC88AA8E77615DF25635461EDDF`

The adjacent `reconstruction.json` records every part's byte count, SHA-256, and Git blob identity.

## Boundaries

These are preservation checkpoints, not merges into `dev`, pull requests, QA approvals, deployments, or releases. Original local worktrees, indexes, branches, untracked files, and dirty states were not reset, cleaned, deleted, or switched. Ignored files such as caches and local secrets were not forced into Git.

You can now wipe Codex/chat context and recover from the remote catalog. This receipt does **not** instruct deletion of the original local worktrees; remove them only as a separate, deliberate filesystem operation after checking the manifest.
