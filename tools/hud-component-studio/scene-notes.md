# HUD component scene

This is an editable authoring study of the approved idle, player-selected, and enemy-selected HUD composition. It contains 224 named nodes on a 512 × 960 canvas. It does not implement gameplay.

The approved reference is copied unchanged to `reference.png`; its comparison headings and three panels are intentionally not baked into the editable canvas. Original component files are copied byte-for-byte into `assets/`. `assets.manifest.json` records each source path, SHA-256, dimensions, file size, and whether its format has an alpha channel. The source preparation performed metadata reads and file copies only; it did not crop or paint raster files. Source paths are portable repository/release paths, with their repository and art release named in the manifest.

## Source art and fidelity

- The snowy far scenery, Gothic ruins, floor, and optional foreground are existing independent scene planes from the reviewed combat-depth package. These are separate original sources, not components extracted from the approved screenshot. Their geometry and painting differ from the reference illustration. The optional foreground is hidden to retain the reference's open standing area.
- The default rear Reaver and Stitched Hound images are the original high resolution alpha masters (1024 × 1536 and 1536 × 1024). They contain painted translucent ambience and differ from the illustrated smooth-cloak player and hounds in the approval image. Existing compact transparent runtime sprites (171 × 256 and 256 × 171) are retained for the separate crisp selection halo masks and are also available as replacement assets. The source image bytes and alpha are preserved throughout.
- The card base, parchment, green cost medallion, blue mana gem, footer frame, stamina orb, draw/spent icons, menu, and shield are existing independent source components. Their original alpha and bytes are preserved. `trim` changes the SVG viewport used to display an asset without modifying its file.
- Card illustrations are existing Slashing Strike and Gorefire Slash source artwork. The third card uses the existing Shield Bastion illustration for the Bastion Blow study; this is a source-art substitution and not an exact cutout of the reference's third-card painting.
- The footer's three-potion tray is a pre-existing composite source. It is independent from the footer. Three separate source flask nodes are also available and initially hidden. The combined potion tray is not described as three separately authored bottles.
- Header item badges use the existing Forsaken Medallion and Ashen Grip relic artwork: the round gold pendant and gold-studded dark wrist cuff seen in the reference composition.
- Heart/fade/ribbon assets are authored SVG UI shapes. The scene's panels, borders, tracks, fills, information letters, labels, hotkeys, numbers, and rules are live primitive/text nodes. No emoji substitute for illustrated art is used.

## Editing and state model

Every node has an explicit stable ID, positive dimensions, a human-readable name, and a parent ID or `null`. Child coordinates are local to their parent. Group transform changes propagate to the children. Nodes can be repositioned, scaled, rotated, recolored, hidden, or adjusted in opacity; source image color adjustment is handled by the editor's image tint controls. The scene uses Georgia text for dependable canvas export. Original font files are retained in the asset library but are not required by the scene.

The default state is `player-selected`. State differences use node property overrides. The near-feet player HP strip remains visible in all three states. Player values are consistently 100/200; the two hounds are 16/16 and 19/19. Expanded player name, separator, level, HP, Poise label/value, and Ward label/value are separate live text layers. Selected enemy intent, information, name, and HP layers are separate from its idle intent/HP layers.

Player and enemy selection halos are separate image leaves using `glowColor`, `glowBlur`, and `glowStrength`; the editor renders and exports these effects from the source alpha. The card illustrations sit inside clip groups. Assets with padding use `trim: [sourceX, sourceY, sourceWidth, sourceHeight]`; this is a display viewport, not a rewritten cutout.

`scene.json` is the checked-in editable seed. Import an exported layout to continue editing, and export JSON to keep a durable copy of later changes. The original machine-specific preparation script is intentionally omitted. This standalone authoring tool does not modify the runtime game.
