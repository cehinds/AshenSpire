AshenSpire - every current class / supported armor, rear idle art
2026-10-06

Open index.html directly or serve this folder:
  python -m http.server 43187 --bind 127.0.0.1 --directory <this folder>

31 distinct appearance masters cover every one of the 35 canonical armor
records at alternative/dev c448cb31c1459581e22642136a224256d4fd3c25.
12 new wearer-specific shared-set PNGs, plus 19 approved exact appearances
copied byte-for-byte from 41ae95ae42cce66e56805cc35ae1903a92a4d5a5.

The complete matrix has four classes x nineteen named armor sets = 76 cells.
31 are supported. 45 lack a current class-scoped armor record; their reason
is explicit in matrix.csv/json. Unlocks and attribute minima are separately
recorded, not confused with unsupported combinations or missing artwork.

The four shared starter sets reuse the corresponding default only on the
same wearer, with the same named armor and palette. Their canonical records
remain separately listed. No cross-class alias is accepted as art coverage.
Bastion, Rimeweave and Waywatcher have their own approved masters.
Head, hands, feet and talisman slots contain no authored additional pieces.
Smith upgrades affect existing records and do not define new armor designs.

Files
  masters/              31 selected original PNG masters, no recompression
  catalog.json          all 35 IDs, source paths, hashes, alpha, idle anchors
  matrix.csv/json       every class/name combination including unsupported ones
  inventory.json        canonical data findings and scope
  receipts.json         exact executed prompts, generator paths, hashes,
                        reference provenance and the three framing corrections
  production-jobs.json  initial twelve production requests
  sources/              frozen canonical definitions and baseline art catalog
  references/           copied reference art, initial framing drafts, scene layers
  review/               actual desktop/phone contact sheets and compositions,
                        browser screenshots and verification receipt
  validation.json       deterministic frozen-package checks and inherited warnings
  SHA256SUMS.txt         all package files except this checksum file

Rebuild (Python + Pillow)
  python build.py
  python render-review.py
  python validate.py
The complete delivered package can render without the original worktree.
validate.py checks the included source snapshots, masters and review files.
It does not require the current game checkout to match the historical source.
Only in the original production checkout, use
  python validate.py --audit-source-checkout
to additionally check live source files and Git scope against that revision.
build.py imports from source paths only if a snapshot/master is absent.
External provenance paths identify the source used at production time.
Do not substitute or overwrite selected PNGs without updating provenance.

Idle placement
Use visibleBounds at alpha >32 and idleAnchor (bottom-center of those bounds).
Anchors are not skeleton joints, hand contacts or animation action anchors.
Retain aspect ratio. Fit the visible bounds with external clear margins.
The 12 new masters each have at least 64 pixels clear on every edge.
The 19 approved masters retain their original tighter source padding; none
has visible alpha at the canvas edge. Gallery/contacts add external space.
Their inherited margin warnings are deliberate and remain visible in validation.

The master PNG's invisible RGB may contain background colors; proper RGBA
compositing is required. Checker/light reviews verify no visible glow backing.
No outlines, UI, floors or animation effects are baked into body cutouts.

Delivery is art-only. No gameplay, HUD/card/footer, layout editor, CI,
primary dev/test merge or playable publication. Later integration must use
the current gameplay class + outfit canonical ID, not legacy donor artClassId.
The source package and the other integration checkout were read-only here.
