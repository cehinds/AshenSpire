# Team charters

Policy version: `1.0.0`

Decisions: [0003 — Control plane, pools, pods, and WIP](DECISIONS/0003-control-plane-pools-pods-and-wip.md),
[0006 — Adaptive model and effort selection](DECISIONS/0006-adaptive-model-and-effort-selection.md),
[0007 — Standing coordination roles and completion council](DECISIONS/0007-standing-coordination-roles-and-completion-council.md),
[0008 — Capability-pool and review-station RACI](DECISIONS/0008-capability-pool-and-review-station-raci.md),
and [0009 — Promotion Gates A–F](DECISIONS/0009-promotion-gates-a-through-f.md)

## Standing coordination roster

| Role | Standing responsibility | Boundary |
|---|---|---|
| Help Desk | Intake, contract/status hygiene, routing, acknowledgements, receipts, and Project workflow projection. | No implementation, product, technical-decision, integration, board-mutation, or delivery authority. |
| Project Management Lead | Portfolio/milestone recommendations; dependency, blocker, WIP, and capacity visibility; completion councils; handoffs; risk/decision log; promotion-readiness planning; stakeholder summaries. | Recommends and coordinates; does not decide technical assignment/integration or gain product, board, delivery, promotion, or release authority. |
| Data Architecture & Systems Lead | Schema/ID/alias/deprecation; source-generator-projection lineage; migration/version/compatibility; generated manifests; save/content/data quality; cross-domain data-contract review. | May `WITHHOLD` an unsafe contract; does not self-assign implementation or replace domain intent or IT Manager III authority. |
| IT Manager III, Integration & Delivery | Mandatory technical relay; technical sequencing; path/maker ownership; architecture reconciliation; incident/P0 command; integration and delivery gates. | Decides technical assignment/integration within granted authority and may perform Gate-C exact test fast-forward; Constantine retains `main`/`release`, Pages, tag, publication, playtest, and final release actions. |

The IT Manager III is the role formerly named `Main`. `READY FOR MAIN` remains
the compatibility lifecycle token and routes to this role.

## Capability pools

| Pool | Delivery capability | Read-only stewardship between tickets |
|---|---|---|
| Art / Tech Art | Visual direction, assets, optimization, manifests, previews, provenance and licensing. | Audit reuse, consistency, hard-coded art, missing credits, and runtime budgets; prepare isolated proposals and handoffs. |
| Feature / Architecture | Features, architecture, models/components/services, tooling, and runtime integration. | Reconcile code and contracts, strengthen reusable boundaries, and draft bounded proposals without inventing product scope. |
| Incident / Defect | Reproduction, containment, repair, regression evidence, and incident/P0 technical response. | Maintain known-bad plants and defect evidence; no unassigned repair. |
| Code Quality & Modernization | Small risk-ranked code, architecture, test, documentation, configuration, repository, and tooling-debt reduction. | Maintain the modernization register and read-only audits; no idle patching or product-behavior change. |
| Game Systems | Mechanics, balance intent, unlock/behavior and data contracts, acceptance conditions. | Identify SPEC/GDD conflicts, unreachable content, balance drift, and unclear player feedback. |
| Experience Design | UX, interaction intent, narrative, names, UI copy, tutorials, accessibility text, changelog and documentation clarity. | Reconcile wording and intent across GDD, SPEC, data/config, UI, help, and changelog. |
| Experience & Accessibility Review | Temporary review of interaction, readability, accessibility, responsive behavior, input modes, player-facing language, and experience evidence. | Form only for applicable tickets; preserve domain intent and independent QA verdict ownership. |
| QA Guild | Independent functional, regression, experience, responsive, accessibility, input, persistence, artifact, and hosted evidence. | Maintain playbooks, RED plants, known-bad cases, fixtures, viewports, and evidence indexes. |
| Platform / Release | CI, generated-artifact lanes, environments, packaging, deployment, release staging and operational evidence. | Audit provenance and environment drift; never infer publication, deployment, promotion, or release authority. |

Pools are not standing delivery teams and do not own a backlog, decision stream,
or source path merely because the path fits their specialty.

`App Team2`, `IT Support2`, and `IT Support3` are legacy task names, not
standing organizations. Existing bounded tasks keep their makers and paths
until closure or explicit reassignment. New work routes through Feature /
Architecture or Incident / Defect and a temporary pod.

These legacy task names are distinct from the standing **`it-support` delivery
seat** defined in `.agentops/governance/roles.json` — a p4 delivery seat, peer to
`maker`, that repairs tooling, environment, routing, and access blockers and
holds no push/PR/merge/deploy/release authority (its authority-matrix row is in
[AUTHORITY.md](AUTHORITY.md); see decision
[0011](DECISIONS/0011-it-support-plane-reconciliation.md)). Retiring the
`IT Support2/3` task names does not retire that seat.

No standing Audio, Localization, Telemetry, Security, or Community department
exists absent a later product-scope decision supported by sustained volume and
an explicit ownership/authority migration. Tickets draw those capabilities
into temporary pods when needed.

## Temporary review stations

- The IT Manager III may chair a temporary **QA Coordination Pool** only while
  competing QA lanes need technical sequencing or a serialized browser,
  artifact, environment, or Pages resource. It coordinates order, collisions,
  availability, and handoffs; independent non-maker reviewers alone author
  their exact-head verdicts. The pool cannot change or overrule them and
  dissolves when the collision clears.
- **Delivery Systems Review** operates under the IT Manager III with CQM, Data
  Architecture & Systems Lead, and Platform / Release consultation as
  applicable. It reviews lineage, generated/serialized lanes,
  dependency/tooling health, integration gates, deployment evidence, and
  rollback readiness. It grants no product or remote-mutation authority.

## Temporary delivery pods

- Help Desk forms a pod only for a contract-ready ticket.
- Each pod has one lead and no more than three bounded helpers.
- The lead owns scope, internal coordination, base/head evidence, and one
  consolidated status/outcome receipt.
- One maker owns each source, test, evidence, and generated-artifact path at a
  time. Helpers receive disjoint, explicit paths or read-only questions.
- A pod dissolves after its accepted handoff or cancellation. Its chat and local
  workspace do not remain an authority source.
- An assignment is active only after the named maker acknowledges it.
- A numbered assignment `#7` or later cannot enter `ASSIGNED` without recorded
  acceptance, dependencies, exact base, exclusive paths, and QA requirements,
  in addition to the ordinary contract-ready fields.

## Adaptive assignment contract

Every assignment and reassignment records:

```text
MODEL <model> | EFFORT <effort> | WHY <risk-and-station reason> | ESCALATE WHEN <observable trigger>
```

Selection follows the risk-and-station matrix in [decision
0006](DECISIONS/0006-adaptive-model-and-effort-selection.md), never role rank.
The pairing is fixed for the active turn. Changing it requires an escalation
receipt, and `max` effort requires a recorded exceptional reason. Model choice
does not alter path, product, board, QA, integration, delivery, or release
authority.

## Completion council

At `READY FOR MAIN` and `RESOLVED`, every lead sends Help Desk and the IT
Manager III its available independent work, dependencies and path/serialized-
lane overlap, recommendation and smallest next action, and exact authority.
The Project Management Lead convenes and summarizes; Help Desk records; the IT
Manager III decides technical assignment, sequencing, integration, delivery,
or `WAIT`. Availability never creates an assignment, and no lead silently
self-assigns a shared path.

## WIP limits

- One active IT Manager III integration item.
- One active implementation per maker.
- One serialized generated-artifact/browser/Pages lane.
- No overlapping active path claims.
- No implementation merely to keep idle capacity busy.

Idle capacity may perform read-only audits, modernization-register refreshes,
documentation reconciliation, tooling/quality observations, or stale-context
identification. It returns evidence or a proposal through Help Desk and creates
no patch unless separately assigned.
