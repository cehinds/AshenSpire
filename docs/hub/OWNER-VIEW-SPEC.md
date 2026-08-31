# What the Hub migration dropped

Ticket: AS-HD-056 · seat: maker · lease: `lease-AS-HD-056-maker` (paths `docs/hub/**`)

**Status: this document is a loss record, not a specification.**

It was written as a spec for a regenerable owner view. That view already existed: PR #401
shipped `renderHubSite` (`.agentops/tools/opsctl.mjs`), which generates
`.agentops/generated/hub/{index,decisions,help-desk,seats}.html` plus a page per ticket,
deterministically from validated `.agentops/` state and drift-gated by `opsctl verify` — the
same mechanism that keeps the Owner HUD honest. The spec proposed work that was done.

What is worth keeping is the other half of the audit: the inventory of what the committed
Hub carried that the replacement cannot, because the evidence behind it does not exist in
this repository. That is recorded below so it is not rediscovered as breakage.

## The replacement, and what it carries

`.agentops/generated/hub/` — Overview (*Needs you now*, *Every ticket*), Decisions, Help desk,
Seats & teams, and one page per ticket. Its own footer states the contract: *"Read-only. Every
figure here is derived from validated repository state; nothing on this page is hand-maintained."*

Its Overview correctly reads **"Nothing is waiting on constantine"** — the fact the committed
Hub got wrong, and the reason this ticket existed.

## Carried forward

| Hub section | Where it lives now |
|---|---|
| Action Required From Constantine | *Needs you now*, projected from `work/*/CURRENT.json` `.blocker` and `hierarchy.json` routing |
| Recently Completed — decisions | `decisions.html`, from `events/*/*.json` `kind=owner-decision` |
| Help Desk queue | `help-desk.html` |
| Teams / Role reference | `seats.html`, from `roles.json`, `hierarchy.json`, `raci.json` |
| Per-ticket detail | `tickets/AS-*.html` |

## Not carried, and unrecoverable

Each of these depends on evidence absent from this repository. None is a defect in the
replacement; a deterministic renderer cannot project a source that does not exist.

**1. Six ticket bodies.** `-016`, `-023`, `-032/-037`, `-041`, `-042`, `-043`, and
`CLASS FACELIFT4` have no `work/<ticket>/CURRENT.json`. Their option sets, recommendations,
consequence statements and authority packets exist only as compiled prose in
`review-approval-hub/index.html`, `review-approval-hub/actions/*.html` (5 pages) and
`review-approval-hub/reviews/*.html` (7 pages). Re-sealing any of them is hand authorship
from that HTML, by whoever holds the authority for it.

**2. Eight of ten decision receipts.** Only `AS-HD-040-0003` and `AS-HD-050-0003` exist as
events. The save-compatibility Option-2 selection, the HUD-data approval, the text-only
Reaver proof approval, the production-lane activation, the 30-day retention selection, the
hybrid-exploration selection and two superseded receipts have no event, no capsule, and no
resolvable hash here. Whether they were genuinely made cannot be confirmed or denied from
this repository.

**3. The 13-team / 52-seat rotation matrix.** Per-seat classification, old and successor task
IDs, `session-rNNNN.json` node hashes, pointer hashes. `find . -name 'session-r*.json'` returns
**0**. The 13 `origin/<team>/team-ledger/<team>` branches do not exist. `AS-HD-054`
(`blocker.kind: evidence-loss`) is the ticket that would re-seal the census.

**4. The Help Desk 13/53 inventory.** `review-approval-hub/help-desk/index.html` renders a
"frozen 51-row inventory plus two live additions" with no counterpart in `.agentops/`. If those
53 were real, the generated `help-desk.html` under-reports the project's true load.

**5. Roughly forty truncated SHA-256 receipt pointers** — packet `99814105…0A43`, Event 0001
`7B3FF9F9…9620`, control `6A810333…DAF74`, addendum `936C2DD1…609C`, PM 52-seat JSON
`6C79F1CF…12F2`, aggregate `5EEBA3FD…89E6D`, and others. Six were sampled; none resolves to any
object outside `review-approval-hub/`. Truncated to 8+4 hex digits, they cannot be bound to an
exact object even with full history.

**6. Live-readback facts.** PR state, Pages build status, hosted-endpoint verification. These
were API reads at a wall-clock instant. `evidence.json` declares no producer that would record
them, and a deterministic renderer must not assert them — a stale "0 open PRs · Pages built"
standing as fact is precisely how the committed Hub misled.

**7. The editorial voice.** The Hub explained each decision in the owner's language: options,
recommendation, consequence, what approval does and does not authorize. The control plane holds
structure, not argument. The generated view is materially colder to read. That is a real
regression, not a neutral trade, and no amount of rendering recovers it.

## Two faults in the still-published Hub

Both were reported by the owner and confirmed. Neither is fixable in place —
`review-approval-hub/**` is build output with no source on any ref, and a hand edit would be
clobbered by any regeneration.

1. **It asks for decisions already made.** Masthead: `2 owner decisions — Art D1 + D2 · unapproved`,
   frozen at `28 Aug · 10:04 AKDT`. Both were approved 2026-08-29
   (`AS-HD-040-0003` at `08:36:51.270Z`, `AS-HD-050-0003` at `08:31:22.507Z`).
2. **Two back-links land on the game.** `reviews/as-hd-20260826-050-decision-debt.html` and
   `reviews/as-hd-20260826-053-context-rotation.html` use `../../index.html`; `reviews/` is one
   directory deep, so that resolves to the Pages root, which serves the game. The other ten
   subpages use `../index.html` correctly. The two broken pages are Decision debt — which lists
   D1 and D2 — and Context Rotation.

## Owner decision on the record

Constantine, asked what should happen to the published Hub, chose: **redirect
`/review-approval-hub/` to the generated hub**, so the URL keeps working and the orphan stops
being served. Execution is owner-exclusive — `AUTHORITY.md` gives `it-manager-iii`
`must_not: change Pages source` — and is tracked on issue #396.

## What must move, not be rebuilt

`review-approval-hub/evidence/**` (20 entries) and `review-approval-hub/qa-evidence/**` (7) are
primary PNG evidence, the only Hub content that is not a rendering of something else. They must
be `git mv`'d, not regenerated. Bytes and therefore SHA-256 bindings survive a move:
`assets/classes/SILHOUETTE-SUCCESSOR-CONTRACT.md` depends on 12 of them by hash and would need
only its path column re-pointed.

## Cost of removing the orphan

1457 files / 139 MB out of the working tree. History retains the bytes, so clone size is
unchanged; a real reduction needs a history rewrite, which is forbidden here and not worth it
for this.
