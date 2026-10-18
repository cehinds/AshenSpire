// Run from any directory: node docs/design/new-card-art/validate.mjs
// Checks the draft against existing identities, not against a duplicated tag list.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tags } from '../../../src/content/generated/tags.js';
import { statuses } from '../../../src/content/statuses.js';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const data=JSON.parse(readFileSync(new URL('./art-catalog.json',import.meta.url)));
const reference=path=>JSON.parse(execFileSync('git',['show',`${data.sources.referenceCommit}:${path}`],{cwd:root,encoding:'utf8'}));
const referenceStatuses=reference(data.sources.referenceStatuses).statuses;
const sourceTags=new Set(tags.map(t=>t.id));
// Three added nodes are verified against the pinned reference tree, not assumed.
const referenceNodes=execFileSync('git',['show',`${data.sources.referenceCommit}:${data.sources.tagVocabulary}`],{cwd:root,encoding:'utf8'});
for(const tag of tags.filter(t=>data.coverage.tagDomains.includes(t.domain)||data.coverage.classificationIds.includes(t.id)))assert.ok(data.bindings.tags[tag.id],`Unmapped combat tag ${tag.id}`);
for(const [id,b] of Object.entries(data.bindings.tags)){
 assert.ok(sourceTags.has(id)||(b.profile==='reference'&&referenceNodes.split('\n').some(line=>line.startsWith(id+','))),`Unknown tag ${id}`);
 assert.ok(b.recipe||b.role==='metadata',`No visual decision for ${id}`);
}
const statusIds=new Set([...statuses,...referenceStatuses].map(s=>s.id));
for(const id of statusIds)assert.ok(data.bindings.statuses[id],`Unmapped status ${id}`);
for(const id of Object.keys(data.bindings.statuses))assert.ok(statusIds.has(id),`Unknown status ${id}`);
for(const [table,bindings] of Object.entries(data.bindings))for(const [id,b] of Object.entries(bindings))if(b.recipe)assert.ok(data.recipes[b.recipe],`Missing recipe for ${table}/${id}`);
const collections={background:'backgrounds',backEffect:'backEffects',object:'objects',foreground:'foregroundEffects'};
assert.deepEqual(data.composition.layerOrder,Object.keys(collections));
assert.equal(data.composition.maxVisibleTags,4);
assert.equal(data.composition.typicalVisibleTags,2);
for(const [id,r] of Object.entries(data.recipes)){
 for(const [layer,collection] of Object.entries(collections))assert.ok(data.collections[collection][r[layer]],`Missing ${layer} component in ${id}`);
 assert.ok(data.collections.objects[r.object].objectCount<=data.composition.maxCentralObjects,`Too many central objects in ${id}`);
}
const actions=readFileSync(new URL('../../../src/engine/actions.js',import.meta.url),'utf8');
for(const op of Object.keys(data.bindings.operations))assert.ok(actions.includes(`case '${op}':`),`Unknown effect operation ${op}`);
for(const e of data.examples){
 assert.ok(e.identityCount<=4,`Too many identities: ${e.label}`);
 assert.ok(e.secondaryRecipes.length<=3,`Too many cues: ${e.label}`);
 for(const r of [e.primaryRecipe,...e.secondaryRecipes])assert.ok(data.recipes[r],`Unknown example recipe ${r}`);
 for(const t of e.input.tags)assert.ok(data.bindings.tags[t],`Unknown example tag ${t}`);
 for(const s of e.input.statuses)assert.ok(data.bindings.statuses[s],`Unknown example status ${s}`);
 for(const op of e.input.operations)assert.ok(data.bindings.operations[op],`Unknown example operation ${op}`);
}
for(const path of data.sources.referenceCards){
 const content=reference(path), cards=Array.isArray(content)?content:content.cards;
 for(const c of cards)for(const t of c.tags||[])assert.ok(data.bindings.tags[t],`Unmapped reference card tag ${t}`);
}
console.log(`Validated ${Object.keys(data.bindings.tags).length} tags, ${statusIds.size} statuses, ${Object.keys(data.recipes).length} recipes and ${data.examples.length} examples against current and pinned reference sources.`);

const proposal=JSON.parse(readFileSync(new URL('./art-proposals-v2.json',import.meta.url)));
const masterIds=new Set(Object.values(proposal.objectMasters).map(m=>m.assetId));
assert.equal(masterIds.size,Object.keys(proposal.objectMasters).length,'Duplicate master asset IDs');
function checkReferences(row){
 for(const r of row.references||[]){
  if(r.kind==='tag')assert.ok(sourceTags.has(r.id),`Unknown proposed tag reference ${r.id}`);
  else if(r.kind==='status')assert.ok(statusIds.has(r.id),`Unknown proposed status reference ${r.id}`);
  else if(r.kind==='operation')assert.ok(actions.includes(`case '${r.id}':`),`Unknown proposed operation ${r.id}`);
  else assert.fail(`Unknown reference kind ${r.kind}`);
 }
}
for(const [id,row] of Object.entries(proposal.cardTypes)){
 assert.ok(row.objects.length<=2,`Too many central objects in ${id}`);
 for(const master of [...row.objects,...row.alternateObjects||[]])assert.ok(masterIds.has(master),`Missing master ${master}`);
 assert.ok(data.collections.backgrounds[row.palette],`Missing palette ${row.palette}`);
 checkReferences(row);
}
for(const [id,row] of Object.entries(proposal.elements)){
 assert.ok(masterIds.has(row.demonstrationObject),`Missing element master ${id}`);
 checkReferences(row);
}
const variantIds=new Set();
for(const [id,row] of Object.entries(proposal.effectComponents)){
 assert.ok(masterIds.has(row.demonstrationObject),`Missing effect master ${id}`);
 assert.equal(row.variants.length,2,`Expected two alternatives for ${id}`);
 for(const v of row.variants){assert.ok(!variantIds.has(v.id),`Duplicate variant ${v.id}`);variantIds.add(v.id);}
 checkReferences(row);
}
for(const component of Object.values(data.collections.objects))for(const master of component.masterRefs||[])assert.ok(masterIds.has(master),`Unknown catalog master ${master}`);
assert.deepEqual(proposal.elements.wind.references,[],'Wind must stay a proposal');
assert.deepEqual(proposal.effectComponents.shocked.references,[],'Shocked must stay a proposal');
assert.deepEqual(proposal.effectComponents.drenched.references,[],'Drenched must stay a proposal');
assert.equal(proposal.artDirection.maxVisibleIdentities,4);
assert.equal(proposal.artDirection.normalVisibleIdentities,2);
assert.equal(proposal.effectComponents.cleanse.demonstrationObject,'master.flame');
assert.equal(data.recipes[data.bindings.tags['fx:cleanse'].recipe].object,'flame');
for(const board of proposal.boards)assert.ok(readFileSync(new URL(board.image,import.meta.url)).length>0,`Missing proposal image ${board.id}`);
console.log(`Validated proposal: ${masterIds.size} shared masters, ${Object.keys(proposal.cardTypes).length} card types, ${Object.keys(proposal.elements).length} elements, ${variantIds.size} effect alternatives.`);
