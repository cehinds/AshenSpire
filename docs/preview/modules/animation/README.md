# Animation module browser preview

Captured 2026-10-17 from the local source server (`index.html`), source commit `a7e4d21abff5cdc817d79cbfc6f5f305570934fe`. This gallery records the module’s disabled presentation: authored figure clips are held at their static pose while geometry and underlying combat outcomes remain intact.

The matching standalone CI artifact is build **0.7.1.1550** (artifact `12111476110`; source digest `1779e6f1ff`; workflow run [39060894016](https://github.com/cehinds/AshenSpire/actions/runs/39060894016)). The expected feature Play URL is [Stance Animation Module](https://cehinds.github.io/AshenSpire/branches/feature/StanceAnimationModule/latest/); public-route verification is pending and is not claimed here.

Browser evidence covered 14 scenes: eight Core cases across four viewports with animation enabled and disabled, four Current cases across normal and Classic profiles with both settings, and two Reading Desk playback cases. The recorded evidence has zero page errors, art failures, and disabled-state body transitions. Core geometry and outcomes matched across setting states. Current checks included a range miss, one resource payment, three optional reaction passes and turn progression. Reading Desk autoplay played when enabled and remained static when disabled. This does not establish behavior for every class or card, or every hardware configuration.

The settings shape used for the override is:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": { "animation": { "enabled": false } }
}
```

| Phone · 390 × 844 | Desktop · 1440 × 900 | Wide · 1280 × 720 | Tablet · 768 × 1024 |
| --- | --- | --- | --- |
| ![Disabled animation on phone](mobile.png) | ![Disabled animation on desktop](desktop.png) | ![Disabled animation in wide layout](wide.png) | ![Disabled animation on tablet](tablet.png) |

| Reading Desk · enabled | Reading Desk · disabled |
| --- | --- |
| ![Reading Desk preview with animation enabled](reading-desk-on.png) | ![Reading Desk preview held static with animation disabled](reading-desk-off.png) |

The compact evidence digest is in [evidence-summary.json](evidence-summary.json). It records the SHA-256 of the full browser evidence file retained with the capture output; raw QA output is not copied into this gallery.
