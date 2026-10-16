# Handoff to JSON game modules: core and current

For **Feature/json-game-modules (core)** and **Feature/json-game-current-preview (current)**, including the combined chat “Feature/json-game-modules · Core & current JSON profiles”. This document is the portable relay; it does not confirm that a direct chat message was delivered.

## Reuse the intent and shared presentation

[Reviewed worker source](https://github.com/cehinds/AshenSpire/tree/worker/rest-screen-layout) is saved through `8fbced2c0317d57779162b3e12c4024e3207b179`, based on dev `37c414acd8cbe954a298ea51dc1d29ab6903942a`. This changes the legacy rest presentation around `src/ui/screens/rest.js`: the implementation edits shared `src/ui/components/scenePainting.js`, `styles/player-polish.css`, and the targeted mobile-art policy/tests. Rest gameplay and service text were retained.

**Port these presentation intentions into the JSON profiles’ actual Rest implementation/shared components.** Their screen composition or JSON contracts may differ; do not blindly overwrite their Rest files, import an old gameplay model, or cherry-pick the whole branch without checking the receiving architecture. Core should own reusable presentation/profile contracts; current should demonstrate the matching UI with its own current data and behavior.

Acceptance criteria:

- Desktop: compact right-side rail, 380 physical pixels wide. Widescreen/ultrawide: 400 physical pixels. Normalize against the existing UI zoom; do not enlarge global controls or fonts. Service titles/descriptions use readable 18/16 physical pixels.
- Preserve the traveler/fire aspect ratio and cap the traveler image at 462 physical pixels wide. Wider screens reveal scenery rather than enlarging the actor. Keep a coherent single campsite and grounded feet.
- Mobile 390×844 and tablet portrait 834×1194 use a readable lower tray; tablet 1024×768 also works. The tray fits its content, with scrolling as needed and Continue docked. All services remain reachable; flask expansion and Level up continue working.
- Verify desktop 1440×900, widescreen 2560×1440, and actual ultrawide 3440×1440. The ≥2000px, ≥2:1 profile selects the approved expanded chapel artwork; the 16:9 profile retains its own painting. Do not stretch, mirror, tile, or enlarge a 16:9 painting to simulate extra side scenery.
- Keep layout/art work separate from gameplay mechanics, balance, and JSON-profile authority.

[Gallery, wireframe, QA and reproduction](README.md) · [Capture provenance](capture-provenance.json) · [Physical geometry](geometry-before-after.json) · [Data-URI picture-source check](data-uri-source-metrics.json).

[Local source preview](http://127.0.0.1:8795/index.html?shot=rest&shotRestState=wounded) is **loopback only**, meaningful while this workspace’s preview server runs. It is not a hosted build; use the adjacent reproduction instructions elsewhere. Local acceptance: 28 focused tests passed; mobile/16:9 containment, ultrawide high/light, and actual WebP data-URI source/fallback checks passed. This is not full production-pack/build validation.

## Canonical art dependency: still blocked

Two canonical IDs are prepared:

- `assets/player-polish/scenes/chapel-rest-desktop.webp`: high 1672×941; canonical light 1279×720.
- `assets/player-polish/scenes/chapel-rest-ultrawide.webp`: approved generated high 1938×812; canonical light 1718×720. The generated center is reinterpreted; exact original-pixel preservation is not claimed.

[Hashes and policy details](README.md#art-dependency-and-continuation) · [Complete portable art patch, approximately 5.2 MB](chapel-rest-art.patch) · [Art receipt](chapel-rest-art-receipt.md).

The patch includes both high/light pairs, targeted policies/tests, generated records, the original ultrawide PNG master, and exact generation provenance. Local art commits are `d606aaece937379261cd1591ab5cd6811ae11145`, `2bf5dc64bfa59536e2c1da308d92a0db53d98f19`, and `f1c296ea6c250723966befb30998877548c29b7e`.

Art-repository writes still returned **403 at the last 2026-10-16 05:20 UTC retry**, even though public metadata reported `permissions.push: true`. The user intends to enable GitHub app access; successful access has not yet been verified. The managed cloud environment is connected and restricted: `github.io` is not allowlisted and no outbound identities are configured there. Do not infer that all GitHub credentials are absent: pushing this game worker branch succeeded.

Required order: restore/verify art access → reviewed art PR and normal CI → merge to art main and automatic immutable release → update the game feature’s art pin and derived manifest → build and QA both tiers/profiles → review/merge the receiving feature only. **No game dev/main promotion is authorized by this handoff.** Do not ship these runtime IDs against the old art pin or bypass the art pipeline with local preview copies.

## Related card presentation relay

[Live CardPreview gallery](https://cehinds.github.io/AshenSpire/branches/Feature/CardPreview/latest/) is a separate published visual exploration: **6 featured designs plus 70 proposals**, including Simple art, the correct dark title fade, centered effect text limited to 2–3 lines, and inspection. Parent review verified CI run [38855179710](https://github.com/cehinds/AshenSpire/actions/runs/38855179710) and published-byte hash prefix `f402…`; this handoff does not claim a fresh fetch from the restricted environment.

Use these as visual proposals for shared card presentation, **not mechanics authority**. Do not overwrite newer MP balancing or decisions owned by the other chat. The rest worker branch does not contain the separate CardPreview implementation; reconcile that effort’s own source and current contracts before reuse.

## Done and pending

- [x] Reviewed rest layout, physical-size criteria, gallery, wireframe, local QA, and portable art dependency saved to the origin worker branch.
- [x] Accepted local ultrawide scene and canonical light export tested; source selection/data-URI fallback checked.
- [x] Portable handoff addressed to core and current JSON-profile efforts.
- [ ] Direct chat delivery confirmed; current tools did not expose thread messaging/handoff.
- [ ] Art-repository access restored and verified; art PR/CI/release completed.
- [ ] JSON-profile owners adapt the shared intentions to their current architecture and reconcile newer gameplay/balance decisions.
- [ ] Feature art pin/derived manifest updated, both tiers built and tested, receiving feature reviewed/merged. No dev/main promotion.
