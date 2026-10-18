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

The rebuilt web and portable games (0.7.1.1561, `ab75fadff2`) were also checked
through New Game → character review. All 31 displayed cutout images decoded;
the portable game served over HTTP resolved all 31 from embedded PNG data.
Direct `file://` browser verification is unavailable under this environment's
browser policy. The no-LAN server reports its expected unavailable LAN probe;
the portable game also requests its pre-existing relative music manifest.
Neither produced a card-art failure.

Regression follow-up: the broad discovered-test run found an obsolete
single-image inspector assertion, unregistered card-art tool pages, and an
unfetched high-art pack. The updated inspector/Workbench suites passed all
73 tests; the book-art suite passed all four after fetching the pinned pack.
The focused art/build/pack suites passed 50 tests. The export check verifies
all 28 compositions and 44 component hashes; external-pack verification
passed 314 checks. Runtime crop/axis checks passed at all four captured sizes.
