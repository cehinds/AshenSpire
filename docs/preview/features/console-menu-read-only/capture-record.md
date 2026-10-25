# Console menu capture record

Root independently viewed and accepted all four original PNGs on 2026-10-25 UTC for readiness, readability and native navigation. The original reports remain unchanged.

## Capture identity

- Local official LIGHT pack source: `b39890a7450a3c91a0d513250ab3bd43f7abbaf8`; tree `b8e5023b6d6dee3549b60bae5d4d0291bf56e9f3`.
- Captured 2026-10-25 around 06:24 UTC: version `0.7.1.1842`, runtime digest `5fa99a7c45`; HTML SHA-256 `0198c2aa0309f0fbb0017532a2ef4a1074a38ae4f09638dece5b517ff7a7013d`.
- Official local pack with external objects; not downloaded CI standalone HTML or screenshots from public HTTP. Official external verification passed 314 checks over 7,950 objects.
- [Verified Review build](https://cehinds.github.io/AshenSpire/branches/fix/ConsoleMenuReadOnlyReview/latest/): source `33d2e3fe9c5133645219cd2a9e708b5f016ed037`, publication [40167851794 / deploy121096469535](https://github.com/cehinds/AshenSpire/actions/runs/40167851794/job/121096469535); Root independently read all 30 successful feature HTTP checks.
- Review and canonical `03362d63b45d4bd9ac7f358479d0712e26147b7c` have identical five PR blobs (receipt, generated receipt, two renderers, regression). The renderer and regression blobs also exactly match b398. Review includes one source-review document. **Whole-tree equality with b398 is not claimed:** the current base includes art-host and quota-save integration changes, including main/save/debuglog code, which these predecessor captures do not exercise.

## Native settled flow

Every context uses native `?shot=combat&shotSeed=SHOWCASE&shotClass=reaver`, with no product/CSS/settings/RNG/function overrides. Fresh touch contexts use real touchscreen taps; mouse contexts use real clicks. Each opens `#combat-menu` then the actual Console row. Both DOM read-only markers are present. The settled Console modal and enabled Export affordance are visible; its readonly log contains the actual build/source metadata.

| Image | Viewport | Input |
| --- | --- | --- |
| mobile.png | 390×844 | isMobile + hasTouch; touchscreen.tap |
| desktop.png | 1200×730 | mouse.click |
| wide.png | 1920×1080 | mouse.click |
| tablet.png | 820×1180 | isMobile + hasTouch; touchscreen.tap |

All 15 registered FontFaces loaded explicitly; visible HTML images decoded with none broken. Cost text fits, controls are in viewport, and the declared idle resources/counters/enemy/pile/timeline projection stays unchanged. This proves settled navigation only. Active-playback preservation belongs to the focused unit regression; no concurrent-playback, clean-console, performance or physical-device claim is made.

Raw browser notices remain: one exact source-pinned Chromium pre-activation vibration denial per view, AudioContext activation warnings, and the existing handled ResizeObserver NOTICE visible in wide view. There were no page exceptions or failed requests. The earlier phone attempt `7I95Nn` remains FAIL under its original stricter notice oracle; it was not rescored.

## Closure and originals

Raw report and independent supervisor receipt: `/tmp/console2311-native-qa-Nd281x/report.json` and `DRIVER-CLOSURE.json`; full native Console text is retained as gzip. Supervisor 68874, driver 68881 and browser 68889 exited; contexts/server closed and private profile removed. Output 2.81 MB, persistent free space 628.98 MB, tmp 3.14 GB, no OOM delta. These are resource receipts, not performance results.

- `mobile.png`: SHA-256 `f6194c398c1b7dfad95bac91fa7ea546920f3bf04b30c87f8da31fb37c3504d8` (187013 bytes), copied unchanged from `phone-console.png`.
- `desktop.png`: SHA-256 `1ffe3cfb857a911aa4d07554d91a701c7d55a00e8d177663928b55f26782929c` (609927 bytes), copied unchanged from `desktop-console.png`.
- `wide.png`: SHA-256 `510cf6750363cefcd23a105c75d940f725247434c8bc12c88b3c685256390600` (1202607 bytes), copied unchanged from `wide-console.png`.
- `tablet.png`: SHA-256 `12c6919332ba656154e7f5b47e98b8c82f45f151ef8595f1d43b91e2b71635cc` (539213 bytes), copied unchanged from `tablet-console.png`.

Existing Release gallery retained byte-for-byte: Root verified Release 0.7.1.1784 / runtime `d71537edb1` and unchanged page SHA prefix `c5090a3` in the same publication. Primary README links, gallery, readme-sync and AI disclosures outside the feature marker are unchanged.

