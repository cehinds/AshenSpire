# Combat tag/source browser verification

PR #876, build `0.6.0.63`, rebased on dev `769dc18f`.

Run `node tools/combat-prototypes-browser.mjs` after rebuilding the standalone.
All 41 checks passed at 1365 by 1000 and 390 by 844 pixels, with no browser
exceptions. The harness opens the actual bundled game and uses pointer input.

The controlled loadout holds a Katana in the right hand and an Ash Staff in the
left. Sunderplate inherits Blood from the Katana; its inherited-tag tooltip names
the Katana, and legacy/categorized labels display Blood only once. Starstone Pebble
excludes Blood and produces a damage event naming the offhand Ash Staff when
played by clicking the card and enemy. Tag rows remain within the viewport.
The existing three-build workshop and retained Dodge checks also pass.

These are controlled fixtures with injected cards and resources, not a natural
run or a balance approval. The screenshots show the remaining weapon card after
the spell was played. Phone enemy sprites remain crowded in this existing scene;
the checks above concern card tags and source selection, not all battlefield art.

- [Desktop capture](combat-tag-sources/desktop.png)
- [Phone capture](combat-tag-sources/phone.png)

Engine source ownership, equipment swaps across all piles, exact preview/save
restoration, wrong-hand rollback, and payment-event source snapshots are covered
by `tests/attack-sources.test.mjs`. Together with the existing foundation tests,
28 focused tests pass. `node tools/attack-source-audit.mjs --check` passes 225 rows.
