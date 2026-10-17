# Collection review

- **Result:** all 25 map-component types have one matching painted icon. Main art-direction review and an independent Sol 6.1 visual review found no substantial style outliers.
- **Compared:** camera, stone/timber materials, palette, light direction, painted edge treatment, silhouette and transparency.
- **Readability:** reviewed the full catalog and every icon at 128px and 64px on light and dark fields. The subjects remain interpretable at 64px; 128px preserves more identity and detail.
- **Corrections:** shrine framing improved, treasure gold reduced, watchtower banner removed. Exact edit prompts and reference paths are retained in those provenance files.
- **Delivered:** 25 unchanged original RGBA PNGs, each 1254 × 1254px. All retained hashes match their generated source outputs.
- **Selection:** `map-icons-painterly-v1` is required. All 39 earlier variants remain mapped for history and cannot be selected under the current policy.
- **Validation:** 44 module JSON documents / six example tiles validate; all 59 tests pass, including missing-style, historical-fallback and source-style mismatch cases.

## Remaining draft limitations

- Tunnel and cave share stone-mouth silhouettes; squared masonry versus irregular natural rock differentiates them. Optional gameplay labels can reinforce identity when needed.
- City and town lose fine settlement detail at 64px. Their wall/keep and clustered-roof silhouettes remain distinct.
- The fishing line is thin on dark terrain. The pier and creel remain visible.
- The portal's cyan is deliberately the strongest magical accent. Other icons keep restrained warm highlights.
- The central-70% framing target was not uniformly met. Solid silhouettes remain inside their canvases; use recorded alpha bounds for placement and padding.
- No alpha ≥16 pixels touch a canvas border. Faint lower-alpha dust touches borders on 22 icons, and slight colored fringe may need cleanup before production export. Sources remain unchanged rather than claiming cleaned alpha.
- These are source-art drafts. Final 256/512px export, calibrated per-icon anchors and game-runtime integration remain separate work.

The shared style ID prevents accidental collection mixing; visual comparison remains necessary whenever new art is added.
