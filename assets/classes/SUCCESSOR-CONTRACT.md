# AS-HD-040 — component-card class silhouette successor contract

STATUS | CLOSED BY SUPERSESSION · PROOF-ONLY · NOT ADOPTED
DECISION | `AS-HD-040-0003` (owner D1, 2026-08-29, issue #389)
BASE | `284fd6e2dcf0` on `recovery/as-hd-040`
CHECK | `node assets/classes/verify-successor-packet.mjs` → `PACKET INTACT — 0 failing check(s)` (87/87)
KNOWN-BAD | `node assets/classes/verify-successor-packet.mjs --selftest` → `SELFTEST OK: all 20 negative plants correctly caught.`
QA | Requested. Candidate frozen and handed to an independent non-maker reviewer; agenda in §7. No verdict exists yet.

## 1. The clause this closes

The 2026-08-28 preflight and r2 census gated the class facelift on a **full-class-silhouette
clause**: each of the four playable classes had to supply an approved first-party *full-body*
input with an independently distinct silhouette. Both runs returned **PASS 0 / WITHHOLD 4**
(`docs/art-evidence/2026-08-28/class-facelift-fullbody-source-provenance-preflight-2026-08-28.md`,
`…-readiness-census-r2-2026-08-28.md`). Rogue failed the clause outright: the equipment
pipeline maps `rogue` to `build_reaver`, so `assets/equipment/body_rogue_default.webp` reuses
the Reaver rig and silhouette.

D1 does not repair that path. It **supersedes** it: the contract is narrowed to the supplied
upper-body/torso canvases, and no new full-body inputs are commissioned. Closure mode is
therefore `superseded-by-approved-successor`, not `satisfied`.

## 2. The successor of record

`review-approval-hub/evidence/look-switcher/` — the frozen four-crop desktop/mobile packet
carried on the hub as *AS-HD-20260826-040 · COMPLETE FIRST PROOF PACKET · Component-catalog
asset look switcher*, status **Proof Accepted · Not Adopted**, 20/20 gates, findings 0, future
looks 4 proof-only and disabled.

- four crops — `assets/{reaver,starseer,rogue,herald}-future.png`, 512×512 RGBA
- desktop proof — `proofs/desktop-1440x900.jpg`
- mobile proofs — `proofs/mobile-{future,header,status-unavailable}-390x844.jpg`

Exact bytes, SHA-256, git blobs and measured facts are pinned in
`assets/classes/successor-packet.manifest.json`.

**These files no longer exist at a working-tree path.** The Hub rebuild
`3e98769e` removed `review-approval-hub/evidence/**`; `origin/dev` holds zero
files there. The bytes survive as git objects reachable from `62f6867a`, and the
verifier reads every one of them by blob OID — content-addressed, so it survives
the paths moving again — falling back to `62f6867a:<path>` where no OID is
recorded. It never reads the working tree. Proven: with
`review-approval-hub/evidence/` removed from the checkout entirely, the verifier
still reports `PACKET INTACT — 0 failing check(s)` and exits 0, and `--selftest`
still catches all 15 plants. The inputs the evidence rules
out are pinned separately in `assets/classes/rejected-inputs.json` — the four
concept crops and the rejected Reaver alpha retry — so AC9 can prove none of
them was swapped in or quietly repaired.

**Not** the successor packet: `review-approval-hub/evidence/classes/*-concept-v1.png`. It is
also a four-crop set with a desktop/mobile proof pair, and its four SHA-256 values match the
concept hashes in the preflight — but all four are 1254×1254 **RGB (PNG color type 2), no
alpha channel**, recorded `INELIGIBLE 4 / direction evidence only`, and explicitly not to be
repaired, masked or reused. It cannot meet §3.

## 3. Acceptance criteria — measured, all PASS

| ID | Requirement | Measured |
|---|---|---|
| AC1 | 512×512 canvas | 4/4 |
| AC2 | Genuine RGBA with a real partial-alpha edge, not RGB with a baked matte | 4/4 color type 6; 2,787–4,812 semi-alpha px |
| AC3 | Zero background/checker/matte residue | 0 transparent pixels carrying non-zero RGB, 4/4 |
| AC4 | Figure never contacts a canvas edge | edge contact 0 px, 4/4 |
| AC5 | Upper-body/torso framing: one shared deterministic bottom cut | all four end at y=359 (soft final row, max alpha 136–140; zero at y≥360); bottom margin 152 px |
| AC6 | Every class silhouette distinct; Rogue must not reuse Reaver | no two alpha≥128 masks identical; pairwise IoU 0.6533–0.7990; **reaver vs rogue 0.7052** |
| AC7 | Deterministic desktop and mobile context proofs | 1× 1440×900, 3× 390×844; each hash-unchanged, **decoded** to confirm the recorded viewport, and its `git_blob` agreeing with its path |
| AC8 | Stays proof-only and disabled | hub records *Not Adopted*; no repository code path reads `assets/classes/**` |
| AC9 | No rejected input substituted into the packet, and none silently altered | 5/5 resolve at the pin, hash-unchanged, still PNG color type 2 — none ever gained an alpha channel that would let it pass as a successor; none matches any packet hash |
| AC10 | The recorded anchor keeps measuring true, and the four crops share one layout frame | alpha-weighted centroids within 0.7 px of x=256 on a 512-wide canvas (offsets −0.43 to +0.13); recorded `baseline_y` equals the measured bottom cut in 4/4 |
| AC11 | The recorded blob OID and the recorded path name the same bytes | `git_blob` and `62f6867a:<path>` resolve identically for all four crops and all four proofs, so neither pin can drift into decoration |
| AC12 | The packet is complete before anything iterates it | the four class ids, 1 desktop + 3 mobile proofs, and the five rejected inputs are required by the checker itself, not derived from the manifest |

AC5 is the evidence that these are the "upper-body/torso canvases" D1 names: a full-body
figure would be grounded at or near the canvas floor, and these four are cut at a common
baseline 152 px above it. AC6 is the evidence that supersession is a real fix and not a
relabelling — the exact Rogue failure recorded against the full-body path does not recur here.

## 4. What makes this fail

- Any crop replaced by RGB bytes, a baked checkerboard, or a masked/segmented derivative of
  the rejected 1254×1254 concept package or of `evidence/reaver-alpha-retry-rejected.png`.
  AC9 enforces this: it fails if a rejected hash appears in the packet, or if a rejected
  object fails to resolve, changes, or gains an alpha channel.
- Any crop contacting a canvas edge, or the shared y=359 cut moving for one class only.
- Any two class alpha masks becoming identical, or Rogue regenerated from the Reaver rig.
- Any byte, SHA-256 or git blob in the manifest changing. The packet is **frozen**: a hash
  change is a break, not an update.
- Adoption, reader/manifest mapping, integration, push, PR, merge, deployment, publication or
  release. D1 authorizes none of these.

## 5. Still open — not closed by D1

1. **Per-file provenance.** `CREDITS.md` declares first-party CC0 at *folder* level for
   `assets/equipment/**`. That declaration does not extend to
   `review-approval-hub/evidence/look-switcher/assets/**`, and no per-file immutable
   provenance record for these four files was found in this repository. The provenance gate
   the preflight raised is unchanged by D1.
2. **UI crop/size/state receipt and manifest/reader steward.** Both were named as WAKE items
   by the preflight and neither exists. Adoption stays blocked on them.

These are recorded, not resolved. This contract closes the silhouette clause only.

## 6. Universal-gate status — maker self-audit, not a verdict

Audited against `docs/governance/QUALITY-GATES.md` §Universal gates. This is the
maker's own reading of its own candidate; it is not QA and does not substitute
for one.

| # | Gate | Status |
|---|---|---|
| 1 | Ticket ID, scope, authority, owner, dependencies, exclusive paths | Present in the work capsule. **`MODEL \| EFFORT \| WHY \| ESCALATE WHEN` assignment metadata is absent** — the capsule schema has no field for it. |
| 2 | Exact fresh `dev` base and exact candidate head | Head exact. **Base is not fresh.** Canonical `dev` is `df4d72ce1524db7c46e5a7920f61c7698fc80ee8`; the worked base `284fd6e2` is contained in it but **47 commits behind** it, and the capsule and lease pin `4a515339`, older still. §9. |
| 3 | Acceptance addressed, deferrals recorded | §3 and the packet's P1–P5 deferrals. |
| 4 | Discriminating known-bad / RED evidence for an added mechanical contract | `--selftest`, 11 plants, all caught. |
| 5 | Applicable repository tests with an exact terminal outcome | `opsctl --selftest` → `SELFTEST OK: all 51 negative plants correctly caught.`; `opsctl validate` → OK. **`opsctl drill` → `DRILL FAIL`** and `opsctl verify` → FAIL, both solely on the two stale generated views. Packet item P5. There is no repository-wide test runner (no `package.json`); this change adds no runtime code, and nothing reads `assets/classes/**`. |
| 6 | Clean `git diff --check`, no unintended paths | `git diff --check 284fd6e..HEAD` clean; the diff touches 7 files, all inside `assets/classes/**` and `.agentops/{work,events}/AS-HD-040/**`. |
| 7 | Rollback boundary | Capsule `rollback`; every artifact here is additive and reversible by discarding the branch. |
| 8 | Independent non-maker QA at the frozen head | **Requested, not yet returned.** The candidate is frozen and handed to QA; see §7. `PACKET INTACT` is a measurement, not a verdict. |
| 9 | Truthful receipt separating local/pushed/PR/integrated/hosted/resolved/released | State is **`LOCAL`** only. Nothing pushed, no PR, nothing integrated, hosted, resolved or released. |

`docs/governance/CONTINUITY.md`'s own check is RED independently of this work:
`node tools/continuity.mjs --check` reports 36 findings, all of them missing
history objects in this recovered clone plus a generated-artifact drift on
`AshenSpire.html`, which commit `49bf66d` last touched. None of the 36 names a
path this branch changed.

## 7. QA review agenda

The candidate is frozen and handed to an independent non-maker reviewer. A maker
may not author a verdict on its own object, so nothing below is a finding — it
is what the reviewer is asked to test.

1. **Re-derive, don't trust.** `node assets/classes/verify-successor-packet.mjs`
   should print `PACKET INTACT — 0 failing check(s)` (87) — in any clone holding the
   objects, including one where `review-approval-hub/evidence/**` does not exist. Every number in the
   manifest is re-measured from the frozen bytes by that run; if the reviewer's
   own tooling disagrees with any of them, the manifest is wrong, not the tool.
2. **Test the tester.** `--selftest` runs 20 plants and should report all caught.
   A verifier that cannot fail is not evidence. Adding a fourteenth plant that
   the reviewer expects to be caught, and finding it is not, is a valid finding.
3. **Challenge the supersession.** §1 claims the clause is *superseded*, not
   *satisfied*. If the reviewer reads D1 as requiring the packet to satisfy the
   original full-body clause, this contract is wrong at its root.
4. **Challenge the packet identification.** §2 resolves "the frozen four-crop
   desktop/mobile packet" to the look-switcher packet and rules out the concept
   crops. The reasoning is stated; the reviewer should confirm or reject it.
5. **Accept or reject two `Not applicable` columns.** `art.md` §3 requires
   twelve manifest columns and permits `Not applicable` only with a reason and
   IT Manager III acceptance. Two are marked so — `fallback_id` and `consumers`
   — with reasons in `successor-packet.manifest.json`. Two others,
   `source_export_recipe_and_tool_receipt` and `provenance_licence`, are marked
   `UNKNOWN` rather than `Not applicable`, because they are unanswered facts and
   not inapplicable ones.
6. **Confirm the scope determinations in §8** are the right reading of D1.

## 8. Scope determinations — recorded, not escalated

These were initially raised as blockers. On review of the governing documents
none of them blocks this work, so they are recorded here as determinations and
the ticket carries no open blocker.

- **Art-policy lifecycle is UNKNOWN, and the reason is not this environment.**
  An earlier revision of this document said the rule could not be evaluated
  because the session had no `origin/dev` ref. That was wrong, and the error was
  mine: `git fetch origin dev` succeeds, and canonical `dev` is
  `df4d72ce1524db7c46e5a7920f61c7698fc80ee8`. `edc726bc`, decision 0004's
  history source, is contained in it. The rule still cannot be evaluated,
  because its *other* input is missing: it needs the exact governance head named
  by a successful independent policy-QA receipt, decision 0004 records a history
  source rather than such a head, and no `policy_activation_head` value exists
  anywhere in the repository — only the `TICKET-SCHEMA.md` field that would hold
  one. So this is a gap in decision 0004, not in the clone. It still does not
  block this work: the package it gates is due for an approved art suggestion
  moving to integration, and D1 authorizes no integration.
- **UI crop/state receipt and manifest/reader steward stay unassigned.** Both
  are adoption prerequisites named by the 2026-08-28 preflight. Commissioning
  them now would be work against an outcome nobody has approved.
- **Provenance and export-recipe are adoption gates, not gaps in this work.**
  `CREDITS.md` line 28 covers `assets/equipment/*.webp`; no row covers the four
  crops, and `art.md` §11 makes unknown provenance an integration blocker.
  Nothing here ships, so nothing here is blocked — but adoption cannot proceed
  until a per-file provenance package exists.

## 9. Handoff to the governance lane

**Closed since this section was written:** the verifier no longer depends on a
stale checkout. It reads pinned git objects, so the deleted-paths defect that
`AS-HD-055` independently reported against the other contract does not apply to
this one.

One item remains outside every lane this seat holds and is left for its owner
rather than filed as a blocker:
`.agentops/generated/reconstruction/AS-HD-040.wake.txt`
and `.agentops/generated/hud/index.html` are stale, so `opsctl verify` and
`opsctl drill` both fail. `git-ownership.json` assigns `.agentops/generated/**`
to the generator writer behind the governance lane. The fix is one command —
`node .agentops/tools/opsctl.mjs render` — run by that owner. Separately, the base is stale against
canonical `dev` `df4d72ce1524db7c46e5a7920f61c7698fc80ee8`: the worked base
`284fd6e2` is contained in `dev` but **47 commits behind** it, and the capsule
and lease pin `4a515339`, older again. Re-issuing the lease at a fresh base is
the issuer's action. Universal gate 2 wants an exact fresh `dev` base, so this
is a gate failure on the candidate, not a tidiness item.
