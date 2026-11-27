# Player sprite cleanup — continuation

Updated: 2026-11-26 (America/Anchorage), final planning milestone.
Planning and baseline investigation only.

## Authority and boundary

The owner requested the complete cleanup plan, concurrent workers, measurements,
baseline images, evidence checklist, and user stories with completed/outstanding
status. The owner explicitly authorized routine pushes of planning milestones.
No sprite implementation, merge, promotion, release, or publication is authorized.
Primary examples, clarified by the owner: **Starseer taking a hit** and **Reaver
performing Sweep**. Do not substitute Starseer Sweep for the Reaver case.

## Baseline and preservation

- Game repository: `cehinds/AshenSpire`.
- Planning branch: `codex/player-sprite-cleanup-plan`.
- Source baseline: `49eca254d795d06266aa23941cb2b31fe77b27bf`, fetched `origin/dev`
  and verified with live `git ls-remote` on 2026-11-26.
- Live test source ref at that observation: `f33b112f89ad1029f48112dd84266006ddc3fe15`.
- Art pin: `cehinds/AI-Art`, `ashenspire-hd-assets-v30`; confirmed through live
  GitHub file read and baseline source. Published game metadata is not yet verified.
- Original checkout `C:\repos\AshenSpire` remains on its unrelated branch with
  existing edits preserved. Work occurs in the attached `sprite-cleanup-plan`
  worktree. Do not remove or reset other worktrees.

## Milestones

1. `d842377392a` — baseline and assignments recorded; pushed to origin.
2. `94f46215e72` — measurement and static visual evidence collected and
   independently checked; pushed to origin. This commit anchors the retained
   immutable raster snapshot for future reproduction.
3. Final planning commit (the commit containing this note) — integrated plan,
   user-story status, evidence checklist, production-stage baseline images,
   baseline tests, provenance guards, and independent review. Push immediately
   and verify local HEAD equals the live planning branch before reporting done.

## Concurrent ownership

- Worker A: `measurements/` — runtime inventory, source measurements, normalization
  factors, coordinate systems, affected consumers; no runtime edits.
- Worker B: `visuals/` — pinned-raster contact sheets, canonical appearance audit,
  source provenance, before-only image evidence; no replacement artwork.
- Worker C: `verification/` — published baseline metadata, test assumptions,
  coverage, deterministic runtime screenshots and capture records where feasible.
- Coordinator: this file and integrated plan/status/checklist; stages only intended
  planning files, commits and pushes each meaningful milestone.

## Next actions

Measurements and identity workers have finished. Coordinator independently
reran `measurements/audit.mjs`: 184 rows, 117 selected-family available paths,
33 landmarked / 84 unmeasured, 330 physical rasters, zero missing files and zero
mismatches against provided catalog hashes. All 23 owning source files match the
baseline after CRLF normalization. Eight inspected before-only static sheets and
their image manifest are in `visuals/`; these are not gameplay screenshots.

Worker C finished four inspected production-stage PNGs at 1280×800 and 390×844
viewports, plus capture receipts: all 12 loaded image bytes match the retained
v30 baseline. Intermediate clock/crop issues were corrected before final
artifacts. These are deterministic posed samples with a shared 0.52 diagnostic
zoom, not full-game playthroughs or native battlefield-fit screenshots.

All 68 focused baseline tests passed; the coordinator independently reran the
11 test files. Worker A's independent review found no outstanding consequential
issues after provenance guards were added. See `REVIEW.md`, `VALIDATION.json`,
and `verification/VERIFICATION.md` for checks and explicit coverage limits.

Published observations: Test 0.7.5.134 / digest4fc712b163 / high; Dev 0.7.5.141 /
digest815d2ca479 / light. The digest is not a Git SHA. Published owning source
SHA and art pin remain unknown; no published/local parity is claimed.

The plan is ready for owner review. **Next authorized action is to present this
planning delivery, not to start the fixes.** Future implementation begins with
the Reaver SW09 physical-calibration and Starseer matching-HURT pilot. Resolve
canonical AI-Art history/replacement selection, preserve originals, and follow
the phase/file assignments in `IMPLEMENTATION-PLAN.md` if that work is requested.

Full-game developer capture timed out its expected readiness selector. This is
not diagnosed as a gameplay failure. Battlefield/HUD, actual damage integration,
reduced motion, light-tier behavior, interruptions, and full variants/inspection
acceptance remain unchecked. No implementation, after-images, PR, merge,
promotion, or publication was performed or granted by this task.

## User-story status

- [ ] US-01: As a player, I retain one recognizable class character through actions
  and reactions. Default-family inventory and identity sheets delivered;
  exhaustive visual coverage and implementation not started.
- [ ] US-02: As a player, my Reaver bends during Sweep without growing in body
  size. Selected SW09 scale-policy difference measured; physical/anatomical
  calibration and implementation not started.
- [ ] US-03: As a player, my Starseer remains the same character when hit.
  Wrong-character source and alpha-height registration documented; replacement
  selection and implementation not started.
- [ ] US-04: As a reviewer, I can reproduce the baseline and follow task-linked
  measurements, images, and verification evidence in the eventual implementation
  PR. Baseline evidence package, runtime report, tests, and independent review
  delivered; final candidate preview/after-images remain unimplemented.
- [ ] US-05: As a player, my combat HUD/targeting and supported settings remain
  correct after cleanup. Shared consumers and checks planned; implementation
  acceptance not started.

Investigation delivery D-01 through D-12 is checked in `EVIDENCE-CHECKLIST.md`.
All implementation task checkboxes remain open. The README table tracks both
columns explicitly; do not reinterpret delivered investigations as fixed sprites.

## Resume instructions

Read this file, then the integrated README when present and the three evidence
subdirectories. Check local status and live planning-branch SHA before further
writes. Continue planning only. Keep every completed implementation item backed
by evidence; never manufacture after-images during this baseline task.
