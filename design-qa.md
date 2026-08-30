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
