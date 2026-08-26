# AshenSpire development coordination workflow

This is the AshenSpire-side operating contract for routine development, status
reporting, cross-family handoffs, and release-quality boundaries. It records the
project-specific additions requested by [issue #184](https://github.com/cehinds/AshenSpire/issues/184)
under the parent experience story [#185](https://github.com/cehinds/AshenSpire/issues/185).

It does not authorize a release, a release-branch merge, a tag, a deployment,
or a change to release readiness.

## Authority and ownership

- **Help Desk** is the routine intake, routing, acknowledgement, and status
  channel. It records work and forms temporary delivery pods from the needed
  capability pools without becoming an implementation or approval authority.
- **Main** is the AshenSpire decision, exception, and integration hub, senior
  developer, and the only liaison to Constantine. Main resolves ambiguity,
  approval and scope choices, contested ownership, architecture and integration
  risks, and blockers that routine routing cannot resolve.
- Work is staffed from capability pools into temporary delivery pods. Each pod
  has one lead and may use up to three supporting agents. The lead remains
  accountable for bounded scope, evidence, internal coordination, and one
  concise Help Desk receipt. A pod dissolves after its accepted handoff; pools
  provide capabilities and do not become standing work units or parallel
  authorities.
- Aurora and Marina may assign and approve routine development work after the
  work has a named owner, bounded scope, current-base evidence, required tests,
  player-facing evidence where applicable, and an independent review.
- Marina leads shared GitHub Projects coordination while she is awake and
  available. Aurora coordinates the Aurora-side work and takes the board lead
  when Marina is unavailable; Aurora returns to the second role when Marina
  resumes.
- Aurora requests available Falk-family capacity from Marina rather than
  assigning Falk-family agents directly.
- An assignment is not accepted until the named owner acknowledges it. An
  unacknowledged assignment is a request, not active ownership.
- One maker owns each source, test, screenshot, and serialized-artifact path at
  a time. Generated root/build/dist/buildordinal output is regenerated once,
  after source freeze, by the owner of that serialized lane.

## Routine routing and Main decision hub

Routine questions, intake, routing, acknowledgements, and status receipts go to
Help Desk. Main receives decision and exception packets: ambiguity that changes
the work, approval requests, design or scope choices, contested ownership,
integration rulings, unresolved blockers, and authority requests. Capability
pools and delivery pods do not ask Constantine directly or create a second
decision channel through another pool, issue, pull request, or chat.

Pods continue safe work that is already authorized. They pause only the part
that actually depends on the unresolved decision. Each escalation to Main must
contain:

1. the exact evidence and current state;
2. two or three materially different options when options are applicable;
3. the pod's recommendation and its trade-off;
4. the smallest next action after a decision; and
5. the exact authority needed, or `No new authority`.

Main answers within existing recorded authority when it can. When Constantine's
decision is required, Main presents the bounded packet, records the answer, and
returns it to the owning pod. A direct instruction from Constantine may
override the ordinary routing order, but the receiving pod still reports the
instruction and its resulting scope to Main before ownership or shared paths
change. This routing rule grants no push, merge, release, publication, board
mutation, or product-scope authority.

## Capability pools and temporary delivery pods

Help Desk uses the following routine routing map. A ticket may draw from
multiple pools, but Main records any contested ownership or integration
decision. A direct instruction from Constantine may override the ordinary
route, but the override must be recorded in the assignment receipt.

| Capability pool | Primary responsibility | Stewardship between delivery pods |
|---|---|---|
| **Art / Tech Art** | Visual direction, asset production and optimization, model appearance, shared visual definitions, asset manifests, previews, and provenance/licensing. | Audit asset reuse, visual consistency, hard-coded art, missing credits, and runtime budgets; prepare bounded assets and handoffs without editing canonical runtime/catalog paths. |
| **Engineering** | Defect diagnosis and repair, feature implementation, application architecture, shared models/components/services, tooling, and substantial runtime wiring. | Reconcile current code, reduce bounded debt, strengthen tests and contracts, and prepare current-iteration proposals without inventing product scope. |
| **Game Systems** | Gameplay rules, loops, balance intent, unlock/behavior contracts, data contracts, and acceptance criteria. | Audit rule conflicts, balance drift, unreachable content, unclear feedback, and missing acceptance criteria against SPEC/GDD truth. |
| **Experience Design** | UX flows, interaction intent, narrative, canonical names, UI copy, tutorials, tooltips, accessibility text, player explanations, changelog prose, and documentation clarity. | Audit usability and language for obsolete terms, unexplained jargon, duplicate copy, accessibility gaps, and documentation drift; do not change lore or mechanics without approval. |
| **QA Guild** | Functional, regression, persistence, input, browser, accessibility, responsive, touch, cross-resolution, and player-flow verification, including independent non-maker review. | Maintain QA playbooks, RED plants, known-bad cases, fixtures, saves, viewport matrices, evidence indexes, and exploratory charters. |
| **Platform / Release** | Build and deployment infrastructure, CI, generated-artifact lanes, environments, release staging, and operational readiness within explicit authority. | Audit tooling, CI, provenance, environment drift, and release evidence; never infer push, deployment, promotion, or release authority. |

### Help Desk ticket contract

Each Help Desk receipt records a stable ticket ID, submitted time, requester,
request type, player-visible problem or desired outcome, exact build/SHA and
environment when known, reproduction/evidence, affected components or systems,
severity/priority, status, owner, dependencies, and smallest next action.

The shared statuses are `NEW`, `TRIAGED`, `ASSIGNED`, `IN PROGRESS`,
`WAITING ON MAIN`, `READY FOR QA`, `READY FOR MAIN`, `RESOLVED`, `STALE`, and
`CLOSED`. Help Desk owns routine routing and acknowledgements. Main owns
decisions, exceptions, contested sequencing or ownership, integration rulings,
and relays to Constantine. A ticket status never grants implementation or
remote-mutation authority.

### Intake and handoff sequence

```text
request / observation
    |
    v
 Help Desk -- record, classify, route, acknowledge, and track
    |
    v
 temporary delivery pod -- one lead + required capability pools
    |       Art / Tech Art       Engineering       Game Systems
    |       Experience Design    QA Guild          Platform / Release
    |
    +-- routine question/status ----------------------> Help Desk
    |
    +-- decision/exception/integration/blocker --------> Main
    |                                                       |
    |                              Constantine only when required
    |                                                       |
    v                                                       v
 pod receipt -> Help Desk status             recorded decision -> owning pod
    |
    v
 existing integration/release gates
```

Pools and pods send routine cross-capability needs through Help Desk. Help Desk
may add a capability to a pod or route a normal handoff, but none of those
actions silently changes shared-path ownership or product scope. Main records
contested ownership, exceptions, and integration decisions before work changes
those lanes.

When the
[automatic Art Design Integration Policy](ART-DESIGN-INTEGRATION-POLICY.md)
is Active, an explicitly approved art suggestion requires its complete
integration package: stable IDs, reuse and asset contracts, catalog evidence,
applicable Game Systems rules, Engineering and QA Guild handoffs,
accessibility, provenance, and documentation. The trigger creates obligations,
not implementation or remote-mutation authority; canonical catalog and runtime
edits wait for the eventual origin-bound implementation.

Idle work is maintenance, not free product scope. It begins with a read-only
audit, stays in an isolated lane, and returns a proposal or patch through Help
Desk. Help Desk involves Main only when it needs a decision, exception, or
integration ruling.
Completed Codex sessions may be archived only after their result and pending
decisions are captured in the canonical issue, pull request, status page, or
handoff receipt. Durable memory changes still require Constantine's explicit
request.

## Routine development gate

Before routine work is treated as ready for integration, its receipt must name:

1. the issue or user story and the named owner;
2. the exact current `dev` base and exact reviewed head;
3. the source, test, evidence, and generated-artifact paths claimed;
4. the acceptance conditions addressed and any conditions left open;
5. the tests and discriminating negative/RED evidence run;
6. the desktop/mobile or other player-facing evidence when the change is
   visible; and
7. the independent non-author review result.

Routine development approval permits ordinary integration to `dev` only when
the repository's branch and review rules are satisfied. It is not release
approval.

## Status reporting

The canonical status home is [issue #183](https://github.com/cehinds/AshenSpire/issues/183).
Every material report uses short, plain-language bullets and includes:

- the exact current `dev` commit and build/source stamp;
- **Built**, **In progress**, **Not started**, **Bugs**, and **Backlog**;
- links to the exact playable build, labelled screenshots, and owning issue or
  pull request for every material step;
- the current release boundary, which remains explicitly **RED** unless
  Constantine approves a release action; and
- **What Constantine needs** — an explicit decision or `Nothing`.

The report must synchronize Family Delivery at the time it is issued. If the
board cannot be read or synchronized, the report says **BOARD SYNC FAILED** and
names the missing access or retry trigger. It must not infer a board state.

The stable development preview is the explicit
[`/AshenSpire.html`](https://cehinds.github.io/AshenSpire/AshenSpire.html)
URL. A report must verify that the preview corresponds to the exact current
`dev` artifact before calling the preview current.

## Feedback and decision refresh

Before a pod escalates a decision, requests review, or repeats an unanswered
request, it sends Main the required escalation packet. Main refreshes the full
comment thread on the owning issue and linked pull request before reporting
`WAITING ON CONSTANTINE` or presenting the question. Main processes every
newer comment from `cehinds` as current input and records its permalink and
time. If there is no newer comment, Main records
`NO NEW CONSTANTINE COMMENT` with the checked time.

An item carrying an explicit approval/deny decision remains in its decision
flow until the named authority records the decision. A waiting label alone is
not evidence that the decision is complete.

## Cross-family handoffs

Formal handoffs use three distinct lifecycle states:

- **SENT** — the request was published to the neutral mailbox or agreed
  delivery channel;
- **RECEIVED** — the destination acknowledged receipt; and
- **ACKNOWLEDGED** — the destination confirmed the request is understood and
  accepted for its lane.

Do not collapse these states into one word. A failed transport or validation
run leaves the durable reference published but does not prove `RECEIVED` or
`ACKNOWLEDGED`. The retry receipt names the failed run, preserves the durable
reference, identifies the bridge or mailbox owner, and gives the exact retry
trigger. Do not create a duplicate scheduler or duplicate assignment while the
existing handoff is unresolved.

## Release boundary

The following remain Constantine-only:

- promotion to `release` or `main`;
- release-branch merges;
- tags and release publication;
- public deployment or promotion beyond the development preview; and
- final release-quality control and release-readiness approval.

A development PR may be fully reviewed, green, mergeable, or merged to `dev`
without changing that boundary. The [repository contribution rules](../CONTRIBUTING.md),
[specification](../SPEC.md), and [credits/license rules](../CREDITS.md) still
govern implementation work.

## Completion of this workflow task

Issue #184 is complete only when this document is present at a canonical
AshenSpire path, the shared vocabulary and authority boundaries are referenced
by the status process, routine development can proceed without repeated release
permission requests, and any active handoff has a truthful `SENT`, `RECEIVED`,
or `ACKNOWLEDGED` receipt. This document itself does not close the parent story
while the other live children of #185 remain open.
