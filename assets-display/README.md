# Display art libraries

The alternative appearance is the default. With the debug flag enabled,
**Settings → Advanced → Import, export & debug → Diagnostics → Classic appearance**
selects the previous character art and battlefield layout. This is a saved
visual preference; combat rules and saves are shared.

| Library | Contents |
| --- | --- |
| [classic](classic/library.json) | Previous character poses, equipment and combat scenery, indexed by their canonical packed asset IDs. |
| [alternative](alternative/library.json) | Layered scenery, figures, and class action frames. Export bytes are stored here. |
| [shared](shared/library.json) | UI, icons, card frames, portraits, fonts, music, maps and other common assets. Companion icons are stored here. |

Classic and shared pack assets retain their canonical `assets/…` IDs and live in
the pinned external art release (`art-release.json` / `art-manifest.json`). The
indexes group those assets without duplicating packs or changing old save IDs.
New display exports use `assets-display/alternative/…`; common exports use
`assets-display/shared/…`. Each library records its source and hashes.

After updating the pinned art release or export catalogs, regenerate and verify:

```sh
node tools/display-art-library.mjs --write
node tools/display-art-library.mjs
```

The one-time `--organize` migration moves registered old exports without changing
their bytes. Unknown files remain in place. Authoring sources stay in the
Combat Studio / Pose Studio packages and the external art repository; these
folders hold runtime libraries. See [credits and unresolved rights records](../CREDITS.md).
