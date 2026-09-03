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

**May a merge republish the builds site, and under which of three models?**
Review showed that A and B are not variations on one ask — they differ in what
`release` and `main` do — so this record asks the question and does not answer
it. A ruling that does not name **A**, **B** or **C** approves nothing — and a
ruling of A must also name its listener treatment, **A-review** or
**A-accept**, because those two differ in whether a future change to the
publishing workflow itself carries publication authority.

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

### Two defects review found in the proposal above, and what they cost

Codex raised both as P1 on #581. I checked each against the builder rather than
taking them on trust. **Both hold.**

**1. The site is one indivisible artifact, so the table's promise cannot be kept
as written.** `tools/pages-site.mjs:160-163` archives **main's whole tree** as
the base of `_site`; `BRANCHES` defaults to all four; `refFor()` resolves each
branch's CURRENT head with no pinning. A deploy triggered by a `dev` push
therefore republishes main's tree and release's index as they stand at that
moment. **If Constantine has merged to `main` and not yet dispatched, the next
`dev` push publishes that content for him.** The row promising `release` and
`main` republish only on his dispatch is, against this builder, false — and it
was the row that made his narrowing the safe option.

**2. The artifact is built from the pushed branch's own code.** The assemble job
checks out the pushed ref unpinned, so a push to `dev` that edits
`tools/pages-site.mjs` or the workflow controls what `_site` contains, including
the root, `main` and `release` paths. Moving the credential to a default-branch
`workflow_run` protects the *token* and does nothing about *what gets deployed*.
The listener must rebuild with default-branch code. The workflow I wrote and
deleted did re-assemble that way; the prose did not say so, and prose is what a
decision record is.

### So the choice is narrower than it looked

- **A — pin what the owner published.** Automatic republication builds `main`
  and `release` from the SHAs he LAST PUBLISHED, recorded in-repo; only `dev`
  and `test` track their heads. His dispatch advances the pins. Keeps the
  promise exactly. Needs `pages-site.mjs` to accept explicit refs plus a small
  published-state file — real work, not a config change.
- **B — accept whole-site republication and say so.** Drop the promise.
  Automatic republication re-renders the whole site including `main` and
  `release` as they currently stand; what it never does is decide what goes on
  those branches. Cheap, honest, and a genuine widening of what he agreed to —
  which is why it is written here rather than assumed.
- **C — decline.** As below.

**A is what his narrowing actually asked for. B is what today's builder can do.**
This record does not choose between them.

### The promotion chain, as he stated it

`local → origin feature/* → dev → test → release → main`, with `main` his.

| Hop | Who | Status |
|---|---|---|
| local → `origin feature/*` | the seat doing the work | unchanged — AGENTS.md already holds "reversible, collision-free local work proceeds without approval", and push is a protected transition needing its own authority |
| `feature/*` → `dev` | any seat, normal reviewable PR | unchanged |
| `dev` → `test` | agent-mergeable under Gate C | **unchanged** — his standing directive, and 0009 delegates the exact fast-forward |
| `test` → `release` | **Constantine alone** | 0009 Gate F. Note this differs from how `release` has actually been cut, which was `dev → release` (F-19, F-23) |
| `release` → `main` | **Constantine alone** | 0009 Gate F |

Two things in that table need his eye rather than my assumption:

- **`test → release` vs `dev → release`.** Every release cut recorded so far is
  `dev → release`; F-19 and F-23 both name it that way. His chain puts `release`
  downstream of `test`. That is a stricter and more coherent line — a release
  would then only ever contain what QA accepted — but it is a change to how the
  cut has been performed, not a restatement, and it is his to make.
- **`feature/*` is not what the branches are called.** `git-ownership.json`
  grants `claude/*` and `recovery/*`; today's work also lands on `codex/*`. If
  `feature/*` is a rename he wants, it is a separate change to that contract and
  to every seat's branch convention. If it is shorthand for "the feature
  branches", nothing needs doing. Recorded rather than guessed.

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
  `workflow_run` from the default branch, never a `push` trigger — **and it must
  rebuild `_site` itself with default-branch code.** Deploying an artifact a
  branch assembled would let a push to `dev` replace root, `main` and `release`
  content whatever the credential arrangement. That is defect 2.
- **Under option A, advancing the pins is itself a repository write, and it needs
  its own authority.** Codex raised this as a third P1. The published-state file
  has to be updated when the owner dispatches, which is a commit and a push —
  a protected transition in its own right under AGENTS.md, and one this
  amendment does not grant. An implementation would therefore either INFER
  permission for that write from the dispatch, which is the substitution this
  whole record exists to refuse, or fail to persist the pins and quietly stop
  being option A. So a ruling of A must also **name the state ref and authorize
  its update**. The record proposed `.agentops/governance/pages-published.json`
  on `main` — and Codex found that this collides with a second invariant, path
  ownership, which is independent of the write authority above.
  `git-ownership.json` assigns `.agentops/governance/**` to **it-manager-iii**,
  so the owner's dispatch cannot be its sole writer there.

  **Checking that turned up something larger than the collision.** No path in
  `git-ownership.json` is owned by `owner` — not one. The contract has twenty-three
  path entries and every one of them belongs to a working role. So there is
  nowhere in the repository the owner's own dispatch may write, and option A
  needs a path that does not currently exist as a concept.

  So a ruling of A must settle three things about the pin file, not one: **where
  it lives, who owns that path, and who may write it.** Two shapes are available
  and neither is mine to pick — add an `owner`-owned path entry to
  `git-ownership.json` for exactly this file, which introduces the first one and
  should be done deliberately if at all; or place the file in the
  `it-manager-iii` governance lane it already fits and have that seat write it on
  the owner's dispatch, which keeps the ownership contract untouched but puts a
  deputy's hand on the record of what the owner published.
- **The listener's own definition cannot be pinned, and option A has to say so
  rather than imply otherwise.** Codex found the contradiction: a `workflow_run`
  listener must live on the default branch to fire at all, and GitHub selects
  the workflow file *as it stands there* before any step runs. Checking out a
  pinned builder inside that run cannot roll back the YAML, the `permissions:`
  block, or the steps already chosen. So a change to the listener landing on
  `main` after the last dispatch takes effect on the very next `dev` push,
  pinned content and pinned builder notwithstanding.

  **This is a limit, not a gap I can close.** The two honest mitigations are
  both outside this file, they are **materially different**, and a ruling of A
  must name which one it means:

  - **A-review** — require the owner's review on the listener path
    specifically. `.github/workflows/**` is `app-dev-iii`'s lane today, so this
    is a repository-settings change, not a contract edit, and it is a second act
    after the ruling rather than something the amendment performs.

    **It takes two pieces, and an earlier draft of this record said "branch
    protection *or* CODEOWNERS" as though either would do.** Codex raised it as
    a P1 and it is right. A `CODEOWNERS` entry on its own only *requests* the
    named reviewer; it does not stop the pull request merging without them. The
    block comes from a branch-protection rule or ruleset on the default branch
    that requires a pull request **and** requires review from Code Owners. So
    CODEOWNERS is the routing and the rule is the enforcement, and A-review needs
    both — or an equivalent that actually refuses the merge. With only the first,
    the sentence below would have been false while reading as though the hole
    were closed, which is worse than leaving it open and saying so.

    **Neither piece exists today:** there is no `CODEOWNERS` file anywhere in
    this repository, and this record does not assert what the default branch's
    protection currently requires, because that is a repository setting and is
    not readable from the tree.

    **A-REVIEW IS NOT IMPLEMENTABLE ON TODAY'S SETUP, AND THIS RECORD HAD TO
    BE TOLD SO TWICE.** Codex raised two further P1s, and the second is the
    one that matters:

    - **A shared account cannot approve its own pull request.**
      `.agentops/scheduler/config.json` records that Constantine and every seat
      authenticate as the single GitHub account `cehinds` (#434), and GitHub
      refuses to let a pull request's author approve it. Requiring that
      account's Code Owner approval on `.github/workflows/**` therefore does
      not gate listener changes — it makes every agent-authored one
      **permanently unmergeable**. The repository had already written this
      trap down, in that same file: an exception "written in terms of one
      [GitHub approval] would read as a relaxation while stalling every merge
      exactly as before." A-review walked into it one level up.

      So A-review needs a **distinct reviewing identity** — #434's fix 3,
      which does not exist — or an owner gate that is not a pull-request
      approval at all (a required status only the owner can satisfy, a
      push restriction on the path, a ruleset bypass list). Naming which is
      part of ruling A-review, and until one exists **A-review is blocked,
      not merely unbuilt.**

    - **The CODEOWNERS rule must own itself.** Assigning the owner to
      `.github/workflows/**` alone leaves the entry itself unguarded: a
      separate pull request can delete or weaken that line without touching
      any owner-owned path, and the next listener change is then ungated.
      GitHub's own Code Owners guidance recommends assigning ownership of the
      `CODEOWNERS` file or its directory for exactly this reason. A-review must
      therefore give the owner `/.github/CODEOWNERS` as well as the listener
      path.

    - **And that file cannot be created until the control plane owns its
      path.** Codex raised this third, and it is a wall before the first step
      rather than a gap in the design. `.agentops/governance/git-ownership.json`
      carries `.github/workflows/**` (`app-dev-iii`) and
      `.github/ISSUE_TEMPLATE/**` (`help-desk`); **`.github/CODEOWNERS` matches
      neither glob and is owned by nobody.** Under the D5 path-grant rule an
      unowned path cannot receive a legal writer lease, so no seat may create
      the file, and the positive merge test is unreachable.

      This repository has met that wall before at the same address — the note
      on the `.github/workflows/**` entry records it being declared on
      2026-08-30 "because it was owned by nobody: under the D5 path-grant rule
      no lease could legally grant it."

      So a ruling of A-review must **also** amend `git-ownership.json` with an
      exact entry for `.github/CODEOWNERS` and a serialized lane, before the
      file is written.

      **A draft of this record went on to forbid `app-dev-iii` as that owner,
      and that was wrong.** Codex: it conflates two independent layers.
      `git-ownership.json` says who may *author* a change; the `CODEOWNERS`
      entry and the branch rule say who must *approve* the merge. Since `dev`
      is pr-only and `main` is protected, an `app-dev-iii` seat holding the
      write lease still could not land a weakening without the owner's
      approval — so the hinge is closed by CODEOWNERS covering itself, not by
      withholding the lease. Requiring an `owner`-owned path invents a new
      control-plane concept this gate does not need, and would block an
      otherwise valid implementation.

      The lane is therefore an ordinary assignment and `app-dev-iii` — which
      already owns `.github/workflows/**` — is the natural one. **With one
      condition, because it is the whole reason the layers can be separated:**
      the separation holds only while the enforcing branch rule is actually in
      place. Without it, nothing requires an approval and the write lease
      becomes the only gate there is, at which point the writer of
      `CODEOWNERS` is the writer of the rule. That is why the satisfaction
      test's second arm — an unreviewed weakening of `CODEOWNERS` is refused —
      is not a formality.

      *(Option A's pin file is a separate question and still needs an answer:
      that one has no GitHub-side gate standing behind it, so it does not get
      this argument.)*

    **Verification is two-sided, and an earlier draft of this record gave only
    one side.** "An unreviewed merge is refused" passes just as happily against
    a brick wall as against a working gate — it is the deadlock above wearing a
    green tick. A-review is satisfied only when **both** hold: an unreviewed
    listener change is refused, an unreviewed attempt to weaken `CODEOWNERS` is
    refused, **and** an authorised listener change can actually merge.

    With all of that in place, a listener change reaches the default branch
    only with the owner's sign-off, so the publication it carries was
    authorised at the point the change landed.
  - **A-accept** — accept that changes to that one file publish on the next
    `dev`/`test` push, and say so where a reader will meet it. Nothing outside
    this record changes; the exposure is written down instead of closed.

  Option A is therefore "everything except the listener itself is pinned", and
  pretending otherwise would be the same overclaim this record has already had
  to withdraw twice. **Neither treatment is the default.** Codex raised this as
  a further P1: an approval row that says only "A" leaves an implementer to
  infer whether future listener changes carry publication authority, and
  inferred Pages authority is the substitution this whole record exists to
  refuse.
- Under option A, `main` and `release` are built from the owner's last-published
  SHAs rather than their heads — **and so is the generator.** Codex raised this
  as a second P1 and it closes a channel the content pins leave open: if `main`
  gains a change to `tools/pages-site.mjs` or to the listener after the last
  dispatch, the next automatic `dev` push runs that NEW default-branch code and
  publishes what it renders, pinned content or not. Option A therefore pins the
  builder revision alongside the content refs, and the owner's dispatch is what
  advances both. Pinning what is rendered while letting the renderer move is not
  option A; it is option B with extra steps.
- **Everything else in Gate F is untouched:** `main` and `release` mutation,
  tags, release publication, Pages source, and final release-readiness stay
  the owner's, per act.

**Option C — decline entirely.** #553 stays open, the staleness report #578
landed stands as the mitigation, and the site is current whenever Constantine
chooses to make it so. This remains a legitimate outcome and the record should
not read as though it is not.

## What happens on approval

**The ruling must name A, B or C — and, for A, the listener treatment too.**
Codex raised this as a P1 and it is right:
A and B are mutually exclusive and differ precisely in what happens to `release`
and `main`, so "approved" without a letter would leave the contract amendment
and the workflow with nothing authoritative to match — and whole-site
publication could then be *inferred* from an ambiguous approval. AGENTS.md is
the standing rule here: protected Pages actions need their own exact authority,
and `UNKNOWN` is never approval. A ruling that does not name a model is `WAIT`,
not a pass.

**The three outcomes are not one procedure.** Codex raised this too: the
paragraph that followed used to say "amend the contract, mark Approved, write
the workflow" for whatever was ruled — including C, which declines. A protected
Pages change could then have been inferred from a ruling that *rejected* it,
which is the same failure as the ambiguous approval above wearing a different
hat. So:

| Ruling | What happens |
|---|---|
| **A-review** | **BLOCKED TODAY — see below; ruling it selects a model but cannot be executed yet.** Amend `promotion-gates.json` to model A — the republication grant, the pinned builder revision, and the named state ref with its write authority, all three. Status becomes **Approved (A-review), pending its gate**. **Before** the workflow is written, an owner gate on the listener path must exist and be shown to work, by exactly one of the two arms below. `git-ownership.json` must gain an exact owner and serialized lane for `.github/CODEOWNERS` under the Code-Owner arm — that path is owned by nobody today and so is uncreatable under the D5 path-grant rule. Then the workflow. |
| ↳ *arm 1: Code Owner review* | **Requires a distinct reviewing identity first (#434 fix 3, which does not exist) — as, it turns out, does arm 2; see below.** `CODEOWNERS` entries naming that identity for `.github/workflows/**` **and** `/.github/CODEOWNERS`, plus a branch-protection rule or ruleset on the default branch requiring a pull request and Code Owner review — CODEOWNERS alone only requests a reviewer. **Do not install this arm on the shared `cehinds` account:** GitHub will not let a pull request's author approve it, so the approval is unobtainable and every agent-authored listener change becomes permanently unmergeable. Satisfied when: an unreviewed listener change is refused, an unreviewed weakening of `CODEOWNERS` is refused, and an authorised listener change still merges. |
| ↳ *arm 2: a non-approval owner gate* | A gate that does not route through pull-request approval — a required status check only the owner can satisfy, a push restriction on `.github/workflows/**`, or a ruleset bypass list. **This arm requires no `CODEOWNERS` file at all**, and an earlier draft of this table wrongly demanded one anyway, reimposing the very deadlock the arm exists to avoid. **It also does not escape the identity problem, which an earlier draft claimed it did.** Codex raised both. A bypass list, a push allowance and a status check all name an *actor*, and every seat authenticates as `cehinds` exactly as Constantine does — so naming him admits every agent too, and the gate passes for the pushes it exists to stop. Satisfied when: an unauthorised listener change is refused, the gate's own configuration cannot be weakened without tripping it, and an owner-authorised listener change still merges — **the first of which no shared-actor configuration can deliver.** |
| ↳ **what both arms turn out to need** | **A credential the agents do not hold.** Arm 1 needs a distinct identity to approve; arm 2 needs one to be distinguishable from. GitHub decides both by actor, and the actor is the same. **So the two arms are not an alternative between a hard path and an easy one — they are two spellings of one prerequisite**, and A-review is blocked behind #434 fix 3 whichever is chosen. The choice between them is only how the gate is expressed once that identity exists. Recorded plainly because three review rounds were spent finding this at three different addresses, and a reader deciding between A-accept, B and C should not have to rediscover it a fourth time. |
| **A-accept** | The same three amendments, plus one sentence in `promotion-gates.json` recording that a change to the listener file itself publishes on the next `dev`/`test` push with no further authority. Status becomes **Approved (A-accept)**. Then the workflow. |
| **A**, bare | **`WAIT`, not a pass.** A names the model but not the listener treatment, and the two differ in whether a future listener change carries publication authority. Nothing is amended and no workflow is written until the treatment is named. |
| **B** | Amend `promotion-gates.json` to model B — republication only, and the record states plainly that `main` and `release` republish with everything else. Status becomes **Approved (B)**. Then the workflow. |
| **C** | **Nothing is amended and no workflow is written.** Status becomes **Declined**, #553 stays open, and #578's staleness report remains the mitigation. The contract is untouched, because C is the ruling that it should be. |

No implementing code merges before the ruling under any of the three; the two
attempts that preceded this record were reverted in full and are not sitting on
a branch waiting.

## Rollback

**Not by reverting this record.** Codex raised two things about the first
draft of this section and both hold.

`DECISIONS/README.md` opens with the rule: *"Decisions are append-only records.
Correct an approved decision with a new record that names what it supersedes;
do not silently rewrite history."* Reverting an Approved 0012 would delete the
fact that it was approved, which is the one thing a decision record exists to
preserve.

And undoing it is itself a **Pages mechanism change** — removing the listener
alters how the site is published, which is a Gate F action needing its own
exact authority. Reverting a record does not carry that authority any more than
approving one did.

So rollback, once A or B is live, is two separate acts:

1. **A new decision** appended after 0012, naming it as superseded and saying
   what the mechanism returns to. 0012 stays in the index with its ruling
   intact.
2. **A separately owner-authorized Pages action** to remove the listener and
   return the site to owner-dispatch republication.

While 0012 is still **Proposed**, none of that applies: nothing is in force,
nothing is deployed, and closing #581 unmerged leaves the repository exactly as
it is today.
