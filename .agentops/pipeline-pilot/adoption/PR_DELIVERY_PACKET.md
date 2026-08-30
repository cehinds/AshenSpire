# Local PR delivery packet

## Identity

- Proposed title: `feat(agentops): pilot task-driven pipeline shadow scheduler`
- Head: `codex/task-pipeline-pilot`
- Base: `dev`
- Rebased base: `191d563cb07bcda15f43d9b89ededf0402f2d7c5`
- Tracking issue: [#269 — automatically assign whoever finishes](https://github.com/cehinds/AshenSpire/issues/269)
- State: `PR_READY_LIVE_OFFER_NOT_DELIVERED`

This candidate advances #269 only as a non-authoritative shadow scheduler. It
does not close #269: durable identity, authoritative claims, and Project-write
credentials remain outside this PR. Nothing has been pushed or opened remotely.

## Proposed PR body

### Summary

- add a provider-neutral task-pipeline pilot with risk-selected routes,
  bounded task nodes, READY-without-pinned-base behavior, and material events;
- add deterministic saturation, completion-triggered refill, dependency wake,
  resource-lock serialization, review backpressure, `NO_SAFE_ASSIGNMENT`, and
  idle-age alarm coverage;
- add a hash-checked local package installer with drift-safe rollback and clean
  Codex/Claude startup pointers;
- add a read-only AgentOps compatibility adapter and one-ticket adoption plan;
  AgentOps remains authoritative and protected actions remain unavailable.
- activate an immediate repository-native `LIVE_OFFER` scheduler bound to #269;
  it selects only existing same-actor claims and emits bounded wake/no-safe/idle
  observations without fabricating seat identity or mutating Project state.

Advances #269 without closing it.

### Verification

- `node .agentops/tools/pipeline-pilot.test.mjs` — PASS 51/51.
- `node .agentops/tools/pipeline-pilot-install.test.mjs` — PASS 16/16.
- `node .agentops/tools/pipeline-pilot-agentops-adapter.test.mjs` — PASS 25/25.
- `node .agentops/tools/pipeline-pilot-live.test.mjs` — PASS 17/17.
- `node .agentops/tools/opsctl.mjs verify` — PASS.
- `node --check` for every new tool and test — PASS.
- `git diff --check` over the complete pilot scope — PASS.
- security review — unsafe Git-ref option input refused; manifest traversal,
  duplicate paths, install-state tampering, symlink install roots, file drift,
  and unsafe rollback are refused.

### Boundaries

This is a local architecture and shadow-adoption candidate. It does not change
product behavior, current AgentOps authority, GitHub state, coordination state,
deployment, publication, or release.

## Exact file set

Add:

- `.agentops/pipeline-pilot/PIPELINE_KERNEL.md`
- `.agentops/pipeline-pilot/activation.json`
- `.agentops/pipeline-pilot/risk-routes.json`
- `.agentops/pipeline-pilot/task-node.schema.json`
- `.agentops/pipeline-pilot/saturation-scenario.json`
- `.agentops/pipeline-pilot/seat-refill-scenario.json`
- `.agentops/pipeline-pilot/tickets/AS-PIPELINE-PILOT-001/nodes/implement.json`
- `.agentops/pipeline-pilot/rehearsals/zoom-scanner/EVENTS.jsonl`
- `.agentops/pipeline-pilot/rehearsals/zoom-scanner/REHEARSAL_REPORT.md`
- `.agentops/pipeline-pilot/rehearsals/zoom-scanner/REVIEW_BACKPRESSURE.json`
- `.agentops/pipeline-pilot/rehearsals/zoom-scanner/WAKE.json`
- `.agentops/pipeline-pilot/rehearsals/zoom-scanner/node-executing.json`
- `.agentops/pipeline-pilot/package/README.md`
- `.agentops/pipeline-pilot/package/MIGRATION_MAP.md`
- `.agentops/pipeline-pilot/package/manifest.json`
- `.agentops/pipeline-pilot/package/templates/stable/PIPELINE_KERNEL.md`
- `.agentops/pipeline-pilot/package/templates/stable/AUTHORITY.json`
- `.agentops/pipeline-pilot/package/templates/stable/RISK_ROUTES.json`
- `.agentops/pipeline-pilot/package/templates/state/task-node.schema.json`
- `.agentops/pipeline-pilot/package/templates/state/TASK_NODE.example.json`
- `.agentops/pipeline-pilot/package/templates/startup/START_HERE.md`
- `.agentops/pipeline-pilot/package/templates/startup/CODEX.md`
- `.agentops/pipeline-pilot/package/templates/startup/CLAUDE.md`
- `.agentops/pipeline-pilot/adoption/LIVE_ADOPTION_PLAN.md`
- `.agentops/pipeline-pilot/adoption/CURRENTNESS.json`
- `.agentops/pipeline-pilot/adoption/COMPATIBILITY_MAP.json`
- `.agentops/pipeline-pilot/adoption/ONE_TICKET_ACCEPTANCE.json`
- `.agentops/pipeline-pilot/adoption/pipeline-observation.schema.json`
- `.agentops/pipeline-pilot/adoption/PR_DELIVERY_PACKET.md`
- `.agentops/tools/pipeline-pilot.mjs`
- `.agentops/tools/pipeline-pilot.test.mjs`
- `.agentops/tools/pipeline-pilot-install.mjs`
- `.agentops/tools/pipeline-pilot-install.test.mjs`
- `.agentops/tools/pipeline-pilot-agentops-adapter.mjs`
- `.agentops/tools/pipeline-pilot-agentops-adapter.test.mjs`
- `.agentops/tools/pipeline-pilot-live.mjs`
- `.agentops/tools/pipeline-pilot-live.test.mjs`

Change:

- `.agentops/BOOTSTRAP.md`
- `.agentops/project.json`
