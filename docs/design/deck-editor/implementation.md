# Reading Desk implementation, October 3, 2026

The six illustrations were recovered from **Show deck editor illustrations**
(`01a0ffde-bdb8-75e1-b27a-29a23598427b`). The original design chat was
`01a0ee2d-2ae5-7110-90f7-fa014213546a`. Reading Desk was the selected direction
in that work. The separate authoring editor already has its own implementation
at commit `6bba8aa`; this branch adapts the design to AshenSpire's actual game
deck editor.

## Inventory and provenance

- Three desktop concepts: Reading Desk, Card Library, Deck Workbench.
- Three mobile concepts: browse, full-card inspection, folded deck list.
- Seven existing card paintings at two resolutions, the existing outline
  catalogue, and the title-city backdrop. No new artwork was generated.
- `provenance.json` records the original paths and matching SHA-256 hashes for
  all 78 recovered files. Reference illustrations remain intact.

## Local implementation

Open `http://127.0.0.1:4340/deck-reading-desk-preview.html`. It mounts the actual
`mountDeckEditor` renderer against an isolated Reaver run, without saved-game
storage. Add `?ordered=1` to inspect the existing ordered-deck controls.

The game renderer now uses illustrated collection rows, a persistent full card
and glossary, search, explicit add/remove, and a compact deck list. Phone
navigation exposes collection, inspection and deck views. Existing session
rules own mutations, copy limits, equipment locks, confirmation and cancellation.
Pointer drag and keyboard/controller equivalents continue to use that session.

Equipment profiles select paintings before base card IDs. This prevents, for
example, a staff's basic Strike from inheriting the sword painting. Cards without
paintings use their recovered outline artwork. All values and ownership counts
come from the current run rather than the illustrative reference text.

## Verification and shipping boundary

- 73 focused tests passed, including deck rules, editor DOM interactions,
  tooltip checks and the playing-card model's internal 588 assertions.
- Content generation is current; `git diff --check` passed.
- In-app browser: desktop and phone rendering, inspection without mutation,
  search, add/remove, equipment locks, mouse drag into the deck and Cancel
  rollback were exercised. Final inspected page logged no errors or warnings.
- Screenshots and the visual comparison are recorded in `/design-qa.md`.
- The complete game bundle is **unverified**: its pinned `hd-assets-v4` high art
  pack is absent from this worktree. The bundler reports that prerequisite.
- New artwork references currently point into this recovered local asset set.
  Move the approved assets into the normal art release and update references
  before shipping. No art release, remote CI, PR, merge or deployment was done.
- Physical touch/controller testing and owner visual acceptance remain open.
