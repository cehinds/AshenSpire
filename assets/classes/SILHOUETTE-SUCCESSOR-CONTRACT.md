# AS-HD-040 — component-card silhouette successor contract (Art D1)

STATUS | RECORDED / PROOF-ONLY / FINAL ASSETS 0
TICKET | AS-HD-040 (Hub identity `AS-HD-20260826-040`)
SEAT | maker · `lease-AS-HD-040-maker` · exclusive paths `assets/classes/**`
RECORDED AT | HEAD `d7c6e4400452e2e32fd0cea2e435037326d5fe18`
AUTHORITY | Owner decision, recorded — not a maker's judgement. This document records a
selection and binds it to exact objects. It generates, adopts, masks, attaches, integrates,
publishes, deploys, delivers or releases nothing.

## 1. The owner-selected successor path

Recorded verbatim from `.agentops/events/AS-HD-040/AS-HD-040-0003.json`
(`kind=owner-decision`, `actor=owner`, `at=2026-08-29T08:36:51.270Z`):

> Owner-command 'approve' by owner recorded: D1 authorized by the owner, taking the
> recommendation of record: one bounded proof-only upper-body successor from the frozen
> four-crop desktop/mobile packet. This narrows the component-card silhouette contract to
> the supplied upper-body/torso canvases rather than commissioning new full-body inputs.
> Scope is proof-only — it authorizes no asset adoption, integration, PR, merge, deployment,
> publication or release, and the frozen packet remains preserved. Blocker cleared: the
> decision it was waiting on is now recorded.

**Effect on the contract.** The full-class-silhouette clause is **superseded**, not satisfied.
The component-card silhouette contract now binds to the supplied upper-body/torso canvases
enumerated in §2. Option B — "four approved first-party full-body inputs, exact
provenance/ownership, class-by-class new-detail approval, UI crop/state evidence, and a
manifest/reader steward" — is **not** the selected path and is closed unless the owner reopens it.

## 2. The frozen packet — 12 files

> **Retrieval note, added by it-manager-iii at PR #423.** The commit this section
> originally named (`d7c6e440`) is not reachable in this repository, and none of
> the twelve paths below exists in the current tree: the Hub rebuild (`3e98769e`)
> removed `review-approval-hub/evidence/` when the Hub became generated output.
> The blobs themselves survive and are reachable at **`62f6867a`** ("Publish
> review approval hub"), so the packet can still be verified:
>
> ```
> git cat-file blob 62f6867a:<path from the table below>
> ```
>
> Nothing in the table has been altered — the paths, byte counts and SHA-256
> values are this seat's evidence and remain as authored. Only the commit to read
> them from is corrected, so the next actor does not have to search history to
> reproduce the claim. Relocating the files under a path the current tree keeps
> belongs to the authoring seat (AS-HD-040), not to this correction.


Every SHA-256 below was recomputed by the authoring seat and matches the identity carried in
`docs/art-evidence/2026-08-28/class-facelift-fullbody-source-provenance-preflight-2026-08-28.md`
where that census names the file. Concept-crop hashes: 4/4 MATCH.

| # | Role | Path (repository-relative) | Bytes | SHA-256 |
|---:|---|---|---:|---|
| 1 | concept crop | `review-approval-hub/evidence/classes/reaver-concept-v1.png` | 1,701,809 | `13DE067B7DF2E7FE9BEB377FBAC9ED3A85F62C487ECAA33764E94E8C35DD0093` |
| 2 | concept crop | `review-approval-hub/evidence/classes/starseer-concept-v1.png` | 1,481,645 | `42BD2664D8D23C23C7061CB6CCBAB84A86715BEF1845A37416C52AA31BD38099` |
| 3 | concept crop | `review-approval-hub/evidence/classes/rogue-concept-v1.png` | 1,543,220 | `CA34C3CD3131CE7110B35C2778E543BB95ADB1226BBF3E7E9F72ADA6509D6E1D` |
| 4 | concept crop | `review-approval-hub/evidence/classes/herald-concept-v1.png` | 1,529,459 | `A02C051679F5460E4DDBC7F8034B082AEF5A181AD6B83355A3A421C371FCE280` |
| 5 | desktop proof | `review-approval-hub/evidence/class-facelift-concepts-desktop-1440x900.png` | 793,575 | `B18CA6497D1E8F630144B71849B0036A0B5958B8292CBB772DFE327CD04EAD96` |
| 6 | mobile proof | `review-approval-hub/evidence/class-facelift-concepts-mobile-390x844.png` | 293,740 | `640058D2E4C40FAB852560F834AAE32ED3ABC3CA7D0E880341EAFC1A463B83FC` |
| 7 | desktop proof | `review-approval-hub/evidence/class-portraits-desktop-1440x900.png` | 175,827 | `504CA5FB5311455413C9E67C49F51B9C82D31DA43944685456C8AC3006453699` |
| 8 | mobile proof | `review-approval-hub/evidence/class-portraits-mobile-390x844.png` | 86,418 | `CEBBFA9FFD19A31489B6ED4ABEF38C97144B91C9B8B5EA55CA24D2F7A9E7AD8A` |
| 9 | look-switcher future | `review-approval-hub/evidence/look-switcher/assets/reaver-future.png` | 80,807 | `6CE034EB419CC51A9948A4A7E71BBEDF2E43405114F9A81F2CDE81FC94797FF8` |
| 10 | look-switcher future | `review-approval-hub/evidence/look-switcher/assets/starseer-future.png` | 67,879 | `B8477A38B35FE1768B84C565CA383B88D0BAB9C6C27E4DE5C8CE887ECFB29526` |
| 11 | look-switcher future | `review-approval-hub/evidence/look-switcher/assets/rogue-future.png` | 87,974 | `370E8DD353E4C27866B7C8E615DA5C8A90B48E4784B181D93030A95EDBE6CA3A` |
| 12 | look-switcher future | `review-approval-hub/evidence/look-switcher/assets/herald-future.png` | 73,383 | `4EED36360A425935BAA66C0AF39D6827542826D5872BEFB1BD525CB82C185414` |

Packet digest (SHA-256 over `sha256sum` lines in the order above):
`BB43990FFE5E6C5DE736EF5881927B5B4C1778FBBA9507D62DFADBA953FE58BA`

**Explicitly excluded.** `review-approval-hub/evidence/reaver-alpha-retry-rejected.png` is rejected
diagnostic evidence, not packet content and not a candidate.

## 3. Standing WITHHOLDs this decision does NOT clear

D1 narrows the contract's scope. It does not discharge any gate below. Both standing censuses
remain in force at `PASS 0 / WITHHOLD 4`
(`docs/art-evidence/2026-08-28/class-facelift-fullbody-source-readiness-census-r2-2026-08-28.md`,
`…-provenance-preflight-2026-08-28.md`).

1. **The selected canvases are the ineligible ones.** Packet rows 1–4 are the same 1254×1254
   RGB files with baked checkerboards that R2 classifies `INELIGIBLE concept` for all four
   classes, with the standing instruction "Do not repair, mask, or reuse them." D1 selects them
   as the *direction and crop basis* for a proof-only successor. It does not reclassify their
   bytes, and they remain `CONCEPT / NOT AN ASSET`.
2. **Provenance is folder-level, not per-file.** `CREDITS.md`
   (SHA-256 `D01831E6CA84C2EB44699B2C4A7B9357557193DFDC359263ADC79D66123A772F`) declares the
   `assets/equipment/*.webp` family AshenSpire / CC0 at folder granularity. That supports a
   conditional source chain; it does not satisfy a per-file immutable production-provenance clause.
3. **Rogue has no distinct rig.** Confirmed live at `tools/equipment-blender.py:393-397` —
   `CLASS_BUILD` maps `"rogue": lib["build_reaver"]`. The independent-silhouette condition fails
   for Rogue on the body path regardless of which successor path is selected.
4. **No UI crop/size/state contract exists.** Deterministic desktop/mobile/card safe areas,
   focus/selected/disabled/defeated ownership, and in-bounds readability criteria are unassigned.
5. **No manifest/reader steward is named.**

Existing first-party body sources, re-verified at this HEAD (4/4 MATCH against the R2 census;
they are the *unselected* Option B inputs and are recorded here only so the supersession is legible):

| Class | Path | Bytes | SHA-256 | Git blob |
|---|---|---:|---|---|
| Reaver | `assets/equipment/body_reaver_default.webp` | 16,012 | `A59D4483BF9EC50ADC35BE2DA842FA3FE35049F6389190B4DF30274F06FB7474` | `0472edd1c9198d77ba3b7ce8bd0fe5b1f96942b7` |
| Starseer | `assets/equipment/body_starseer_default.webp` | 11,884 | `A4DE84A2F925BCE512F92AEA40D7FAF0671C3540B40D595F67E82EF3FD7EDE5E` | `95fd6de78293e5debed610ebc0a2cab992493487` |
| Rogue | `assets/equipment/body_rogue_default.webp` | 15,564 | `AAB107C67420459075D0F21EFBBCD9AEED217D49F87F696A7D5CAFE2B259201B` | `f1a72c900d716c439ffa0c968ebac03966ac5ab8` |
| Herald | `assets/equipment/body_herald_default.webp` | 18,648 | `CBDB46428BF642411C0B1CD3F195C8BFF5F4D25336BE195F64621C24EA7CF754` | `6f2e4d1820942cad40488cd992c12f070acb6c64` |

## 4. Custody hazard — the packet lives inside orphaned build output

All 12 packet files are under `review-approval-hub/**`, which `AS-HD-056` establishes is
committed Next.js build output with no source on any branch, and whose specification
(`docs/hub/OWNER-VIEW-SPEC.md`) proposes deleting the tree and relocating its evidence to
`docs/hub/evidence/`. **This contract's exact objects would move with it.**

The relocation is a `git mv` — bytes and therefore hashes are preserved, so §2 stays valid by
SHA-256 after the move. Only the paths change. Whoever executes that relocation must re-point
§2's path column. Recorded so the dependency is not discovered later by breakage.

## 5. Contract state

| Field | Value |
|---|---|
| Selected path | proof-only upper-body successor from the frozen 12-file packet |
| Superseded | full-class-silhouette clause / Option B new full-body inputs |
| Packet | preserved, 12 files, digest `BB43990F…58BA`, unmodified by this ticket |
| Eligible sources | 0 |
| Final assets | 0 |
| Generation authorized by this record | none |

## 6. Wake

Not this seat's to take. The next actor must supply, as one packet:
(a) the exact UI crop/size/state contract for the upper-body canvas, and
(b) a named manifest/reader steward.
Only then can a proof-only upper-body successor be produced and independently reviewed.
Rogue's rig reuse is a separate finding that survives this decision and needs its own routing.

INVALIDATE | if any packet SHA-256 in §2 changes, if `CREDITS.md` or the equipment pipeline
changes, or if the owner reopens Option B.
ROLLBACK | `git rm assets/classes/SILHOUETTE-SUCCESSOR-CONTRACT.md`. No runtime, asset, catalog
or shared-path state was created.
