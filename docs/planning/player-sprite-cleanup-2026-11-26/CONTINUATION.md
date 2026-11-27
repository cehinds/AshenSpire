# Player sprite cleanup — continuation

Updated: 2026-11-26 (America/Anchorage). Planning and baseline investigation only.

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

1. Baseline and assignments recorded — this commit; push immediately.
2. Measurement and static visual evidence collected and independently checked —
   this checkpoint; push immediately. Runtime/test verification is still running.
3. Integrated cleanup plan, story status, checklist, and independent review — pending.

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

Worker C is completing real-browser production-stage captures, published build
metadata, and test/coverage documentation in `verification/`. During coordinator
image review, an intermediate harness snapshot was found to advance its hit
stage while sampling the return stage; C is correcting the harness clock and
regenerating evidence. Do not use intermediate files as final acceptance.

Finish the integrated plan/checklist and independent review, validate evidence
links/hashes, then push the final planning milestone. No runtime implementation
or after-images. Published source/art parity and exhaustive full-game/settings
coverage must be stated only to the extent observed.

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
  measurements, images, and verification evidence. Reproducible measurement and
  static-image artifacts delivered; runtime report and integrated review pending.

## Resume instructions

Read this file, then the integrated README when present and the three evidence
subdirectories. Check local status and live planning-branch SHA before further
writes. Continue planning only. Keep every completed implementation item backed
by evidence; never manufacture after-images during this baseline task.
