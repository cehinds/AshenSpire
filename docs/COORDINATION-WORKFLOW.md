# AshenSpire development coordination workflow

This is the AshenSpire-side operating contract for routine development, status
reporting, cross-family handoffs, and release-quality boundaries. It records the
project-specific additions requested by [issue #184](https://github.com/cehinds/AshenSpire/issues/184)
under the parent experience story [#185](https://github.com/cehinds/AshenSpire/issues/185).

It does not authorize a release, a release-branch merge, a tag, a deployment,
or a change to release readiness.

## Authority and ownership

- **Main** is the AshenSpire coordinator and the only routine liaison between
  Constantine and the delivery teams. Main receives work, classifies it,
  brokers assignments, protects sequencing and one-maker ownership, collects
  the team leads' receipts, and presents approval decisions to Constantine.
- Every delivery team has one lead and may use up to three supporting agents.
  The lead may implement work directly, but remains accountable for scope,
  integration inside the team's lane, verification, and one concise report to
  Main. Supporting agents do not become separate coordinators.
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

## Team operating model

Main uses the following routing order. A direct instruction from Constantine
may override the ordinary route, but the override must be recorded in the
assignment receipt.

| Team | Primary responsibility | Idle maintenance, coordinated through Main |
|---|---|---|
| **IT Support 1, 2, 3** | First stop for defects, regressions, broken builds, diagnostics, repair, and recovery. IT Support may fix a defect in-house or ask Main to route feature-sized construction to an App Team. | Audit stale issues and sessions; prepare safe archive candidates; reconcile old context with current `dev`; refresh README, changelog, status, catalog, and backlog receipts; improve regression coverage and propose memory consolidation. Never delete history or broaden product scope merely because the team is idle. |
| **App Team 1, 2** | Build new features, applications, architecture slices, and feature-sized implementation delegated by Main. They may accept construction escalated from IT Support, but do not self-assign defects from an IT lane. | Improve the current iteration only: reduce local code debt, align models/components/services, strengthen tests, refresh implementation documentation, and prepare bounded current-iteration proposals. Do not invent a new product initiative. |
| **Game Design Team** | Own gameplay-system proposals, player loops, balance intent, UX rules, data contracts, acceptance criteria, and design reviews. It defines what the experience should do; App Teams implement substantial code. | Audit the current iteration for rule conflicts, unclear feedback, balance drift, unreachable content, and missing acceptance criteria. Keep proposals data-driven and traceable to SPEC/GDD decisions. |
| **Writing Team** | Own narrative, names, UI copy, tutorial text, tooltips, player-facing explanations, changelog prose, and documentation clarity. Keep canonical terminology consistent and localization-ready. | Review current-iteration copy for contradictions, obsolete language, unexplained jargon, duplicate wording, and documentation drift. Do not change canonical lore or mechanics without approval. |
| **QA Team 1** | Functional, regression, persistence, input, combat, and exact-head automated/browser verification. Maintains discriminating RED plants and tests behavior, not screenshots alone. | Maintain the QA playbook, known-bad corpus, test fixtures, reproducible saves, and evidence index; audit current `dev` for untested critical paths. |
| **QA Team 2** | Independent UX, accessibility, responsive, touch, cross-resolution, and player-flow review. Provides the non-maker review for visible work and checks desktop plus phone evidence. | Maintain viewport/device matrices, accessibility checks, screenshot comparisons, usability heuristics, and current-iteration exploratory charters. |
| **Art Team 1, 2** | Own non-programming visual production and the visual asset system: model appearance, asset consistency, component miniatures/icons, current-build assets, polish, and reusable/data-driven visual definitions. Similar models must reference shared components rather than duplicate them. | Audit the current build and component catalog for mismatched models, duplicate assets, inconsistent icons, weak visual miniatures, missing credits/licences, and hard-coded art. Prepare or refine relevant assets and catalog evidence. Substantive runtime wiring is routed through Main to an App Team. |

### Intake and handoff sequence

```text
Constantine
    |
    v
  Main -- classify, sequence, and name one lead
    |
    +-- defect / regression -----------------> IT Support
    |                                             |
    |                              feature-sized build request
    |                                             v
    +-- feature / application ----------------> App Team
    +-- mechanics / balance / UX rules --------> Game Design
    +-- narrative / copy / documentation ------> Writing
    +-- artwork / illustration / visual assets -> Art Team
    +-- verification / independent review -----> QA Team 1 or 2
                                                  |
                                                  v
                        lead receipt -> Main -> Constantine approval
                                                  |
                                                  v
                                     approved integration by Main
```

Teams communicate cross-team needs through Main. An IT lead may recommend an
App Team handoff, an Art or Design lead may request implementation support, and
an App lead may request copy, art, or QA, but none of those requests silently
changes ownership. Main records the new owner, exact paths, base/head, blocked
dependencies, and handoff state before work changes lanes.

Idle work is maintenance, not free product scope. It begins with a read-only
audit, stays in an isolated lane, and returns a proposal or patch to Main.
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

Before an owner, reviewer, or task reports `WAITING ON CONSTANTINE`, asks for a
decision, requests review, or repeats an unanswered request, refresh the full
comment thread on the owning issue and linked pull request. Process every newer
comment from `cehinds` as current input and record its permalink and time. If
there is no newer comment, record `NO NEW CONSTANTINE COMMENT` with the checked
time.

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

Main may push and merge explicitly approved, verified routine work to
`origin/dev`. Main may execute an explicitly approved merge from `release` to
`main` after Constantine has accepted the release candidate. These are
integration permissions, not standing approval for an individual change or a
release decision.

The following remain Constantine-only:

- promotion or merge into `release`;
- authorization for a `release` to `main` promotion;
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
