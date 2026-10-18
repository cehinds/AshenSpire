# Layered card art runtime preview

Serve the repository with `node tools/serve.mjs --no-open`, then open
`/docs/preview/layered-card-art/`. The preview uses the production card renderer
and real resolved healing, cleansing and projectile cards, plus explicitly
tagged weapon fixtures. It includes all ten approved ethereal assemblies.

Browser checks on 2026-10-18: 1280×960 desktop, 390×844 phone, 1920×1080 wide,
820×1180 tablet. All 13 cards and 54 component images loaded; no page errors,
missing images or horizontal overflow. The stage maintained its 4:5 ratio.
Simple/Legacy switching and whole-composition fallback on a failed cutout passed.
The web build booted with no page errors; `verify-external` passed 314 checks.
The portable build compiled successfully. Captured build: 0.7.1.1560,
source digest `bc5933846e`.

The PNGs show presentation only: weapon fixtures intentionally share Strike's
payload while varying explicit camp/maneuver tags. They are not new combat cards.
