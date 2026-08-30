# Bounded AgentOps adoption plan

## Currentness baseline

This candidate began against `dev` at
`03b8e771b712a098c04b694bfb172a9892be598f`, detected live movement, then was
rebased cleanly through two observed advances onto exact live `origin/dev` at
`aba1f66cae4f066d560271ee4313155fe4581243`. The final local HEAD,
remote-tracking ref, and `git ls-remote` identity match. Exact current source
identities and the resolved historical drift are recorded in
`CURRENTNESS.json`; stale-base readiness is never inferred.

## Authority model

AgentOps remains the sole authority throughout the one-ticket pilot. The
pipeline adapter is a read-only projection. It cannot write capsules, leases,
events, refs, product files, generated authority views, or owner decisions.
The refill scheduler emits recommendations and metrics only. A recommendation
is never an AgentOps assignment, lease, gate result, or protected action.

## Exact future PR surface

Add only after the shadow pilot passes:

- `.agentops/governance/pipeline.json` — feature flag, refill threshold,
  lifecycle mapping, and protected-action prohibition.
- `.agentops/schemas/task-node.schema.json` — provider-neutral node contract.
- `.agentops/schemas/pipeline-observation.schema.json` — bounded metrics and
  drift report.
- `.agentops/tools/pipeline-adapter.mjs` and its test — read current capsule +
  lease and emit an in-memory shadow node.
- `.agentops/tools/pipeline-scheduler.mjs` and its test — recommendation-only
  refill, no writes.

Change:

- `.agentops/project.json` — register `pipeline-shadow` as installed but
  non-authoritative.
- `.agentops/tools/opsctl.mjs` — add read-only `pipeline observe` and `pipeline
  plan-refill`; neither command may accept `--apply`.
- `.agentops/BOOTSTRAP.md` — add one optional pointer for an actor explicitly
  assigned to the pilot. Normal actors do not load pipeline state.
- the deterministic HUD renderer — add counts for projection drift,
  recommendations, `NO_SAFE_ASSIGNMENT`, idle alarms, and duplicate assignment;
  the view remains non-authoritative.

Do not add per-seat branches, duplicate ticket events, or a second writer-lease
store.

## Backward compatibility

- AgentOps `CURRENT.json`, leases, transitions, authority, QA, and event chains
  remain byte-authoritative.
- `assigned` maps to pipeline READY with `base_oid: null`, even when the legacy
  capsule already recorded an old base. The old base remains compatibility
  evidence only; branch movement creates no pipeline event.
- `in-progress` and later local work map to EXECUTING or later and retain the
  exact AgentOps base and lease paths.
- `resolved` maps to CLOSED. `released` stays a separate delivery fact and is
  never inferred from CLOSED.
- Unknown states, missing/revoked leases, invalid hashes, expired authority, or
  path mismatch produce projection drift and no refill recommendation.
- Pipeline output never flows backward into AgentOps during shadow mode.

## One-ticket pilot

Use one reversible, collision-free ticket with two to four nodes. The existing
zoom-scanner rehearsal is the reference shape, not live adoption.

1. Record the exact AgentOps capsule and lease hashes.
2. Run `pipeline observe` and save no state; compare the shadow node with the
   capsule, lease, transitions, and authority.
3. Simulate terminal completion and refill. Verify the highest-priority safe
   node is recommended without writing an assignment or lease.
4. Exercise lock, dependency, authority, review-pressure, and empty-queue
   negatives.
5. Re-run after `dev` advances while an assigned node is still READY; require
   event delta zero and `base_oid: null`.
6. Run a clean Codex and clean Claude reconstruction from the bounded wake
   packet.
7. Stop the pilot and compare AgentOps file hashes with step 1.

Acceptance is defined in `ONE_TICKET_ACCEPTANCE.json`.

## Observability

Every observation reports source capsule hash, lease identity, projected stage,
projection drift count, refill recommendation count, no-safe count, idle alarms,
duplicate assignments, protected-action attempts, packet characters, and
observation age. Alerts are emitted for drift, duplicate assignment, any
protected-action attempt, or an idle alarm. Metrics contain pointers and counts,
not copied history or source.

## Cutover and rollback

Shadow deployment is reversible by removing the optional commands and pilot
files; no authoritative state was changed.

A future authority cutover requires a separate owner decision. Sequence:

1. Freeze only the selected ticket transition for an atomic comparison.
2. Require AgentOps and pipeline state to agree at one exact capsule hash.
3. Name the pipeline node as current truth for that ticket only.
4. Mark the matching AgentOps capsule as a compatibility projection; retain all
   history and leases.
5. Run one transition and independent readback before expanding scope.

Rollback immediately on drift, duplicate authority, duplicate assignment,
unbounded packets, missed protected-action guards, or inability to reconstruct.
For the first live ticket, restore the still-preserved AgentOps capsule as
current truth, disable pipeline writes, retain the failed pipeline events as
diagnostic history, and verify hashes. Never rewrite old evidence to imply the
cutover succeeded.

## Decision boundary

No decision is needed for the local or shadow pilot. Constantine must authorize
the exact first ticket and authority cutover separately before any pipeline
artifact becomes live coordination truth.
