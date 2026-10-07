# Player art export targets

The regular and alternative player builds share the same art release and export
policy. Export from original source art; keep the source masters for later work.
Do not enlarge small originals to meet a number.

| Runtime art | Export target |
| --- | --- |
| Characters, enemies, poses, animation frames, equipment and effects | At most 480px on the longest edge; WebP quality 12, alpha quality 25 |
| Maps, backgrounds, prologue art and full-screen scene paintings | Fit inside 1280×720; WebP quality 78, alpha quality 80 |
| Four-scene combat atlases | Up to 1080×720 per scene, or 2160×1440 for the two-by-two atlas; never enlarge a native 768×512 scene |
| Cards and other raster interface art | At most 720px on the longest edge; retain their existing category-specific compression |
| Small icons and cropped poses | Keep native dimensions when already below the ceiling |
| Vector artwork | Preserve the vector source; its viewBox is a coordinate system, not a raster pixel budget |

Here, 720p scenery refers to image height within the landscape export box,
not a 720px longest-edge cap. A 1920×1080 scene becomes 1280×720; a portrait
1024×1536 background becomes 480×720. Native 512px map-detail tiles remain
separate tiles. Atlas registration, animation timing and display sizes do not
change when raster files are re-encoded.

The executable rules live in `tools/mobileart-policy.mjs`, shared with the art
repository. Encode through AshenSpire-art's `tools/mobile-art.mjs`; it records
the source hash and export policy for every light twin. Map fallback exports
come from the original paintings through its map-detail builder. Regenerate
the art manifest, run the provenance and pack checks, publish an immutable art
release, and update both game versions to that release.

The alternative branch also has its own approved Combat Studio masters. Run
`python tools/alternative-art-build.py` there with Pillow, Node and the libwebp
`cwebp` encoder available. Its exporter queries `tools/art-export-plan.mjs` for
the same policy, resizes crop bounds with the exported canvas, and regenerates
the runtime catalog and hashes. Keep authoring crop coordinates in source units.
Re-run the alternative art tests after changing an export or its source master.

Measure both the art and final download. The existing complete single-file cap
is 100 MB; the preferred target remains 80 MB. Check representative sprites,
maps and backgrounds in desktop and phone views before adopting a new release.
