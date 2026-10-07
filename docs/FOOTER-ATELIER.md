# Painted combat footer

The solo and co-op boards share `combatActionRow.js`. Footer Atelier in
AshenedSpire-Editor edits the separate artwork and text layers in
`content/config/ui/presentation/footerLayout.json`. The file wraps the portable
`ashenspire.footer` version 1 document in `components.layout`. Run
`node tools/config-build.mjs` after saving to rebuild the runtime module.

The editor offers grid/edge/centre snapping, docking, group movement, resizing,
and separate text position, font, weight, style, alignment, and binding controls.
Its connected checkout save shows a review and refuses a stale revision.
Exported JSON alone is a portable draft; saving the canonical file and compiling
is what changes the game.

Text templates use `{value}` with `sp`, `spLabel`, `draw`, `drawLabel`, `discard`,
`exhaust`, `endTurn`, `endTurnKey`, or `potions` bindings. `static` keeps literal
text. Discard/exhaust can also use `{label}` for the game's localized wording.
The font choices are `serif`, `sans`, and `mono`. Text is SVG/DOM text and
never part of an image. The SP ring still reads live mana capacity and spending;
the footer supplies its separately positioned stamina number and label.

Wide screens assemble the authored component positions. Narrow screens and
short landscape rails retain the same actions with readable compact labels and
44px minimum targets. Selection groups do not define game behavior: asset IDs
and bindings retain their meaning when layers are joined or detached.

The blank button plate, draw cradle, discarded cards, potion tray, and joining
rail resolve through `assetUrl()` under `assets/ui/footer/`. The art repository
ships full WebP images and light twins in its verified releases. Both standalone
downloads and the web edition use the same layout and live text.
