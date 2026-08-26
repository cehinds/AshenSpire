# Team charters

Policy version: `1.0.0-candidate`

Decision: [0003 — Control plane, pools, pods, and WIP](DECISIONS/0003-control-plane-pools-pods-and-wip.md)

## Capability pools

| Pool | Delivery capability | Read-only stewardship between tickets |
|---|---|---|
| Art / Tech Art | Visual direction, assets, optimization, manifests, previews, provenance and licensing. | Audit reuse, consistency, hard-coded art, missing credits, and runtime budgets; prepare isolated proposals and handoffs. |
| Engineering | Defects, features, architecture, models/components/services, tooling, runtime integration. | Reconcile code and contracts, reduce bounded debt, strengthen tests, and draft risk-ranked proposals without inventing scope. |
| Game Systems | Mechanics, balance intent, unlock/behavior and data contracts, acceptance conditions. | Identify SPEC/GDD conflicts, unreachable content, balance drift, and unclear player feedback. |
| Experience Design | UX, interaction intent, narrative, names, UI copy, tutorials, accessibility text, changelog and documentation clarity. | Reconcile wording and intent across GDD, SPEC, data/config, UI, help, and changelog. |
| QA Guild | Independent functional, regression, experience, responsive, accessibility, input, persistence, artifact, and hosted evidence. | Maintain playbooks, RED plants, known-bad cases, fixtures, viewports, and evidence indexes. |
| Platform / Release | CI, generated-artifact lanes, environments, packaging, deployment, release staging and operational evidence. | Audit provenance and environment drift; never infer publication, deployment, promotion, or release authority. |

Pools are not standing delivery teams and do not own a backlog, decision stream,
or source path merely because the path fits their specialty.

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

## WIP limits

- One active Main integration item.
- One active implementation per maker.
- One serialized generated-artifact/browser/Pages lane.
- No overlapping active path claims.
- No implementation merely to keep idle capacity busy.

Idle capacity may perform read-only audits, modernization-register refreshes,
documentation reconciliation, tooling/quality observations, or stale-context
identification. It returns evidence or a proposal through Help Desk and creates
no patch unless separately assigned.
