# Repository continuity

[`continuity.json`](continuity.json) is AshenSpire's compact, repository-native handoff. A fresh
model or device starts here after reading the canonical governance files named
and blob-pinned in the packet. Chat transcripts, task titles, machine paths,
and uncommitted work are not continuity authority.

## What the packet answers

- Which governance files and exact Git objects define the current contract.
- Which `dev`, `test`, `release`, and `main` heads were last observed, whether
  repository policy protects them, and what GitHub protection settings reported.
- Which migration lanes are active, queued, blocked, waiting on a decision, or
  frozen; their owner acknowledgement, base/head, paths, dependencies, blocker,
  next action, and rollback boundary.
- Which paths and serialized resources collide and who must decide their order.
- How a clean clone is bootstrapped, tested, built, hosted-verified, and recovered.
- Which action is next and which additional authority it requires.

The machine-readable schema is [`continuity.schema.json`](continuity.schema.json).
The canonical authority, workflow, and gate boundaries remain in
[`AUTHORITY.md`](AUTHORITY.md), [`WORKFLOW.md`](WORKFLOW.md), and
[`QUALITY-GATES.md`](QUALITY-GATES.md). The packet is bounded
to 40,000 UTF-8 bytes and an estimated 10,000 tokens (`ceil(bytes / 4)`), with
separate row limits. When history outgrows those limits, preserve exact closure
facts as compact tombstones; do not turn the packet into a diary.

## Fresh-clone entry

```text
git clone https://github.com/cehinds/AshenSpire.git
git fetch --all --tags
git switch dev
node tools/continuity.mjs --check
node tools/continuity.mjs --audit
```

`--check` validates the JSON Schema, internal contracts, budgets, named commit
and blob objects, and current working bytes of the governance sources. `--audit`
also queries the configured remote and fails when a protected branch moved or
the snapshot is older than its budget. Remote unavailability is `UNKNOWN`
(exit 2), not green. Start no mutation from a failed or unknown audit.

The packet's exact SHAs are observations, not permission to move a branch.
`local-only` means the branch was not found on `origin` at the observation time;
another device must not assume that unpushed work is recoverable from the name.
Project #4 `Status` remains workflow truth. IT Manager III, Integration &
Delivery owns technical sequencing, path ownership, decisions, and integration.
Constantine retains `main`, `release`, tag, publication, Pages, playtest, and
release authority. Local, pushed, PR, reviewed, integrated, hosted, resolved,
and released facts remain separate.

## Updating the handoff

1. Refresh the remote and Project/ticket evidence. Do not infer Project state
   from this file.
2. Update only facts that have an exact owner and timestamp. An in-progress lane
   may have `headSha: null`; `candidate-frozen` and `complete` may not.
3. Record acknowledgement before marking a lane active. Record the decision
   owner, retry trigger, and safe next action for every block.
4. Declare every shared path or serialized lane in `collisions`; do not resolve
   collisions by copying or hand-merging generated files.
5. Run:

   ```text
   node tools/continuity.mjs --check
   node tools/continuity.mjs --selftest
   node tools/continuity.mjs --audit
   git diff --check
   ```

6. Freeze the candidate for independent non-maker policy QA. A later edit makes
   a new candidate and invalidates the former exact-head verdict.

The deterministic self-test sends seventeen clean and known-bad cases through
the same validator, including malformed hashes, missing Git objects, governance
blob drift, stale and moved branch snapshots, dependency cycles, missing owner
acknowledgement, unsafe generated order, local paths, broken Markdown links,
budget overflow, and a pruning path that must remain mutation-free.

## Build and generated-artifact lane

Source needs no dependency installation or build to run from `index.html`.
Tracked standalone artifacts are different: after all accepted source is frozen,
one IT Manager III-assigned owner runs exactly:

```text
node tools/launch.mjs --build-only
```

The source digest may update `buildordinal.json`; the bundler writes
`build/AshenSpire.html`; the launcher refreshes root `AshenSpire.html` and the
`dist` aliases. Treat the packet's order as one serialized transaction. Verify
with `tools/verify-shipped.mjs`, `tools/rebuild-matches.mjs`, applicable tests,
and `git diff --check`. Never hand-edit or hand-resolve these files.

The Pages URL is development evidence. Record the deployed SHA and run, prove
the hosted artifact identity, and exercise the intended player flow. A green
Pages job alone is not hosted verification, and hosted verification is not a
release fact.

## Recovery and pruning

On stale identity, missing objects, collision, or contradictory ownership, stop
the affected lane and route `EVIDENCE / OPTIONS / REC / NEXT / AUTH` to the IT
Manager III. Unaffected disjoint work may continue. Preserve dirty checkouts,
branches, worktrees, artifacts, and evidence. Recover in a clean worktree from
the recorded base or frozen head; regenerate derived files from restored source.

The scheduled workflow audits daily at 13:17 UTC. On Sunday at 13:47 UTC it also
emits a dry-run pruning proposal. The proposal lists expired tombstones and the
authority required; it performs zero mutations. The workflow has read-only
contents permission, writes reports only to the runner's temporary directory,
and never commits, pushes, deletes, opens a PR, or updates `dev`.

An external snapshot may be attached only as optional, hash-identified forensic
evidence using an HTTPS or URN reference. It is never canonical, never required
to resume, and never overrides repository governance, Git, Project, CI, Pages,
or ticket truth.
