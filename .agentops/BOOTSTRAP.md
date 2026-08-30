# AgentOps bootstrap

The compact, repository-native control plane for AshenSpire. Git history plus
the validated JSON in this directory are authoritative. Dashboards, chat, and
model memory are projections only.

## Cold start (bounded)

A disposable agent recovering from a clean clone needs at most three
authoritative reads before its first correct action:

1. This file (`.agentops/BOOTSTRAP.md`).
2. `.agentops/project.json` — project identity and installed stage.
3. The single validated contract the current action touches (for example
   `.agentops/governance/authority.json` before claiming an action, or
   `.agentops/governance/git-ownership.json` before writing a path).

Do **not** preload the whole reconstruction bundle, full history, ledgers, raw
logs, or unrelated source trees. Retrieve by exact path first; take at most one
extra hop.

## Authoritative state

| Truth | Lives in |
|---|---|
| Owner intent, deputy grant | `governance/owner-intent.json` |
| Hierarchy and escalation ownership | `governance/hierarchy.json` |
| Roles (may / must / must-not) | `governance/roles.json` |
| Per-action authority | `governance/authority.json` |
| Git path/ref ownership, one-writer | `governance/git-ownership.json` |
| RACI (one Accountable per item) | `governance/raci.json` |
| Delegation envelopes, subdelegation limits | `governance/delegation.json` |
| Escalation timers and routing | `governance/escalation.json` |
| Lifecycle transitions and permitted actors | `governance/transitions.json` |
| Information-access / context-loading rules | `governance/information-access.json` |
| QA independence and risk-selected gates | `governance/qa.json` |
| Artifact/evidence responsibility | `governance/evidence.json` |
| Owner-command allowlist (authenticated decisions) | `governance/owner-command.json` |
| Legacy migration policy (read-only inventory) | `governance/migration.json` |

Human-readable views under `generated/` are produced from these JSON files and
carry no authority of their own.

## Runtime state (per active ticket)

| Artifact | Lives in |
|---|---|
| Work capsule (compact current state, sealed with a CAS `current_hash`) | `work/<ticket>/CURRENT.json` |
| Writer lease (one writer per overlapping path/ref) | `leases/<lease-id>.json` |
| Append-only event (transition receipt) | `events/<ticket>/<event-id>.json` |

Resume an actor onto a ticket with the token-bounded wake compiler — it reads
only what that action needs and prints one disposable capsule (never committed):

```sh
node .agentops/tools/opsctl.mjs wake --actor <role> --work <ticket>
# e.g. wake --actor maker --work AS-1001
```

Prove a clean clone reconstructs exact work state (zero evidence loss,
provider-neutral) with the reconstruction drill — see
[`RECONSTRUCTION-DRILL.md`](RECONSTRUCTION-DRILL.md):

```sh
node .agentops/tools/opsctl.mjs drill
```

When a terminal ticket releases an already-identified actor, the live-offer
scheduler can immediately select that actor's highest-ranked safe ticket from
the explicit Issue #269 priority list. It never creates or transfers a claim:

```sh
node .agentops/tools/pipeline-pilot-live.mjs --actor <actor> --completed <terminal-ticket> --released-at <UTC>
```

The output is a bounded wake offer or the distinct `NO_SAFE_ASSIGNMENT` /
`IDLE_ALARM` state. AgentOps capsules and leases remain authoritative.
The `AgentOps completion refill` workflow invokes this command immediately for
the deduplicated `agentops-ticket-completed` repository event and emits the
idle alarm at 300 seconds when no safe row appears.

Owner decisions flow through the authenticated owner-command path — enumerated,
allowlisted, and compare-and-swap-checked. `--dry-run` validates and reports
what it would do without touching the repository; `--apply` performs the same
validation and then writes:

```sh
node .agentops/tools/opsctl.mjs command --dry-run --request '<owner-command-request json>'
node .agentops/tools/opsctl.mjs command --apply   --request '<owner-command-request json>'
```

Applying appends **one append-only decision event** and re-seals **only** the
target capsule. It moves lifecycle state only where `owner-command.json`
declares a `lifecycle_target` and `transitions.json` declares that exact
transition from the capsule's current state for the authenticating role — an
undeclared or unpermitted move is rejected and nothing is written. A stale
`expected_current_hash` is refused rather than applied to unseen state, and the
seal is re-checked immediately before the write.

In the browser, the owner files decisions from the HUD's **Decide** table: each
row links to the *Owner decision* issue form prefilled with the ticket and its
live compare-and-swap hash. `.github/workflows/owner-command.yml` executes only
issues the repository owner authored, resolves the actor role from the
authenticated GitHub identity (never from the issue body), and reports the
result back on the issue. Help Desk intake uses the *Help Desk ticket* form.

The read-only Owner HUD is a redacted, deterministic projection at
`generated/hud/index.html`. It is a plain static file: the repository
publishes its own tree to GitHub Pages (Settings → Pages → Deploy from a
branch → `main`, root), so the HUD is served with the rest of the site and
reachable at `/hud/` (a copy of the generated file). There is no separate
publish workflow — regenerating the file with `opsctl render` and pushing is
all it takes.

Because Pages publishes `main`, the live site is the **released** state:
regenerating the HUD on `dev` does not change it until an owner-authorized
`dev` → `main` promotion. Publication stays a protected transition rather
than a side effect of routine integration.

## Validate before you trust

```sh
node .agentops/tools/opsctl.mjs verify     # validate contracts + check the generated view is in sync
node .agentops/tools/opsctl.mjs --selftest # prove every validation check can fail
node .agentops/tools/opsctl.test.mjs       # full test suite
```

`opsctl render` is the **sole** writer of `generated/GOVERNANCE.md`. Never edit
that view by hand; regenerate it and `verify` catches drift.

## Default authority

Reversible, collision-free local work proceeds without approval: read-only
inspection, scoped local implementation on exclusive paths, isolated
refs/worktrees, tests, builds, schema validation, fixtures, documentation, and
local commits on an isolated branch.

Protected transitions require their own exact, separate authority and never
follow automatically from local readiness: push/force-push, PR creation or
merge, direct updates to `dev` or `main`, destructive cleanup or history
rewrite, publication/Pages/deployment/release, credential or privacy crossings,
and overriding an independent QA verdict. See
`governance/owner-intent.json → protected_decision_classes`.

## Installed stage

`migration-tooling`. The governance kernel, the operational contracts, the
runtime layer (`opsctl wake`), the reconstruction drill (`opsctl drill`), the
authenticated owner-command path (`opsctl command --dry-run`), the read-only
Owner HUD (`generated/hud/index.html`), and now the read-only legacy migration
inventory (`opsctl migrate` + `governance/migration.json` +
`generated/migration/PLAN.md`) are installed and validated. Deferred to later
stages (see `project.json → deferred_next_stages`): the owner-command live
executor; the migration cutover (real genesis capsules + legacy-entrypoint
replacement, owner-gated); and the exact `dev` → `main` promotion decision.
