# Art-bundled v27 game captures

Actual self-contained game with `ashenspire-hd-assets-v27` light art; **no staged art injection**. Build **0.7.4.166**, digest **05ae2af4e2**. Artifact `build/download/AshenSpire.html`; artifact SHA-256 `6fc92e4078d0c0af2dcd9792697bcdc21d22214d29da9b7df188a9dd003e3390`. Built and captured 2026-11-18 UTC.

Source at capture: `311dd2b7729bf0872d4ce572b914c8663a110227` plus the then-uncommitted reviewed v27 art pin/manifest and preview-tool changes. The artifact digest identifies the actual built sources; the commit alone does not. The later derived game summary refresh did not change that digest (`buildversion --check`: 9/9 passed again).

## Actual combat screenshots

Each case boots the native core seed3 combat fixture, clicks the natural Ironbreaker card and a living enemy, and observes the real engine damage receipt. The browser clock advances the existing action timeline in 20 ms steps and holds after actual contact for a clear screenshot. Each contact reported `data-renderer="art"`, frames 1–3, and nonzero painted canvas pixels. No effect or receipt was invented. This is a single-action smoke test, not an earned campaign playthrough.

| Screenshot | Viewport |
| --- | --- |
| [Phone](v27-phone.png) | 390 x 844 |
| [Desktop](v27-desktop.png) | 1280 x 800 |
| [Wide](v27-wide.png) | 1920 x 1080 |
| [Tablet](v27-tablet.png) | 1024 x 768 |

All four screenshots were visually inspected; no page errors occurred. **Known phone presentation limit:** the large Poise reaction rim on the rightmost enemy extends beyond the screen edge; the target and turn controls remain visible. Its art geometry was preserved. The separate capped static debug fallback is verified in `BUILT-CAPTURES.md`.

## Controlled pinned-art previews

These use the source tool `tools/recipient-effects-runtime-preview.html` with its default pinned-cache resolution, without `artRoot`. They exercise the production resolver/renderer on actual game actor art, but they are explicit review scenes rather than engine combat receipts or screenshots of the standalone build.

- [Caster spell circle](pinned-spell-circle.png): Player invoker, Enemy recipient, at 250 / 600 ms; circle remains on Player.
- [Ward](pinned-ward.png): Player receives alteration Ward at 150 / 420 ms.
- [Evade](pinned-evade.png): Enemy invokes; Player afterimages at 150 / 300 ms.
- [Fire slash](pinned-fire-slash.png): Player invokes; Enemy receives single cut and fire overlay at 150 / 300 ms.

All four previews reported real art and nonzero painted pixels; no page errors. Detailed local records: `scratch/recipient-effects/built-art-qa/05ae2af4e2/report.json` and `scratch/recipient-effects/pinned-preview-v27/report.json`. The reviewed art-pinned source was subsequently committed as [`8f9c83460a4304c221e9ae0a610d6791f8bbd006`](https://github.com/cehinds/AshenSpire/commit/8f9c83460a4304c221e9ae0a610d6791f8bbd006), preserving the captured runtime digest. This is the later committed equivalent, not a claim that the earlier screenshots were captured at that HEAD.

## Public preview verification

[Play the public sandboxed feature](https://cehinds.github.io/AshenSpire/branches/feature/recipient-effects-integration/latest/) · [Successful exact-source build](https://github.com/cehinds/AshenSpire/actions/runs/44390259958) · [Immutable run artifact](https://github.com/cehinds/AshenSpire/actions/runs/44390259958/artifacts/14467591066).

On 2026-11-18, a direct GET of the public wrapper's `build.txt` matched the local standalone SHA-256 **6fc92e4078d0c0af2dcd9792697bcdc21d22214d29da9b7df188a9dd003e3390** exactly. Its compiled identity was **0.7.4.166 / 05ae2af4e2**; native pointer/Enter input opened the [public title](public-title.png) with that same visible stamp and no page errors. The Pages listing identified source `8f9c83460a4304c221e9ae0a610d6791f8bbd006`, although CDN responses briefly alternated with an earlier listing during deployment; the exact public artifact bytes establish the build identity.

**Public combat navigation was not completed:** Playwright's cross-frame locator click stalled after scrolling to New Game. This is an automation limitation, not a diagnosed gameplay failure or a successful public playthrough. The four real-combat captures above were taken from the byte-identical local standalone, without injecting source modules, staged artwork, effects or receipts.

The workflow artifact archive is named `feature-preview-8f9c83460a4304c221e9ae0a610d6791f8bbd006`; archive SHA-256 `9053e024a285cf48c015d6e9fa9baf72503b4f04cdfc2931c0f33917092764d9`. Artifact downloads require GitHub sign-in and can expire; the linked run and source commit identify the build independently of the mutable public `latest/` route. Detailed public identity and native-title evidence remains at `scratch/recipient-effects/public-v27/`; the failed automation report and original captures are preserved.
