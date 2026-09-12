import { configurablePseudocode } from './pseudocode-configuration.mjs';
import {baseReferenceMetadata,resolveSources} from './reference-metadata.mjs';
import {hudConfig} from './hud-reference.mjs';
import {progressionConfig,progressionSamples} from './progression-reference.mjs';
import {screenConfig,screenModels,confirmationModels,inspectorSample} from './screen-reference.mjs';
import {componentCompletions,componentCompletionDefaults} from './component-completion.mjs';
import {cardReferenceConfig,cardReferenceRegistry} from './card-reference.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
await import('./generate-portrait-references.mjs');
const source=fs.readFileSync(path.join(root,'wireframe.md'),'utf8');
const catalog=[...JSON.parse(fs.readFileSync(path.join(root,'component-wireframe-catalog.json'))),...JSON.parse(fs.readFileSync(path.join(root,'tooltip-wireframe-catalog.json'))),...JSON.parse(fs.readFileSync(path.join(root,'wireframe-catalog.json'))),...JSON.parse(fs.readFileSync(path.join(root,'card-wireframe-catalog.json')))];
const headings=[...source.matchAll(/^#{2,3} Wireframe (W\w+): (.+)$/gm)];
const data=catalog.map(entry=>{
 const index=headings.findIndex(h=>h[1]===entry.id);if(index<0)throw Error('Missing '+entry.id);
 const section=source.slice(headings[index].index,headings[index+1]?.index??source.length);
 const modes=[...section.matchAll(/\*\*(Wide|Compact|Portrait \/ iPhone SE \(3rd generation\)|Portrait \/ Galaxy S24)\*\*/g)];
 const views=modes.map((m,i)=>{const part=section.slice(m.index,modes[i+1]?.index??section.indexOf('**Language-agnostic pseudocode**'));const ascii=part.match(/```text\s*\n([\s\S]*?)```/)?.[1].trimEnd();const rows=part.split(/\r?\n/).filter(l=>l.startsWith('|')).map(l=>l.split('|').slice(1,-1).map(x=>x.trim().replaceAll('`',''))).filter(r=>!r[0].startsWith('---'));return {mode:['wide','compact','iphoneSE','galaxyS24'][i],ascii,rows};});
 if(views.length!==4||views.some(v=>!v.ascii||v.rows.length<2))throw Error('Incomplete '+entry.id);
 return {...entry,description:section.slice(section.indexOf('\n')+1,modes[0].index).trim(),views,pseudo:section.match(/\*\*Language-agnostic pseudocode\*\*\s*```text\s*\n([\s\S]*?)```/)?.[1]||''};
});
for(const entry of data){
 if(!entry.pseudo.startsWith('// Load'))entry.pseudo=configurablePseudocode(entry.pseudo);
 Object.assign(entry,baseReferenceMetadata(entry));
 if(entry.id.startsWith('WC4')){
  const shared=JSON.parse(fs.readFileSync(path.join(root,'pseudocode-config.json'),'utf8'));
  entry.defaults={combatant:shared.combatant,interaction:shared.interaction,geometry:{presentation:'borderless combatant assembly',artwork:'preserve intrinsic ratio; sprite receives remaining height'}};
 }
 const completion=componentCompletions[entry.id];
 if(completion)Object.assign(entry,{model:completion.model,children:completion.children,defaults:componentCompletionDefaults,references:resolveSources(completion.sourceReferences),referenceStatus:completion.sourceDescription,implementation:{renderer:'renderCompletedComponent',source:['component-completion-client.js','component-completion.mjs','button-widths.mjs'],styles:['component-completion.css']}});
 if(cardReferenceRegistry[entry.id]){if(!entry.id.startsWith('WC4'))entry.defaults={...entry.defaults,...cardReferenceConfig};entry.model={...entry.model,registryRecord:cardReferenceRegistry[entry.id]};entry.implementation.source.push('card-reference-client.js','card-reference.mjs');if(!entry.id.startsWith('WC4'))for(const view of entry.views){const frame=view.rows.find(row=>row[0]===entry.id+'.frame');if(frame){frame[1]=`clamp(${cardReferenceConfig.geometry.widthMinimum}, ${cardReferenceConfig.geometry.widthPreferred}, ${cardReferenceConfig.geometry.widthMaximum})`;frame[2]='resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth';}}}
 if(['W4','W4a','W4b','W4c'].includes(entry.id)){entry.implementation={renderer:'gameplayPreview',source:['wireframe-gallery-template.html','component-completion-client.js','hud-reference-client.js','scene-reference-client.js'],styles:['wireframe-gallery-template.html#style','component-completion.css','scene-reference.css']};entry.defaults={scene:JSON.parse(fs.readFileSync(path.join(root,'gameplay-config.json')))[entry.id==='W4'?'W4a':entry.id],hud:hudConfig};entry.children=entry.defaults.scene.components;entry.model={context:entry.id,scene:entry.defaults.scene};entry.references=resolveSources(['src/ui/screens/combat.js','src/ui/screens/map.js','src/ui/screens/event.js']);}
}
const template=fs.readFileSync(path.join(root,'wireframe-gallery-template.html'),'utf8');
const clients=['hud-reference-client.js','progression-reference-client.js','component-completion-client.js','screen-reference-client.js','card-reference-client.js','reference-browser-audit.js','scene-reference-client.js'];
const styles=['screen-reference.css','progression-reference.css','component-completion.css','scene-reference.css'];
const serialized=value=>JSON.stringify(value).replaceAll('<','\\u003c');
const globals=`const HUD_REFERENCE_CONFIG=${serialized(hudConfig)};window.PROGRESSION_CONFIG=${serialized(progressionConfig)};window.PROGRESSION_SAMPLES=${serialized(progressionSamples)};const REFERENCE_SCREENS=${serialized({models:screenModels,confirmations:confirmationModels,inspector:inspectorSample,config:screenConfig})};globalThis.COMPONENT_COMPLETION_DEFAULTS=${serialized(componentCompletionDefaults)};globalThis.COMPONENT_COMPLETIONS=${serialized(componentCompletions)};const CARD_REFERENCE=${serialized({config:cardReferenceConfig,registry:cardReferenceRegistry})};`;
const geometry=cardReferenceConfig.geometry;
const cardTokens=`:root{--card-ratio:${geometry.ratioWidth} / ${geometry.ratioHeight};--card-max:${geometry.widthMaximum};--card-min:${geometry.widthMinimum};--card-preferred:${geometry.widthPreferred}}.preview-tabpanel>.cardhost:not(.combatant-host){width:clamp(var(--card-min),var(--card-preferred),var(--card-max))}.cardhost:not(.combatant-host)>.cardbox{grid-template-rows:${Object.values(geometry.bands).map(value=>'minmax(0,'+value+'fr)').join(' ')}}`;
const textFiles=[...new Set(data.flatMap(d=>[...d.implementation.source,...d.implementation.styles]).map(s=>s.split('#')[0]))];
const sourceTexts=Object.fromEntries(textFiles.map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]));
fs.writeFileSync(path.join(root,'wireframe-gallery.html'),template.replace('/*GAMEPLAY*/',fs.readFileSync(path.join(root,'gameplay-config.json'),'utf8')).replace('/*CONFIG*/',serialized(JSON.parse(fs.readFileSync(path.join(root,'pseudocode-config.json'),'utf8')))).replace('/*DATA*/',serialized(data)).replace('/*REFERENCE_CLIENTS*/',globals+'\nconst REFERENCE_SOURCE_TEXT='+serialized(sourceTexts)+';\n'+clients.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n')).replace('/*REFERENCE_STYLES*/',styles.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n')+'\n'+cardTokens));
fs.writeFileSync(path.join(root,'reference-coverage.json'),JSON.stringify(data.map(({id,children,implementation,references,defaults})=>({id,children,implementation,references:references.map(({excerpt,...ref})=>ref),defaults})),null,2));
// Keep the Markdown handoff and HTML backed by the same model and source bindings.
const cleanSource=source.replace(/\n<!-- reference-metadata:start -->[\s\S]*?<!-- reference-metadata:end -->\n/g,'\n');
const enriched=cleanSource.replace(/(^#{2,3} Wireframe (W\w+):[^\n]*\n)([\s\S]*?)(?=^#{2,3} Wireframe W\w+:|$(?![\s\S]))/gm,(whole,heading,id,body)=>{
 const entry=data.find(item=>item.id===id);if(!entry)return whole;
 const links=entry.children.map(child=>`[${child}](wireframe-gallery.html#${child})`).join(', ')||'Leaf component; no nested component.';
 const refs=entry.references.map(ref=>ref.url?`- [${ref.file}${ref.line?':'+ref.line:''}](${ref.url}) — ${ref.sourceSnapshot||ref.status||'reference'}`:`- ${ref.description||ref.status}`).join('\n');
 const files=entry.implementation.source.map(file=>`[${file}](${file})`).join(', ');
 return heading+body+'\n<!-- reference-metadata:start -->\n**Source description and inheritance**\n\n'+entry.referenceStatus+'\n\n'+refs+'\n\n**Referenced components:** '+links+'\n\n**Actual reference code:** '+files+'\n\nRenderer binding: `'+entry.implementation.renderer+'`. The HTML “Component composition” tab executes this implementation with the model below. Production source excerpts are references, not scripts embedded into the game.\n\n**Styles:** '+entry.implementation.styles.map(file=>`[${file}](${file})`).join(', ')+'\n\n<details><summary>Model JSON</summary>\n\n```json\n'+JSON.stringify(entry.model,null,2)+'\n```\n\n</details>\n\n<details><summary>Configuration defaults JSON</summary>\n\n```json\n'+JSON.stringify(entry.defaults,null,2)+'\n```\n\n</details>\n<!-- reference-metadata:end -->\n';
});
fs.writeFileSync(path.join(root,'wireframe.md'),enriched);
fs.writeFileSync(path.join(root,'reference-defaults.json'),JSON.stringify({screens:screenConfig,hud:hudConfig,cards:cardReferenceConfig,components:componentCompletionDefaults,progression:progressionConfig},null,2));
console.log(`Built ${data.length} wireframes / ${data.reduce((n,d)=>n+d.views.length,0)} views, with positioning tables and pseudocode.`);
