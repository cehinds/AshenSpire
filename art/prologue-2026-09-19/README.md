# AshenSpire opening art pack

Six scenes, desktop and mobile paintings, and four transparent class layers. Original art generated with the built-in Image Generation tool on 2026-09-19 using this repository's intro art and the owner's annotated back/belt placement reference. Exact prompts: `prompts.json`. No third-party game artwork was used.

## Open the editor

On this Windows computer, double-click **Open Studio.cmd** to start the local editor and open it in your browser. When using the ZIP, extract the entire folder structure first so its art paths remain intact.

The local preview is served at http://127.0.0.1:8770/art/prologue-2026-09-19/ while the task's server is running. To reopen later, run `python art/prologue-2026-09-19/serve.py` from the repository using an installed Python interpreter, then open that address. The bundled Python interpreter can also run `serve.py`. The server listens only on this computer.

Choose a scene thumbnail. Edit **Speaker** and **Dialogue** on the right (below the preview on a phone). Edits appear immediately and save in this browser. For **What you carry**, switch the Class menu to edit each class's own line. The text is never baked into an image. Scene titles, location caption, and player-facing button labels are also editable.

Under **Timing and button text**, **Transition (seconds)** controls the art transition duration for desktop and mobile. It defaults to **5 seconds** and is adjustable from 0 to 5 seconds. Scene hold times are edited separately. Timing changes save in this browser and are included in exported presets.

**Export edits** saves every scene, all four class lines, button text, timing/effects, and motif preferences in a portable JSON preset. **Import edits** validates and restores a preset without touching gameplay or saves. Keep an exported backup if you clear browser storage or switch devices.

**Download scene WebP** saves the current composition with the selected character and colour wash, without text. This produces all class/layout combinations without repeatedly generating the scenery. No artwork is sent to a remote service by the editor.

## Files

- `../../assets/prologue/`: 12 text-free backdrop WebPs and 4 transparent adventurer WebPs, about 5.1 MiB total.
- `masters/`: all 16 PNG masters, retaining RGBA transparency for class layers.
- `sequence.json`: canonical editable starting script and presentation defaults.
- `index.html`, `studio.mjs`, `studio.css`, `model.mjs`: the working art/text authoring preview.
- `prompts.json`: complete generation prompts and reference provenance.
- `generated-originals/`: unmodified tool output copies, including earlier mockups. Three zero-byte failed outputs were left in this archive for provenance; the masters and delivered WebPs are complete and verified.

| Scene | Desktop and mobile background stem | Foreground |
| --- | --- | --- |
| Remembered warmth | warmth | None |
| The stopped year | year | None |
| Last night | night | Neighbour painted into scene; this is not the player |
| What you carry | carry | Selected class |
| The road out | road | Selected class |
| The first step | step | Selected class |

Background filenames end in `-desktop.webp` or `-mobile.webp`. Foregrounds are `reaver.webp` (longsword across back), `starseer.webp` (staff across back), `rogue.webp` (short dagger across rear belt), and `herald.webp` (holy book at rear hip). All class items sit outside the cloak. They identify class visually and do not grant gameplay equipment.

## Motif and colour

The preview supports the actual interface accent palette from `src/content/balance.js` and character tint palette from `styles/base.css`/`src/ui/assets.js`. The wash is applied dynamically to art only. Subtitles remain ivory. The Last night scene caps the wash at 6% to preserve the ember's visual meaning. Default intensity is 14%; it can be set to zero. Gold character tint resolves to the active interface accent, matching the game's variable palette.

For game integration, resolve the palette from `run.customization.tint` or `settings.accent` according to the configured source; do not infer class from colour. The studio lets the author select the same values manually and does not read or modify the game's profile.

## Scope and lore

This is an art pack and working authoring preview, not a change to the new-game flow or the game's Advanced Settings. The earlier plan in `docs/design/new-game-prologue.md` remains the integration plan. Exported studio presets use their own schema and must not be imported into the game's existing general-configuration importer until an adapter is added.

Road/field art depicts the Hollow Weald route. Arrival follows the current atlas start, Crownfall, using the existing Crownfall map as architectural reference. Other classic starting seats require their own mapped destination art before full new-game integration. No claim is made that those region variants already exist in this pack.

The past is represented by a carved three-hearth relief. Present-day city lights are extinguished. The hut neighbour's burning is unfinished. The player's cloaked face remains obscured; arbitrary character body/armor customization is not yet represented by these four class layers.

## Verification

All 16 WebP files decode. The four class masters and WebPs retain transparency. Three focused model tests verify text/colour/timing export round trips, independent class lines, Unicode/empty text, and refusal of malformed presets without mutating current data. Browser checks cover live dialogue editing, persistence, class selection, tint and portrait layouts. These checks apply to the authoring tool, not unimplemented game integration.

The image tool exhausted C: while saving three foregrounds. This task's generated-image directory was moved to `generated-originals/` on D: and the old path replaced by a junction pointing here, so prior generated-image paths still work. The affected class images were regenerated and saved successfully; no unrelated files were removed.
