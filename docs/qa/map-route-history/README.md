# Map route history

Approved layout: `Act <number> — <name>  Entrance — (choices) —> Boss`.
The circles represent the graph's non-boss floors (12 in this preview), not
an arbitrary mockup count. Only committed visits populate them. Existing
glyphs preserve the map's encounter vocabulary and revealed event outcomes.

Run `node tools/map-route-probe.mjs` against the source checkout with its
pinned art packs fetched. On Windows, point TEMP, TMP and TMPDIR to D:.

- `entrance.png`: all future circles empty, desktop 1600×900.
- `desktop.png`: three chosen encounters, inline act title, desktop 1600×900.
- `phone.png`: 390×844; title above the complete route.
- `small-phone.png`: 320×640; complete route remains inside the viewport.
- `results.json`: measured equal spacing, centred nodes, visited counts,
  current-position marker, empty future glyphs and absence of page overflow.

The probe also performs a real pointer selection on a reachable encounter:
the destination tray opens while the committed route remains unchanged.
All four scenarios completed with no browser exceptions or failed HTTP
responses. The browser launcher reported a Windows profile cleanup lock;
that temporary-profile warning is separate from the page checks.

Self-review: the renderer reads existing saved path/current state, deduplicates
floor visits, ignores foreign node ids after an act change, excludes all boss
destinations from the intermediate slots, and never emits future encounter
types. The strip remains a read-only accessible note. No save migration or
engine rules changed. The component catalog and its miniature are updated.
