# Batch 10 review

Status: main source and static composition review passed for proposal use; independent review recorded separately. Runtime integration remains untested.

## Review scope

- 86 unique new PNGs, each with its exact generation prompt, original output path, dimensions and SHA-256 provenance.
- Hash-bound per-setting source approvals in `review.json`; generation attempts rejected for baked floor fixtures or clipped source silhouettes remain recorded in provenance history.
- Independent review in [INDEPENDENT-REVIEW.md](INDEPENDENT-REVIEW.md).
- 28 editable scene recipes; references reuse compatible art rather than duplicating paintings.
- All 12 actual Crownfall starter-map IDs, names, types and local positions checked against the source atlas and its fingerprint.
- Four static camera crops with explicit intentional side framing. A complete source silhouette and a deliberately cropped close-up viewport are different checks.

## Limits retained for review

- Native generated dimensions are recorded; requested sizes are not claimed as delivered sizes.
- Some prop margins are narrower than requested. Faint alpha dust/fringes and detailed realistic material rendering remain source limitations.
- Static previews do not verify actors, HUD clearance, animation, scrolling cameras or gameplay.
- Art references remain candidates, with no live-world or prologue binding changes.

## Final verification

- Actual source counts: 25 backdrops, 19 grounds and 42 props. Dimensions: 43 at1672×941, one at1672×940, and42 at1254×1254.
- All86 retained PNGs verified byte-identical to original generated outputs, with matching approved review hashes.
- Seven composition sheets and five source/reuse sheets rendered; all28 scenes and all12 intro mappings visually inspected.
- 324 unique scene/prop/camera placements passed static geometry checks, including intro scenes and the Old Market extra prop. Near side crops are declared; contained throne/forge/road markers remain within reviewed cameras.
- Art-style validation passed across274 retained sources (230 approved,40 inactive,4 superseded). Hex validation passed44 documents. All96 targeted module/style/adjacency tests passed.

## Composition limits and next polish

Straight floor/backdrop boundaries and mismatched matte floor versus more reflective backdrop lighting remain visible in several rooms. The floor can make far architecture feel slightly sunken, especially dungeon/tunnel/astrologer scenes. This is a placement, perspective and lighting integration follow-up; source layers remain reusable. Static geometry checks do not certify seamless painting transitions.

The Crownfall gate candidates intentionally share one scene. The inn uses the night street candidate and still needs its own distinct frontage. Outdoor weather loops are reused from the earlier atmosphere module; this batch adds no new weather animation.
