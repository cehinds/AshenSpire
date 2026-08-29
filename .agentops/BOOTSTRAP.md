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

Owner decisions flow through the authenticated owner-command path — enumerated,
allowlisted, and compare-and-swap-checked. This stage ships the dry-run (records
what it would do; no repository mutation):

```sh
node .agentops/tools/opsctl.mjs command --dry-run --request '<owner-command-request json>'
```

The read-only Owner HUD is a redacted, deterministic projection at
`generated/hud/index.html`, published by `.github/workflows/pages.yml`
(workflow_dispatch only; inert until Pages is enabled).

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

`owner-hud-and-command`. The governance kernel, the operational contracts, the
runtime layer (`opsctl wake`), the reconstruction drill (`opsctl drill`), and
now the authenticated owner-command path (`opsctl command --dry-run`, enumerated
+ allowlisted + compare-and-swap) plus the read-only Owner HUD
(`generated/hud/index.html`, published by an inert `pages.yml`) are installed and
validated. Deferred to later stages (see `project.json →
deferred_next_stages`): the owner-command live executor (append decision event +
CAS-update state); migration tooling for existing work; and the exact `dev` →
`main` promotion decision.
