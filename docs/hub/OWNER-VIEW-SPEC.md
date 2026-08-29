# Owner View — specification for a regenerable replacement for the Review & Approval Hub

Ticket: AS-HD-056 · seat: maker · lease: `lease-AS-HD-056-maker` (paths `docs/hub/**`)
Audited at HEAD `dfff52fbff06fc8435709a6f03129d940b4422d7`.

## Verdict

`review-approval-hub/` cannot be maintained. It is 1457 committed files / 139 MB of
Next.js build output with no source on any branch in this repository, and its
headline claim is now **false**: the Hub's masthead reads
`2 owner decisions — Art D1 + D2 · unapproved`, while the control plane records
both as approved by owner-command
(`.agentops/events/AS-HD-040/AS-HD-040-0003.json`, `owner-decision`, 2026-08-29T08:36:51.270Z;
`.agentops/events/AS-HD-050/AS-HD-050-0003.json`, `owner-decision`, 2026-08-29T08:31:22.507Z).
The Hub is frozen at `28 Aug · 10:04 AKDT` and asks the owner for two decisions
they have already made. This is the failure mode the spec below exists to remove.

A regenerable replacement can carry roughly a third of the Hub's sections at full
fidelity, can carry the evidence images unchanged, and cannot carry the rest — not
because of effort, but because the underlying evidence is not in this repository.

## Checks run

| Command | Result |
|---|---|
| `node .agentops/tools/opsctl.mjs verify` | `VERIFY OK: contracts + runtime valid, consistent, and all generated views in sync.` |
| `node .agentops/tools/opsctl.mjs wake --actor maker --work AS-HD-056` | capsule emitted; `FRESHNESS: STALE — capsule base f4a30c2d929a != live HEAD dfff52fbff06` |
| `git ls-files review-approval-hub \| wc -l` | `1457` |
| `git ls-files \| grep -Ei 'package\.json\|next\.config\|tsconfig'` | `desktop/electron/package.json` only — no Hub source |
| per-branch scan for Hub source (`git ls-tree -r` over all refs) | 2 refs exist (`claude/ashenspire-framework-continue-bhjo30` local + its remote); `hubsrc=0` on both |
| `git merge-base --is-ancestor` for the six merge OIDs the Hub cites | all six are ancestors of HEAD |
| `grep -ril <receipt-hash> --exclude-dir=review-approval-hub` for 6 sampled receipt hashes | `NO MATCH OUTSIDE HUB` for all six |
| `find . -name 'session-r*.json' -not -path './.git/*' \| wc -l` | `0` |
| `git branch -a \| wc -l` | `2` — the 13 `origin/<team>/team-ledger/<team>` branches the Hub tracks do not exist |

## Section classification

**(a) still carries real signal**

| Hub section | Exact path | Why it survives |
|---|---|---|
| Delivery — merge identity | `review-approval-hub/index.html` (§ *PR / Merge / Deployment / Release Decisions*) | The commit OIDs it cites (`d163fd2c…`, `5af802e6…`, `a110ac9d…`, `1f936f54…`, `0187efd3…`, `03bf280d…`) are all reachable ancestors of HEAD. The *identities* are re-derivable from git at any time. |
| Visual evidence bytes | `review-approval-hub/evidence/**` (20 entries), `review-approval-hub/qa-evidence/**` (7 entries) | Committed PNGs. These are the only Hub artifacts that are primary evidence rather than a rendering of it. They are not regenerable from `.agentops/` and must be **moved, not rebuilt**. |
| Component-catalog deep links | 102 hrefs to `cehinds.github.io/AshenSpire/docs/component-catalog.html?q=…` | Target exists in-repo at `docs/component-catalog.html`. Link *targets* are sound; whether the published copy resolves was **not verified** (no readback performed). |

**(b) stale but regenerable from `.agentops/`**

| Hub section | Control-plane source | Note |
|---|---|---|
| *Action Required From Constantine* | `.agentops/work/*/CURRENT.json` `.lifecycle_state`, `.blocker`; `.agentops/events/*/*.json` `kind=owner-decision` | Currently **wrong**, not merely stale — see Verdict. |
| *Ready to Review*, *Frozen Changes Ready for Independent QA* | `lifecycle_state` ∈ {`local`,`qa-review`}, `.agentops/governance/transitions.json` | |
| *Escalated Blockers* / *Decision Visibility · Decision debt* | `CURRENT.json.blocker` (`{kind, wake, summary}`), `.agentops/governance/escalation.json`, `hierarchy.json` `escalation_routing` | Hub's `2 owner · 2 ITM3 overdue · 1 team-remediable` counters are a projection of exactly this shape. |
| *Recently Completed* — decision receipts | `.agentops/events/*/*.json` `kind=owner-decision` | Only **2 of the Hub's 10** listed decisions have a corresponding event; see (c). |
| *Role reference* ("who owns each part of the path") | `.agentops/governance/roles.json` (7 roles), `hierarchy.json` (5 nodes), `raci.json` | The Hub's nine prose role blurbs collapse cleanly onto the seven declared roles. |
| Delivery counters (`0 open PRs`, promotion candidates) | `transitions.json.protected_states` ∩ capsule `lifecycle_state` | The HUD already renders this as *Promotion candidates & protected risks*. |
| Masthead `1 current dev line` | `.agentops/project.json` `development_branch` | |

**(c) depends on evidence that no longer exists — unrecoverable**

| Hub section | What is missing |
|---|---|
| Ticket bodies for `-016`, `-023`, `-032/-037`, `-041`, `-042`, `-043`, `CLASS FACELIFT4` | No `.agentops/work/<ticket>/CURRENT.json` exists for any of them. Their option sets, recommendations, consequence and authority packets exist **only** as baked prose in `review-approval-hub/index.html`, `review-approval-hub/actions/*.html` (5 pages) and `review-approval-hub/reviews/*.html` (7 pages). Nine capsules exist (`AS-1001`, `AS-HD-029/040/045/050/053/054/055/056`); five of them map by number onto Hub tickets, the rest of the Hub's tickets have no control-plane counterpart. |
| 8 of 10 *Recently Completed* decision receipts | Only `AS-HD-040-0003` and `AS-HD-050-0003` exist as events. The save-compatibility Option-2 selection, the HUD-data approval, the text-only Reaver proof approval, the production-lane activation, the 30-day retention selection, the hybrid-exploration selection and the two superseded receipts have no event, no capsule and no resolvable hash in this repository. |
| *Context Rotation* — the 13-team / 52-seat matrix | Per-seat classification, old/successor task IDs, `session-rNNNN.json` node hashes and pointer hashes. `find . -name 'session-r*.json'` returns **0**. The 13 `origin/<team>/team-ledger/<team>` branches do not exist (`git branch -a` = 2). `.agentops/work/AS-HD-054/CURRENT.json` is `assigned` with `blocker.kind = "evidence-loss"` — the census has not been re-sealed, so there is nothing to project. |
| *Help Desk queue* — `13 in progress / 53 current-valid` | `review-approval-hub/help-desk/index.html` renders a "frozen 51-row inventory plus two live additions" that exists nowhere in `.agentops/`. There is no ticket inventory in the control plane, only the 9 capsules. |
| All truncated SHA-256 receipt pointers (~40, e.g. packet `99814105…0A43`, Event 0001 `7B3FF9F9…9620`, control `6A810333…DAF74`, addendum `936C2DD1…609C`, PM 52-seat JSON `6C79F1CF…12F2`, aggregate `5EEBA3FD…89E6D`) | Sampled 6; none resolve to any object outside `review-approval-hub/`. They are truncated to 8+4 hex digits, so even a full-history search cannot bind them to an exact object. |
| Live-readback facts | Pages build status, PR open/closed state, hosted-endpoint verification. These were API readbacks at a wall-clock instant; nothing in `.agentops/` records them and `evidence.json` has no producer that would. |

## The Owner View

**Path** `.agentops/generated/owner-view/index.html`, rendered by a new
`renderOwnerView(contracts, rt)` in `.agentops/tools/opsctl.mjs`, registered in
`generatedArtifacts()` alongside `GENERATED_VIEW` and `HUD_VIEW`. It is therefore
written by `opsctl render` and drift-gated by `opsctl render --check` and
`opsctl verify` on exactly the same mechanism as the HUD — no new gate, no new
workflow, no new publish path.

**Determinism contract.** `renderOwnerView` must be a pure function of
`loadContracts()` + `loadRuntime()`. No clock, no `git` shell-out, no network, no
filesystem walk outside the control plane, no random or locale-dependent
ordering. Every list sorts by ticket ID; every hash is rendered full-length or
not at all. This is the property the Hub never had and the reason it drifted.

**Sections, and their sources**

1. **Needs you now** — capsules whose `blocker` is non-null and whose `blocker.wake`
   routes to `owner` per `hierarchy.json`, plus any capsule at a `protected_states`
   entry awaiting promotion. Source: `work/*/CURRENT.json`, `governance/hierarchy.json`,
   `governance/transitions.json`. Each row carries the capsule's
   `current_hash` and the enumerated `owner-command.json` action links, exactly as
   the HUD's *Decide* table already does.
2. **Decisions of record** — every `kind=owner-decision` event, newest first, with
   full event ID, `at`, `actor` and `summary` verbatim. Source: `events/*/*.json`.
   Replaces *Recently Completed* with the two receipts that actually exist rather
   than the ten that were once claimed.
3. **Work in flight** — one row per capsule: ticket, `lifecycle_state`, `owner_actor`,
   `ref`, `affected_paths`, `blocker.kind`, `evidence_pointers`. Source:
   `work/*/CURRENT.json`. This is the honest successor to *Help Desk queue*: 9 rows,
   not 53.
4. **Blocked, and on whom** — `blocker.kind` grouped by `blocker.wake`, annotated
   with `escalation.json` routing and the `default_sla_minutes` / deputy-custody
   thresholds from `hierarchy.json.escalation_routing`. Successor to *Decision debt*.
5. **Visual evidence** — a static index of `docs/hub/evidence/**` (relocated from
   `review-approval-hub/evidence/**` and `qa-evidence/**`), each entry captioned by
   filename and byte size only. **The renderer must not assert what an image proves.**
   Any claim about an image is a `qa.json` verdict and belongs in section 6 or nowhere.
6. **Independent QA standing** — for each capsule, the applicable `qa.json` gate, its
   `required_evidence`, and which of those `evidence_pointers` the capsule actually
   holds. Successor to *Frozen QA*, and the section that makes an empty
   `evidence_pointers: []` visible instead of invisible.
7. **Delivery identity** — `project.json.development_branch`, and for capsules at or
   past `pushed`, their `base_oid` and `ref`. Merge OIDs appear **only** if a capsule
   or event records them; the renderer never shells out to git.
8. **Who owns what** — `roles.json` (role, mission, `approval_ceiling`), `hierarchy.json`
   escalation parents, `raci.json` accountability. Successor to *Role reference*.

**Deliberate omissions.** Each of these is a decision, not an oversight:

- **No live readback.** No PR state, no Pages build status, no hosted-endpoint check.
  A deterministic renderer cannot produce these truthfully, and a stale one is worse
  than none — that is precisely how the Hub came to display `0 open PRs · Pages built`
  as standing fact.
- **No wall-clock "evidence as of" banner.** Freshness is the `current_hash` and
  `base_oid` already on every capsule; a timestamp invites the reader to trust a
  rendering rather than a hash, and makes the output non-deterministic.
- **No team/seat rotation matrix.** No source; see (c). If `AS-HD-054` ever seals the
  census into `.agentops/`, this becomes a section — not before.
- **No 13-team model at all.** The control plane declares 7 roles and 5 hierarchy
  nodes. The Hub's 13 teams / 52 seats is a second, incompatible org model with no
  contract behind it. The Owner View projects the one that is validated.
- **No prose the control plane does not contain.** No "what approval authorizes",
  no "known limits", no recommendation copy. Those are capsule fields
  (`objective`, `done_when`, `next_action`, `authority.may` / `must_not`) or they
  do not exist. The Hub's editorial voice is not reproducible and must not be faked.
- **No decision capture.** The Hub offered "Record on this device / Copy ticket-ready
  response". The Owner View links to the authenticated `owner-command.yml` issue form
  with the compare-and-swap hash prefilled, as the HUD does, and captures nothing itself.
- **No truncated hashes.** Full-length or absent.

**Relationship to the existing HUD.** Sections 1, 3 and 8 overlap the HUD's
*Needs you now*, *Traceability* and *Writer leases*. Two acceptable resolutions:
extend `renderHud` and keep one page, or render a second page and let the HUD stay
the operator view while the Owner View stays the owner's. Choosing between them is
an `it-manager-iii` sequencing call, not a maker's.

## Migration cost

| Item | Cost |
|---|---|
| `renderOwnerView` + registration in `generatedArtifacts()` | ~250–350 lines in `opsctl.mjs`, same shape as `renderHud` (`opsctl.mjs:1128–1225`). No new dependency; the file is Node stdlib only. |
| Unit coverage in `opsctl.test.mjs` | Purity/determinism assertion + one golden, matching how `render --check` already gates `generated/hud/index.html`. |
| Relocating evidence | `git mv review-approval-hub/{evidence,qa-evidence} docs/hub/evidence/` — 27 top-level entries. Cheap in effort; this is the only Hub content that must be preserved byte-for-byte. |
| Deleting `review-approval-hub/**` | 1457 files, 139 MB removed from the working tree. History retains the bytes, so the clone stays large; a true size reduction needs history rewrite, which is forbidden here and should not be attempted for this. |
| Re-sealing lost tickets | The real cost. Any of `-016`, `-023`, `-032/-037`, `-041`, `-042`, `-043` that still matters must be re-authored as a capsule by hand, from the frozen HTML, by whoever holds the authority for it. Unbounded and not a maker's call. |
| Publication | `project.json` documents `generated/hud/index.html` as served from branch-published Pages at `/hud/`. An Owner View at `/owner-view/` needs no new workflow but does need an owner-authorized `dev → main` promotion to become visible. Owner-gated. |

**Not in scope of the cost above:** re-deriving the Help Desk 53-row inventory, the
52-seat census, or the eight missing decision receipts. Those are not migrations.
They are reconstructions from evidence this repository does not hold.

## What is lost

1. **Editorial framing.** The Hub explained each decision in the owner's language —
   options, recommendation, consequence, what approval does and does not authorize.
   The control plane holds structure, not argument. The Owner View will be
   materially colder to read, and that is a real regression, not a neutral trade.
2. **Eight decision receipts** become invisible. They may have been genuine; nothing
   here can confirm or deny them.
3. **Continuity/rotation reporting** disappears entirely until `AS-HD-054` seals a census.
4. **The Help Desk queue** shrinks from a claimed 53 current-valid tickets to 9 capsules.
   If the 53 were real, the Owner View will under-report the project's true load, and
   should say so on its face rather than imply 9 is the whole picture.
5. **Live delivery state.** Owner loses at-a-glance PR/Pages status and gains nothing
   in its place. Determinism costs this.

## Could not determine / needs authority I do not hold

- Whether the 102 `cehinds.github.io` deep links resolve on the published site. No
  readback performed.
- Whether the Hub source exists outside this repository. Only this repository was
  searched; "no source on any branch" is a statement about `cehinds/AshenSpire`.
- Whether the eight unreceipted *Recently Completed* decisions were genuinely made.
- Whether to extend `renderHud` or add a second page (`it-manager-iii` sequencing).
- Whether any of the six orphaned Hub tickets should be re-sealed as capsules, and
  by whom.

## Seat conditions recorded

- **Capsule base drift.** `lease-AS-HD-056-maker.base_oid` is
  `f4a30c2d929a8429acd46fa02ca8a4798b6d2915`; live HEAD is
  `dfff52fbff06fc8435709a6f03129d940b4422d7`. `git diff --stat f4a30c2..HEAD` touches
  `.agentops/**` and `hud/index.html` only — **no overlap with `docs/hub/**`** — so the
  drift is collision-free and this work proceeded under
  `record-blocker-and-continue-collision-free-work`. Re-seating is `it-manager-iii`'s.
- **Branch.** Work is on `claude/ashenspire-framework-continue-bhjo30`, not the
  `recovery/as-hd-056` named by the lease. Creating that ref and moving the commit is
  an `it-manager-iii` action, not taken here.
- `review-approval-hub/**` was read only. Nothing under it was modified.
