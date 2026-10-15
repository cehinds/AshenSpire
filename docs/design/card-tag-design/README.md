# Card and tag design catalog

Open **index.html** directly in a browser after extracting the ZIP. The gallery loads its bundled catalog-data.js locally and works with file:// URLs. Keep index.html, styles.css, gallery.js, catalog-data.js, and wireframes/ together.

This is a reviewable design preview. Proposed cards, tags, statuses, and services are **not implemented in the game**.

## Contents and counts

| Section | Contents |
| --- | --- |
| Current game | 304 live cards; 457 authoritative tree nodes including 28 roots; 429 derived vocabulary tags; 69 statuses; 3 stances; 3912 tag assignments |
| New proposal | 74 candidate entries: 70 combat cards and 2 noncombat services and 2 rule templates; 91 tags; 16 statuses; 4 layout wireframes |
| Historical repository proposal | 892 tag rows and 156 object rows from docs/tag-model/tables; separate and nonruntime |

**all-cards-and-tags.json** is the complete download, with currentGame and proposedDesign kept separate. current-game.json and proposed-design.json are standalone source sections. Current-game history lives only in currentGame.historicalProposal and must not be treated as shipped content or as the new proposal.

Current card **definition** objects are exact objects from the composed content bundle; **runtimeDefinition** objects come from the actual registry projection. These are data records, including full effects and authored text, rather than claims inferred from face captions. Source pointers identify the entrypoint and candidate defining/reference files. Live tag nodes include roots; registeredTags is the derived tag vocabulary. combatProfile is produced by the canonical combatProfileFor(runtimeDefinition) helper; its school and maneuver are tag-derived identities, and null means no assignment.

Proposed display names are provisional design labels. Proposed identifiers and effect descriptions are candidates, including any explicit canonical identity references. Their presence does not add those mechanics to the game. Noncombat services and rule templates share the candidate cards collection but are distinguished by entityKind and the counts above.

Unknown values remain null in proposal data and appear as **?** on preview faces. They are unresolved parameters, not zeroes or approved balance. Exact qualifications and open questions stay in the JSON even when a face uses a short caption.

Live face.lines and face.summary are produced by src/model/cardFaceText.js without a combat preview. The gallery uses the compact summary with its inspection cue when applicable. costProfile comes from registries.framework.costProfile(runtimeDefinition), the same static authority used by the card presentation model without preview. Its action and stamina values describe the same SP payment and must not be added together; mana is MP. Equipment, weight class, target, player bonuses, reductions, and live combat modifiers are absent, so these numbers are not live prices or damage predictions. Authored templates and exact effects remain available for inspection.

## Provenance and reproduction

Current source commit: **f7a24e0e39dd7823c15f89afd6023782526655d0**. The snapshot was exported read-only from /workspace/AshenSpire. The JSON records its source paths and serialization notes. Existing docs/tag-model is explicitly a proposal whose own README says the game does not read it.

With Node 24 and the repository available:

```sh
node export-current.mjs /path/to/AshenSpire /path/to/card-tag-design
node build-gallery.mjs /path/to/card-tag-design
node package-design.mjs /path/to/card-tag-design
```

The exporter preserves present JavaScript undefined values using an explicit {$jsType:"undefined"} sentinel; this snapshot contains 0. Missing fields remain absent. Duplicate IDs and runtime card counts are validated during export. Exporting performs no game edits or builds.

The ZIP includes the JSON files, complete offline gallery, individual SVG card wireframes, contact sheet, scene definitions, screenshots, this README, and reproduction scripts.
