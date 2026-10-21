# Stance rendering captures

Captured 2026-10-21 UTC from local packaged build **0.7.1.1759**, digest **3b32ce0feb**, production source **7d1e2fff7**. Later branch changes update tests and documentation only. HTML SHA256: `cd36880b6b2878fb6f398bde46e0a55a759ef04d73b93a6b014d05b5841e58b2`.

[Feature preview](https://cehinds.github.io/AshenSpire/branches/fix/StanceRendering/latest/) · [PR #2236](https://github.com/cehinds/AshenSpire/pull/2236)

The captures show the seeded three-enemy combat fixture with Strike selected, after images and fonts loaded. They are not a completed playthrough. Viewports: mobile 390×844, desktop 1280×800, wide 1920×1080, tablet 1024×1366. The tablet capture preserves the game's existing scene sizing.

Native-touch checks passed for offensive/defensive/Smash previews, returning to a prior stance, deselection, holding another card, resize, reduced motion and exactly one confirmed Strike with one SP spent. Hold/disarm and completed-hold action symbols remain inside the overhead meter rack. No page errors occurred.

Two clean Chromium CPU4× comparisons against 1758, with all 62 images and fonts ready, recorded stationary-hover tracking callbacks 25→0, selection HUD updates 9→7, and tracking-window extensions 6→3. Full fits and hand builds remained two each. Selection latency was mixed (1191→2875 ms and 1982→1376 ms), so no overall speed improvement or physical-phone benchmark is claimed. Four native switches between two offensive cards each drew the player canvas three times before and twice after; the existing neutral disarm/re-arm transition remains.

The Release README gallery was checked against release buildordinal: 0.7.1.1517 / a5b5079cb1, unchanged. Component identities and gameplay contracts are unchanged; see [component catalog](../../../component-catalog.html).
