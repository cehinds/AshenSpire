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
  schemas/              mini-schemas the validator enforces
  tools/
    opsctl.mjs            validate | render [--check] | verify | --selftest
    opsctl.test.mjs       test suite (real corpus + negative plants)
  generated/
    GOVERNANCE.md         generated human view (sole writer: opsctl render)
```

The JSON is the source of truth; Markdown under `generated/` is a projection.
Regenerate and drift-check with `node .agentops/tools/opsctl.mjs verify`.

This is the `operational-governance` stage (the governance kernel plus the
operational contracts). The reusable installer specification and
governance census this was built from live under
[`docs/reconstruction/agentops/`](../docs/reconstruction/agentops/); that bundle
is read-only installation authority, not runtime context.
