// Read-only snapshot. Run: node export-current.mjs REPO OUTPUT_DIR
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = resolve(process.argv[2] || '/workspace/AshenSpire');
const out = resolve(process.argv[3] || '/workspace/outputs/Feature-updateCharacterCreation/card-tag-design');
const imp = p => import(pathToFileURL(join(root,p)).href);
const { contentBundle: bundle } = await imp('src/content/index.js');
const { createRegistries } = await imp('src/model/registries.js');
const { cardFaceLines, cardFaceSummary } = await imp('src/model/cardFaceText.js');
const { readTable } = await imp('docs/tag-model/tools/csv.mjs');
const { combatProfileFor } = await imp('src/model/combatCardProfile.js');
const registries = createRegistries(bundle);
const sha = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const undefinedPaths = [];
function lossless(value, path='$') {
  if (value === undefined) { undefinedPaths.push(path); return { $jsType:'undefined' }; }
  if (typeof value === 'number' && !Number.isFinite(value)) return { $jsType:'number', value:String(value) };
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') throw new Error(`Unsupported ${typeof value} at ${path}`);
  if (Array.isArray(value)) return Array.from(value,(v,i)=>lossless(v,`${path}[${i}]`));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,lossless(v,`${path}.${k}`)]));
  return value;
}
async function walk(dir) { const result=[]; for (const entry of await readdir(join(root,dir),{withFileTypes:true})) { const p=join(dir,entry.name); if(entry.isDirectory())result.push(...await walk(p));else result.push(p); } return result; }
const sourceFiles = (await walk('src/content')).filter(p=>p.endsWith('.js'));
const sourceText = await Promise.all(sourceFiles.map(async p=>[p,await readFile(join(root,p),'utf8')]));
const cards = bundle.cards.map(raw => {
  const runtimeDefinition = registries.cards.get(raw.id);
  const sourceCandidates = sourceText.filter(([,text])=>text.includes(`'${raw.id}'`) || text.includes(`"${raw.id}"`)).map(([file])=>file);
  return { id:raw.id, name:runtimeDefinition.name, definition:raw, runtimeDefinition, source:sourceCandidates, combatProfile:combatProfileFor(runtimeDefinition), tags:runtimeDefinition.tags || [], costProfile:registries.framework.costProfile(runtimeDefinition), costProfileContext:'Static registry definition via registries.framework.costProfile(def), same authority as card presentation without preview; no player, equipment, power reductions, weight class, or live combat modifiers.', authoredTextTemplate:raw.textTemplate ?? null,
    face:{ context:'static definition only; no player, equipment, target or combat preview. Context-dependent numbers are not live predictions.', lines:cardFaceLines(runtimeDefinition,null,registries), summary:cardFaceSummary(runtimeDefinition,null,registries) },
    tagAssignments:bundle.tagging.filter(t=>t.family==='card' && t.objectId===raw.id),
    provenance:{ bundle:'src/content/index.js#contentBundle.cards', definitionCandidates:sourceCandidates, note:'Candidates are literal ID references; composition/registry transformations may add fields.' } };
});
const tables = {};
for(const file of (await walk('docs/tag-model/tables')).filter(p=>['docs/tag-model/tables/tags.csv','docs/tag-model/tables/objects.csv'].includes(p))) {
  const parsed=readTable(join(root,file));
  tables[relative('docs/tag-model/tables',file)]={source:file,columns:parsed.header,rows:parsed.rows.map(row=>Object.fromEntries(parsed.header.map((key,i)=>[key,row[i]])))};
}
const counts={cards:cards.length,tags:bundle.nodes.length,registeredTags:bundle.tags.length,nodes:bundle.nodes.length,rootNodes:bundle.nodes.filter(n=>!n.parentId).length,statuses:bundle.statuses.length,stances:bundle.stances.length,tagAssignments:bundle.tagging.length,historicalTags:tables['tags.csv'].rows.length,historicalObjects:tables['objects.csv'].rows.length};
for(const [name,rows] of Object.entries({cards,tags:bundle.tags,nodes:bundle.nodes,statuses:bundle.statuses,stances:bundle.stances})) {if(new Set(rows.map(x=>x.id)).size!==rows.length)throw new Error(`Duplicate IDs: ${name}`);}
const data={schemaVersion:1,provenance:{repository:root,sourceSha:sha,entrypoint:'src/content/index.js#contentBundle',exporter:'export-current.mjs',semantics:'Read-only snapshot of the composed runtime content bundle and registry card projection. Raw definitions are exact bundle objects, not original source literals.',serialization:'Present undefined values are represented by {$jsType:"undefined"}; missing properties remain absent.'},counts,cards,tags:bundle.nodes,registeredTags:bundle.tags,tagDomains:bundle.tagDomains,tagFamilies:bundle.tagFamilies,tagFamilyDomains:bundle.tagFamilyDomains,tagAssignments:bundle.tagging,statuses:bundle.statuses,stances:bundle.stances,treeTables:Object.fromEntries(['nodeRelations','familyNodes','nodeTerms','nodeVariables','variableBindings','nodeEffects','propertyRules'].map(k=>[k,bundle[k]])),tableProvenance:{nodes:'content/source/nodes.csv → src/content/generated/nodes.js',tags:'content/source/nodes.csv → src/content/generated/tags.js',tagAssignments:'content/source/tagging.csv → src/content/generated/tagging.js',statuses:'src/content/statuses.js',stances:'src/content/stances.js'},historicalProposal:{status:'NONRUNTIME PROPOSAL',warning:'Existing docs/tag-model proposal. README explicitly says nothing in the game reads these files. These tables are not the new proposal in this export folder.',source:'docs/tag-model/README.md',otherTableSources:(await walk('docs/tag-model/tables')).filter(p=>p.endsWith('.csv') && !['docs/tag-model/tables/tags.csv','docs/tag-model/tables/objects.csv'].includes(p)),tables}};
const encoded=lossless(data);
encoded.serializationUndefinedPaths=undefinedPaths;
await mkdir(out,{recursive:true});
await writeFile(join(out,'current-game.json'),JSON.stringify(encoded,null,2)+'\n');
const check=JSON.parse(await readFile(join(out,'current-game.json'),'utf8'));
if(check.cards.length!==registries.cards.size)throw new Error('Card registry count mismatch');
console.log(JSON.stringify({sourceSha:sha,counts,undefinedValues:undefinedPaths.length,path:join(out,'current-game.json')},null,2));
