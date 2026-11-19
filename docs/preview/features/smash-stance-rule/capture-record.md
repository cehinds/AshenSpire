# Capture record — Smash stance rule

- Capture date: 2026-11-19 UTC.
- Current source: `35548faa9f130b8ea0000aa1f129124720304e61`, combined GearPass + Smash.
- Checked-in source build: **0.7.4.209**, digest `ce10b5d42c` (the separate CI artifact embedded build 0.7.4.210).
- Before source: fetched `origin/dev` at `6232329243fbea016f8774bd398f02d3be6f1573`, captured by the same official sandbox run.
- [CI preview artifact](https://github.com/cehinds/AshenSpire/actions/runs/44499406132/artifacts/14515959316): run 44499406132/artifact 14515959316. Actual extracted-file QA passed: embedded build **0.7.4.210**, HTML SHA-256 `98c7d470470337543679e4361159d40f7957ec8da514317ff088d453898b414c`. GitHub sign-in is required to download the artifact. Pages returned 503; the verified CI artifact is the preview fallback.
- QA mode: production memory-only combat screenshot fixture; unplayed hand card and actual Information modal, explicit audio mute. No DOM edits or paid card play.
- Route: `?shot=combat&shotSeed=4&shotEnemies=wanderingSoldier&shotDeck=core.smash&shotSettings=%7B%22muteAudio%22%3Atrue%7D`.
- Information action: hold real `.hand .card[data-card-id="core.smash"]` 1100 ms, wait 500 ms, activate `button[aria-label="Information about Smash"]`.

| View | Size | Current face | Current Information | Before Information |
| --- | --- | --- | --- | --- |
| Desktop | 1280×800 | [desktop-face.png](desktop-face.png) | [desktop-information.png](desktop-information.png) | [desktop-before.png](desktop-before.png) |
| Phone | 390×844 | [phone-face.png](phone-face.png) | [phone-information.png](phone-information.png) | [phone-before.png](phone-before.png) |
| Wide | 1600×900 | [wide-face.png](wide-face.png) | [wide-information.png](wide-information.png) | Kept in ignored raw sandbox output |
| Tablet | 820×1180 | [tablet-face.png](tablet-face.png) | [tablet-information.png](tablet-information.png) | Kept in ignored raw sandbox output |

The current Information body shows Defend 1.5× and Prepared 1.25×; the old baseline shows shared 1.25×. The face captures show the actual card, whose production Smash help attributes were independently checked. All eight current images were visually inspected; their 88 required card-image instances decoded and had positive natural dimensions. The separate 36-flow saved-rule matrix decoded 396 additional image instances. Official acceptance: 32 passed, 0 failed. Matrix: 36/36 completed. No cards or Stamina spent; no page, HTTP/network or unexpected console errors. Only the existing navigator.vibrate policy warning is allowed.

Audio mute scopes this acceptance to Smash display; original unmuted holdTick/holdCommit sample 404s and matching baseline evidence are preserved in ignored scratch and described in the [verification report](../../../content/smash-stance-rule-verification-2026-11-19.md). Preintegration 5e evidence is separate and was not reused for these captures.

Separate artifact QA covered desktop 1280×800 and phone 390×844 with current, old shared 1.25× and custom shared 1.6×/2× in-memory rule variants: **8/8 visual + 8/8 strict network flows**, **16/16 card-image instances decoded and pinned-hash matched**. Resources/gameplay counters stayed unchanged; page exceptions and request failures were zero, with eight existing navigator.vibrate policy warnings. Artifact memory fixtures exercise the actual standalone production UI; production snapshot serialization/restoration coverage belongs to the separate 36-flow source probe. These selected captures remain source 35548f/build 209, not artifact screenshots. Earlier unmuted 5e artifact network failures remain recorded as a limitation. The later test-pin-only commit fdfe1a77f8 retains this runtime/UI but was not the source of these captures.

Only these ten PNGs, this record and the concise verification report are selected for review. Full raw JSON, logs, 36 matrix screenshots and earlier failures remain ignored. The parent task will remove this transient gallery from the delivered tree before merging, per CONTRIBUTING, retaining immutable commit links and ignored originals. No release-gallery substitution or standalone playthrough is claimed.
