# Governance decision index

Decisions are append-only records. Correct an approved decision with a new
record that names what it supersedes; do not silently rewrite history.

| ID | Decision | Status | Effective |
|---|---|---|---|
| [0001](0001-typed-truth-and-authority.md) | Typed truth and authority | Approved | Authorized canonical merge |
| [0002](0002-lifecycle-and-legacy-mapping.md) | Lifecycle and legacy mapping | Approved | Authorized canonical merge |
| [0003](0003-control-plane-pools-pods-and-wip.md) | Control plane, pools, pods, routing, and WIP | Approved | Authorized canonical merge |
| [0004](0004-art-policy-adoption.md) | Art policy canonical adoption | Approved | Authorized canonical merge; Art status becomes Active then |

Approval, local preparation, canonical merge, policy activation, and release
are separate facts. These records are approved local candidates until their
authorized canonical merge.
