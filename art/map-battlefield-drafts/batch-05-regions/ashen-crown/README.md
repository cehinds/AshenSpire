# Ashen Crown — regional layer drafts

Five separate original image-generator outputs, copied byte for byte. Dry ochre highlands, weathered timber, and warm-gray old stone; neutral cloudy daylight. These are unregistered art drafts, not runtime bindings.

| Asset | Actual pixels | Role |
| --- | --- | --- |
| `ground-dry-meadow.png` | 1672 × 941 | Dry earth and faded grass combat floor |
| `ground-worn-courtyard.png` | 1672 × 940 | Open flagstone combat floor |
| `prop-market-stall.png` | 1254 × 1254 | One empty timber stall |
| `prop-broken-column.png` | 1254 × 1254 | One warm-gray broken column |
| `backdrop-ashen-highlands.png` | 1672 × 941 | Opaque distant keep, fields and mountains |

Requested canvases were 3072 × 1728 for grounds/backdrop and 1536 × 1536 for props. Actual tool outputs are smaller; they have not been upscaled. Exact prompts, reference paths, original output paths, dimensions, SHA-256 hashes and alpha measurements are in each `.provenance.json` sidecar. `qa-summary.json` collects the measurements.

## Composition and QA

- Ground silhouettes begin around 52% of canvas height and fill the lower sides/bottom. Upper 45% has alpha 0–1/255. The broad central floor stays clear of separate props.
- Grounds differ by one pixel in height. Use explicit composition placement; these are not finalized registered production exports.
- Props are separate, nearly frontal combat-camera objects. Their measured bounds are in the sidecars; the stall's margins are narrower than requested.
- Generated ground/prop material interiors generally have alpha 251–253 rather than fully 255. Review slight background bleed before production. Near-transparent edge RGB includes red/yellow residue, with measured saturated-red alpha at most 4/255. Original output is preserved rather than silently cleaned.
- Backdrop is fully opaque. The castle sits left and above the intended floor silhouette; lower fields are distant scenery, not a combat platform.
- No composites, runtime files, shared catalogs, commits, or production asset registration were changed by this batch.

Visual inspection covered each generated image; numeric QA checked alpha bounds, bleed, dimensions and byte-identical source hashes. These drafts still need final scene-composition and production-resolution review.
