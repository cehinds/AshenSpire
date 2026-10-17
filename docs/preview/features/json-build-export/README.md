# Capture record — JSON build export (#2072)

- Feature: rules, screens, maps and art as JSON compiled by one build; visible changes are the two combat HUD fixes (no per-frame HUD re-measure on phones; player bar anchored over the player).
- Source commit: `61e519450c50d01eaa9e80e16fd60b68b89c520d` (branch `Feature/JsonBuildExport`).
- Build: release 0.7.1, ordinal 1553, digest `8cc27b651b` (buildordinal.json at capture). Feature preview workflow run [39067388792](https://github.com/cehinds/AshenSpire/actions/runs/39067388792) built this commit successfully.
- Captured: 2026-10-17, local source server (`?shot=combat`, first fight of the seeded run), headless Chromium, common art pack hd-assets-v23 verified, zero page errors.
- Viewports: mobile 390×844 (touch), desktop 1440×900, wide 1280×720, tablet 768×1024 (touch).
- Playable URL: https://cehinds.github.io/AshenSpire/branches/Feature/JsonBuildExport/latest/ — the branch route served `build.txt` (HTTP 200) on 2026-10-17; that the hosted copy is this exact commit was not confirmed from the capture environment (pages-builds runs were queued/cancelled by concurrency at the time).
