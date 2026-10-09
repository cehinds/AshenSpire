# B + B card preview

Implementation evidence for `feature/card-solid-bb`; `report.json` records the
tested source revision and whether the capture included uncommitted changes.

Run `node tools/serve.mjs --port 4397 --no-open --no-lan`, then open
`http://localhost:4397/docs/qa/card-solid-bb/preview.html`.
The preview uses the native renderer, canonical cards and pinned artwork.

The current illustrated frame keeps its bottom band for a solid gold action
symbol and name. Smash uses a fist; Counter uses a shield and diagonal sword.
The footer is integrated into the base's original stone texture and gold frame.
Connected gold braces form a taller action bay, with a larger centered icon/name
and the parchment ending directly above it. It has no separate opaque plaque.
Card names have a dark outline and shadow; side symbols have a thicker black halo.
An opaque dark title backdrop covers each full name, then fades into the artwork.
Up to three primary tag symbols sit on the right of the artwork. Information
retains the full vocabulary and effect details. Long effects expand the
parchment inside its safe interior, below the symbol rail.

`approved-preview.png` shows eight examples. Desktop and phone combat,
inspection captures accompany `report.json`. The QA tool also writes full gallery
captures and per-card geometry locally.
The browser checks cover 2,186 card variants, all ten native action types and
eight schools, widths 120/124/144/200px, clipping, overlap, accessible names,
tap-to-inspect, resource preservation and Escape/focus return.

Scoped validation: 23 test-runner results pass, including 813 assertions in
the playing-card model suite. `git diff --check` passes. The full repository
suite was stopped during long simulation tests; it is not a complete-suite
pass. The preview has no page errors or broken artwork. Optional synthesized
sound-effect sample 404s are recorded separately by browser QA.

Packaged verification: the light standalone build 0.7.1.1150 passed desktop
and phone hand geometry, complete title-fade coverage, inspection and focus
checks. Its captures and provenance are in `standalone/`. Subsequent reconciliation
with PR 1765 changes documentation and generated changelog metadata only.
