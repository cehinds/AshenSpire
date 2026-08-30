# 0005 — Dev delivery, promotion readiness, and Pages source

- Decision status: **Approved**
- Policy effective condition: independently reviewed governance head contained
  in fresh canonical `dev`
- Decision owner: Main
- Initiative: `AS-HD-20260826-021`
- Snapshot date: `2026-08-26` (`America/Anchorage`)

## Decision

### Main's standing discretion for `dev`

Main has standing discretion, not an automatic duty, to choose `WAIT` or to
deliver genuinely independent completed work to `dev`. Delivery uses the normal
reviewable process: push the immutable topic head, open or update its pull
request, complete current review and checks, and merge through the pull request.
It does not authorize a direct push to `dev`.

Main may deliver only when every item below is `PASS` at the same exact head:

1. dependencies and required decisions are resolved;
2. the work is independent of unfinished delivery and has no shared source,
   test, documentation, generated-artifact, browser, or Pages-lane collision;
3. the named maker has completed the approved scope;
4. the candidate is an immutable exact head;
5. required independent Functional QA, Experience QA when applicable, and
   repository gates are complete at that head;
6. fresh canonical `dev`, candidate head, pull-request head, mergeability, and
   required CI have been checked;
7. scope and acceptance have not changed since candidate freeze; and
8. exact evidence and delivery facts are recorded in the ticket.

The independence checklist result is `PASS`, `FAIL`, or `UNKNOWN`. `FAIL` and
`UNKNOWN` require `WAIT`. Main may also choose `WAIT` after a `PASS` for
sequencing, risk, capacity, or integration reasons. The receipt records the
rationale, blocking or retry trigger, and smallest next action. Waiting does
not authorize idle implementation or a speculative replacement patch.

### Test and release promotion readiness

After a strong QA playtest at an exact candidate, Main may declare the
**promotion packet ready for Constantine review** and submit it. This means the
candidate and evidence packet are ready to be considered; it is not a claim
that the product is release-ready and grants no promotion authority.

Constantine alone approves and performs mutation of `test`, `release`, or
`main`, release-branch merges, tags, release publication, and final release
readiness. Authority for one action does not imply authority for another.

### Future Pages source

The desired future Pages source is `main`. No source switch is authorized by
this decision. A switch may occur only in an explicitly Constantine-authorized
change window after an exact candidate reaches `main` and the packet records:

- the exact `main` commit, artifact path, SHA-256, build, and source receipt;
- the intended Pages source and the prior source required for rollback;
- the successful Pages deployment and its exact run/commit evidence;
- hosted live smoke and strong playtest results against the deployed URL; and
- the rollback command or configuration change, trigger, responsible actor,
  and authority to restore the prior Pages source.

The source change is not complete until deployment and hosted verification
pass. A failed deployment or hosted check triggers the recorded rollback; it
does not authorize a different source, artifact, or release action.

## Dated evidence snapshot

This table is historical evidence for the ruling, not evergreen branch or
deployment truth:

| Surface | Observed value on 2026-08-26 |
|---|---|
| `dev` | `0187efd30320a0745241d480b8d7055b292086c3` |
| `main` | `ba2716979dc099129183f7153f47c6da7a6c60b8` |
| `test` | `ba2716979dc099129183f7153f47c6da7a6c60b8` |
| `release` | `c0713d34d1777c2719bb780b3f7c4b1715bb2dc5` |
| Pages legacy source | `dev` branch, repository root (`/`) |
| Pages development URL | `https://cehinds.github.io/AshenSpire/AshenSpire.html` |

Every delivery or promotion decision refreshes live branch heads, pull-request
state, Pages configuration, deployed commit, and hosted artifact. This snapshot
must never be used to infer their current values.

## Promotion packet

The durable ticket records or links all of the following:

1. ticket and decision IDs, requested action, decision owner, and exact new
   authority requested;
2. evidence timestamp and fresh exact `dev`, `test`, `release`, and `main`
   heads;
3. candidate base/head, pull request, reviewed head, merge commit when present,
   mergeability, required review, and CI results;
4. dependency result, claimed paths and serialized lanes, collision search,
   and the itemized independence checklist result;
5. approved scope/acceptance, maker completion receipt, independent reviewers,
   QA stages, gates, and unresolved findings or exceptions;
6. exact artifact path, SHA-256, build/version, source receipt, generation
   provenance, and byte-identity result;
7. strong playtest matrix, environment, player flows, result, and evidence;
8. current and desired Pages source, deployment run/commit, hosted URL,
   deployed artifact/hash/source, and hosted smoke/playtest result;
9. rollback target, prior Pages source or branch state, exact procedure,
   trigger, recovery consequence, responsible actor, and required authority;
10. Main's `WAIT` or delivery recommendation, rationale, smallest next action,
    and the exact Constantine action requested.

Missing, contradictory, stale, or unverified fields are `UNKNOWN` and block the
associated delivery or promotion action.

## Rollback or supersession

Before activation, revert this bounded governance change. After activation,
append a superseding decision; do not rewrite this approval or its dated
snapshot. Reversing an authorized branch, Pages, tag, publication, or release
action requires action-specific authority and the recorded rollback packet.
