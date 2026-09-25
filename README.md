# AshenedSpire

A stripped fork of [AshenSpire](https://github.com/cehinds/AshenSpire) (source
commit `8540823c`, branch `dev`). Every line of game code, content data, tooling,
tests, build output and process documentation has been removed. What remains is
the raw material for a clean rebuild as a **Unity WebGL** game:

| Kept | Where | What |
|---|---|---|
| Runtime art | `assets/`, `assets-mobile/` | Sprites, animation frames, poses, enemy states, combat effects, environments, maps, prologue paintings, fonts, relic/equipment icons, asset manifests |
| Source art | `art/` | Masters, sprite sheets, scene layers, generation prompts and provenance |
| Low-poly references | `art/low-poly-fighters/` | Class kit and outfit turnarounds |
| Music | `music/` | Tracks, manifest, generation prompts |
| Wireframes | `wireframes/` | Mockup SVGs, approved wireframe specs and catalogs, sizing, colour/interaction and card contracts |
| Lore | `lore/` | The four lore bibles plus every piece of in-game prose (card/relic flavour, events, quests, places) |
| Tag and 3NF intent | `design-intent/TAGS-AND-3NF.md` | Why the tag system and the content tables are shaped the way they are |
| Rebuild brief | [`PROMPT.md`](PROMPT.md) | A self-contained prompt for building AshenedSpire in Unity from these files alone |
| Inventory | [`ASSETS.md`](ASSETS.md) | Folder-by-folder asset counts |
| Licensing | `LICENSE`, `CREDITS.md` | Original licence and asset provenance, unchanged |

Documents kept here quote paths from the original project (`src/…`,
`content/source/…`, `tools/…`, `docs/…`). Those files are not in this fork;
treat such references as history, not as missing files.
