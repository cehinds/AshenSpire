# AshenSpire development coordination workflow

This is the AshenSpire-side operating contract for routine development, status
reporting, cross-family handoffs, and release-quality boundaries. It records the
project-specific additions requested by [issue #184](https://github.com/cehinds/AshenSpire/issues/184)
under the parent experience story [#185](https://github.com/cehinds/AshenSpire/issues/185).

It does not authorize a release, a release-branch merge, a tag, a deployment,
or a change to release readiness.

## Authority and ownership

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
