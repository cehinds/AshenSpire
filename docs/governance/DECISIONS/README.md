# Governance decision index

Decisions are append-only records. Correct an approved decision with a new
record that names what it supersedes; do not silently rewrite history.

| ID | Decision | Decision status | Policy effect |
|---|---|---|---|
| [0001](0001-typed-truth-and-authority.md) | Typed truth and authority | Approved | Active when the independently reviewed governance head is contained in canonical `dev` |
| [0002](0002-lifecycle-and-legacy-mapping.md) | Lifecycle and legacy mapping | Approved | Active under the same branch-containment rule |
| [0003](0003-control-plane-pools-pods-and-wip.md) | Control plane, pools, pods, routing, and WIP | Approved | Active under the same branch-containment rule |
| [0004](0004-art-policy-adoption.md) | Art policy canonical adoption | Approved | Art policy is Active under the same branch-containment rule |
| [0005](0005-dev-delivery-promotion-and-pages.md) | Dev delivery, promotion readiness, and Pages source | Approved | Active under the same branch-containment rule; dated branch/Pages values remain snapshot evidence |

Approval, local preparation, canonical merge, policy activation, and release
are separate facts. Decision status remains historical; policy activation is
derived from the exact independently reviewed head and fresh canonical `dev`
containment, without a merge-time document mutation.
