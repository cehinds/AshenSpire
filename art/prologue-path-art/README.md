# Final journey backgrounds by starting path

The prologue's final scene selects art from the run's actual starting destination. The selection does not draw random numbers or depend on class.

| Start | Desktop background | Mobile background |
| --- | --- | --- |
| Hollow Weald | `assets/prologue/step-weald-desktop.webp` | `assets/prologue/step-weald-mobile.webp` |
| Pale Marches | `assets/prologue/step-marches-desktop.webp` | `assets/prologue/step-marches-mobile.webp` |
| Cinder Reach | `assets/prologue/step-reach-desktop.webp` | `assets/prologue/step-reach-mobile.webp` |
| Crownfall (World Journey) | `assets/prologue/step-crownfall-desktop.webp` | `assets/prologue/step-crownfall-mobile.webp` |

Each of the four starting views now has a desktop and mobile composition. The Pale Marches and Cinder Reach plates began as newly generated paintings; the Weald and Crownfall plates were edited from existing journey art. All eight final plates were refined with the built-in image tool and imagegen skill, using `assets/bg/title-city-tower.webp` as the visual reference for the distant **Ashen Spire**. They preserve each region's path and the dark, highly detailed medieval painterly style, with an empty foreground patch for the separately rendered player character. No text is baked in.

PNG masters are in `masters/`, initial generation prompts and exact final refinement prompts in `prompts/`, WebPs in `../../assets/prologue/`, and checksums and sizes in `manifest.json`. WebPs were encoded at quality 84, method 6, at generated dimensions without cropping or resizing. `export_webp.py` reproduces the export. Existing `road-*` and `step-*` plates were preserved for provenance.

The final scene continues to use the run's real destination name as its caption. Existing custom scene art choices still work; regional selection applies when the final scene uses its standard `step` artwork. Settings preview without a run shows Crownfall.
The final scene starts with its artwork focused toward the top, keeping the distant Spire visible when the game crops a desktop plate. The scene editor can preview each starting path on desktop and mobile and lets the owner adjust this focus.

Both formats were visually inspected after compression. The regional road, climate, distant unlit Ashen Spire and actor placement area remain readable. Verification runs focused prologue tests and validates every entry in `art/prologue-2026-09-19/assets.json` against shipped WebP dimensions, bytes and alpha.

The Crownfall desktop and mobile plates were refined again to add two very small towers on the mountain summits flanking the central Ashen Spire. The left peak is snow-dusted; the right has a restrained volcanic ember glow. Their exact edit prompts are `prompts/crownfall-towers-desktop.txt` and `prompts/crownfall-towers-mobile.txt`. The PNG masters and compressed WebPs were visually inspected after this edit.
