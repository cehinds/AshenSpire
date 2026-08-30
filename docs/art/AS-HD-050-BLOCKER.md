# AS-HD-050 — blocked: the tuple D2 must reconcile is not in this repository

STATUS | BLOCKED / NO WORK PERFORMED / EVIDENCE-LOSS
TICKET | AS-HD-050 (Hub identity `AS-HD-20260826-050`)
SEAT | maker · `lease-AS-HD-050-maker` · exclusive paths `docs/art/**`
RECORDED AT | HEAD `d7c6e4400452e2e32fd0cea2e435037326d5fe18`

## Verdict

The owner decision is recorded and valid. The work it authorizes cannot be started here.
Two independent conditions block it; either alone is sufficient.

Owner decision, verbatim from `.agentops/events/AS-HD-050/AS-HD-050-0003.json`
(`kind=owner-decision`, `actor=owner`, `at=2026-08-29T08:31:22.507Z`):

> Owner-command 'approve' by owner recorded: D2 authorized by the owner: proceed with one
> append-only successor. The sole continuity writer preserves history, validates the exact
> tuple, refreshes the shared index, and writes the pointer LAST; on mismatch only the residual
> routes to Help Desk. Reopens no motif policy or production decision — the PM supersession,
> current register, independent Art reread and Art backlog r7 already match and the body records
> COMPLETE; only the pointer/continuity projection was stale.

## Block 1 — the four-way tuple has no representation in this repository

`DONE-WHEN` requires that "the PM supersession, current register, independent Art reread and Art
backlog r7 remain matched". None of the four is present. Checks run at this HEAD:

| Check | Command | Result |
|---|---|---|
| Art team pointer/backlog | `find . -iname 'POINTER.json' -o -iname 'BACKLOG.json'` (excl. `.git`, `review-approval-hub`) | *(no output)* |
| Physical-ledger workspace | `ls -d teams` | `ls: cannot access 'teams': No such file or directory` |
| Art team directory | `find . -type d -iname 'art'` | *(no output)* |
| `r7` anywhere in tracked content | `grep -ril 'r7' --exclude-dir=.git --exclude-dir=review-approval-hub` | `./AshenSpire.html`, `./dist/AshenSpire.html` (unrelated build strings), `./.agentops/generated/reconstruction/AS-HD-050.wake.txt` (the ticket's own wake golden) |
| `backlog r7` / `pointer-last` phrases | same, phrase-scoped | only `.agentops/work/AS-HD-050/CURRENT.json` and `.agentops/events/AS-HD-050/AS-HD-050-0003.json` — the ticket describing itself |

The only pointer documents in the tree are Game Design's, and both explicitly disclaim being the
source of truth:

- `game-design/docs/TEAM-POINTER.md` — "Canonical source: `teams/game-design/POINTER.json` in the
  physical-ledger workspace. The external physical pointer remains authoritative for active seat,
  revision, writer, and currentness. **Do not infer state from this pointer document.**"
- `game-design/docs/TEAM-BACKLOG.md` — "Canonical source: `teams/game-design/BACKLOG.json` in the
  physical-ledger workspace. … this file is a Markdown discoverability pointer only."

The authoritative ledger is an external physical workspace this repository does not contain, and
there is no Art equivalent of even the Game Design stub. There is nothing here to validate the
exact tuple against, and therefore nothing to reconcile pointer-last. `AS-HD-053`
(`blocker.kind = "evidence-loss"`, "Rebuild durable team continuity so a seat survives a lost
session") is the ticket that would restore it, and it has not.

## Block 2 — the write target is another ticket's active lease

`lease-AS-HD-050-maker` grants `docs/art/**`, which did not exist before this file. The Art
pointer and shared index D2 would refresh do not live there. The nearest real artifacts are
`game-design/docs/TEAM-POINTER.md` and `game-design/docs/TEAM-BACKLOG.md`, held by
`lease-AS-HD-053-help-desk` (`game-design/docs/**`, actor `help-desk`, active until
2026-10-31T23:59:59Z).

Writing them from this seat would violate `must_not: claim-overlapping-active-paths`, which the
maker role carries in `.agentops/governance/roles.json` and which this ticket's capsule repeats.
The one-writer-per-overlapping-path rule is enforced by `opsctl verify`; the collision is real,
not notional.

## What was NOT done, deliberately

- No file under `game-design/docs/**` was read for mutation or modified.
- No pointer, index, register or successor node was written anywhere.
- No `AS-HD-050` lifecycle transition was attempted; the capsule remains `assigned`.
- No claim is made that the tuple does or does not match — it cannot be evaluated here.

## Also recorded: the capsule's `next_action` is stale

`.agentops/work/AS-HD-050/CURRENT.json` still reads "Await the owner authorization for one
append-only successor", and `AS-HD-040`'s reads "Await the owner decision recorded on this
ticket". Both decisions were recorded on 2026-08-29 as seq-0003 events. `opsctl command --apply`
appended the decision event and cleared the blocker but left `next_action` and `lifecycle_state`
untouched, so both wake capsules now instruct their seat to wait for something that already
happened. Re-sealing a capsule is not a maker action; routed here rather than fixed.

## Wake

`it-manager-iii` — to either rebind D2's write target onto whichever lease actually owns the Art
continuity artifacts, or sequence `AS-HD-050` behind `AS-HD-053` so the ledger exists first.
Owner authorization for D2 is already recorded and does not need to be sought again.

ROLLBACK | `git rm docs/art/AS-HD-050-BLOCKER.md`. No other state exists to roll back.
