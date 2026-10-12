# Preview frame contract

These assets support sequence-order review only. Shipped selections, catalogs, rigs, exports and runtime behavior are unchanged. The owner-selected original Counter15 is used as C; its earlier two-hand review flag does not replace the owner's actual choice.

| ID | Exact source | Treatment |
|---|---|---|
| C | Counter A bottom-left, CT15 | Original board depiction, scale 1.18 |
| D | Counter A top-right, CT12 | Scale 1.18 |
| V | Evade A top-right, EV12 | Scale 0.75; excludes disconnected neighboring boot |
| G | Counter B bottom-left, CT20 | Prototype scale1.0 after rigid body comparison; CT14 is not used |
| H | Counter B top-left, CT16 | Prototype scale1.0 after rigid body comparison |
| S | Existing selected Smash05 WebP | Original bytes copied unchanged |
| AT1–AT6 | Smash05, Sweep20, Smash06, Sweep16, Evade15, Evade13 | Exact owner-selected source order |
| T/E/W | Existing Attack, Evade15, Sweep18 | Additional held origins |
| EV1/EV2/EV3 | Evade16 derivative, Evade11 front-sword edit, Evade13 | Approved source revisions explicitly disclosed |

`preview-assets.json` supplies frame paths, sizes, hashes and draw offsets. Render each image at its recorded size plus `drawOffset` inside a **768×512** logical viewport. Normalized C/D/V/G/H already occupy that viewport. S and AT3 retain original512×512 rasters. T retains its256×256 raster and renders at the existing512×512 logical size. All use the common floor Y464; body registration uses a manually measured pelvis projection at X384 rather than the sword/cape alpha-bounds center. Native attack phases share one constant offset so the original within-clip movement remains intact.

Source landmarks, alpha bounds, crop rectangles, exact input hashes and per-source scales are in `sources.json`. The exporter copies connected source RGBA pixels, applies uniform resampling and translation, and retains transparent padding. It performs no repainting, anatomy repair, VFX or source-image changes. Solid alpha (>32) bounds and floor registration are checked; faint connected edge pixels (>1) are retained. The roomier viewport keeps full swords/capes at the reviewed body scale.

The requested attack uses six owner-selected source figures in order: AT1=Smash05, AT2=Sweep20, AT3=Smash06, AT4=Sweep16, AT5=Evade15, AT6=Evade13. Evade uses EV1=Evade16, EV2=Evade11 with sword in front, EV3=Evade13. EV1 is a director-approved ImageGen transparency derivative that redrew detail; EV2 is a director-approved ImageGen sword-position edit. All other preview extraction uses existing source pixels. Comparison durations are350ms per slot and change no engine timings. Aliases E/AT5 and EV3/AT6 share exact image bytes and registration. The original four-phase native attack is not played as this requested sequence.

Regenerate mechanically with the repository's Playwright dependency and pinned art pack available:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chromium ART_SOURCE_ROOT=/path/to/checkout-with-art-cache node pose-studio/stances/update-stances/sequence-review/export-preview.mjs
```

The tool writes only this preview folder. It verifies every input hash and records output hashes before the comparison UI uses them.
