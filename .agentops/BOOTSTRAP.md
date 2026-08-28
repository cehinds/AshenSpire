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
| Hierarchy and escalation | `governance/hierarchy.json` |
| Roles (may / must / must-not) | `governance/roles.json` |
| Per-action authority | `governance/authority.json` |
| Git path/ref ownership, one-writer | `governance/git-ownership.json` |

Human-readable views under `generated/` are produced from these JSON files and
carry no authority of their own.

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

`governance-kernel`. Deferred to later stages (see `project.json →
deferred_next_stages`): RACI, delegation, escalation, transition, information-
access, and QA contracts; the `opsctl wake` token/context compiler; the work /
event / evidence / lease capsules; the owner-command workflows; and the
read-only Owner HUD on GitHub Pages.
