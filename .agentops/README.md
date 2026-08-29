# `.agentops/`

AshenSpire's compact, repository-native, provider-neutral control plane.
Centralized owner intent, decentralized reversible execution, one writer per
overlapping path or ref, and clean-session reconstruction from Git.

Start at [`BOOTSTRAP.md`](BOOTSTRAP.md).

```
.agentops/
  BOOTSTRAP.md          cold-start entry (bounded reads)
  project.json          project identity + installed stage
  governance/           validated JSON contracts (authoritative)
    owner-intent.json     mission, invariants, owner + deputy grant
    hierarchy.json        actors, escalation ownership, routing SLA
    roles.json            per-role may / must / must-not / ceiling
    authority.json        per-action routine owner + required evidence
    git-ownership.json    path/ref ownership + one-writer + collisions
    raci.json             one Accountable per deliverable / decision
    delegation.json       non-amplifying envelopes + subdelegation limits
    escalation.json       timers, routes, wake — routing only, never authority
    transitions.json      lifecycle states + permitted actors + guards
    information-access.json  startup / on-demand / restricted / forbidden context
    qa.json               risk classes, independent gates, waiver authority
    evidence.json         producer / exact object / verifier / invalidation
  schemas/              mini-schemas the validator enforces (governance + runtime)
  work/<ticket>/CURRENT.json   sealed work capsule (compare-and-swap current_hash)
  leases/<lease-id>.json       writer lease (one writer per overlapping path/ref)
  events/<ticket>/*.json       append-only transition events
  RECONSTRUCTION-DRILL.md      provider-neutral clean-clone / context-wipe drill spec
  tools/
    opsctl.mjs            validate | render [--check] | verify | wake [--frozen] | drill | command (--dry-run|--apply) | migrate [--plan] | --selftest
    opsctl.test.mjs       test suite (real corpus + 47 negative plants + reconstruction + owner-command + migration)
  generated/
    GOVERNANCE.md         generated human view (sole writer: opsctl render)
    reconstruction/<ticket>.wake.txt   frozen wake goldens (drift-gated by verify)
    hud/index.html        read-only Owner HUD (redacted, deterministic; drift-gated)
    migration/PLAN.md     legacy migration inventory/plan (drift-gated)
```

The JSON is the source of truth; Markdown under `generated/` is a projection.
Regenerate and drift-check with `node .agentops/tools/opsctl.mjs verify`.

This is the `migration-tooling` stage (the governance kernel, the operational
contracts, the runtime capsule/lease/event layer with `opsctl wake`, the
clean-clone reconstruction drill, the authenticated owner-command dry-run path,
the read-only Owner HUD, and the read-only legacy migration inventory). The
reusable installer specification and governance census this was built from live
under
[`docs/reconstruction/agentops/`](../docs/reconstruction/agentops/); that bundle
is read-only installation authority, not runtime context.
