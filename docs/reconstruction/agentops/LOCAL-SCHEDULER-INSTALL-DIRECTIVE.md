# Constantine Directive: Install the AshenSpire Execution Scheduler

> Reusable one-time installation and repair directive. Do not preload this
> document during ordinary ticket work. The installed scheduler must generate
> bounded wake capsules for disposable agents.

Install or repair a compact, repository-native scheduler in the existing
AshenSpire repository.

The scheduler is the sole runtime execution engine.

GitHub issues, Help Desk intake, QA reports, dashboards, chats, receipts, and
team views may supply input or display derived state. They must never maintain
separate actionable queues, ownership records, or competing workflow logic.

The objective is not to document work. The objective is to continuously move
prioritized issues through implementation, QA, pull-request delivery, and
completion with minimal context, minimal idle time, and no duplicate execution.

## Required outcome

Deliver a scheduler that:

1. Continuously selects the highest-priority actionable work.
2. Keeps every available worker assigned when safe work exists.
3. Runs multiple non-conflicting ticket pipelines concurrently.
4. Maintains exactly one writer for every overlapping path, branch, generated
   artifact, or protected resource.
5. Refills a released seat immediately after completion, blocking, expiry,
   failure, or resource release.
6. Moves agents between implementation and review according to pipeline
   backpressure.
7. Automatically pushes verified branches and opens issue-closing pull requests
   when authorized.
8. Automatically merges eligible pull requests into `dev` only under the
   standing delivery policy in this directive.
9. Preserves independent QA and owner-controlled promotion to `test`, `release`,
   and `main`.
10. Survives complete loss of chat, task history, model memory, and local
    context.
11. Reconstructs work from a clean clone using a bounded wake capsule of no more
    than 1,500 input tokens.
12. Runs on Windows and PowerShell without requiring a hosted scheduler service.

## Starting state

- Repository: `https://github.com/cehinds/AshenSpire`
- Development branch: `dev`
- QA branch: `test`
- Release-candidate branch: `release`
- Protected production branch: `main`
- The repository is already cloned. Discover the exact path from the workspace.
- Do not create another clone unless the existing repository is unusable and
  Constantine explicitly approves replacement.
- Preserve every existing worktree, branch, edit, commit, untracked file,
  archive, evidence artifact, and AgentOps record.
- Never modify a dirty canonical checkout. Use an isolated worktree and a
  `codex/` branch.

## Core operating model

Use one event-driven scheduler with five cooperating concepts.

### Canonical work item

Each GitHub issue maps to exactly one scheduler work item.

### Claim and lease

Before edits begin, atomically assign:

- one worker;
- one issue;
- one branch;
- one base commit;
- one lease epoch;
- the exact writable paths and shared resources.

Reject overlapping leases.

### Material event

Every accepted state transition emits one idempotent event. Polling, repeated
acknowledgements, unchanged status, chat delivery, and "still working" messages
are not material events.

### Derived snapshot

Derive the current queue, assignments, blockers, QA state, and promotion state
deterministically from the event journal. Humans and agents never edit the
derived snapshot directly.

### Event-driven refill

Every accepted terminal, blocking, release, QA, or expiry event immediately
runs the scheduling loop again. A periodic watcher is a recovery mechanism, not
the primary assignment trigger.

## Pipeline model

Use this lifecycle:

```text
INTAKE
  -> READY
  -> CLAIMED
  -> RUNNING
  -> CANDIDATE_READY
  -> QA
  -> PR_READY
  -> PR_OPEN
  -> MERGED_DEV
  -> DONE
```

Exceptional states:

```text
WAITING_DEPENDENCY
REPAIR_REQUIRED
SUPERSEDED
CANCELLED
```

Rules:

- `BLOCKED` is not a parking lot. Record the exact blocked transition, release
  unnecessary resources, refill the worker seat, and continue unaffected work.
- A candidate is not QA. QA is not pull-request delivery. A pull request is not
  a merge. A merge into `dev` is not promotion to `test`, `release`, or `main`.
- A later candidate invalidates only QA bound to the earlier candidate.
- Completed work leaves active context.
- Superseded candidates remain preserved but lose current execution authority.

## Concurrency and backpressure

Configuration must include:

```text
worker_slots
qa_slots
maximum_ready_work
maximum_candidates_waiting_for_qa
maximum_prs_waiting_for_review
refill_latency_target_seconds
idle_alarm_seconds
lease_duration_seconds
```

Operating rules:

1. Assign every safe worker seat before a lead performs coordination-only work.
2. Prefer the highest-priority dependency-ready ticket.
3. Among equal priorities, prefer work that keeps different pipeline stages
   active.
4. Do not start additional implementation merely to create a large QA backlog.
5. When QA is the bottleneck, reassign eligible idle agents to independent
   review.
6. When pull-request review is the bottleneck, prioritize review and
   reconciliation over opening more pull requests.
7. Refill a completed or safely interruptible seat immediately.
8. If no safe assignment exists, record `NO_SAFE_ASSIGNMENT` with the exact
   collision, dependency, or authority reason.
9. Dispatch or acknowledgement is not active work. Active work requires a
   successful claim and a concrete first action.

Target refill latency:

```text
event-driven refill: <= 5 seconds
watcher recovery refill: <= 30 seconds
```

## One-writer enforcement

Build a conflict graph from claimed paths, branches, refs, and resources.

Treat these as exclusive when applicable:

```text
canonical checkout
integration branch
generated root/build/dist outputs
buildordinal.json
package lock
shared browser profile
shared content registry
schema migration
GitHub Pages
test promotion
release promotion
main promotion
deployment environment
```

Rules:

- One issue may claim multiple paths.
- Two issues may run concurrently only when their claims are disjoint.
- Scope expansion requires a new compare-and-swap event.
- Preserve a late result from an expired lease epoch as a candidate, but reject
  it as current execution evidence.
- A worker may not edit outside its lease.
- Serialize generated output: settle source authority, regenerate once, and
  verify aliases and provenance.

## Canonical scheduler state

Keep scheduler code and schemas on the product branch:

```text
.agentops/BOOTSTRAP.md
.agentops/project.json
.agentops/scheduler/config.json
.agentops/scheduler/schemas/event.json
.agentops/scheduler/schemas/snapshot.json
.agentops/scheduler/schemas/wake.json
.agentops/tools/scheduler.mjs
.agentops/tools/scheduler.test.mjs
```

Optional thin adapters:

```text
AGENTS.md
CLAUDE.md
.github/workflows/agentops-validate.yml
```

Use the dedicated portable state ref:

```text
agentops/scheduler-state
```

It contains only:

```text
journal/
snapshot.json
machine-lease.json
STATE_VERSION
```

The state ref is not a product branch and must never merge into `dev`, `test`,
`release`, or `main`. It must not contain source code, screenshots, large logs,
secrets, chats, personal information, or absolute machine paths.

Store ephemeral machine runtime under:

```text
.git/agentops-scheduler/
```

It may contain `machine.json`, `watcher.lock`, `replay-cursor.json`,
`pending-events/`, and `logs/`. Nothing in that directory is committed.

## Minimum work-item fields

Each current work item contains only execution-critical data:

```text
schema
revision
issue_id
title
priority
dependencies
state
base_commit
candidate_commit
branch
assigned_actor
lease_id
lease_epoch
lease_expiry
claimed_paths
claimed_resources
acceptance_commands
evidence_pointers
blocker
wake_condition
next_action
authority_ceiling
updated_event
```

Do not copy issue history, chats, full ledgers, or large evidence bodies into a
work item. Use exact pointers.

## Material events

Support the smallest useful event set:

```text
INTAKE_RECORDED
CLAIM_ACQUIRED
WORK_ENTERED
CANDIDATE_READY
QA_RESULT
PR_OPENED
MERGED_DEV
BLOCKED
RESOURCE_RELEASED
LEASE_EXPIRED
DRIFT_DETECTED
RECOVERY_BOUND
SUPERSEDED
CANCELLED
COMPLETED
```

Every event contains:

```text
event_id
idempotency_key
sequence
previous_snapshot_hash
issue_id
actor
machine_id
lease_id
lease_epoch
event_type
exact_object
payload
created_at
```

Requirements:

- Replaying the same event is harmless.
- Events are append-only.
- Snapshot reconstruction is deterministic.
- Missing sequence entries fail only the affected transition.
- Duplicate intake links to the canonical issue.
- Polling, unchanged heartbeats, repeated acknowledgements, and unchanged status
  produce no durable event.

## Scheduling transaction

Every cycle:

1. Fetch and validate the scheduler-state ref.
2. Confirm local machine custody.
3. Replay new events.
4. Rebuild and verify the snapshot.
5. Reconcile live GitHub issue, pull-request, and branch state.
6. Release expired or invalid claims.
7. Find dependency-ready work.
8. Calculate path and resource conflicts.
9. Apply priority and backpressure rules.
10. Atomically assign available seats.
11. Generate compact wake capsules.
12. Dispatch work.
13. Persist the event journal and snapshot using expected-old-OID
    compare-and-swap.
14. Stay quiet if nothing materially changed.

The scheduler must never require a Team Lead, Help Desk, PM, IT Manager, or
owner to manually relay routine work between stages.

## Immediate refill triggers

Run the scheduling transaction immediately after:

- candidate completion;
- QA pass or failure;
- pull-request creation;
- merge;
- blocker classification;
- dependency satisfaction;
- lease expiry;
- agent disappearance;
- explicit resource release;
- stale-base detection;
- candidate supersession;
- scheduler restart;
- recovery of a missed completion event.

If a worker becomes blocked:

1. Record the precise blocked transition.
2. Preserve the branch and evidence.
3. Release paths the worker no longer needs.
4. Route the blocker through the scheduler.
5. Refill the worker with unrelated safe work.
6. Retry the blocked ticket when its wake condition becomes true.

## Compact agent wake capsule

An assigned agent receives only:

```text
IDENTITY
ISSUE
OBJECTIVE
FIRST ACTION
DONE WHEN
REPOSITORY
BASE COMMIT
BRANCH/WORKTREE
ALLOWED PATHS
CLAIMED RESOURCES
LEASE ID/EPOCH/EXPIRY
ACCEPTANCE COMMANDS
EVIDENCE TARGET
AUTHORITY CEILING
FORBIDDEN ACTIONS
BLOCKER/WAKE
ROLLBACK
```

Limits:

```text
target: <= 1,200 input tokens
hard failure: > 1,500 input tokens
```

Never preload the full backlog, event journal, raw chat, receipt collections,
unrelated team state, complete Git history, large logs, screenshots, unrelated
source trees, or secrets.

Agents report through validated events. Chat is informational only.

## Help Desk and management

Help Desk is an intake and deduplication adapter. It may fingerprint a request,
find or create one canonical issue, attach aliases and related feedback,
classify a blocker, and submit a material scheduler event. It must not maintain
another work queue.

Team Leads ensure available seats receive scheduler assignments, resolve the
highest-impact blocker after capacity is assigned, review returned work where
required, and escalate only decisions outside existing authority. They must not
reproduce the scheduler queue in chat or another ledger.

PM and IT Manager views are derived projections, not workflow engines.

## Risk-selected QA

### Low risk

Isolated documentation, bounded tooling fixes, and non-behavioral presentation
work require focused tests, self-review, and a current-base check.

### Standard product change

Require focused tests, applicable full suites, independent exact-head review,
and a clean current-base candidate.

### High risk or protected change

Persistence, schema or data migration, security/privacy, generated runtime
composition, promotion, deployment, and release require an exact candidate,
independent QA, risk-specific negative tests, rollback, and explicit protected
authority.

A QA failure blocks only that candidate revision. It does not stop unrelated
tickets or the maker's corrected successor.

## Standing delivery policy

Configure these exact defaults for AshenSpire.

Automatically allowed after verification:

- isolated implementation;
- local commits;
- non-force push of a uniquely owned `codex/` branch;
- opening an issue-closing pull request into `dev`;
- updating that pull request with a corrected successor;
- closing duplicate or superseded pull requests with evidence;
- merging into `dev` only when all of these are true:

```text
current base verified immediately before merge
candidate head unchanged
one-writer ownership proven
required checks passed
independent exact-head review passed
zero unresolved current review threads
no conflicting or superseding pull request
rollback known
```

Owner-controlled actions:

```text
promotion to test
promotion to release
promotion to main
Pages publication
deployment
tagging
production release
destructive cleanup
force-push
history rewrite
security or privacy exception
QA override
```

Encode standing grants in scheduler configuration. Never infer authority from
conversation history, a green check, or an earlier promotion.

## Cross-machine custody

Only one machine may dispatch work at a time.

Local identity is stored in `.git/agentops-scheduler/machine.json`. Portable
custody contains:

```text
machine_id
lease_epoch
acquired_at
expires_at
expected_state_ref_oid
```

Use expected-old-OID compare-and-swap when advancing
`agentops/scheduler-state`. If two machines race, exactly one succeeds; the
loser fetches, replays, discards stale planning, and replans.

Handoff procedure:

1. Stop local dispatch.
2. Reconcile running assignments.
3. Preserve all branches and worktrees.
4. Append final material events.
5. Synchronize scheduler state.
6. Release machine custody.
7. Verify the remote state-ref OID.
8. Fetch, bootstrap, acquire custody, recover assignments, and start the watcher
   on the next machine.

Never infer completion or acceptance from an orphaned branch, commit, task, or
pull request.

## Required commands

Provide:

```text
scheduler bootstrap
scheduler verify
scheduler status
scheduler sync
scheduler acquire-machine
scheduler release-machine
scheduler enqueue
scheduler claim
scheduler entered
scheduler candidate
scheduler qa
scheduler block
scheduler release
scheduler recover
scheduler watch
scheduler simulate
```

Commands emit concise machine-readable JSON plus a short human summary.
`watch` stays quiet when nothing changed. `simulate` must not edit product refs
or send GitHub mutations.

## Failure recovery

Handle duplicate intake or completion, writer collisions, stale assignments,
expired leases, lost completion events, agent disappearance, branch drift, base
advancement, rewritten remote history, scheduler crashes and restarts, state-ref
races, local/remote divergence, orphaned branches, external pull requests,
stale-head QA, missing credentials, unavailable GitHub, and a dirty watcher
checkout.

Reject stale fencing tokens, preserve all candidate commits, fail only the
affected transition, keep unrelated work moving, and restart from the last
verified event and snapshot. Never manufacture a PASS, completion, claim, or
owner decision.

## Required tests

Implement automated coverage for:

1. Deterministic replay and snapshot checksums.
2. Event idempotency.
3. State-ref compare-and-swap races.
4. One-writer collision rejection.
5. Parallel dispatch of disjoint tickets.
6. Priority and dependency ordering.
7. Backpressure-aware assignment.
8. Immediate refill after completion, blocking, QA, and release.
9. Lease expiry and fencing.
10. Agent-disappearance recovery.
11. Scheduler restart and replay.
12. Stale base, head, and tree refusal.
13. Fast-forward recovery and rewritten-history refusal.
14. Lost-completion and orphan-branch recovery.
15. Duplicate Help Desk intake.
16. Exact-head QA binding.
17. Automatic pull-request delivery under standing authority.
18. Rejection of unauthorized protected promotion.
19. Secret and machine-path rejection.
20. Clean-clone reconstruction.
21. Cross-machine custody transfer.
22. Quiet no-change watcher cycles.

Negative plants must fail only the targeted transition.

## Acceptance demonstrations

### Clean-start drill

From a clean clone, read `BOOTSTRAP.md`, fetch product refs and scheduler state,
validate schemas, replay events, reconstruct the snapshot, acquire custody,
generate one wake capsule, and begin the correct first action without chat or
memory. The first correct action must require no more than 1,500 input tokens.

### Pipeline simulation

Run at least twelve synthetic tickets with dependencies, three or more worker
seats, independent QA, conflicting and disjoint paths, one blocker, one expired
lease, one failed QA revision, and one protected promotion.

Demonstrate concurrent pipelines, different stages occupied simultaneously,
backpressure, immediate refill, zero duplicate writers, and a correct stop at
the protected transition.

### Real-ticket pilot

After simulation passes:

1. Select three small, reversible, disjoint live issues.
2. Verify current `dev`.
3. Claim all three atomically.
4. Run them concurrently.
5. Require independent review.
6. Automatically push verified candidates.
7. Open issue-closing pull requests.
8. Merge only eligible pull requests into `dev`.
9. Prove every released seat is refilled without owner prompting.
10. Preserve exact evidence for anything that cannot proceed.

Do not declare the scheduler live until the pilot proves execution, not merely
dispatch.

## Installation sequence

### Discover

Resolve the repository, read bounded guidance, fetch current refs, inspect the
existing AgentOps scheduler, watcher, claims, leases, and tests, and determine
whether repair is smaller than replacement. Do not install a duplicate.

### Implement or repair

Use a fresh isolated worktree from current `origin/dev`. Keep the file surface
minimal, reuse compatible AgentOps contracts, and demote competing queue logic.

### Validate

Run focused and full scheduler tests, negative plants, the clean-start drill,
pipeline saturation, restart recovery, and cross-machine recovery.

### Pilot

Use three disjoint low-risk issues to prove entered work, review, automatic
pull-request delivery, eligible `dev` merge, issue closure, and refill.

### Cut over

Only after the pilot passes, mark the scheduler as the sole runtime engine,
turn legacy ledgers and dashboards into read-only generated views, retain all
history, disable competing assignment loops, start exactly one watcher, and
verify zero duplicate scheduler authority.

## Preservation and safety

Never reset, destructively clean, delete worktrees or evidence, overwrite dirty
work, force-push, rewrite history, store credentials or private data, merge
scheduler state into product branches, infer owner approval, bypass independent
QA, or publish and release without exact authority.

Use recoverable append-only and compare-and-swap operations.

## Required return

Return only material evidence.

### Outcome

```text
READY
REPAIR_REQUIRED
BLOCKED
```

### Repository

- exact path;
- current branch, HEAD, and tree;
- fetched `origin/dev`, `origin/test`, `origin/release`, and `origin/main`;
- dirty and untracked state;
- isolated implementation worktree.

### Scheduler

- installed or repaired files;
- scheduler-state ref OID;
- snapshot hash;
- material event count;
- active machine custody;
- live worker capacity;
- queue counts by pipeline stage;
- exactly one watcher result.

### Validation

- commands and results;
- negative plants;
- clean-start token count;
- pipeline simulation results;
- refill latency;
- cross-machine recovery;
- real-ticket pilot results.

### Delivery

Distinguish exactly:

```text
local
committed
pushed
PR open
merged to dev
promoted to test
promoted to release
main PR open
merged to main
published
deployed
released
```

### Remaining work

Return genuine blockers, exact wake conditions, and one smallest next action.

Do not call installation complete unless:

> The scheduler can reconstruct exact current work from a clean clone and the
> canonical state ref; no work can begin without an atomic issue, path, and
> resource lease with a fencing token; completion triggers immediate refill;
> multiple disjoint pipelines run concurrently; verified candidates
> automatically reach pull-request delivery under configured authority; and no
> parallel queue or workflow engine can assign competing work.
