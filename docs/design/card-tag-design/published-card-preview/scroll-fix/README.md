# Gallery scroll regression — 2026-10-16 UTC

The standalone gallery inherited the full-screen game's `html` and `body` height/overflow constraints. After expansion the mobile body contained36,133px of cards but the document's scroll range was zero. Native wheel input could not reach any later cards. The initial public verification had counted the hidden card DOM without exercising scrolling through the public wrapper.

The fix changes only the gallery's own final style block: root height becomes auto with vertical scrolling; body height becomes auto with visible overflow. It preserves the actual production CSS, all card markup, illustrations, centered effect boxes, title fades, full rules and runtime. Canonical `ingame-look-preview/index.html` contains the same override, so future exports retain the correction. The shipped `build.txt` was patched with this exact source-style substitution; provenance records both hashes and the byte-level change.

- Before SHA256: `f402742bbdf84ba368020a0992ee063546c57881f48a6e3f91c791eb60250291`,11,139,723bytes.
- Corrected SHA256: `04e17eaf2cf1ebb3d393d2aa0e26a62f3fe0873f0a3f0e8e3df862debfb28d5a`,11,139,814bytes.

`before-metrics.json` reproduces the failure at390×844,1024×768,1440×900 and2560×1440. Native wheel scrolling stays at zero in every viewport; body content extends below the fixed, hidden root. `after-metrics.json` records the same four sizes after the fix: wheel reaches the70th card, Restrained, at document offsets35,370 /11,846 /11,714 /11,174px. The70th card opens its full inspection, Escape closes it and restores the previous scroll position, and collapsing/reexpanding leaves the gallery scrollable. There is no horizontal overflow or browser page error. Four `after-*-last-card.png` images show the last card through the opaque sandbox wrapper.

The first four-profile run used the production wrapper's exact CSP, sandbox attributes and viewport layout with an equivalent compact fetch/srcdoc loader. `serve-exact-wrapper.mjs` then extracts the unchanged `previewWrapperHtml`, `PREVIEW_SCRIPT`, CSP and sandbox constants directly from `origin/dev:tools/pages-site.mjs` for the additional native input check. `exact-wrapper-mobile-input.json` records that exact-wrapper check: keyboard End moves from900px to35,370px; real CDP touch-start/move/end input pans back to34,670px; the70th card inspects and Escape closes it. The child origin is `null`, touch-action is auto, all images decode and all70 cards retain one fade. The earlier synthetic-scroll-gesture probe in `after-metrics.json` reported false; the actual touch event test is the accepted touch evidence. An independent reviewer also reached card70 with eight touch swipes and verified End from mid-gallery.

To reproduce, use a checkout containing the source game and history, with Playwright available through `CODEX_PRIMARY_RUNTIME_NODE_MODULES`:

```sh
ASHENSPIRE_REPO=/path/to/AshenSpire node serve-exact-wrapper.mjs
ASHENSPIRE_REPO=/path/to/AshenSpire node check-scroll.mjs before
ASHENSPIRE_REPO=/path/to/AshenSpire node check-scroll.mjs after
ASHENSPIRE_REPO=/path/to/AshenSpire node check-exact-input.mjs
```

The server listens at127.0.0.1:8771. It serves the historical `ab18a73cd` payload under `/before/` and the corrected sibling `build.txt` under `/after/`. `CARD_PREVIEW_BUILD`, `CARD_SCROLL_URL` and `CARD_SCROLL_OUTPUT` can override artifact, URL and evidence locations. Browser launches use the project's private-profile `tools/browser.mjs` and close in finally blocks. These are sandbox-shaped local regression checks; public delivery is verified separately only after the corrected artifact is published.
