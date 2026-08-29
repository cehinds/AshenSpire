# 0007 — Standing coordination roles and completion council

- Decision status: **Approved**
- Policy effective condition: independently reviewed governance head contained
  in fresh canonical `dev`
- Decision owner: IT Manager III, Integration & Delivery
- Initiative: `AS-HD-20260826-026` and `AS-HD-20260826-027`

## Decision

The permanent coordination roster is:

- **Help Desk** for intake, contract/status hygiene, routing, receipts, and
  current workflow projection;
- **Project Management Lead** for portfolio and milestone recommendations,
  dependency/blocker/WIP/capacity visibility, completion councils, handoffs,
  risk/decision-log stewardship, promotion-readiness planning, and stakeholder
  summaries;
- **Data Architecture & Systems Lead** for schema, ID, alias, deprecation,
  source-generator-projection lineage, migration/version/compatibility,
  generated manifests, save/content/data quality, and cross-domain data-contract
  review; and
- **IT Manager III, Integration & Delivery** for the mandatory technical relay,
  technical sequencing, path/maker ownership, architecture reconciliation,
  incident/P0 command, integration, and delivery gates.

`IT Manager III, Integration & Delivery` replaces the prior operational role
name `Main`. Historical decision text and the compatibility lifecycle token
`READY FOR MAIN` remain unchanged. In current policy, a packet routed to Main
or work at `READY FOR MAIN` is routed to the IT Manager III.

The Data Architecture & Systems Lead may return `WITHHOLD` on an unsafe data
contract. The verdict identifies the violated invariant, affected schemas,
IDs, lineage, versions or compatibility boundary, exact evidence, and smallest
safe correction. `WITHHOLD` blocks assignment or integration of that contract;
it does not authorize implementation, reassignment, product decisions, or
delivery. The IT Manager III retains final architecture reconciliation,
technical sequencing, assignment, integration, and delivery decisions and must
resolve the withhold or obtain the exact authority needed to accept an
exception.

The Project Management Lead recommends; the IT Manager III decides technical
assignment and integration. Neither this role nor the Data Architecture role
creates product, board-mutation, delivery, publication, promotion, or release
authority. Domain teams retain product, art, content, runtime, and build intent.
Both standing leads may lead or assist a temporary pod only after explicit
ticket assignment; neither owns implementation paths by standing role.

## Completion council

At `READY FOR MAIN` and again at `RESOLVED`, every lead sends Help Desk
and the IT Manager III a completion-council packet containing:

1. available independent work;
2. dependencies and shared-path or serialized-lane overlap;
3. recommendation and smallest next action; and
4. exact existing or newly required authority.

The Project Management Lead convenes and summarizes the council. Help Desk
records receipts and workflow facts. The IT Manager III records technical
assignment, sequencing, integration, delivery, or `WAIT` decisions. The council
does not assign work by silence, availability, or consensus, and no lead may
self-assign a shared path.

## Relationship to earlier decisions

This decision supersedes the role-name and two-member-control-plane wording in
[0001](0001-typed-truth-and-authority.md),
[0003](0003-control-plane-pools-pods-and-wip.md), and
[0005](0005-dev-delivery-promotion-and-pages.md). It preserves their typed
truth, lifecycle, pool/pod, WIP, QA, delivery, promotion, Pages, and Constantine
authority contracts. References to `Main` in those immutable records mean the
IT Manager III after this decision takes effect.

## Rollback or supersession

Revert this bounded governance commit before activation, or append a later
decision that explicitly remaps the standing roles, open decisions, path
claims, completion-council ownership, and compatibility references.
