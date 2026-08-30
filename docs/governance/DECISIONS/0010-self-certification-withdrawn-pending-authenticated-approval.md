# 0010 — Maker self-certification: directive accepted, mechanism withdrawn

**Status:** the owner's directive stands; the implementation is withdrawn pending a
sound approval path.
**Decided by:** it-manager-iii (delegated technical scope and sequencing).
**Supersedes:** the `qa.self_certification` block and the
`itm-to-team-lead-self-certification` envelope, both removed from the corpus.

## The directive

The owner directed that a maker may self-sign Gate A when approved by its team
lead, the lead holding standing approval from the IT Manager III. That decision
is unchanged. What follows is about how it was built, not whether it was wanted.

## Why the implementation was withdrawn

The mechanism recorded the waiver as a `self_certification` field inside the
certifying seat's own work capsule. Every check written against it — and there
were eleven rounds of them — validated fields the maker itself wrote.

Demonstrated on the real corpus: a maker writes a complete, internally
consistent waiver naming its own team's lead into its own capsule and reseals.
The only error is the seal mismatch, and resealing its own capsule is something
the maker is entitled to do. No lead performs any action. No lead-authored
event, signature, or authenticated command is required anywhere.

Two related failures have the same root:

- The candidate's **risk class** lived inside the waiver, so the maker chose it.
  The low/standard bound — the entire safety argument for the policy — was
  applied to a number the constrained party supplied.
- `exact_head` was compared against `base_oid`, which is the assigned base
  rather than the frozen candidate. That either forbids certifying real work or
  binds the waiver to the pre-change tree.

No amount of field validation fixes a record written by the party it
constrains. Eleven rounds of review against this one block, several of them
finding holes in the fix for the previous hole, is the evidence.

## The rule this leaves behind

`qa.rules.independence_is_not_self_recorded`:

> A waiver of independence is never recorded by the party it constrains. Any
> future self-certification mechanism must be carried by a separately
> authenticated action from the approving role, not by a field the certifying
> seat writes into its own capsule and reseals.

## What a sound implementation needs

1. **A lead-authored action, not a maker-authored field.** The `owner-command`
   path already provides an authenticated, compare-and-swap-guarded command
   whose actor is checked against an allowlist. A waiver belongs there.
2. **Risk classified outside the waiver**, bound to the frozen candidate, so the
   allowlist constrains something the certifying seat did not choose.
3. **A frozen candidate head recorded separately from `base_oid`**, so a waiver
   binds to the tree it actually reviewed.

## What was kept

Team leads remain: one persistent lead per team, each with an `actor_id`, the
one team it leads, and a seat name following `P | <role> III | <team> |
Ashenspire`. That is org structure the owner asked for and it stands on its own.
The leads simply hold no waiver over independent QA.

## Honest note on provenance

This defect was found by an automated reviewer, not by the author. The author
wrote the mechanism, declared it checked at every round, and reported to the
owner three times that high-risk work was protected by a bound that was not in
fact enforced at runtime until very late. That record is part of why the
mechanism is withdrawn rather than patched again.

---

## Addendum: this branch must not be squash-merged

Recorded during review, after an automated reviewer twice reported that the work
capsules' `base_oid` was unreachable from the commit it was reviewing.

The reachability failure does not hold against the submitted history: each
capsule's base is the immediate parent of the branch head and is an ancestor of
both the branch and `refs/pull/423/merge`. The reviewer was testing against a
**squash preview** — a synthetic single-parent child of the base branch tip —
in which no branch commit can be an ancestor by construction.

But the observation points at something real. A capsule records the exact commit
its instructions were written against. If this branch is **squash-merged**, every
one of those commits ceases to exist in the default history, and each capsule's
`base_oid` becomes unreachable from `dev`: a clean clone could no longer
reconstruct the state a seat was told to work from, which is the property the
reconstruction drill exists to guarantee.

**Therefore: merge this branch with a merge commit, never a squash.** That is
already the repository's convention, and `git-ownership.branch_hygiene` prefers
history-preserving updates for the same reason. This is the first time the
consequence of the alternative has been written down.

The general constraint, beyond this branch: any branch carrying work capsules
must be integrated in a way that preserves the commits those capsules name.
