# 0012 — Republishing the builds site is not a release publication

- **Decision status:** **PROPOSED — awaiting Constantine.** Nothing in this
  record is in force until he rules. No code implementing it may merge first.
- **Prepared by:** it-manager-iii, Integration & Delivery.
- **Decided by:** Constantine. Gate F is owner-exclusive and
  `owner_gates_are_owner_exclusive` says it "cannot be delegated, waived or
  satisfied by a deputy" — so a deputy cannot propose himself into it either.
  This record asks; it does not assume.
- **Ticket:** [#553](https://github.com/cehinds/AshenSpire/issues/553).
- **Supersedes:** nothing yet. If approved it amends decision 0009's Gate F and
  `.agentops/governance/promotion-gates.json` in the one bounded way below.

## The ask, in one sentence

Let a merge to **`dev` or `test`** automatically republish the **builds site**.
`release` and `main` keep republishing only on Constantine's dispatch, and
every other Pages and release action stays exactly as it is: his, per
individual act.

## Why this is being asked

#543 correctly took the Pages deploy credential off the push path: on a push,
the workflow file that push carries is the one that runs, so a guard written
inside it is a guard the pusher can delete in the same commit. That fix is not
in question and this record does not reopen it.

Its cost was #553. Since 2026-09-02 04:20Z nothing has republished, so `/dev`,
`/test` and `/release` have served builds older than the work they claim to
show — including all of `rc.4`. #578 landed a report that says so on every
build. A report is not a fix; it makes the staleness visible and leaves the
chore.

**Twice I tried to fix it by making publication automatic behind a switch, and
both attempts were refused on review — correctly.** The contract is not
ambiguous:

> `separate_actions`: [... "Pages source or deployment" ...],
> `authority_is_per_action: true`
>
> `no_implied_authority` — "No gate grants main, release, tag, publication or
> Pages authority except Gate F, and there only **per individual action**."
>
> `owner_gates_are_owner_exclusive` — Gates E and F "cannot be **delegated,
> waived or satisfied by a deputy**."

A standing switch is a delegation to every future push. So the question is not
how to build it. The question is whether the rule should say something
different, and that question is Constantine's.

## The argument for, stated as strongly as it deserves

The invariant exists so that **merging is never the same event as releasing.**
That is a good invariant and nothing here weakens it.

The builds site is not a release. It is an index of builds that **already
exist on branches that already exist**. `/release/` shows what the `release`
branch already holds — and the decision to put a build on `release` was Gate
F, made by Constantine, at the time. Republishing the index does not decide
anything; it re-renders a decision already made. The site is a window, and the
window being stale does not make the room safer.

Under that reading, automatic republication publishes **no build the owner has
not already placed on its branch**, and the per-action authority still governs
the act that actually matters: putting a build on `release` at all.

## The argument against, which is not weak

Three honest objections, none of which I can dismiss:

1. **The site is public.** Whatever the internal reasoning, republishing pushes
   bytes to a public URL without a human in the loop. "It only shows what is
   already on a branch" is a claim about intent; the bytes are still published.
2. **`main` is in the trigger list.** `main` is the release-facing branch and
   project.json describes Pages as serving the released state. Auto-publishing
   `main` is closer to a release publication than auto-publishing `dev` is.
3. **It is the thin end.** The next request will be "and the artifact", then
   "and the tag". A rule that bends once is easier to bend again, and the
   value of `authority_is_per_action` is precisely that it has not bent.

## What is proposed, exactly

Constantine narrowed this himself on 2026-09-02, and the narrowing answers
objection 2 rather than arguing with it: **`dev` and `test` republish
automatically; `release` and `main` stay his call.** That is what this record
proposes. It is deliberately not the broader version I first drafted.

Two different things are settled here and they should not be run together:

### Republishing the site

| Branch | Republishes | Why |
|---|---|---|
| `dev` | **automatically, on push** | the development line; a stale view of it helps nobody and risks nothing |
| `test` | **automatically, on push** | QA reads this to accept a candidate, so stale is actively harmful — Gate D acceptance is evidence-at-a-SHA and a stale window undermines it |
| `release` | **owner's dispatch** | release-facing; objection 2 stands here |
| `main` | **owner's dispatch** | project.json describes Pages as serving the released state; the closest thing to a release publication in the list |

### Merging between branches — unchanged, restated because he raised it

| Transition | Who | Status |
|---|---|---|
| into `dev` | any seat, through the normal reviewable PR | already the rule (0005, 0009 Gate B) |
| `dev → test` | agent-mergeable under Gate C | **already the rule** — his standing directive, and 0009 delegates the exact fast-forward |
| `dev → release` | **Constantine alone** | already the rule (0009 Gate F, F-19/F-23) |
| anything → `main` | **Constantine alone** | already the rule (0009 Gate F) |

Nothing in that second table changes. He confirmed it; this record writes it
down beside the publication rule so the two are never conflated again — a merge
to `test` being automatic has never implied anything about publishing, and
after this record it implies exactly one thing: the `test` view refreshes.

### The contract amendment

- Gate F keeps `authority_is_per_action: true` for every listed action.
  **"Pages source or deployment" splits** into:
  - **"Pages source"** — which branch or workflow serves the site at all.
    **Unchanged: owner-exclusive, per individual action.**
  - **"builds-site republication"** — re-rendering the index from branches as
    they already stand. **Automatic for `dev` and `test` only.**
- Republication runs only after a successful assemble, so a site whose drift
  plant went unproven is never deployed.
- The workflow holding the credential must be one a push cannot rewrite —
  `workflow_run` from the default branch, never a `push` trigger.
- **Everything else in Gate F is untouched:** `main` and `release` mutation,
  tags, release publication, Pages source, and final release-readiness stay
  the owner's, per act.

**Option C:** decline entirely. #553 stays open, the staleness report #578
landed stands as the mitigation, and the site is current whenever Constantine
chooses to make it so. This remains a legitimate outcome and the record should
not read as though it is not.

## What happens on approval

`.agentops/governance/promotion-gates.json` is amended, this record's status
becomes Approved, and the workflow is written to match — in that order. No
implementing code merges before the ruling; the two attempts that preceded this
record were reverted in full and are not sitting on a branch waiting.

## Rollback

Revert this record and the contract amendment, and delete the listener. The
site returns to owner-dispatch republication with nothing else changed, because
nothing else was changed.
