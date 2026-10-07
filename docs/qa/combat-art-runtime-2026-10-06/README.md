# Completed combat art runtime integration

Source art: local commit `41ae95ae42cce66e56805cc35ae1903a92a4d5a5`.
Integration base: `fdd992dc6` on `alternative/dev` (rebased after PR #1683).
The original 64-scene sweep ran on base `c448cb31c`; the later base changes
updated creation and smithing while retaining the alternative battlefield.

## Implementation

- All 59 canonical idle appearances exported and addressable: 19 armor,
  33 enemy, two companion, five speaker. Exact armor IDs take precedence over
  old art aliases, including Bastion, Rimeweave and Waywatcher. The 16 shared
  armor rows use the reviewed package's explicit visual class/set aliases.
  Future class-by-armor production can add dedicated IDs independently.
- The 52 previously approved hero/enemy desktop WebPs are byte-identical.
  The two companions and five speakers use the reviewed rear-right revisions.
  The corrected Reaver sword and red cloak are preserved.
- All 32 canonical combat settings select four independent layers from 69
  masters. Saved dungeon and ordinary seeded location selection are retained.
  Separate desktop/phone transforms are fitted uniformly to the live field
  and current formation ground, preserving existing HUD/cards/footer/slots.
- 266 hash-pinned WebPs include desktop and phone exports. Desktop alpha equals
  the source plane; phone alpha equals its resized plane, verified after WebP
  decoding. Desktop exports total 50.16 MB; phone exports total 17.59 MB.
  The existing verified common asset store and inline build loader carry both.
- Companion artwork decorates the existing ally indicators. Speaker rear art
  is available by canonical ID; no new speaker combat encounters were invented,
  and existing dialogue portraits remain unchanged. No animation strips or
  hand/action anchors were inferred from idle bounds.
- Newer alternative/dev Combat Studio outlines, side metadata, and pinned
  art-library lookup were retained while importing the art package. The earlier
  ZIP receipt stays unchanged; the source-package checksum list was regenerated.

## Validation

- 12 focused Node tests passed: all actor IDs and source identities, every
  armor mapping, both device paths, all scene layer references and dimensions,
  saved dungeon selection, existing environment and formation contracts.
- The receipt tests passed all eight cases on the final receipt.
- Changelog ordering passed 812 checks and its 766 receipts were regenerated.
  `about-changelog.mjs --check` did not pass: the raw-CDP source Settings probe
  timed out with an empty title body, including on retry. This remains an
  open validation gap, separate from the passing gameplay harness.
- 17 asset-pack/mobile tests passed, including stale-hash rejection and the
  common-pack loader used by the alternative art.
- Local light pack and portable builds succeeded: `0.7.1.1046`, identity
  `6c2378998c`. Build identity (9 checks) and shipped-file verification
  (12 checks) passed. Built HTML remains ignored.
- Chromium/Edge at 1440x900 and 390x844 loaded all 64 scene/device combinations
  in production combat, checked selected layer IDs and phone sprite paths,
  decoded every selected layer and actor, and found no horizontal page overflow.
  Both co-op mounts and mounted desktop/phone resizes passed. Contact sheets
  and representative full-size screenshots were visually inspected.
- Fresh Quick start, mastery selection, map entry, tutorial Skip, real card
  selection/targeting, hold End Turn, hand retention and turn 2 passed at both
  sizes, from the source preview, served pack, and offline portable file.
  Source, pack and portable gameplay passed again after rebasing onto `fdd992dc6`.
  The repeat source scene sweep timed out on its third navigation during the
  concurrent rebuild; its first two scenes passed without page/HTTP errors.
  The full 64-scene sweep precedes the rebase; the subsequent source gameplay
  rerun passed at both sizes after the rebuild finished.
- The first input harness run exposed a tutorial overlay and an early End Turn
  attempt during card playback. The harness now uses the visible Skip control
  and waits for enabled controls/retention. Both complete playthroughs were
  rerun successfully. These were harness changes, not gameplay changes.
- No page JavaScript errors or required-art HTTP errors. The source preview
  and served pack still probe optional recorded SFX and `/api/lan/info` and receive 404s;
  it uses its existing synthesized audio fallback. These are listed separately
  in `validation.json`. The portable playthrough has no HTTP errors.

## Ground contact follow-up

The phone co-op resize check found two placement defects: measuring zoom with
`clientWidth` excluded the scrollbar, and the older co-op stylesheet forced a
110px host around the 190px alpha-cropped artwork. The fitter now measures the
whole field box, and alternative co-op figures keep their intrinsic dimensions.

The browser check measures sprite bottoms against the current formation ground,
samples the rendered ground layer beneath each sprite, and requires four ordered
sections: far, landmark, ground and foreground. It waits for resizing to settle;
attack and recoil motion are allowed to leave the resting baseline. The content
test also requires separate desktop and phone image paths for each section.

The corrected source passed all 64 scene/device combinations (192 measured
sprite placements), both co-op sizes and both resize directions. The largest
resting-baseline difference was 0.19px; ground alpha beneath every measured
sprite was at least 249/255. All 12 focused tests passed.

Build `0.7.1.1047` (`1b565d8ecd`) passed the same 64 scene/device checks,
both co-op sizes and both resize directions. Desktop/phone card play through
turn 2 passed in the pack and portable builds. Build identity (9 checks),
shipped-file verification (12), and changelog ordering (812) passed. The first
pack sweep exposed a filename-based phone-tier assertion in the harness;
pack images have hash URLs. The assertion now compares the selected image
with its picture phone source, and the phone sweep passed on rerun.

After reconciling the concurrent progression/overhead update `2e29b6b69`,
build `0.7.1.1056` (`1e6437bc6d`) repeated all 64 built scene/device checks,
four co-op/resize checks, and desktop/phone card play. Portable play passed
at both sizes too. The final rebuild only reorders the changelog receipt;
the validated grounding code and artwork are unchanged. Final build
`0.7.1.1057` (`0b6580e1b2`) passed desktop/phone gameplay in pack and portable
form, build identity (9 checks), shipped aliases (12), and receipt ordering
(817 checks).

[Phone ground contact](phone-grounded.png) · [Ground-contact measurements](ground-contact.json) · [Phone co-op after correction](phone-coop-grounded.png)

## Evidence and acceptance boundary

- [Desktop gameplay, turn 2](desktop-turn2.png)
- [Phone gameplay, turn 2](phone-turn2.png)
- [All desktop settings](desktop-contact.jpg)
- [All phone settings](phone-contact.jpg)
- [Machine-readable observations](validation.json)

This is local Chromium evidence, not physical-phone, Safari, controller,
all-encounter or animation acceptance. It does not change gameplay rules or
consume Combat Studio browser drafts. Independent review and hosted CI are
separate from these local checks. Nothing was merged, promoted or published.

Reproduce with `python tools/alternative-art-build.py`, the focused tests named
in DEVELOPER.md, `node tools/launch.mjs --build-only`, and
`node tools/alternative-art-qa.mjs`. Point `COMBAT_ART_URL` at the portable file
and add `--play-only` to test the portable game; use `--play-only --pack`
for the served pack. Keep local outputs/temp on D:.
