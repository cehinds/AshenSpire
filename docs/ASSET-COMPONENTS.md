# AshenSpire asset components

Armoury component names are authored in `content/source/armouryUi.json` under
`assetComponents`. That JSON is the easy-to-edit registry: each entry contains a
stable `id`, a plain-language `label`, and the CSS `selector` that identifies the
rendered component. The runtime mirrors the stable id on `data-component`, so a
browser inspector, screenshot tool, or documentation link can name the exact
piece without guessing from layout.

The visual component folder is `assets/components/armoury/`. Keep screenshots,
reference art, and human-facing notes there. The registry remains the source of
truth for IDs and selectors; do not create a second hand-maintained ID list in
the asset folder.

Current IDs include:

- `armoury.panel`, `armoury.toolbar`, `armoury.close-button`
- `armoury.slot`, `armoury.slot.card`, `armoury.slot.selected`
- `armoury.inventory`, `armoury.inventory.item.folded`,
  `armoury.inventory.item.expanded`, `armoury.inventory.item.model`,
  `armoury.inventory.item.information`, `armoury.inventory.equipped-tag`
- `armoury.cards`, `armoury.cards.item`
- `armoury.drawer.resize-handle`, `armoury.hold.progress`,
  `armoury.hold.tooltip`

