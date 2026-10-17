# Batch 09 review

- **Coverage:** 45 original source paintings—six mountain props plus 13 components each for desert, jungle and snowy settings.
- **Style:** every generating agent inspected its complete group; an independent Sol 6.1 reviewer inspected all final source sheets and layered compositions. No blocking visual outlier remains. See [INDEPENDENT-REVIEW.md](INDEPENDENT-REVIEW.md).
- **Mountain depth:** near ridges retain material detail. Three distant versions were regenerated with simpler forms, lighter desaturated colors and softer contrast. Their surroundings remain transparent; no opaque fog plate is baked in.
- **Night:** skies, street grounds and lit towns are separate painted sources. City/castle/entrance props remain neutral base paintings with explicit preview grading in their night/rain scene records.
- **Revisions:** the jungle gate received more alpha room; its rainy ground was revised for a quieter ground edge. Earlier generated outputs remain recorded outside the selected batch; only final reviewed PNG hashes are registered.
- **Data:** 39 pools, six mountain references, 39 scene presets and a portable JSON export validate against the approved role/family library. Biome tags are authoring candidates with no live-region binding.
- **Framing:** all 144 prop/camera combinations pass measured alpha>=32 bounds checks for native, portrait, landscape and ultrawide views. Placement uses the measured ground horizon and limits size around each anchor.
- **Source integrity:** retained PNGs are byte-identical to their recorded original generated outputs. Review records refer to those same SHA-256 hashes. No pixel editing, resizing or upscaling was applied.
- **Checks:** existing 71 module/style tests plus 14 new biome-scene/export tests pass. The full style library validates 188 retained sources: 144 approved, 40 inactive and four superseded originals.

## Native dimensions

- Six castle/entrance sources are 1254 × 1254px.
- Thirty-seven wide sources are 1672 × 941px.
- The dry distant mountain and snowy night town are 1672 × 940px.
- Requested 1536px square and 3072 × 1728px landscape sizes were not delivered. Actual measurements remain authoritative.

## Remaining draft limitations

- Some prop margins are tighter than requested. Independent review found complete main silhouettes; visible bounds are measured rather than inferred from canvas size.
- Generated alpha can contain faint dust/fringes and near-opaque material interiors. Ground layers may contain tiny alpha traces in the nominally transparent upper field. Production cleanup remains necessary.
- The desert city silhouette is a compact settlement cluster; the snowy city is fortress-heavy. Larger urban districts can be assembled later from more independent blocks.
- These camera checks cover static rectangles and prop bounds. Actor scale, animation, ground-contact shadows and unrestricted camera motion still need in-game review.
- The existing source edges support the shown crops; larger camera motion may require expanded paintings. The two 940px-high layers preserve their originals and still need final registration if used on an exact common production stage.
