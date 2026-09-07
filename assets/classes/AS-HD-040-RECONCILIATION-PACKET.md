# AS-HD-040 — reconciliation packet for it-manager-iii

Assembled by the `maker` seat holding `lease-AS-HD-040-maker` (`assets/classes/**`),
at Constantine's direction relayed by the scheduler-cutover operator session
`session_017aHqQzu971qKcvxfeKxCk8`, 2026-08-31.

This packet **adjudicates nothing**. It assembles the evidence so one read is enough.
Every SHA below was resolved locally against `origin/dev` at
`bbbc5e7526f2be34ab2e044c3533647c46930a6e`.

## EVIDENCE — three actors, one ticket, one lease

Three distinct actors have written as AS-HD-040 under the single lease
`lease-AS-HD-040-maker`. TICKET-SCHEMA.md names "zero duplicated active path
ownership" a hard invariant; it is currently violated.

### Actor A — contract author (`a72cac96`)

| Fact | Value |
|---|---|
| Commit | `a72cac9689cfb3b7e302cbcaa4d0a88f4e9ab7ff`, 2026-08-29 **09:17:12** |
| Change | one file, +123 lines: `assets/classes/SILHOUETTE-SUCCESSOR-CONTRACT.md` |
| Artifact SHA-256 at that commit | `fac3d5aaf76e1539f80e2e97f80520e69b689725c87946a17cc6e1faca2829f8` |
| Contained in `origin/dev` | yes |
| Ledger | issue #427 (`SENT` to `qa-independent`), #395 |
| Later touched by | it-manager-iii retrieval note at PR #423 |

Conclusion: **superseded, not satisfied.** Packet enumerated as **12 files**.

### Actor B — reseat sweeper (dev event chain)

| Fact | Value |
|---|---|
| Events | `AS-HD-040-0004` … `AS-HD-040-0052` on `origin/dev` |
| Kind / actor | all 49 are `state-change` by `maker` |
| Content | **49 of 49 contain "Reseated from"** — no work event among them |
| Window | 2026-08-29T17:07:48.578Z → 2026-08-30T01:40:29.535Z |
| Capsule | revision **51**, `lifecycle_state: assigned`, base `7bcc9ed08d3a` |
| Produced | no artifact |

Each pass reads "the seat had not started, so its base follows the branch rather
than pinning a commit it never worked from." The chain still grew while this
packet was being assembled (50 → 52).

### Actor C — this seat (local only)

| Fact | Value |
|---|---|
| Branch | `recovery/as-hd-040`, created from `284fd6e2`, **never pushed**; absent from `origin` (`git ls-remote --heads origin 'recovery/*'` → empty) |
| Commits | 13, `7c712ee` 2026-08-29 09:41:50 → `6abb35f` 22:32:14 |
| Frozen candidate | `13bcea022325518b6ed986492577a3acf59d7aac` |
| Artifacts | `SUCCESSOR-CONTRACT.md`, `successor-packet.manifest.json`, `rejected-inputs.json`, `verify-successor-packet.mjs` |
| Local events | `0004` … `0017`, **different content, same IDs as Actor B's** |
| Capsule | revision 9, `lifecycle_state: qa-review` |
| Ledger | none — this seat posted no issue and holds no authority to |

Conclusion: **superseded, not satisfied.** Packet identified as **8 files**.

## Conflicts

1. **Event-ID fork.** Actor B's `0004`–`0052` and Actor C's `0004`–`0017` are
   different files with identical IDs, both parented on `0003`. An append-only
   chain cannot carry both. Actor C's next free local ID, `0018`, is also taken
   on dev, so Actor C stopped appending.
2. **Duplicate artifacts for one clause.** `SILHOUETTE-SUCCESSOR-CONTRACT.md`
   (Actor A, on dev) and Actor C's four files both close the same clause, and
   agree on the substantive answer.
3. **Packet scope, 12 vs 8.** Actor A enumerates four concept crops, four
   concept/portrait proofs, and four look-switcher futures. Actor C identifies
   the four look-switcher futures plus the look-switcher desktop/mobile proofs,
   and rules the concept crops out as RGB direction evidence. D1 says
   "four-crop"; Actor A's twelve contains **two** candidate four-crop groups.
   Their four look-switcher SHA-256s are **identical** to Actor C's, so this is a
   scope disagreement, not a factual one.
4. **Capsule divergence.** dev revision 51 `assigned`; Actor C revision 9
   `qa-review`.
5. **The ledger understates two seats.** Help-desk read the dev chain, saw 49
   reseats and no work event, and reported "nothing produced"; then corrected by
   attributing Actor A's freeze to Actor C. Both readings came from a ledger
   three actors write into.
6. **#427's pin has drifted.** Its SHA `FAC3D5AA…29F8` matches the artifact **at
   `a72cac96`**; `origin/dev`'s current copy of the same path is
   `7deb378bc9df08a874d2074027dcad5885b665a905a1bf2e336223e92a21b70a`, changed by
   the PR #423 note. QA must review `a72cac96`, not dev HEAD.
7. **Actor C's verifier does not run on dev.** The Hub rebuild `3e98769e` removed
   `review-approval-hub/evidence/**`; `origin/dev` holds **0** files there. The
   blobs survive at `62f6867a`. `verify-successor-packet.mjs` resolves
   working-tree paths, so its 71 passing checks depend on Actor C's stale clone.

## OPTIONS

- **O1 — Actor A is the contract of record; Actor C's work is offered as a
  measured addendum.** A is on dev, corrected by ITM3 at #423, already routed to
  QA at #427. C's verifier, AC1–AC10, alpha/centroid measurements and
  rejected-input register attach as a separate file, or are discarded.
- **O2 — Actor C's candidate replaces Actor A's.** Requires pushing a branch that
  does not exist on origin, renumbering C's events to `0053+`, and re-routing QA.
  Higher cost, and back-dated event IDs would misrepresent when the work happened.
- **O3 — Merge the two contracts into one.** Most faithful to the evidence, most
  expensive, and needs an owner for the merged artifact.

## REC

**O1.** Actor A's contract is already on dev, already corrected by ITM3, and
already before QA; displacing it buys nothing, because the two agree on the
answer. Take from Actor C only what A lacks and what is independently
re-derivable: that all four look-switcher crops are genuine RGBA (colour type 6)
with zero transparent-pixel RGB residue, that they share a bottom cut at y=359
and sit within 0.7 px of x=256, and that no two silhouettes are identical
(reaver vs rogue IoU 0.7052) — which is what actually retires the Rogue
reuses-Reaver failure the 2026-08-28 preflight recorded.

On conflict 3, Actor C's reading: the **four look-switcher futures** are D1's
four crops. The concept crops are 1254×1254 RGB with baked checkerboards, and the
r2 census classifies them INELIGIBLE and direction-evidence-only, so they cannot
be a successor. ITM3 should rule, because both readings fit the words.

Do not merge Actor C's event chain. Its value is this packet, not 14 back-dated
IDs in an append-only ledger that already carries 49 no-ops.

## NEXT

1. ITM3 rules on conflict 3 (which four crops) and O1/O2/O3.
2. Stop Actor B's sweep — already escalated as a control-plane defect; the
   terminating condition belongs in the reseat policy, not in any seat.
3. Correct #427 to name `a72cac96` as the reviewed head rather than dev HEAD.
4. If the addendum is accepted, Actor C repoints its verifier at
   `62f6867a:<path>` instead of the working tree, and re-runs.

## AUTH

None requested. This seat holds `implement-locally-on-exclusive-paths`,
`run-tests-and-builds`, `commit-on-isolated-branch`,
`record-blocker-and-continue-collision-free-work`. Every action in NEXT belongs
to it-manager-iii or help-desk. This seat has not pushed, opened a PR, posted to
the board, or touched `tools/**`.
