# Collection validation

The original twelve concept boards were visually reviewed in full, including both desktop/mobile feature rows on every board. The resulting collection has 316 unique artwork files, three fonts, 24 unique screen recipes and 48 responsive composition descriptions. No game model, live renderer, art registry, map coordinates or animation routing is changed.

## Art and static review

- All 43 new generator PNGs are saved unchanged, with exact prompt/reference/tool records. Their game-facing WebP exports keep the original dimensions. Scenes/materials use quality 92; cutouts use lossless WebP with actual zero-alpha exterior and near/full-opacity subjects.
- Enemy full bodies and inspector busts were checked against canonical references. Soldier armour/red cloth, the hound's green blight and the colossus's basalt/molten core remain recognizable. Inspector busts intentionally end at the torso; full-body silhouettes retain all major body/equipment parts.
- The 194 first-kit artwork copies retain their original hashes, and eight additional canonical objects are unchanged source copies. Existing combat atlases and maps remain the default for authored coordinate/ground contracts.
- The new-art, enemy, decoration and three box/menu sheets were rendered and visually inspected. WebP review thumbnails are decoded to PNG in memory for librsvg compatibility; this does not alter game-facing assets or PNG masters.
- Vector frames have explicit slicing or aperture metadata. Small-control corners fit inside their caps; the 64-pixel HUD and 32-pixel stat chips retain a stretchable center. Selection, focus and disabled surfaces are separate. CSS disabled handling covers both native `disabled` and `aria-disabled=true`.

## Delivery checks

Run `python verify-collection.py` to verify every declared asset and master hash, dimensions, SVG parse, alpha range, font hash, recipe/reference path and static HTML/CSS links. JavaScript is syntax-checked through Node. The verifier builds an explicit manifest-derived package inventory and a fixed-metadata ZIP, checks ZIP integrity and writes its SHA-256 receipt. Package-local files not in that inventory are excluded.

Independent review was performed by the existing asset review agent. Findings about blank WebP review sheets, disabled skins, cap geometry, a raw-atlas demo and broad directory packaging were corrected. Final verification results are recorded in the delivery summary; this document describes the repeatable checks without embedding the checksum of itself.

## Evidence limits

Automatic browser approval review blocked opening the current `http://127.0.0.1:4337/` preview under the app's URL policy. No alternate browser or serving workaround was attempted. The current game's newer rendered screens and interactive catalog behavior are therefore not claimed as browser-verified. Saved source boards, independent artwork, static compositions and portable package checks are the evidence for this delivery.

New enemy art consists of static illustrations, not animation sets. New combat backgrounds and enemy bodies need explicit runtime art bindings and authored floor/action anchors before replacing animated combat assets. New city perspectives are service/background options and do not replace coordinate-bearing map assets without reauthoring pins. The separate game conversion remains responsible for runtime/browser/device acceptance.

## October 4 canonical motif expansion

The expanded manifest declares 316 artwork files, 43 unchanged new PNG masters and 15 true-alpha cutout exports. The adoption helper checks staged master hashes, dimensions and alpha before copying. Existing build-collection.py performs format-only WebP conversion: quality 92 for opaque paintings and lossless for cutouts; it never crops, resizes or edits alpha.

All sixteen additions were visually inspected as full-resolution source images and in the rebuilt artwork/decoration sheets. Independent review confirmed the sixteen master hashes, dimensions and original-output byte equality, while all 300 prior asset records and artwork hashes remained unchanged. The Frozen Camp mobile signature was removed with an imagegen edit; its superseded prompt and output hash remain embedded as previousVersion.

The verifier checks all fifteen cutouts' alpha channels pixel for pixel against their PNG masters, plus the sixteen exact UTF-8 prompt hashes and delivered package references. External generator inputs are labeled as provenance rather than portable package dependencies. The 24 recipes retain live-text and canonical-state boundaries; the open codex is also available as an inventory/equipment ornament.

The catalog/static-sheet builders and portable package verification passed after adoption. The final checksum belongs in the adjacent archive receipt, not this hashed document. Browser catalog and current game verification remain unconfirmed because the app URL policy blocked preview access; no browser workaround was attempted.
