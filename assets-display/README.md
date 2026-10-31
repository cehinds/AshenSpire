# Display art libraries

The alternative appearance is the default. With the debug flag enabled,
**Settings → Advanced → Import, export & debug → Diagnostics → Classic appearance**
selects the previous character art and battlefield layout. This is a saved
visual preference; combat rules and saves are shared.

| Library | Contents |
| --- | --- |
| [classic](classic/library.json) | Previous character poses, equipment and combat scenery, indexed by their canonical packed asset IDs. |
| [alternative](alternative/library.json) | Reviewed figures and class action frames, indexed here; image bytes come from the verified common art pack. |
| [shared](shared/library.json) | UI, icons, card frames, portraits, fonts, music, maps and other common assets. Companion icon bytes come from the verified common art pack. |

Classic and shared pack assets retain their canonical `assets/…` IDs and live in
the pinned external art release (`art-release.json` / `art-manifest.json`). The
indexes group those assets without duplicating packs or changing old save IDs.
New display exports use `assets-display/alternative/…`; common exports use
`assets-display/shared/…`. Each library records its source and hashes. These folders retain only game-owned JSON/Markdown metadata; runtime display images are read from `.art-cache/<tag>/common/assets-display/` after verifying the pinned release. Edit display images in the separate `AI-Art` checkout on branch `ashenspire`, under `common/assets-display/`; use an explicit `ASHEN_ART_CHECKOUT` or `--asset-root` for authoring.

After updating the pinned art release or export catalogs, regenerate and verify:

```sh
node tools/display-art-library.mjs --write
node tools/display-art-library.mjs
```

The legacy `--organize` migration is restricted to explicit `ASHEN_ART_SOURCE=trees` copies. Normal authoring uses the separate AI-Art checkout; these game folders hold metadata, not image outputs. See [the authoring guide](../docs/ART-AUTHORING.md). See [credits and unresolved rights records](../CREDITS.md).
