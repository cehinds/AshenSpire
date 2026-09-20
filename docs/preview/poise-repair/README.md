# Poise repair preview

PR #1210, screenshots from build 0.7.1.303. Final build 0.7.1.304 has the same gameplay and artwork; its receipt was refreshed for the final push. Captured from the rebuilt external-art browser edition (`build/web/AshenSpire.html`) in Edge, at 1440 × 900 and 390 × 844. The page title and populated combat hand were checked before interaction. No blocking overlay remained after confirming End Turn.

The combat screenshot fixture uses Herald and reduced motion. To exercise Stagger deterministically, the fixture's player meter was set to 11/13 before a real enemy turn; no saved game was modified. End Turn and its confirmation were clicked, then playback was allowed to finish. Both viewports produced one Stagger, 27/46 HP, 2/3 actions, and Poise 4/17. The engine and paced-display regression separately checks sub-threshold impact and post-fill overflow values.

- [Initial desktop hand](desktop-mana-costs.png): Urgent Heal and Blight Touch show action, stamina, and Mana cost lines.
- [Desktop after enemy turn](desktop-stagger.png): Stagger penalties are present and the next turn has two actions.
- [Mobile after enemy turn](mobile-stagger.png): the same completed interaction at phone width.

The compact-equipment popup and creation info control were also exercised as real components at 80% and 140% interface zoom in a 1000 × 800 viewport. Both opened and remained inside the viewport. This component check does not claim a complete character-creation playthrough.

No JavaScript exceptions occurred. Browser console warnings were limited to existing missing favicon and optional `assets/sfx/hit.ogg` requests; the audio module has a synthesized fallback. The known party-headcount session-smoke failures remain outside this repair.

See the [shared component catalog](../../component-catalog.html) for component contracts.

## Compressed dungeon art

The owner approved WebP runtime compression. All 27 images retain their dimensions and exact alpha-channel bytes; originals are archived under art/legacy-dungeon-originals-2026-09-19/. Runtime images total 4,784,668 bytes, down from 32,372,720. Browser decoding passed for every image, and all three dungeon maps rendered without JavaScript exceptions. [Desktop dungeon](dungeon-BS-desktop.png) and [mobile dungeon](dungeon-BS-mobile.png) show the compressed artwork in the real map renderer. This check covers rendering, not a complete dungeon playthrough.
