# AshenSpire local maps — batch 01

Open `gallery.html` for labeled previews, full-size source/export links and exact prompts. `previews/labeled-gallery.jpg` is the portable contact sheet.

| Stable revision ID | Region | Destination | Dimensions | WebP bytes |
| --- | --- | --- | --- | --- |
| MAP-01-briar-sanctum | Hollow Weald | Briar Sanctum | 1536 × 1024 | 658660 |
| MAP-02-hall-of-mirrors | Pale Marches | Hall of Mirrors | 1536 × 1024 | 646472 |
| MAP-03-furnace-chapel | Cinder Reach | Furnace Chapel | 1536 × 1024 | 574648 |

All three paintings were created with built-in image_gen on 2026-09-19. Exact prompts and input reference provenance are recorded in `provenance.json`; `manifest.json` adds delivered filenames, dimensions and byte sizes. The Bellfoundry reference was inspected and used for style/camera context, never overwritten. Destination names and region associations follow the game's boss destinations and three region seats; the depicted architectural layouts are new art concepts, not established geographic canon.

Original PNG masters are in `sources/`. Full-size WebP exports are in `webp/`, encoded at quality 88, method 6, without resizing. Combined export size is 1,879,780 bytes versus 11,860,995 source bytes (84.2% reduction). Lower-resolution previews are separate. `build_pack.py` reproduces packaging using Pillow; it does not generate or retouch artwork.

Review: all generated paintings visually inspected for coherent regional identity, elevated map perspective, distinct main landmarks and absence of text/UI. All full-size WebPs decoded successfully and retain original dimensions. Painted routes have not been fitted to a game graph or tested as playable geometry. No existing assets or runtime files changed. Request revisions by exact stable ID; preserve this first batch when making later variants.
