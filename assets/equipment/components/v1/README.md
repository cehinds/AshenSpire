# Equipment component reference assets

These are transparent five-view reference strips derived from the supplied low-poly character paintings. They are modeling and inventory-art inputs, not rigged 3D models.

`manifest.json` is the lookup table. Every item has a stable `id`, AshenSpire `classId`, equipment `slot`, relative `asset` path, and five 256 x 256 frame rectangles ordered `top`, `right`, `bottom`, `left`, `back`.

Game UI code should resolve an item's `asset` through `assetUrl()` from `src/ui/assetmap.js`. The existing single-file bundler recursively embeds every WebP under `assets/`, including these strips. To display one view, use the corresponding frame rectangle as a sprite-sheet crop; do not hardcode a second copy of the frame order.

The `confidence` field describes reconstruction certainty from the paintings. In particular, `herald_under_trousers` is intentionally `low` confidence because the source paintings reveal only small portions of that garment.
