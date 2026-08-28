# 0008 — Capability-pool and review-station RACI

- Decision status: **Approved**
- Policy effective condition: independently reviewed governance head contained
  in fresh canonical `dev`
- Decision owner: IT Manager III, Integration & Delivery
- Initiative: `AS-HD-20260826-028`

## Decision

New engineering work routes through **Feature / Architecture** or **Incident /
Defect** capability pools and ticket-specific temporary pods. **App Team2**,
**IT Support2**, and **IT Support3** are legacy task names, not standing
organizations or sources of future ownership. Existing bounded tasks under
those names keep their recorded makers and paths until closure or explicit
reassignment; the names create no follow-on assignment.

An **Experience & Accessibility Review** capability pool may be formed
temporarily for applicable tickets. It reviews interaction, readability,
accessibility, responsive behavior, inputs, player-facing language, and
experience evidence. It does not replace domain product/art intent or
independent Functional/Experience QA.

When competing QA lanes require technical sequencing or a serialized browser,
artifact, environment, or Pages resource, the IT Manager III may chair a
temporary **QA Coordination Pool**. The pool coordinates order, collisions,
reviewer availability, and evidence handoffs. It never authors, changes,
combines, pressures, or overrules an independent reviewer's verdict. Each
reviewer signs the exact-head result; the pool dissolves when the competing
lanes are resolved.

**Delivery Systems Review** is a technical review station under the IT Manager
III, with consultation from Code Quality & Modernization, the Data Architecture
& Systems Lead, and Platform / Release as applicable. It reviews source-to-
artifact lineage, generated/serialized lanes, dependency/tooling health,
integration gates, deployment evidence, and rollback readiness. It neither
grants product scope nor authorizes push, Project mutation, promotion, Pages
change, publication, or release.

No standing Audio, Localization, Telemetry, Security, or Community department
is created by this policy. Those capabilities are drawn into temporary pods or
review pools when a ticket requires them. A standing organization requires a
later product-scope decision supported by sustained work volume and an explicit
authority/ownership migration.

## Assignment-entry floor

Any numbered assignment `#7` or later cannot enter `ASSIGNED` until its ticket
records acceptance, dependencies, exact base, exclusive paths, and QA
requirements. The ordinary contract-ready fields, adaptive model/effort packet,
maker acknowledgement, authority, test plan, and rollback still apply; this
floor does not waive them.

## RACI boundaries

| Station | Responsible | Accountable technical decision | Consulted | Informed |
|---|---|---|---|---|
| Feature / Architecture delivery | Assigned temporary pod | IT Manager III for technical assignment, architecture reconciliation, integration, and delivery | Product/domain owner, Data Architecture when data-bearing, CQM and Platform as applicable | Help Desk and Project Management Lead |
| Incident / Defect delivery | Assigned temporary pod | IT Manager III, including incident/P0 command | Affected domain owner, CQM, Data Architecture, Platform, and QA as applicable | Help Desk and Project Management Lead |
| Experience & Accessibility Review | Assigned temporary review pool | Existing product/art authority for intent; IT Manager III only for technical reconciliation | Experience Design, QA Guild, domain owner, affected makers | Help Desk and Project Management Lead |
| Competing QA lanes | Independent assigned reviewers author verdicts | IT Manager III sequences technical lanes but does not own verdicts | Project Management Lead for capacity; QA Guild and affected leads | Help Desk |
| Delivery Systems Review | Assigned review participants | IT Manager III | CQM, Data Architecture & Systems Lead, Platform / Release | Help Desk and Project Management Lead |

## Relationship to earlier decisions

This decision supersedes the generic Engineering-pool routing in
[0003](0003-control-plane-pools-pods-and-wip.md) for new work. It preserves the
temporary-pod, helper, maker/path, WIP, QA-independence, delivery, and authority
contracts in decisions 0003, 0005, 0006, and 0007.

## Rollback or supersession

Revert this bounded governance commit before activation, or append a later
decision that maps open tasks, reviewers, lanes, and path ownership to its
replacement structure.
