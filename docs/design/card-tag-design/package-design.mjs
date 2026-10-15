// Regenerate combined JSON, README, and ZIP after both source exports and gallery are final.
// Usage: node package-design.mjs [OUTPUT_DIR]
import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {resolve,join,dirname,basename} from 'node:path';
import {execFileSync} from 'node:child_process';
const dir=resolve(process.argv[2]||'/workspace/outputs/Feature-updateCharacterCreation/card-tag-design');
const read=async file=>JSON.parse(await readFile(join(dir,file),'utf8'));
const currentGame=await read('current-game.json'),proposedDesign=await read('proposed-design.json');
const sourceCommit=currentGame.provenance.sourceSha;
const combined={schemaVersion:1,sourceCommit,notice:'Read-only design export. currentGame contains exact composed current content and its runtime projection; proposedDesign contains unimplemented candidates. currentGame.historicalProposal is a separate older nonruntime repository proposal. Identifiers and rules are not merged across these sections. Static card faces and costs are not combat-context predictions.',currentGame,proposedDesign};
await writeFile(join(dir,'all-cards-and-tags.json'),JSON.stringify(combined,null,2)+'\n');
const pc=proposedDesign.counts,c=currentGame.counts;
const readme=`# Card and tag design catalog

Open **index.html** directly in a browser after extracting the ZIP. The gallery loads its bundled catalog-data.js locally and works with file:// URLs. Keep index.html, styles.css, gallery.js, catalog-data.js, and wireframes/ together.

This is a reviewable design preview. Proposed cards, tags, statuses, and services are **not implemented in the game**.

## Contents and counts

| Section | Contents |
| --- | --- |
| Current game | ${c.cards} live cards; ${c.tags} authoritative tree nodes including ${c.rootNodes} roots; ${c.registeredTags} derived vocabulary tags; ${c.statuses} statuses; ${c.stances} stances; ${c.tagAssignments} tag assignments |
| New proposal | ${pc.candidateEntries ?? proposedDesign.cards.length} candidate entries: ${pc.proposedCombatCards} combat cards and ${pc.proposedServices} noncombat services${pc.proposedRuleTemplates ? ` and ${pc.proposedRuleTemplates} rule templates` : ''}; ${pc.tags} tags; ${pc.statuses} statuses; ${pc.wireframes} layout wireframes |
| Historical repository proposal | ${c.historicalTags} tag rows and ${c.historicalObjects} object rows from docs/tag-model/tables; separate and nonruntime |

**all-cards-and-tags.json** is the complete download, with currentGame and proposedDesign kept separate. current-game.json and proposed-design.json are standalone source sections. Current-game history lives only in currentGame.historicalProposal and must not be treated as shipped content or as the new proposal.

Current card **definition** objects are exact objects from the composed content bundle; **runtimeDefinition** objects come from the actual registry projection. These are data records, including full effects and authored text, rather than claims inferred from face captions. Source pointers identify the entrypoint and candidate defining/reference files. Live tag nodes include roots; registeredTags is the derived tag vocabulary. combatProfile is produced by the canonical combatProfileFor(runtimeDefinition) helper; its school and maneuver are tag-derived identities, and null means no assignment.

Proposed display names are provisional design labels. Proposed identifiers and effect descriptions are candidates, including any explicit canonical identity references. Their presence does not add those mechanics to the game. Noncombat services and rule templates share the candidate cards collection but are distinguished by entityKind and the counts above.

Unknown values remain null in proposal data and appear as **?** on preview faces. They are unresolved parameters, not zeroes or approved balance. Exact qualifications and open questions stay in the JSON even when a face uses a short caption.

Live face.lines and face.summary are produced by src/model/cardFaceText.js without a combat preview. The gallery uses the compact summary with its inspection cue when applicable. costProfile comes from registries.framework.costProfile(runtimeDefinition), the same static authority used by the card presentation model without preview. Its action and stamina values describe the same SP payment and must not be added together; mana is MP. Equipment, weight class, target, player bonuses, reductions, and live combat modifiers are absent, so these numbers are not live prices or damage predictions. Authored templates and exact effects remain available for inspection.

## Provenance and reproduction

Current source commit: **${sourceCommit}**. The snapshot was exported read-only from /workspace/AshenSpire. The JSON records its source paths and serialization notes. Existing docs/tag-model is explicitly a proposal whose own README says the game does not read it.

With Node 24 and the repository available:

\`\`\`sh
node export-current.mjs /path/to/AshenSpire /path/to/card-tag-design
node build-gallery.mjs /path/to/card-tag-design
node package-design.mjs /path/to/card-tag-design
\`\`\`

The exporter preserves present JavaScript undefined values using an explicit {$jsType:"undefined"} sentinel; this snapshot contains ${currentGame.serializationUndefinedPaths.length}. Missing fields remain absent. Duplicate IDs and runtime card counts are validated during export. Exporting performs no game edits or builds.

The ZIP includes the JSON files, complete offline gallery, individual SVG card wireframes, contact sheet, scene definitions, screenshots, this README, and reproduction scripts.
`;
await writeFile(join(dir,'README.md'),readme);
const checked=await read('all-cards-and-tags.json');
for(const [name,rows] of Object.entries({currentCards:checked.currentGame.cards,currentTags:checked.currentGame.tags,proposedCards:checked.proposedDesign.cards,proposedTags:checked.proposedDesign.tags}))if(new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('Duplicate IDs: '+name);
if(currentGame.cards.length!==c.cards||currentGame.tags.length!==c.tags||proposedDesign.cards.length!==pc.cards)throw Error('Count mismatch');
const zip=join(dirname(dir),'card-tag-design.zip');
// ZIP is outside the folder, so it cannot recursively include itself. Replace only this generated archive.
execFileSync('python',['-c','import pathlib,sys,zipfile\nr=pathlib.Path(sys.argv[1]); z=pathlib.Path(sys.argv[2])\nwith zipfile.ZipFile(z,"w",zipfile.ZIP_DEFLATED) as out:\n for p in sorted(r.rglob("*")):\n  if p.is_file(): out.write(p,pathlib.Path(r.name)/p.relative_to(r))',dir,zip]);
console.log(JSON.stringify({sourceCommit,currentCounts:c,proposalCounts:pc,combinedBytes:(await stat(join(dir,'all-cards-and-tags.json'))).size,zip,zipBytes:(await stat(zip)).size},null,2));
