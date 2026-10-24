# Combat Console capture record

Feature: optional Console shortcut in the full combat log, enabled in Settings →
General → Combat → Combat log; off by default.
[Component catalog](../../../component-catalog.html) · [Player guide](../../../PROJECT-GUIDE.md).

Source commit: `fe7c6988e7428e11f364529582add3fa63cc98d3`.
Source tree: `712f0b1321885f1fcbdb43faa33c90e37e3e9953`.
Build: `0.7.1.1814`, source digest `ddf4bd050f`, built 2026-10-24.
HTML: 14,807,180 bytes; SHA-256 `e2f4599b88248312f1ac26c28c46ab9ce75d4c560e694cef40964b8e78f78a5d`.
The stable review build on `fix/CombatLogConsoleReview` uses source commit
`e38ae247e570435a347318f99edb3877772c56c8`. That built commit has the identical
complete Git tree `712f0b1321885f1fcbdb43faa33c90e37e3e9953` as the captured
source. Later documentation-only commits attach this record and its screenshots;
they do not change the tested runtime.
Screenshots show that stable review snapshot, not the canonical branch’s later
integration head. Canonical integration before evidence publication:
`651d1715dbc4db05e10c3539ffc4e91019918faf` (committed box 1821).
It also includes later owner-authored data migrations and derived receipt updates. Its Console modules, settings, stylesheet, guide and
entire UI-string catalog are unchanged from the captured source. No screenshot
or local build of that later integration is claimed here.

Screenshots use the official local light pack built from this source. The complete
canonical runtime identity contains 1,006 inputs; the guarded build verified
all 5,255 materialized tracked files against Git. Console code and its 15 catalog
rows remain unchanged from reviewed source `40e5ff59b43e464be8b27f6c4f1be479ecc38ade`;
the integrated source includes the owner’s Rogue-card migration and updated delivery notes.

Official CI preview [run 40131799858, job 120984878050](https://github.com/cehinds/AshenSpire/actions/runs/40131799858/job/120984878050)
reported actual merge `530e41c0`, build `0.7.1.1814` / source `ddf4bd050f`:
shipped checks 12, external checks 314 and negative plants 22 passed. These CI
checks are separate from native browser QA. The local pack passed external 314.
The stable review branch also built successfully in [run 40134080950, job
120991769410](https://github.com/cehinds/AshenSpire/actions/runs/40134080950/job/120991769410),
artifact `12575992549`. That successful artifact is not a public-HTTP claim.

[Play the verified frozen review build](https://cehinds.github.io/AshenSpire/branches/fix/CombatLogConsoleReview/latest/).
Trusted public deployment [run 40135055513, job 121001218969](https://github.com/cehinds/AshenSpire/actions/runs/40135055513/job/121001218969)
verified this exact route at source `e38ae247e570435a347318f99edb3877772c56c8`;
all 26 feature-preview HTTP checks passed at 2026-10-24T22:15:41Z.
This is actual deployed-HTTP proof, distinct from the local browser captures.

| File | CSS viewport | DPR | Input | Visible surface | Captured UTC | PNG SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| phone.png | 375 × 667 | 3 | Touch taps; mobile emulation | console | 2026-10-24T21:29:32+00:00 | `ce9ffd401bbc464150418bdcd450179aedbc5ce6ae1465cb34c59e03ae6063d5` |
| tablet.png | 768 × 1024 | 2 | Native click; touch-enabled context | setting | 2026-10-24T20:56:00+00:00 | `cd3dd64479df5523371673398d8590681e0db1e5f3c5f7a61846702ab674be91` |
| desktop.png | 1280 × 720 | 1 | Native click; pointer context | log | 2026-10-24T20:56:19+00:00 | `f8b2036290d931ccff47d34a2b82ae80294f86a01439b1a50f7fce62352c4f7f` |
| wide.png | 1920 × 1080 | 1 | Native click; pointer context | console | 2026-10-24T20:56:31+00:00 | `66560dcec35e608e0a6702f097048679716c3c74b330dddd0a6f36190f70fd8f` |

All four originals were viewed and accepted. The original five viewport cases used
browser-native clicks in contexts with touch capability where configured. Two
additional mobile-emulation cases, 375 × 667 and 320 × 568, used genuine touch taps
(`locator.tap()`, mobile mode enabled); both passed. The required phone image is
from the 375 px touch run; tablet, desktop and wide images are from the original
five-case run. The 320 px images and all raw reports remain in scratch. The flow used
the Combat menu, Settings → General → Combat → Combat log, the Console preference,
Combat log and Console. It checked capture before opening, actual text download
contents, Copy, viewport fit, nested Escape/focus return, and unchanged combat.
All seven final contexts and their browsers closed. Touch runs also exercised
the native footer Close controls for Console and its parent, reopen, and keyboard
Escape/focus return. No real page exceptions or resource
failures were recorded. Intentional `QA_CONSOLE_2284_*` markers and the exact
Chrome vibrate-policy notice were classified separately. Any existing benign
ResizeObserver notification remains a notice rather than a failure banner.

Boundaries: browser emulation with ephemeral Core-showcase settings; no reload
persistence or physical-phone share claim. A console Error marker is intentionally
a safe summary without stack frames. Uncaught-error location and existing trace
reuse are covered by focused unit tests, not by an uncaught-error browser claim.
The command log remains a separate diagnostic view. No live game, CSS or RNG
changes were injected. Earlier harness and preliminary runs, prior packs and old
capture originals remain outside the repository as diagnostic evidence.

## README gallery and link verification

Trusted public deployment [run 40135055513, job 121001218969](https://github.com/cehinds/AshenSpire/actions/runs/40135055513/job/121001218969)
verified Release at 2026-10-24T22:14:15Z: build `0.7.1.1784`, commit
`2f6603ba019c583bd58c6dc28b30df2cfe33b8fc`, source `d71537edb1`,
14,966,137 HTML bytes, SHA-256
`c5090a3e7e26da4a87d7a2ea42fe4ab758b6920dfe67783494414e38c1dcd32f`.
This matches the existing [Release gallery record](../../releases/0.7.1.1784/README.md),
so its six screenshots are retained. The same deployment separately verified the
frozen review route above.

One bounded executor HEAD pass across the four primary channels’ play, download,
badge and history targets was blocked by the configured proxy (CONNECT 403).
Those are not product HTTP failures. Published-game HTTP/source verification and
assembled-site badge/download/history route evidence are distinct; no additional
direct badge/download/history HTTP claim is made here. Workbench, installers and
unrelated external links were not newly verified by this feature session.
