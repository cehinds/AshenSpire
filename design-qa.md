# Character Creation Design QA

- Source visual truth: `C:\Users\const\.codex\generated_images\01a02dea-009d-75b3-94a8-d7c673b40388\exec-789a781e-d30c-4fd6-a3a1-574328fc85a4.png`
- Implementation screenshot: `C:\Users\const\Documents\Codex\2026-08-22\realtime-voice-chat\outputs\character-creation-components-after-desktop.png`
- Combined comparison: `C:\Users\const\Documents\Codex\2026-08-22\realtime-voice-chat\outputs\character-creation-components-design-comparison.png`
- Responsive evidence: `character-creation-components-after-mobile.png`, `character-creation-components-equipment-desktop.png`, `character-creation-components-equipment-mobile.png`, and the desktop/mobile component-catalog captures in the same output directory.
- Viewport: source 1487 x 1058 px; implementation 1440 x 1024 CSS px at device scale 1; mobile implementation 390 x 844 CSS px at device scale 1.
- Normalization: both desktop images were placed at native pixel dimensions on one 2960 px comparison board. Their aspect ratios differ by less than 0.1%, so no resampling was applied.
- State: dark theme, Class expanded, Reaver selected, list view selected. Additional implementation captures cover Starting Equipment and the catalog.

## Findings

No actionable P0, P1, or P2 differences remain for the component implementation.

- Fonts and typography: the existing AshenSpire display/body families, gold hierarchy, small-caps labels, line height, and wrapping remain consistent. The implementation keeps existing shipped typography instead of rasterizing text from the mock.
- Spacing and layout rhythm: the 30/60 configurable split, bordered panes, vertical class cards, disclosure rhythm, and pinned continuation action preserve the mock's hierarchy. The production screen is intentionally denser so Back/Begin remain available in the existing game shell.
- Colors and visual tokens: borders, gold selected states, parchment copy, black-brown panels, and muted secondary text resolve through existing theme tokens.
- Image quality and asset fidelity: live shipped sprite/equipment assets are used at native browser quality. The mock's aspirational shell logo and decorative icon art are outside this component pass and are being modeled in the separately requested reusable-asset task; no screenshot crops, handcrafted SVGs, or CSS-art substitutes were introduced here.
- Copy and content: the title, subtitle, class descriptions, resources, relic copy, section labels, and continuation actions match current authored game content and requested flow.
- Responsive behavior: at 390 x 844 the preview and selector stack, the desktop divider is removed, touch targets remain usable, and every tested section reports no horizontal overflow.
- Accessibility and interaction: disclosure buttons expose expanded state; List/Grid and Standard/Assign modes expose pressed state; the splitter supports pointer and Arrow/Home/End input; focused selectors persist; the browser pass reported no uncaught exceptions.

## Focused evidence

The full comparison board retains both images at native density and makes the class split, selector cards, resources, relic, and disclosure rows readable together. The divider was also checked against the user's focused crop at `C:\Users\const\AppData\Local\Temp\codex-clipboard-35f3c808-e407-44f2-bd24-52698f09495a.png`. A browser regression now measures the handle center against the actual midpoint between the two panes.

## Comparison history

1. Initial comparison and user crop found a P2 divider-handle alignment defect: the minimum touch width overflowed from the narrow grid track and the two chevrons could wrap vertically.
2. Fix: center the full accessible hit target with `justify-self: center`, keep a 44 px touch width, and force the chevrons onto one centered line.
3. Post-fix evidence: `C:\Users\const\Documents\Codex\2026-08-22\realtime-voice-chat\outputs\character-creation-components-after-desktop.png`; browser check `Class resize handle is centered between both panes` passed, with 71/71 desktop/mobile/catalog checks green.

## Primary interactions tested

- Class selection and List/Grid switching
- Splitter position and responsive removal
- Standard and Assign Points modes, including equipment-requirement refusal text
- Sprite, tint, sigil, keepsake, armour, both hands, relic, and section persistence
- Auto-advance and equipment List/Grid switching
- One-armament/one-hand movement
- Begin consuming current selected values
- Component-catalog rendering at desktop and mobile
- Browser exceptions and horizontal overflow

## Follow-up polish

- P3: swap in the future branded shell logo and bespoke resource/section icons when the separate asset-library task delivers approved production files. The components already accept injected asset-backed content.

final result: passed

---

# Combat Command Bar Design QA

- Source visual truth: `C:\Users\const\.codex\generated_images\01a03f3d-e98a-7453-b238-1fe4ebade7c4\exec-9521fc29-1000-418d-b0df-4d5fe4c3bddd.png` (952 x 1653, SHA-256 `BF78ECEEE5024EFA85EE87662B75B9B93212D001D504AD85BBC31E755369DBB9`).
- Primary implementation screenshot: `docs/preview/combat-command-bar-approved/action-row-approved-source-390x844-text-xl-hand-8-rest.png` (390 x 844, SHA-256 `13841D678C0C7046770857A286A6C510EE6DC1EC0F19773D2D9D5A8F40BFED5F`).
- Combined comparison: `docs/preview/combat-command-bar-approved/qa-comparison-approved-390x844.png` (876 x 844, SHA-256 `7A2F2445E080A9B01C35146D63E5A2F75B765F26114E2D9A96D79905D7D10FF3`).
- Responsive evidence: `action-row-approved-source-1200x730-text-m-hand-7-rest.png` and `action-row-approved-source-844x390-text-xl-hand-8-rest.png` in the same preview directory.
- State: solo combat, original four-button Quick Access visible, eight-card portrait hand, no Armaments rail control, Exhausted at zero.
- Normalization: the approved reference was scaled proportionally to the implementation's 844 px height and placed beside the native 390 x 844 screenshot. No crop or production asset was created from either image.

## Findings

No actionable P0, P1, or P2 difference remains for the requested command-bar layout.

- Actions remains circular and owns the bottom-left edge.
- Draw and Discard sit 4 px from the larger centered End Turn control; their gaps are symmetric and their labels remain bounded.
- Exhausted remains present at zero and owns the bottom-right edge.
- Armoury, Menu, Crimson, and Azure remain the four visible Quick Access controls; combat no longer mounts the Armaments radial or hides the flask controls.
- Draw, Discard, and Exhausted open separate pile surfaces. Flask keyboard shortcuts continue to open menus against their visible Quick Access anchors.
- At 390 x 844, 320 x 640, 844 x 390, and 1200 x 730, every control is on glass, at least 44 px, 45/45 hit-testable, and clear of cards and pagers. End Turn center drift is 0–0.008 px.
- Source gate: 112 solo states and 2 co-op states passed. Independent settled standalone checks passed at 390 x 844 and 1200 x 730 in rest, armed, and exhaust states.
- Standalone artifact: `AshenSpire.html`, 4,237,093 bytes, SHA-256 `B400068BFCBBCB6E888CBC8AE325330BE2FF88AF1D62E766E3C91FA74B6792DE`.

## Comparison history

1. The approved mock established the bottom-left Actions anchor, tight symmetric center cluster, bottom-right Exhausted control, and four-button Quick Access panel.
2. The first current-base implementation exposed CSS-zoom track overflow: Draw crossed End Turn and the right edge could exceed its grid track.
3. Shared grid/control sizing tokens, bounded padding, and edge-specific sizing removed the overflow while preserving the 4 px cluster gaps.
4. One independent standalone sample read the first desktop frame before its geometry settled. The non-writing validator now waits for stable geometry for every state; five repeated product checks plus independent desktop/portrait reruns passed without changing the built artifact.

final result: passed

---

# Title Menu Design QA

- Source visual truth: `C:\Users\const\Documents\Codex\2026-08-23\ashenspire-asset-component-library\.codex-remote-attachments\01a03230-593b-7c31-ac0e-095f74f38b93\62753926-b830-4e31-a536-251bfa3adf41\1-Photo-1.jpg`, `2-Photo-2.jpg`, and `3-Photo-3.jpg`.
- Exact prototype sources behind the photos: `C:\Users\const\Documents\Codex\2026-08-23\ashenspire-asset-component-library\outputs\startup-menu-preview\screenshots-expanded-desktop.png`, `screenshots-load-desktop.png`, and `screenshots-load-mobile-390x844.png`.
- Implementation screenshots: `docs/preview/title-menu-wide-1440x900.png`, `docs/preview/title-load-wide-1440x900.png`, and `docs/preview/title-load-mobile-390x844.png`.
- Viewports: implementation desktop 1440 x 900 CSS px and mobile 390 x 844 CSS px, device scale 1. Reference exports are 1425 x 929 px desktop and 375 x 868 px mobile; the user-provided camera exports are 1280 x 834 px and 553 x 1280 px.
- Normalization: comparison used the design-owned game surface and ignored the isolated prototype's `PREVIEW` harness and surrounding black capture canvas. Source and implementation were opened together in one comparison input. No density resampling was needed for the implementation captures.
- States: expanded hall with Continue selected, LOAD modal with slot 1 selected, NEW modal selection/continuation availability, and borderless folded startup.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: Cinzel remains the production display face; the wordmark is parchment rather than saturated gold, menu tracking and slot serif treatment now match the preferred prototype hierarchy, and mobile modal type is compensated for the automatic UI zoom so it retains the reference's readable scale.
- Spacing and layout rhythm: the desktop menu renders at roughly 432 px wide, the modal at roughly 760 x 615 px, and the mobile modal at roughly 368 x 478 px. Slot rows and actions match the reference density while retaining the shipped minimum tap target.
- Colors and visual tokens: the implementation stays on the existing brown-black, parchment, muted brass, and gold tokens. The background remains the genuine shipped `bg_act1.webp` raster.
- Image quality and asset fidelity: no generated replacements, CSS illustrations, placeholder art, or screenshot crops were introduced. The supplied reference and shipped background are the only art sources.
- Copy and content: ASHEN SPIRE, A ROGUELIKE DECKBUILDER, Continue/Load/New/Collection/Settings/Quit, slot metadata, Back, and Continue match the selected target and current game records.
- Accessibility and interaction: semantic buttons/dialog remain unchanged; visible selected/hover/focus treatment is retained; LOAD and NEW open the reusable modal; Back closes it; NEW has a valid selected slot; mobile actions render at 50 px and slot rows at about 89 px; browser console reported zero errors.

## Focused evidence

The title lockup/menu and modal slot/action regions were compared separately because the reference capture includes prototype-only harness chrome. The production default now frames Continue like the selected reference. The folded state was also inspected after the restyle: `.startup-mark` computes to `border: 0px none`.

## Comparison history

1. Initial integrated capture was materially larger than the preferred prototype: the wide menu was about 516 px, the modal about 912 x 734 px, the first slot about 133 px high, and the mobile actions about 45 px high.
2. First fix restored the prototype's compact desktop proportions and serif slot treatment. Post-fix desktop measurements were about 432 px for the menu and 760 x 615 px for the modal.
3. Mobile comparison found the automatic 0.9 UI zoom made the modal type, slots, and actions smaller than the reference. The mobile rules now compensate for UI zoom while preserving Text Size scaling; post-fix slot height is about 89 px and action height is 50 px.
4. Final comparison restored the reference's default framed Continue state and confirmed no browser console errors.

## Follow-up polish

- P3: at unusually short wide canvases, production keeps its 44 px tap floor, so the menu is slightly taller than the isolated visual prototype. This is an intentional accessibility constraint.
- P3: production Quick Settings and build metadata remain present because they are shipped controls/evidence, not part of the isolated prototype harness.

final result: passed
