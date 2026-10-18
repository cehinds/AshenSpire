# Standalone rear sprite data

This optional module is outside the game core. Nothing imports or registers it.
It contains the existing 130 design proposals and 57 elite pilot frames without new art.
All artwork remains draft and unpublished; this does not unlock actors or supply a complete animation set.

Load `catalog.json` using the host's JSON loader, and import pure functions from `index.mjs`.
Validate the catalog with `catalog.schema.json` (JSON Schema 2020-12).
The snapshot preserves source actor objects, including hashes, prompts, calibration and publication provenance.
The parity test deliberately fails if the authoring manifest changes: update the snapshot explicitly after review.

```js
import { selectProposal, sequenceFor, sampleSequence, positionFrame } from './index.mjs';
const selection = selectProposal(catalog, 'courtDuelist', 'v01');
const clip = sequenceFor(selection, 'animations', 'attack');
const sampled = sampleSequence(clip, elapsedMs); // one shot; clamps at last frame
if (sampled.available) {
  const box = positionFrame(sampled.frame, [320, 480], { scale: 0.5 });
  // The host resolves sampled.frame.asset and renders the full canvas at box.x/y.
}
```

Selection always requires an actor and version. Provisional defaults remain metadata.
`sequenceFor` accepts `stances`, `animations`, or `reactions`.
Held stance art and static reactions never become animation clips.
Missing actors, versions, states, and anchors return `{ available: false, reason }`; no fallback occurs.
Only attack and evade have multi-frame clips for the three elite v01 pilots.
Pass `{ loop: true }` to sample explicitly looping playback.
Invalid times and positioning numbers throw RangeError.
Call with a catalog validated against the schema; functions do not sanitize arbitrary untrusted catalogs.

Anchors use normalized full-canvas coordinates. Positioning returns top-left coordinates,
size and flip metadata with the named anchor at the requested target, including off-center feet.
A renderer must mirror the image about its center when flipX is true.
This is coordinate math only; combat camera alignment and gameplay integration remain separate work.

Run `node --test pose-studio/enemy-back-proposals/standalone/index.test.mjs`.
The dedicated CI also validates JSON Schema and rejects data drift or changed art hashes.
