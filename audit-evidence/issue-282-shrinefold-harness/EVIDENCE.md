# Issue #282 shrine-fold harness correction

Subject before correction: `1be093806b6236fad5f0e922a5bb2bec19870e4a`.

## Reproduced false green

`node tools/shrinefold.mjs` at the unmodified exact head reported `14/14`
while `before-1be0938-source-low-cinders-1200x730.png` clipped the top of
`SHRINE OF EMBER`. The image is copied from a detached exact-head worktree;
SHA-256: `c7b2d63f0db3ac2727ee58a8e335bf08910d652e8638e59c16aa892c350fdee5`.

## Corrected contract

Before an advertised capture, the harness now:

1. opens the disclosure through its real face control;
2. resets window and `.shrine-screen` scroll to the origin;
3. blurs the interaction focus and waits two animation frames;
4. asserts the exact viewport, both scroll origins, full title and reveal
   geometry, one-open disclosure state, disabled Level affordability, zero
   horizontal overflow, and every shrine-fold control inside the viewport;
5. writes only to this non-serialized evidence directory.

Focused runs:

- `node tools/shrinefold.mjs` — source, `18/18` green at `390x844` and
  `1200x730`.
- `node tools/shrinefold.mjs --dist` — shipped bundle, `18/18` green at both
  viewports.
- `node tools/shrinefold.mjs --selftest` — five same-door plants caught and
  clean copied tree green:
  - non-uniform collapsed faces → `S2` RED;
  - Level remains painted when Flasks opens → `S4` RED;
  - cinder shortfall does not disable Level → `S6` RED;
  - Flask reallocation forgets its open fold → `S5` RED;
  - desktop title clipped above the viewport → `S7` RED.
- `node tests/run-node.mjs` — `94 passed, 0 failed`.
- `node tools/onefold.mjs` — fold constructors `1 == 1`; aria-expanded
  constructors `3 == 3`.
- `node tools/verify-shipped.mjs` — `6` checks passed. Its provenance note is
  expected: this correction changes only an external harness, not serialized
  product bytes.

Source and dist screenshots use distinct prefixes so one run cannot overwrite
the other. No published `docs/preview` image or serialized bundle is generated
by this corrected harness.
