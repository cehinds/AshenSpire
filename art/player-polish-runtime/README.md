# Player interface runtime exports

Source: the reviewed [player polish kit](../../docs/design/player-polish-asset-kit-2026-10-02/README.md), with the twelve [approved boards](../../docs/design/player-polish-2026-10-01/README.md) as the visual reference.

The game consumes 95 selected exports: nine scene WebPs, one leather WebP,
79 registered engraved icons, and six vector components used by the runtime
stylesheet. The complete 129-vector library remains in the source kit.
Generic role portraits and example card paintings are supplemental art without
canonical identities; this integration keeps actual character, NPC, enemy,
card, equipment, relic and flask bindings.

Regenerate from the repository root with Python/Pillow, Node and libwebp's
`cwebp` on PATH. The light encoder flags match the art repository's generator:

```powershell
python tools/player-polish-art.py
node tools/art-manifest.mjs --write
node tools/mobile-art.mjs --check
```

Before the source-kit PR merges, pass its standalone root using `--kit`.
`exports.json` records source hashes, encoder version/settings, and exact high
and light output hashes. The authoring adapter reads `policyFor()` and
`twinDimensions()` from the existing mobile policy. It only owns the
`player-polish` export directories. SVG bytes are identical in both tiers.
No canonical runtime asset is re-encoded or replaced.

CSS scene/material URLs are background declarations, so the external-art
exporter moves them through its existing `ASSET_CSS` slots and tier fallback.
DOM paintings and engraving masks resolve through `assetUrl()`. Mounted masks
refresh when the built-in or local high-resolution source changes.

The new light payload adds roughly 0.4 MB inlined. The committed art-tree
allowance is 20.5 MB; the default light dev/test edition has no whole-file cap
(DEVELOPER.md). The separate release mobile edition retains its 30 MB gate.
Passing the twin-tree check does not establish that a release mobile bundle
fits that whole-file limit.
