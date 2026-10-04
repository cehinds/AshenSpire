# Signature starter paintings

Starstone Pebble, Urgent Heal, and Ambush now resolve to original painted card illustrations through the existing `playingCardArtwork` / `assetUrl` path. Gameplay and the Card Studio layer geometry are unchanged.

The art source is [AshenSpire-art PR 12](https://github.com/cehinds/AshenSpire-art/pull/12), including exact generation prompts, unchanged PNG masters, a deterministic cwebp export recipe and hashes. The 512px and 1024px versions have generated light twins; six light files add 21,034 bytes.

Open `index.html` with the repository preview server and use the artwork-quality selector to inspect all three cards. This page uses `renderCard` and the production styles. It does not read or write saved games.

Browser evidence covers high/light art at 1200px and 390px. Each of the 12 card/viewport/tier combinations decoded its expected painting with `data-card-art=official`, with positive rendered dimensions, no horizontal page overflow, and no page errors or failed requests. The quality selector was exercised by keyboard input. Evidence was captured through `tools/serve.mjs` after fetching and hash-verifying release `hd-assets-v10`; the tracked mobile twins were copied from that verified release. The screenshot WebPs are compact derivatives of captured PNGs.

Reproduce with `node tools/serve.mjs --port 8787 --no-open`, then `node tools/starter-card-art-browser.mjs`. Set `CHROME` to the installed Chrome or Edge executable if it is not auto-detected, and keep `TEMP`, `TMP`, and `TMPDIR` on D: on this Windows workstation. The browser tool also verifies that the production card layer stylesheet is active.

- [High artwork on desktop](high-1200.webp)
- [Light artwork on phone](light-390.webp)
- [Machine-readable browser evidence](browser-report.json)

The source paintings and desktop/mobile card crops were visually inspected. Existing two-line rule summaries still truncate longer card descriptions; this art pass does not change text fitting or card behavior.
