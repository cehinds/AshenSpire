# Extended card illustrations

The approved roster is the exact current set of canonical base card identities and equipment profiles. Upgraded cards reuse their base illustration. Artwork is generated separately with portrait overscan for user cropping; this pipeline only converts those authored PNGs to delivery sizes.

`tools/export-extended-card-art.mjs` verifies each completed receipt against its PNG SHA-256 and dimensions before publishing. Incomplete receipts are left pending. Hash mismatches, unknown identities, non-portrait masters, missing files and inconsistent outputs fail the operation. A normal export requires every current subject; `--allow-partial` is an explicit preview mode.

Run from this checkout:

```powershell
node tools/export-extended-card-art.mjs --root D:/repos/.codex/tmp/card-art-staging --source-library D:/repos/AshenedSpire-Editor/art/card-portraits-2026-10-05
node tools/export-extended-card-art.mjs --check --root D:/repos/.codex/tmp/card-art-staging --source-library D:/repos/AshenedSpire-Editor/art/card-portraits-2026-10-05
node --test tests/extended-card-artwork.test.mjs tests/card-artwork.test.mjs tests/deck-editor.test.mjs tests/asset-pack.test.mjs tests/build-identity.test.mjs tests/art-source.test.mjs
node tools/fetch-art.mjs --pack all
node tools/bundle.mjs --out build/card-art-qa
python tools/card-art-contact-sheets.py --library D:/repos/AshenedSpire-Editor/art/card-portraits-2026-10-05
```

While production is in progress, omit `--source-library` to read `masters/` and `receipts/` from the editor's public card-art-library folder. Once generation finishes, keep masters and receipts outside `public/` so Vite does not copy authoring PNGs into the application build. `--library` independently chooses the optimized editor catalog destination; `--inventory` chooses the approved roster JSON. Defaults point to the local AshenedSpire-Editor inventory and public library. All generated outputs stay on D:.

Each receipt is `receipts/{kind}-{id}.json` with `kind`, `id`, `sourceMaster`, `sha256`, `width` and `height`; prompt, generator and original output provenance remain in that receipt. `sourceMaster` is relative to the source-library root and must remain within `masters/`.

Exports:

- Desktop: `assets/cards/extended/{kind}-{id}-1024.webp` at 1024×1536 and `-512.webp` at 512×768.
- Mobile: matching paths under `assets-mobile/`, following the current shared mobile policy (720 maximum edge, quality 44 for this portrait library), preserving portrait proportions.
- Editor: `art/{kind}-{id}.webp` and a lazy catalog with canonical IDs, names and class labels. Only selected image bytes enter an assembler design.
- Runtime resolver: generated `src/ui/extendedCardArtwork.js`; only verified exported subjects are mapped.
- Receipt-backed delivery records: `asset-data/card-art/extended-manifest.json`, including output dimensions, byte sizes and hashes.

The exporter is incremental and deterministic for a fixed Pillow/libwebp version, converter and source bytes. It re-encodes only changed sources or policy, and includes encoder versions in the manifest. `--check` verifies coverage, source and delivery hashes, mobile dimensions, editor byte parity and the exact runtime mapping.

Runtime assets ship through `cehinds/AshenSpire-art`, following CONTRIBUTING.md. Export requires an explicit `--root` authoring staging directory; keep it outside the game checkout. A partial local `assets-mobile/` directory can shadow the complete pinned light cache. Preserve the game's existing tracked light tree and update it only with canonical release bytes; do not replace it with Pillow staging twins. Add `--art-repo <checkout>` to copy verified high WebPs into that checkout's `hd/assets/cards/extended/`. Run the art repository's `mobile-art.mjs` to make canonical light twins and provenance, regenerate its manifest, and merge its PR to publish an art release.

Copy the verified generated `src/ui/extendedCardArtwork.js` and `asset-data/card-art/extended-manifest.json` from staging into the game checkout, then update the game's `art-release.json` and `art-manifest.json` pin with the normal repository process. After the normal release-pack and file-hash verification, run `node tools/export-extended-card-art.mjs --adopt-release --root <game-checkout> --inventory <approved-inventory.json>`. This metadata-only command requires unchanged canonical high records and complete, correctly sized mobile records before writing anything. It replaces the delivery manifest's staging light records with the release's paths, byte sizes and hashes, records the complete current policy and cwebp provenance, and preserves masters and high records. The release pack must have been generated with that current policy; adoption does not inspect or encode image bytes.

`--check-release` defaults to the game checkout and verifies all current canonical paths, high and light metadata hashes, dimensions, byte sizes, policy and adopted manifest provenance against the pinned manifest. Verify the actual release-pack bytes through the normal asset pipeline separately. The staging twins remain useful for authoring QA but do not replace the art repository's generated twins.

Equipment profiles win over base identities, including during partial exports: new profile, existing reviewed profile, new card illustration, existing reviewed card illustration, then outline fallback. New portrait paintings use `cover` at `50% 65%` so the lower action remains visible in landscape art regions. The shared illustrated face enables the artwork layer for newly illustrated cards that previously hid it, retaining their other authored layers and costs. Existing artwork keeps its previous crop behavior.

Contact sheets are review artifacts only: 24 labeled portrait thumbnails per page and an index of subject IDs. They are not runtime art.

Authoring conversion requires Python with Pillow and WebP support. Runtime builds consume verified committed WebP outputs and do not need Python. CI installs Pillow 11.1.0 for the actual conversion fixture; it is never silently skipped. The full receipt/output `--check` also remains a delivery check.
