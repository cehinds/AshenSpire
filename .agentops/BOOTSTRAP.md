# AshenSpire AgentOps bootstrap

Git history, validated `.agentops/` contracts, and `agentops/scheduler-state`
are authoritative. Chat, dashboards, issue views, receipts, and generated pages
are projections only. Never use them as a second queue or ownership source.

## Cold start

Before the first action, read only this file and the assigned wake capsule.
Do not preload the backlog, raw chat, event history, logs, screenshots,
reconstruction bundle, or unrelated source trees.

```powershell
git fetch origin dev release main
git fetch origin agentops/scheduler-state
node .agentops/tools/scheduler.mjs verify
node .agentops/tools/scheduler.mjs status
node .agentops/tools/scheduler.mjs acquire-machine --push
```

`verify` validates the schemas and deterministically replays `journal/` into
`snapshot.json`. `status` names exact work and custody. Machine identity and
watcher locks live only under `.git/agentops-scheduler/`. Portable state lives
only on `agentops/scheduler-state`, whose tree is limited to:

```text
journal/
snapshot.json
machine-lease.json
STATE_VERSION
```

The state ref never merges into a product branch. Every state advance is based
on the expected old ref OID; a race loser fetches, discards stale planning, and
replans. Missing or invalid authority, sequence, fencing, QA, credential, or
GitHub evidence fails only the affected transition.

## Execution rules

- One canonical GitHub issue maps to one work item.
- No edit begins without one atomic seat/issue/branch/base/epoch/path/resource
  lease. Overlap is rejected; edits outside the lease are forbidden.
- Events are append-only and idempotent. Snapshots are derived and never
  hand-edited.
- Candidate, QA, PR, `dev` merge, protected promotion, publication, deployment,
  and release are distinct states.
- Terminal, blocking, QA, expiry, drift, and release events immediately refill
  every safe seat. `NO_SAFE_ASSIGNMENT` states the exact reason.
- Generated root/build/dist output is exclusive: settle source authority,
  regenerate once, then verify aliases and provenance.
- A late expired-epoch result is preserved as a candidate but is not current
  execution evidence.

An assigned worker receives only the bounded wake fields defined by
`scheduler/schemas/wake.json`; more than 1,500 estimated input tokens is a hard
failure.

## Authority

The exact standing grants are in `scheduler/config.json`. Verified local work,
non-force push of a unique `codex/` branch, an issue-closing PR to `dev`, and an
eligible `dev` merge may proceed only through those encoded gates. Stop for
Constantine before promotion to `test`, `release`, or `main`; Pages,
publication, deployment, tagging, production release, destructive cleanup,
force-push, history rewrite, privacy/security exception, or QA override.
Never infer approval from history, chat, a green check, or an earlier promotion.

## Commands

```text
scheduler bootstrap | verify | status | sync
scheduler acquire-machine | release-machine
scheduler enqueue | claim | entered | candidate | qa | block | release | recover
scheduler watch | simulate
```

Run them as `node .agentops/tools/scheduler.mjs <command>`. `watch` stays silent
when no material state changed. The older `pipeline-pilot-watch.mjs` remains a
preserved compatibility adapter until the real-ticket pilot passes and one
explicit cutover disables it; never run both dispatch loops.

For non-scheduler governance work, load only the single contract named by the
action. `opsctl.mjs verify`, `--selftest`, `drill`, `wake`, `command`, `render`,
and `migrate` retain their existing meanings. Never hand-edit `generated/`.
